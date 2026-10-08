import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  LockKeyhole,
  Share2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/FormField";
import {
  checkoutParentPaymentShare,
  confirmMockPayment,
  confirmMockReturnPayment,
  createParentPaymentShare,
  createPaymentCheckout,
  getParentPaymentShare,
  getPaymentOffer,
  type PaymentMethod,
  type PaymentMerchant,
  type PaymentOrderDto,
  type PaymentOffer,
  type PaymentProduct,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";
import { getToken } from "@/lib/auth";
import { rememberAuthReturnTarget } from "@/lib/auth-return";
import { categorizeCheckoutBrowser, trackEvent } from "@/lib/analytics";
import { formatPaymentPrice, PENDING_PAYMENT_RETURN_KEY } from "@/lib/payment-offer";

type Props = {
  shareToken?: string;
};

type CheckoutInfo = {
  product: PaymentProduct;
  paymentMethods: PaymentMethod[];
  available?: boolean;
  status?: PaymentOrderDto["status"];
  expiresAt?: string;
  processor?: "Grow" | "Mock (development only)";
  receiptsProvided?: boolean;
  hostedPayerDetails?: boolean;
  merchant?: PaymentMerchant;
};

function rememberPaymentReturn(order: PaymentOrderDto, flow: "account" | "parent") {
  let returnPath = `/payment/return?order=${encodeURIComponent(order.id)}&flow=${flow}`;
  if (order.returnUrl) {
    try {
      const url = new URL(order.returnUrl);
      returnPath = `${url.pathname}${url.search}`;
    } catch {
      // keep the authenticated fallback path
    }
  }
  try {
    localStorage.setItem(
      PENDING_PAYMENT_RETURN_KEY,
      JSON.stringify({ returnPath, savedAt: Date.now() }),
    );
  } catch {
    // storage can be unavailable in private or in-app browsers
  }
  return returnPath;
}

const METHOD_LABELS: Record<PaymentMethod, { title: string; detail: string }> = {
  apple_pay: { title: "Apple Pay", detail: "אם זמין במכשיר ובדפדפן" },
  bit: { title: "Bit", detail: "מעבר מאובטח לאפליקציה או לעמוד התשלום" },
  google_pay: { title: "Google Pay", detail: "אם זמין במכשיר ובדפדפן" },
  card: { title: "כרטיס אשראי", detail: "תשלום חד־פעמי מאובטח" },
};

function createIdempotencyKey() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isCommonInAppBrowser(userAgent: string) {
  return /(Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|musical_ly|BytedanceWebview)/i.test(
    userAgent,
  );
}

function browserCanMakeApplePayPayment(): boolean {
  if (typeof window === "undefined") return false;
  const ApplePaySession = (
    window as Window & {
      ApplePaySession?: { canMakePayments?: () => boolean };
    }
  ).ApplePaySession;
  try {
    return ApplePaySession?.canMakePayments?.() === true;
  } catch {
    return false;
  }
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed");
}

export function CheckoutPage({ shareToken }: Props) {
  const navigate = useNavigate();
  const idempotencyKey = useRef("");
  const checkoutTracked = useRef(false);
  const offerFailureTracked = useRef(false);
  if (!idempotencyKey.current && typeof window !== "undefined") {
    idempotencyKey.current = createIdempotencyKey();
  }

  const [mounted, setMounted] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mockConfirming, setMockConfirming] = useState(false);
  const [order, setOrder] = useState<PaymentOrderDto | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [applePayCapable, setApplePayCapable] = useState(false);
  const [returnPath, setReturnPath] = useState("");

  const isSharedCheckout = Boolean(shareToken);
  const token = mounted ? getToken() : null;
  const currentUrl = mounted ? window.location.href : "";
  const inAppBrowser = mounted && isCommonInAppBrowser(navigator.userAgent);

  useEffect(() => {
    setMounted(true);
    setApplePayCapable(browserCanMakeApplePayPayment());
  }, []);

  const offerQuery = useQuery<PaymentOffer>({
    queryKey: ["payment-offer"],
    queryFn: getPaymentOffer,
    enabled: mounted,
    retry: 1,
    staleTime: 60_000,
  });

  const shareQuery = useQuery<CheckoutInfo>({
    queryKey: ["payment-share", shareToken],
    queryFn: () => getParentPaymentShare(shareToken as string),
    enabled: mounted && isSharedCheckout && offerQuery.data?.enabled === true,
    retry: 1,
    staleTime: 60_000,
  });

  const offer = offerQuery.data;
  const info: CheckoutInfo | undefined = isSharedCheckout ? shareQuery.data : offer;
  const infoPending =
    offerQuery.isPending || (offer?.enabled === true && isSharedCheckout && shareQuery.isPending);
  const infoError =
    offerQuery.error ?? (isSharedCheckout && offer?.enabled ? shareQuery.error : null);

  useEffect(() => {
    if (mounted && offer?.enabled && !isSharedCheckout && !token) {
      rememberAuthReturnTarget("/checkout");
      navigate({ to: "/post-signup", hash: "login", replace: true });
    }
  }, [isSharedCheckout, mounted, navigate, offer?.enabled, token]);

  const hosted = Boolean(info?.hostedPayerDetails);
  const configuredMethods = useMemo(() => info?.paymentMethods ?? [], [info?.paymentMethods]);
  const methods = useMemo(
    () =>
      configuredMethods.filter(
        (configuredMethod) => configuredMethod !== "apple_pay" || applePayCapable,
      ),
    [applePayCapable, configuredMethods],
  );

  useEffect(() => {
    if (!mounted || !offer?.enabled || !info || checkoutTracked.current) return;
    checkoutTracked.current = true;
    trackEvent("checkout_started", {
      flow: isSharedCheckout ? "shared" : "account",
      browser: categorizeCheckoutBrowser(navigator.userAgent),
    });
  }, [info, isSharedCheckout, mounted, offer?.enabled]);

  useEffect(() => {
    if (!infoError || offerFailureTracked.current) return;
    offerFailureTracked.current = true;
    trackEvent("payment_failed", { stage: "checkout" });
  }, [infoError]);

  useEffect(() => {
    if (!methods.length) {
      setMethod(null);
      return;
    }
    setMethod((current) => (current && methods.includes(current) ? current : methods[0]));
  }, [methods]);

  function validate() {
    const errors: Record<string, string> = {};
    if (!hosted) {
      if (fullName.trim().split(/\s+/).filter(Boolean).length < 2) {
        errors.fullName = "נא להזין שם מלא הכולל לפחות שתי מילים";
      }
      const digits = phone.replace(/\D/g, "");
      if (!/^(?:05\d{8}|9725\d{8}|009725\d{8})$/.test(digits)) {
        errors.phone = "נא להזין מספר נייד ישראלי תקין";
      }
      if (!method) errors.method = "בחרו אמצעי תשלום זמין";
    }
    if (!termsAccepted) errors.terms = "יש לאשר את תנאי השימוש ומדיניות הביטול";
    if (!adultConfirmed) errors.adult = "יש לאשר שהמשלם או המשלמת בגירים";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    if (!validate() || (!hosted && !method) || !info || !offer?.enabled) return;

    setSubmitting(true);
    if (method && !hosted) trackEvent("payment_method_selected", { method });
    try {
      const confirmations = {
        termsAndCancellationAccepted: true,
        adultPayerConfirmed: true,
      } as const;
      const payload = hosted
        ? { confirmations }
        : {
            payer: { fullName: fullName.trim(), phone: phone.trim() },
            paymentMethod: method ?? undefined,
            confirmations,
          };
      const response = isSharedCheckout
        ? await checkoutParentPaymentShare(shareToken as string, payload)
        : await createPaymentCheckout({
            ...payload,
            idempotencyKey: idempotencyKey.current,
            productKey: info.product.productKey,
          });
      setOrder(response.order);

      if (response.order.requiresMockConfirmation) return;
      if (response.order.claimCode) {
        setReturnPath(
          rememberPaymentReturn(response.order, isSharedCheckout ? "parent" : "account"),
        );
        return;
      }
      if (!response.order.checkoutUrl) {
        throw new Error("ספק התשלום לא החזיר כתובת מאובטחת להמשך.");
      }
      window.location.assign(response.order.checkoutUrl);
    } catch (error) {
      trackEvent("payment_failed", { stage: "checkout" });
      const message = getErrorMessage(error, "לא הצלחנו לפתוח את התשלום");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDevelopmentPayment() {
    if (!import.meta.env.DEV || !order?.requiresMockConfirmation || !order.checkoutUrl) return;
    setMockConfirming(true);
    setSubmitError("");
    try {
      if (isSharedCheckout) {
        const returnUrl = new URL(order.checkoutUrl);
        const returnToken = returnUrl.searchParams.get("token");
        if (!returnToken) throw new Error("חסר אסימון חזרה לתשלום הפיתוח.");
        await confirmMockReturnPayment(order.id, returnToken);
      } else {
        await confirmMockPayment(order.id);
      }
      window.location.assign(order.checkoutUrl);
    } catch (error) {
      trackEvent("payment_failed", { stage: "checkout" });
      const message = getErrorMessage(error, "אישור תשלום הפיתוח נכשל");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setMockConfirming(false);
    }
  }

  async function createShareLink() {
    setSharing(true);
    setSubmitError("");
    try {
      const response = await createParentPaymentShare();
      setShareUrl(response.shareUrl);
      try {
        await copyText(response.shareUrl);
        toast.success("קישור התשלום הועתק");
      } catch {
        toast.success("קישור התשלום נוצר. אפשר להעתיק אותו מהשדה");
      }
    } catch (error) {
      const message = getErrorMessage(error, "לא הצלחנו ליצור קישור לתשלום");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSharing(false);
    }
  }

  async function copyCheckoutLink(value: string) {
    try {
      await copyText(value);
      toast.success("הקישור הועתק");
    } catch {
      toast.error("לא הצלחנו להעתיק. אפשר לסמן את הקישור ולהעתיק ידנית");
    }
  }

  if (!mounted || offerQuery.isPending) {
    return <CheckoutLoading />;
  }

  if (offerQuery.isError || !offer) {
    return (
      <CheckoutMessage
        title="לא ניתן לטעון את הצעת התשלום"
        body={getErrorMessage(offerQuery.error, "נסו לרענן את העמוד או לחזור לאתר.")}
        shared={isSharedCheckout}
      />
    );
  }

  if (!offer.enabled) {
    return (
      <CheckoutMessage
        title="התשלום אינו זמין כרגע"
        body="בתקופת הבטא כל חמש ההתאמות פתוחות בחינם, ולכן אין צורך ואין אפשרות לבצע חיוב."
        shared={isSharedCheckout}
      />
    );
  }

  if (!isSharedCheckout && !token) return <CheckoutLoading />;
  if (infoPending) return <CheckoutLoading />;

  if (infoError || !info) {
    return (
      <CheckoutMessage
        title="לא ניתן לטעון את פרטי התשלום"
        body={getErrorMessage(infoError, "נסו לרענן את העמוד או לחזור לאתר.")}
        shared={isSharedCheckout}
      />
    );
  }

  if (isSharedCheckout && info.available === false) {
    const paid = info.status === "paid";
    return (
      <CheckoutMessage
        title={paid ? "התשלום כבר הושלם" : "הקישור אינו זמין עוד"}
        body={
          paid
            ? "שתי ההתאמות המובילות כבר נפתחו בחשבון שאליו נשלח הקישור."
            : "ייתכן שהקישור כבר שימש, בוטל או פג תוקפו."
        }
        shared
      />
    );
  }

  const price = formatPaymentPrice(info.product);
  const merchant = info.merchant ?? {};
  const hasMerchantDetails = Boolean(
    merchant.legalName || merchant.phone || merchant.address || merchant.contactEmail,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12" dir="rtl">
      <div className="border border-iron/30 bg-card">
        <header className="border-b border-iron/25 px-5 py-6 text-right sm:px-8">
          <p className="font-mono text-[10px] tracking-widest text-primary uppercase">
            תשלום מאובטח
          </p>
          <h1 className="mt-2 text-2xl font-black text-foreground">פתיחת מקומות 2 ו־1</h1>
          <p className="mt-2 text-sm leading-6 text-dust">
            גישה קבועה לשתי ההתאמות המובילות בחשבון, כולל חישובים מחדש בעתיד. תשלום חד־פעמי, ללא
            מנוי וללא חיובים חוזרים.
          </p>
        </header>

        {inAppBrowser ? (
          <section
            className="m-5 border border-amber-500/40 bg-amber-500/10 p-4 text-right sm:m-8"
            aria-labelledby="in-app-browser-heading"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 id="in-app-browser-heading" className="font-bold text-foreground">
                  פתחו את הקישור ב־Safari או Chrome
                </h2>
                <p className="mt-1 text-sm leading-6 text-dust">
                  הדפדפן הפנימי של Instagram, Facebook או TikTok עלול לא לתמוך בארנק דיגיטלי. העתיקו
                  את הקישור ופתחו אותו בדפדפן. אפשר גם לבחור Bit או כרטיס אשראי אם הם זמינים.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={currentUrl}
                    readOnly
                    dir="ltr"
                    aria-label="קישור לעמוד התשלום"
                    className="input-field min-w-0 flex-1 text-left text-xs"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => void copyCheckoutLink(currentUrl)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-iron/40 px-3 text-xs font-semibold text-foreground hover:border-primary/50"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    העתקה
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="border-b border-iron/25 bg-background/30 p-5 text-right lg:border-b-0 lg:border-l lg:p-8">
            <p className="text-sm font-semibold text-foreground">{info.product.displayName}</p>
            <div className="mt-4 flex items-end justify-between gap-4 border-y border-iron/20 py-4">
              <span className="text-sm text-dust">מחיר סופי</span>
              <strong className="font-mono text-3xl font-black tabular-nums text-primary" dir="ltr">
                {price}
              </strong>
            </div>
            <p className="mt-2 text-xs leading-5 text-dust">המחיר כולל מע״מ ככל שחל.</p>
            <ul className="mt-5 space-y-3 text-sm text-dust">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                תשלום חד־פעמי
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                פתיחה קבועה בחשבון
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                ללא מנוי
              </li>
            </ul>
            <div className="mt-5 border-t border-iron/20 pt-4 text-xs leading-5 text-dust">
              {info.processor ? (
                <p>
                  עיבוד התשלום והפקת הקבלה:{" "}
                  <strong className="text-foreground">{info.processor}</strong>
                </p>
              ) : null}
              <p className="mt-1">פרטי כרטיס או ארנק אינם נשמרים בשרת של {`קח כיוון`}.</p>
              {hasMerchantDetails ? (
                <address className="mt-3 not-italic">
                  <p className="font-semibold text-foreground">פרטי מפעיל השירות</p>
                  {merchant.legalName ? <p>{merchant.legalName}</p> : null}
                  {merchant.address ? <p>{merchant.address}</p> : null}
                  {merchant.phone ? (
                    <p>
                      טלפון:{" "}
                      <a
                        href={`tel:${merchant.phone}`}
                        className="text-primary hover:underline"
                        dir="ltr"
                      >
                        {merchant.phone}
                      </a>
                    </p>
                  ) : null}
                  {merchant.contactEmail ? (
                    <p>
                      אימייל:{" "}
                      <a
                        href={`mailto:${merchant.contactEmail}`}
                        className="text-primary hover:underline"
                        dir="ltr"
                      >
                        {merchant.contactEmail}
                      </a>
                    </p>
                  ) : null}
                </address>
              ) : null}
              {merchant.cancellationUrl ? (
                <a
                  href={merchant.cancellationUrl}
                  className="mt-3 inline-flex font-semibold text-primary hover:underline"
                >
                  ביטול עסקה ובקשת החזר
                </a>
              ) : (
                <Link
                  to="/cancellation"
                  className="mt-3 inline-flex font-semibold text-primary hover:underline"
                >
                  ביטול עסקה ובקשת החזר
                </Link>
              )}
            </div>
            {isSharedCheckout && info.expiresAt ? (
              <p className="mt-5 text-xs text-dust/80">
                קישור התשלום תקף עד{" "}
                {new Date(info.expiresAt).toLocaleString("he-IL", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            ) : null}
          </aside>

          {order?.claimCode && order.checkoutUrl ? (
            <GrowLinkHandoff
              claimCode={order.claimCode}
              checkoutUrl={order.checkoutUrl}
              returnPath={returnPath || `/payment/return?order=${encodeURIComponent(order.id)}`}
              price={price}
              methods={methods}
              onCopy={copyCheckoutLink}
            />
          ) : (
            <form className="space-y-6 p-5 sm:p-8" onSubmit={submitCheckout} noValidate>
              {hosted ? (
                <div className="border border-iron/30 bg-background/30 p-4 text-right text-sm leading-6 text-dust">
                  <p className="font-semibold text-foreground">
                    התשלום מתבצע בעמוד המאובטח של Grow
                  </p>
                  <p className="mt-1">
                    אחרי האישור נציג לכם קוד הזמנה קצר. שם, נייד ואמצעי תשלום
                    {methods.length
                      ? ` (${methods.map((item) => METHOD_LABELS[item].title).join(" / ")})`
                      : ""}{" "}
                    ממלאים בעמוד של Grow.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="שם מלא של המשלם/ת" error={fieldErrors.fullName}>
                      <input
                        className="input-field"
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) => {
                          setFullName(event.target.value);
                          setFieldErrors((current) => ({ ...current, fullName: "" }));
                        }}
                      />
                    </FormField>
                    <FormField label="נייד ישראלי" error={fieldErrors.phone}>
                      <input
                        className="input-field"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        dir="ltr"
                        placeholder="050-000-0000"
                        value={phone}
                        onChange={(event) => {
                          setPhone(event.target.value);
                          setFieldErrors((current) => ({ ...current, phone: "" }));
                        }}
                      />
                    </FormField>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="mb-3 text-sm font-semibold text-foreground">
                      אמצעי תשלום
                    </legend>
                    {methods.map((item, index) => (
                      <label
                        key={item}
                        className={`flex cursor-pointer items-center gap-3 border px-4 py-3 transition-colors ${
                          method === item
                            ? "border-primary/60 bg-primary/10"
                            : "border-iron/30 hover:border-iron/55"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value={item}
                          checked={method === item}
                          onChange={() => {
                            setMethod(item);
                            setFieldErrors((current) => ({ ...current, method: "" }));
                          }}
                          className="accent-primary"
                        />
                        {index === 0 && item === "apple_pay" ? (
                          <Smartphone className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                        ) : (
                          <CreditCard className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-foreground">
                            {METHOD_LABELS[item].title}
                          </span>
                          <span className="block text-xs text-dust">
                            {METHOD_LABELS[item].detail}
                          </span>
                        </span>
                      </label>
                    ))}
                    {methods.length === 0 ? (
                      <p role="alert" className="text-sm text-destructive">
                        אין כרגע אמצעי תשלום זמינים. לא ניתן להמשיך לחיוב.
                      </p>
                    ) : null}
                    {fieldErrors.method ? (
                      <p role="alert" className="text-sm text-destructive">
                        {fieldErrors.method}
                      </p>
                    ) : null}
                  </fieldset>
                </>
              )}

              <div className="space-y-3 border-t border-iron/20 pt-5">
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-dust">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => {
                      setTermsAccepted(event.target.checked);
                      setFieldErrors((current) => ({ ...current, terms: "" }));
                    }}
                    className="mt-1 accent-primary"
                  />
                  <span>
                    קראתי ואני מאשר/ת את{" "}
                    <Link
                      to="/terms"
                      target="_blank"
                      className="font-semibold text-primary hover:underline"
                    >
                      תנאי השימוש ומדיניות הביטול
                    </Link>
                    {" ואת "}
                    <Link
                      to="/cancellation"
                      target="_blank"
                      className="font-semibold text-primary hover:underline"
                    >
                      דף הביטול וההחזר
                    </Link>
                    .
                  </span>
                </label>
                {fieldErrors.terms ? (
                  <p role="alert" className="text-sm text-destructive">
                    {fieldErrors.terms}
                  </p>
                ) : null}

                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-dust">
                  <input
                    type="checkbox"
                    checked={adultConfirmed}
                    onChange={(event) => {
                      setAdultConfirmed(event.target.checked);
                      setFieldErrors((current) => ({ ...current, adult: "" }));
                    }}
                    className="mt-1 accent-primary"
                  />
                  <span>אני מאשר/ת שהמשלם/ת בן/בת 18 ומעלה ומורשה לבצע את התשלום.</span>
                </label>
                {fieldErrors.adult ? (
                  <p role="alert" className="text-sm text-destructive">
                    {fieldErrors.adult}
                  </p>
                ) : null}
              </div>

              {submitError ? (
                <p
                  role="alert"
                  className="border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {submitError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  submitting || methods.length === 0 || Boolean(order?.requiresMockConfirmation)
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <LockKeyhole className="h-4 w-4" aria-hidden />
                )}
                {hosted ? `קבלת קוד הזמנה · ${price}` : `מעבר לתשלום מאובטח · ${price}`}
              </button>
              <p className="text-center text-xs leading-5 text-dust">
                {hosted
                  ? "פרטי כרטיס או ארנק מוזנים רק בעמוד של Grow ואינם עוברים לשרת שלנו."
                  : "לאחר הלחיצה תועברו בעמוד מלא לספק התשלום. פרטי כרטיס אינם עוברים לשרת שלנו."}
              </p>

              {order?.requiresMockConfirmation && import.meta.env.DEV ? (
                <div className="border border-amber-500/40 bg-amber-500/10 p-4 text-right">
                  <p className="font-mono text-[10px] font-bold tracking-widest text-amber-300 uppercase">
                    פיתוח בלבד · תשלום מדומה
                  </p>
                  <p className="mt-2 text-sm text-dust">
                    הכפתור הבא מאשר הזמנת Mock מקומית. הוא אינו מוצג בבניית production ואינו מבצע
                    חיוב.
                  </p>
                  <button
                    type="button"
                    disabled={mockConfirming}
                    onClick={() => void confirmDevelopmentPayment()}
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-400/50 px-4 py-2 text-sm font-bold text-amber-200 disabled:opacity-50"
                  >
                    {mockConfirming ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    אישור תשלום מדומה והמשך
                  </button>
                </div>
              ) : null}

              {!isSharedCheckout ? (
                <div className="border-t border-iron/20 pt-5">
                  <button
                    type="button"
                    disabled={sharing}
                    onClick={() => void createShareLink()}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    <Share2 className="h-4 w-4" aria-hidden />
                    יצירת קישור לתשלום על ידי הורה
                  </button>
                  {shareUrl ? (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={shareUrl}
                        readOnly
                        dir="ltr"
                        aria-label="קישור תשלום לשיתוף"
                        className="input-field min-w-0 flex-1 text-left text-xs"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <button
                        type="button"
                        onClick={() => void copyCheckoutLink(shareUrl)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-iron/40 px-3 text-xs font-semibold text-foreground hover:border-primary/50"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        העתקה
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function GrowLinkHandoff({
  claimCode,
  checkoutUrl,
  returnPath,
  price,
  methods,
  onCopy,
}: {
  claimCode: string;
  checkoutUrl: string;
  returnPath: string;
  price: string;
  methods: PaymentMethod[];
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <section className="space-y-6 p-5 text-right sm:p-8" aria-labelledby="grow-link-heading">
      <div>
        <p className="font-mono text-[10px] tracking-widest text-primary uppercase">שלב אחרון</p>
        <h2 id="grow-link-heading" className="mt-2 text-xl font-black text-foreground">
          קוד ההזמנה שלכם
        </h2>
      </div>

      <div className="flex items-center gap-3 border border-primary/50 bg-primary/10 p-4">
        <strong
          className="flex-1 font-mono text-3xl font-black tracking-[0.3em] text-primary"
          dir="ltr"
          aria-label={`קוד הזמנה ${claimCode.split("").join(" ")}`}
        >
          {claimCode}
        </strong>
        <button
          type="button"
          onClick={() => void onCopy(claimCode)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-iron/40 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/50"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          העתקה
        </button>
      </div>

      <ol className="list-decimal space-y-2 pr-5 text-sm leading-6 text-dust">
        <li>
          בעמוד התשלום של Grow הזינו את הקוד בשדה{" "}
          <strong className="text-foreground">קוד הזמנה</strong>.
        </li>
        <li>
          שלמו {price}
          {methods.length
            ? ` ב־${methods.map((item) => METHOD_LABELS[item].title).join(" / ")}`
            : ""}
          .
        </li>
        <li>אחרי התשלום חזרו לכאן. הפתיחה מתבצעת אוטומטית כשהאישור מ־Grow מגיע לשרת.</li>
      </ol>
      <p className="text-xs leading-5 text-dust">
        שכחתם את הקוד? אם תזינו ב־Grow את כתובת האימייל של החשבון, נזהה את התשלום גם בלעדיו.
      </p>

      <a
        href={checkoutUrl}
        onClick={() => {
          void navigator.clipboard?.writeText(claimCode).catch(() => undefined);
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-black text-primary-foreground transition hover:brightness-110"
      >
        <LockKeyhole className="h-4 w-4" aria-hidden />
        המשך לתשלום ב־Grow · {price}
      </a>
      <a
        href={returnPath}
        className="block text-center text-sm font-semibold text-primary hover:underline"
      >
        כבר שילמתי, בדיקת מצב התשלום
      </a>
    </section>
  );
}

function CheckoutLoading() {
  return (
    <div
      className="mx-auto flex min-h-[55vh] max-w-md items-center justify-center px-6"
      role="status"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <span className="mr-3 text-sm text-dust">טוען את פרטי התשלום מהשרת…</span>
    </div>
  );
}

function CheckoutMessage({
  title,
  body,
  shared = false,
}: {
  title: string;
  body: string;
  shared?: boolean;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center" dir="rtl">
      <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden />
      <h1 className="mt-4 text-2xl font-black text-foreground">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-dust">{body}</p>
      <Link
        to={shared ? "/" : "/ai-counselor"}
        className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
      >
        {shared ? "חזרה לאתר" : "חזרה ליועץ"}
      </Link>
    </div>
  );
}
