import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  readAnalyticsConsent,
  saveAnalyticsConsent,
  sendAnalyticsPageView,
  startThirdPartyAnalytics,
  thirdPartyAnalyticsConfigured,
} from "@/lib/third-party-analytics";

/** Cookie notice for GA4 and Clarity; nothing loads until the visitor accepts. */
export function CookieConsent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [undecided, setUndecided] = useState(false);

  useEffect(() => {
    if (!thirdPartyAnalyticsConfigured) return;
    const consent = readAnalyticsConsent();
    if (consent === null) setUndecided(true);
    else if (consent === "granted") startThirdPartyAnalytics();
  }, []);

  useEffect(() => {
    sendAnalyticsPageView();
  }, [pathname]);

  if (!undecided) return null;

  function choose(consent: "granted" | "denied") {
    saveAnalyticsConsent(consent);
    setUndecided(false);
  }

  return (
    <div
      role="dialog"
      aria-label="הסכמה לקוקיז"
      className="fixed inset-x-3 bottom-3 z-[80] border border-iron/40 bg-background/95 p-4 text-right shadow-[0_8px_32px_oklch(0_0_0/0.6)] backdrop-blur-md sm:inset-x-auto sm:right-4 sm:max-w-md"
      dir="rtl"
    >
      <p className="text-sm leading-6 text-foreground">
        נשמח להשתמש בקוקיז של Google Analytics ו־Microsoft Clarity כדי להבין איך משתמשים באתר ולשפר
        אותו. מה שאתם מקלידים לא נשמר.{" "}
        <Link to="/privacy" className="text-primary hover:underline">
          פרטים
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose("granted")}
          className="min-h-10 flex-1 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:brightness-110"
        >
          אישור
        </button>
        <button
          type="button"
          onClick={() => choose("denied")}
          className="min-h-10 flex-1 rounded-md border border-iron/40 px-4 text-sm font-semibold text-dust transition hover:text-foreground"
        >
          לא תודה
        </button>
      </div>
    </div>
  );
}
