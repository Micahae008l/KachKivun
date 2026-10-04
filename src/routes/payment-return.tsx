import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getTopMatchesStatus } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { SITE_NAME_HE } from "@/lib/brand";

export const Route = createFileRoute("/payment-return")({
  component: PaymentReturnPage,
  head: () => ({
    meta: [{ title: `אישור תשלום | ${SITE_NAME_HE}` }, { name: "robots", content: "noindex" }],
  }),
});

/** The payment provider confirms to our server a moment after the redirect, so wait for it. */
const POLL_MS = 1500;
const GIVE_UP_MS = 45_000;

function PaymentReturnPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"waiting" | "slow" | "signed-out">("waiting");

  useEffect(() => {
    if (!getToken()) {
      setState("signed-out");
      return;
    }
    let cancelled = false;
    const started = Date.now();

    async function poll() {
      while (!cancelled) {
        try {
          const status = await getTopMatchesStatus();
          if (status.unlocked) {
            trackEvent("unlock_paid");
            toast.success("2 ההתאמות המובילות שלכם פתוחות");
            navigate({ to: "/ai-counselor", hash: "unlocked", replace: true });
            return;
          }
        } catch {
          // A blip while the API wakes up; keep waiting.
        }
        if (Date.now() - started > GIVE_UP_MS) {
          trackEvent("unlock_failed", { stage: "confirmation_timeout" });
          setState("slow");
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    }
    void poll();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center"
    >
      {state === "waiting" ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <h1 className="text-xl font-bold text-foreground">מאשרים את התשלום…</h1>
          <p className="text-sm text-dust">זה לוקח כמה שניות. אל תסגרו את הדף.</p>
        </>
      ) : null}

      {state === "slow" ? (
        <>
          <ShieldCheck className="h-10 w-10 text-primary" aria-hidden />
          <h1 className="text-xl font-bold text-foreground">האישור מתעכב</h1>
          <p className="text-sm leading-relaxed text-dust">
            אם התשלום עבר, ההתאמות ייפתחו תוך כמה דקות. לא חויבתם פעמיים. אם זה נמשך, כתבו לנו
            ונסדר.
          </p>
          <Link
            to="/ai-counselor"
            className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
          >
            חזרה לתוצאות
          </Link>
        </>
      ) : null}

      {state === "signed-out" ? (
        <>
          <Lock className="h-10 w-10 text-primary" aria-hidden />
          <h1 className="text-xl font-bold text-foreground">התחברו כדי לראות את ההתאמות</h1>
          <p className="text-sm text-dust">התשלום נשמר בחשבון שלכם, התחברו עם אותו אימייל.</p>
          <Link
            to="/post-signup"
            hash="login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
          >
            התחברות
          </Link>
        </>
      ) : null}
    </main>
  );
}
