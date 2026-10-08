import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ExternalLink, Loader2, ReceiptText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { listPaymentOrders, refundPaymentOrder, type PaymentOrderDto } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";
import { trackEvent } from "@/lib/analytics";
import { getToken, subscribeAuth } from "@/lib/auth";
import { rememberAuthReturnTarget } from "@/lib/auth-return";
import { SITE_NAME_HE, SUPPORT_EMAIL } from "@/lib/brand";

const CONTACT_EMAIL = SUPPORT_EMAIL;

export const Route = createFileRoute("/cancellation")({
  component: CancellationPage,
  head: () => ({
    meta: [
      { title: `ביטול עסקה והחזרים | ${SITE_NAME_HE}` },
      {
        name: "description",
        content: "צפייה בתשלומים ובקבלות, בקשת ביטול או החזר, ומעקב אחר אישור הספק.",
      },
    ],
  }),
});

function CancellationPage() {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const currentToken = useSyncExternalStore(subscribeAuth, getToken, () => null);

  useEffect(() => setMounted(true), []);
  const token = mounted ? currentToken : null;
  const ordersQuery = useQuery({
    queryKey: ["payment-orders", token],
    queryFn: () => listPaymentOrders(),
    enabled: Boolean(token),
    retry: false,
    staleTime: 15_000,
  });

  async function submitRefund(order: PaymentOrderDto) {
    setSubmittingId(order.id);
    try {
      const response = await refundPaymentOrder(order.id);
      if (response.order.status === "refunded") {
        trackEvent("payment_refunded");
        toast.success("ההחזר אושר על ידי ספק התשלום");
      } else {
        toast.success("הבקשה נשלחה. הגישה נשארת פתוחה עד לאישור ההחזר");
      }
      setConfirmingId(null);
      await queryClient.invalidateQueries({ queryKey: ["payment-orders", token] });
    } catch (error) {
      toast.error(getErrorMessage(error, "לא הצלחנו לשלוח את בקשת ההחזר"));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="topo-lines min-h-[65vh]" dir="rtl">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="font-mono text-xs tracking-widest text-primary uppercase">שירות לקוחות</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">ביטול עסקה והחזרים</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-dust">
          כאן אפשר לראות תשלומים, קבלות ומצב החזר, ולבקש ביטול של רכישה חד־פעמית. בקשה אינה מבטלת
          גישה מיד: הזכאות בתשלום תבוטל רק לאחר שספק התשלום יאשר שההחזר הושלם.
        </p>

        <section className="mt-8 border border-iron/30 bg-card p-5 text-sm leading-6 text-dust">
          <h2 className="font-bold text-foreground">אפשר גם לפנות אלינו</h2>
          <p className="mt-2">
            <Link to="/contact" search={{ topic: "cancellation" }} className="font-semibold text-primary hover:underline">
              טופס פנייה בכתב
            </Link>{" "}
            (מקבלים תשובה למייל), או כתבו מהאימייל של החשבון אל{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-primary hover:underline"
              dir="ltr"
            >
              {CONTACT_EMAIL}
            </a>
            . פרטי המפעיל המלאים הנדרשים על פי דין מוצגים בקופה לפני חיוב.
          </p>
          <p className="mt-2">
            פרטי הזכאות לביטול או החזר כפופים לדין ולנסיבות העסקה. ראו גם את{" "}
            <Link to="/terms" className="text-primary hover:underline">
              תנאי השימוש
            </Link>
            .
          </p>
        </section>

        {!mounted ? (
          <Loading label="בודקים אם יש חשבון מחובר…" />
        ) : !token ? (
          <section className="mt-8 border border-primary/40 bg-primary/10 p-6 text-center">
            <h2 className="text-lg font-black text-foreground">התחברו כדי לראות את הרכישות</h2>
            <p className="mt-2 text-sm leading-6 text-dust">
              הכניסה מתבצעת באימייל ובקוד חד־פעמי. לאחר ההתחברות חזרו לעמוד זה.
            </p>
            <Link
              to="/post-signup"
              hash="login"
              onClick={() => rememberAuthReturnTarget("/cancellation")}
              className="mt-5 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              התחברות בקוד OTP
            </Link>
          </section>
        ) : ordersQuery.isPending ? (
          <Loading label="טוענים תשלומים וקבלות…" />
        ) : ordersQuery.isError ? (
          <section className="mt-8 border border-amber-500/35 bg-amber-500/10 p-5">
            <h2 className="font-bold text-foreground">לא ניתן לטעון כרגע את היסטוריית התשלומים</h2>
            <p role="alert" className="mt-2 text-sm leading-6 text-dust">
              {getErrorMessage(ordersQuery.error, "נסו שוב או פנו אלינו באימייל.")}
            </p>
          </section>
        ) : ordersQuery.data.orders.length === 0 ? (
          <section className="mt-8 border border-iron/30 bg-card p-6 text-center">
            <h2 className="font-bold text-foreground">לא נמצאו רכישות בחשבון</h2>
            <p className="mt-2 text-sm text-dust">
              אם שילמתם מחשבון אחר, התחברו אליו או פנו אלינו מהאימייל ששימש לרכישה.
            </p>
          </section>
        ) : (
          <section className="mt-8 space-y-4" aria-labelledby="payment-history-heading">
            <div className="flex items-center justify-between gap-4">
              <h2 id="payment-history-heading" className="text-xl font-black text-foreground">
                התשלומים שלכם
              </h2>
              <button
                type="button"
                onClick={() => void ordersQuery.refetch()}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                רענון מצב
              </button>
            </div>
            {ordersQuery.data.orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                confirming={confirmingId === order.id}
                submitting={submittingId === order.id}
                onStart={() => setConfirmingId(order.id)}
                onCancel={() => setConfirmingId(null)}
                onConfirm={() => void submitRefund(order)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  confirming,
  submitting,
  onStart,
  onCancel,
  onConfirm,
}: {
  order: PaymentOrderDto;
  confirming: boolean;
  submitting: boolean;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const state =
    order.status === "refunded"
      ? {
          icon: CheckCircle2,
          title: "ההחזר אושר על ידי הספק",
          detail: "הזכאות בתשלום בוטלה לאחר אישור ההחזר.",
        }
      : order.status === "refund_requested"
        ? {
            icon: Clock3,
            title: "בקשת ההחזר ממתינה לאישור הספק",
            detail: "הגישה נשארת פתוחה עד לקבלת אישור סופי.",
          }
        : {
            icon: ReceiptText,
            title: "תשלום מאושר — ניתן לבקש ביטול",
            detail: "שליחת הבקשה אינה מבטלת את הגישה לפני אישור ההחזר.",
          };
  const StateIcon = state.icon;

  return (
    <article className="border border-iron/30 bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <StateIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-foreground">{state.title}</h3>
          <p className="mt-1 text-sm leading-6 text-dust">{state.detail}</p>
          <p className="mt-2 font-mono text-xs text-dust">
            {order.createdAt
              ? new Date(order.createdAt).toLocaleDateString("he-IL", { dateStyle: "long" })
              : "תאריך לא זמין"}
            {" · "}₪{(order.product.amountMinor / 100).toLocaleString("he-IL")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-iron/20 pt-4">
        {order.invoice ? (
          <a
            href={order.invoice.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            קבלה {order.invoice.number}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
        {order.refundReceipt ? (
          <a
            href={order.refundReceipt.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            אישור החזר {order.refundReceipt.number}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
        {order.cancellation.requestEligible && !confirming ? (
          <button
            type="button"
            onClick={onStart}
            className="rounded-md border border-destructive/45 px-4 py-2 text-sm font-bold text-destructive"
          >
            בקשת ביטול והחזר
          </button>
        ) : null}
      </div>

      {confirming ? (
        <div className="mt-4 border border-amber-500/40 bg-amber-500/10 p-4" role="alert">
          <p className="text-sm font-bold text-foreground">לשלוח בקשת החזר עבור תשלום זה?</p>
          <p className="mt-1 text-xs leading-5 text-dust">
            ייתכן שיידרש בירור. הגישה תישאר פעילה עד לאישור סופי של ספק התשלום.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onConfirm}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              כן, שלחו את הבקשה
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="rounded-md border border-iron/40 px-4 py-2 text-sm text-dust disabled:opacity-50"
            >
              חזרה
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="mt-8 flex items-center justify-center gap-3 py-10" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
      <span className="text-sm text-dust">{label}</span>
    </div>
  );
}
