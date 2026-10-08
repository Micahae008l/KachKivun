import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  ReceiptText,
  XCircle,
} from "lucide-react";
import { getPaymentOrder, getPaymentReturnStatus, type PaymentOrderDto } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";
import { getToken } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { PENDING_PAYMENT_RETURN_KEY } from "@/lib/payment-offer";

type ReturnSearch = {
  order?: string;
  token?: string;
  flow?: "account" | "parent";
  interrupted: boolean;
};

const POLL_DELAYS_MS = [0, 800, 1_400, 2_300, 3_700, 6_000, 10_000, 15_000] as const;
const TERMINAL_STATUSES = new Set<PaymentOrderDto["status"]>([
  "paid",
  "failed",
  "refunded",
  "expired",
]);

export const Route = createFileRoute("/payment/return")({
  validateSearch: (raw: Record<string, unknown>): ReturnSearch => ({
    order:
      typeof raw.order === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.order)
        ? raw.order
        : undefined,
    token:
      typeof raw.token === "string" &&
      raw.token.length >= 32 &&
      raw.token.length <= 256 &&
      /^[A-Za-z0-9_-]+$/.test(raw.token)
        ? raw.token
        : undefined,
    flow: raw.flow === "parent" || raw.flow === "account" ? raw.flow : undefined,
    interrupted: raw.interrupted === "1",
  }),
  component: PaymentReturnPage,
  head: () => ({
    meta: [{ title: "בדיקת תשלום | קח כיוון" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function PaymentReturnPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<PaymentOrderDto | null>(null);
  const [checking, setChecking] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [hasSuccessfulPoll, setHasSuccessfulPoll] = useState(false);
  const [error, setError] = useState("");
  const [autoReturnSeconds, setAutoReturnSeconds] = useState(5);
  const terminalEventTracked = useRef<PaymentOrderDto["status"] | null>(null);
  const isParentFlow = search.flow === "parent";
  const isAuthenticatedAccountFlow =
    !isParentFlow && search.flow !== "parent" && Boolean(getToken());

  useEffect(() => {
    if (!search.order) {
      try {
        const saved = JSON.parse(localStorage.getItem(PENDING_PAYMENT_RETURN_KEY) || "null") as {
          returnPath?: unknown;
        } | null;
        if (
          typeof saved?.returnPath === "string" &&
          saved.returnPath.startsWith("/payment/return?")
        ) {
          window.location.replace(saved.returnPath);
          return;
        }
      } catch {
        // fall through to the missing-link message
      }
    }
    setMounted(true);
  }, [search.order]);

  useEffect(() => {
    if (!mounted || !search.order) {
      if (mounted) setChecking(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function wait(delay: number) {
      if (!delay) return;
      await new Promise<void>((resolve) => {
        timer = setTimeout(resolve, delay);
      });
    }

    async function poll() {
      setChecking(true);
      setTimedOut(false);
      setHasSuccessfulPoll(false);
      setError("");
      let anyPollSucceeded = false;
      let lastRequestError: unknown = null;

      for (const delay of POLL_DELAYS_MS) {
        await wait(delay);
        if (cancelled) return;
        try {
          const response = search.token
            ? await getPaymentReturnStatus(search.order as string, search.token)
            : getToken()
              ? await getPaymentOrder(search.order as string)
              : null;
          if (!response) {
            setError("יש להתחבר לחשבון כדי לבדוק את ההזמנה.");
            setChecking(false);
            return;
          }
          if (cancelled) return;
          anyPollSucceeded = true;
          setHasSuccessfulPoll(true);
          setOrder(response.order);

          if (TERMINAL_STATUSES.has(response.order.status)) {
            try {
              localStorage.removeItem(PENDING_PAYMENT_RETURN_KEY);
            } catch {
              // storage unavailable
            }
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
              queryClient.invalidateQueries({ queryKey: ["match-history"] }),
              queryClient.invalidateQueries({ queryKey: ["recommendation"] }),
              queryClient.invalidateQueries({ queryKey: ["payment-offer"] }),
              queryClient.invalidateQueries({ queryKey: ["payment-orders"] }),
            ]);
            if (!cancelled) setChecking(false);
            return;
          }
        } catch (requestError) {
          if (cancelled) return;
          lastRequestError = requestError;
          const message = getErrorMessage(requestError, "לא הצלחנו לאמת את מצב התשלום");
          if (/אינו תקין|לא נמצאה|not found/i.test(message)) {
            setError(message);
            setChecking(false);
            return;
          }
        }
      }

      if (!cancelled) {
        setChecking(false);
        if (anyPollSucceeded) {
          setTimedOut(true);
        } else {
          setError(
            getErrorMessage(
              lastRequestError,
              "לא הצלחנו להתחבר לשרת ולא ניתן לאמת את מצב התשלום כרגע.",
            ),
          );
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mounted, queryClient, search.order, search.token]);

  useEffect(() => {
    if (order?.status !== "paid" || !isAuthenticatedAccountFlow) return;
    setAutoReturnSeconds(5);
    const interval = window.setInterval(() => {
      setAutoReturnSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    const timeout = window.setTimeout(() => {
      navigate({ to: "/ai-counselor", replace: true });
    }, 5_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [isAuthenticatedAccountFlow, navigate, order?.status]);

  useEffect(() => {
    if (!order || terminalEventTracked.current === order.status) return;
    if (order.status === "paid") trackEvent("payment_confirmed");
    else if (order.status === "refunded") trackEvent("payment_refunded");
    else if (order.status === "failed" || order.status === "expired") {
      trackEvent("payment_failed", { stage: "return" });
    } else {
      return;
    }
    terminalEventTracked.current = order.status;
  }, [order]);

  if (!mounted || checking) {
    return (
      <ReturnShell>
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" aria-hidden />
        <h1 className="mt-5 text-2xl font-black text-foreground">בודקים מול השרת</h1>
        <p className="mt-3 text-sm leading-6 text-dust" aria-live="polite">
          {search.interrupted
            ? "החזרה מספק התשלום נקטעה. בודקים אם תשלום נקלט לפני שמציגים תוצאה."
            : "לא מסתמכים על הודעת ההפניה. ממתינים לאישור המאומת של ההזמנה."}
        </p>
      </ReturnShell>
    );
  }

  if (!search.order) {
    return (
      <ReturnShell>
        <XCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
        <h1 className="mt-5 text-2xl font-black text-foreground">קישור החזרה חסר</h1>
        <p className="mt-3 text-sm text-dust">לא נמצא מזהה הזמנה תקין בקישור.</p>
        {isParentFlow ? <BackToSite /> : <BackToCounselor />}
        <Link
          to="/cancellation"
          className="mt-6 mr-3 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          ביטול עסקה והחזרים
        </Link>
      </ReturnShell>
    );
  }

  if (error) {
    return (
      <ReturnShell>
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-300" aria-hidden />
        <h1 className="mt-5 text-2xl font-black text-foreground">לא ניתן לאמת את ההזמנה</h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-dust">
          {error}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-md border border-primary/45 px-5 py-2.5 text-sm font-bold text-primary"
        >
          בדיקה מחדש
        </button>
        {isParentFlow ? <BackToSite /> : <BackToCounselor />}
      </ReturnShell>
    );
  }

  if (order?.status === "paid") {
    return (
      <ReturnShell>
        <CheckCircle2 className="mx-auto h-11 w-11 text-primary" aria-hidden />
        <p className="mt-4 font-mono text-[10px] tracking-widest text-primary uppercase">
          התשלום אושר בשרת
        </p>
        <h1 className="mt-2 text-2xl font-black text-foreground">
          {isParentFlow ? "התשלום הושלם בהצלחה" : "מקומות 2 ו־1 פתוחים עכשיו"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-dust">
          {isParentFlow
            ? "הגישה נשמרה בחשבון של מקבל/ת הקישור. אפשר להעביר להם שהתשלום אושר ולסגור את העמוד."
            : "הגישה נשמרה בחשבון לצמיתות. היועץ יטען מחדש את כל חמש ההתאמות."}
        </p>
        {order.invoice ? (
          <a
            href={order.invoice.url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <ReceiptText className="h-4 w-4" aria-hidden />
            צפייה בקבלה {order.invoice.number}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
        {isAuthenticatedAccountFlow ? (
          <>
            <p className="mt-5 text-sm text-dust" aria-live="polite">
              חוזרים ליועץ בעוד {autoReturnSeconds} שניות.
            </p>
            <BackToCounselor primary />
          </>
        ) : isParentFlow ? (
          <BackToSite />
        ) : (
          <BackToCounselor primary />
        )}
      </ReturnShell>
    );
  }

  if (order?.status === "refunded") {
    return (
      <ReturnShell>
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden />
        <h1 className="mt-5 text-2xl font-black text-foreground">הזיכוי אושר</h1>
        <p className="mt-3 text-sm leading-6 text-dust">
          הגישה בתשלום בוטלה בהתאם לזיכוי שנקלט בשרת.
        </p>
        {order.refundReceipt ? (
          <a
            href={order.refundReceipt.url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <ReceiptText className="h-4 w-4" aria-hidden />
            צפייה באישור הזיכוי
          </a>
        ) : null}
        {isParentFlow ? <BackToSite /> : <BackToCounselor />}
      </ReturnShell>
    );
  }

  if (order?.status === "failed" || order?.status === "expired") {
    return (
      <ReturnShell>
        <XCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
        <h1 className="mt-5 text-2xl font-black text-foreground">
          {order.status === "expired" ? "התשלום בוטל או פג" : "התשלום לא אושר"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-dust">
          {isParentFlow
            ? "לא נפתחה גישה. בקשו מבעל/ת החשבון ליצור קישור תשלום חדש אם עדיין רוצים לנסות."
            : "לא נפתחה גישה ולא הסתמכנו על טקסט ההפניה. אפשר לחזור לקופה ולנסות שוב."}
        </p>
        {isParentFlow ? (
          <BackToSite />
        ) : (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/checkout"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              חזרה לקופה
            </Link>
            <BackToCounselor />
          </div>
        )}
      </ReturnShell>
    );
  }

  return (
    <ReturnShell>
      <Clock3 className="mx-auto h-10 w-10 text-amber-300" aria-hidden />
      <h1 className="mt-5 text-2xl font-black text-foreground">
        {timedOut && hasSuccessfulPoll ? "האישור עדיין בטיפול" : "מצב התשלום עדיין לא סופי"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-dust">
        {isParentFlow
          ? "השרת אישר שההזמנה קיימת, אבל מצב התשלום עדיין לא סופי. אל תנסו לשלם שוב; אפשר לרענן בעוד רגע או לסגור את העמוד ולעדכן את מקבל/ת הקישור."
          : "השרת אישר שההזמנה קיימת, אבל מצב התשלום עדיין לא סופי. אל תנסו לשלם שוב; אפשר לרענן את העמוד בעוד רגע ולבדוק מאוחר יותר."}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 rounded-md border border-primary/45 px-5 py-2.5 text-sm font-bold text-primary"
      >
        בדיקה מחדש
      </button>
      {isParentFlow ? <BackToSite /> : <BackToCounselor />}
    </ReturnShell>
  );
}

function ReturnShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-12" dir="rtl">
      <section className="w-full border border-iron/30 bg-card p-7 text-center sm:p-10">
        {children}
      </section>
    </div>
  );
}

function BackToCounselor({ primary = false }: { primary?: boolean }) {
  return (
    <Link
      to="/ai-counselor"
      className={`mt-6 inline-flex rounded-md px-5 py-2.5 text-sm font-bold ${
        primary
          ? "bg-primary text-primary-foreground"
          : "border border-iron/40 text-dust hover:border-primary/45 hover:text-foreground"
      }`}
    >
      חזרה ליועץ
    </Link>
  );
}

function BackToSite() {
  return (
    <Link
      to="/"
      className="mt-6 inline-flex rounded-md border border-iron/40 px-5 py-2.5 text-sm font-bold text-dust hover:border-primary/45 hover:text-foreground"
    >
      חזרה לאתר
    </Link>
  );
}
