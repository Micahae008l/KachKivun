/**
 * Typed, non-PII product analytics.
 *
 * Events go directly to Plausible so its automatic page-view script never sees
 * a dynamic checkout/share path. Runtime sanitizers discard unknown props and
 * normalize every URL before transmission.
 */
import {
  isKnownAnalyticsEvent,
  sanitizeAnalyticsProps,
  sanitizeAnalyticsUrl,
} from "./analytics-sanitization.js";

const PLAUSIBLE_DOMAIN = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined)?.trim();
const PLAUSIBLE_API =
  (import.meta.env.VITE_PLAUSIBLE_API as string | undefined)?.trim() ||
  "https://plausible.io/api/event";

export type AssessmentAnalyticsSection =
  | "direction"
  | "roles"
  | "preferences"
  | "environment"
  | "style"
  | "combat"
  | "technical"
  | "scores"
  | "yom"
  | "checkpoint"
  | "motivation"
  | "identity"
  | "review"
  | "email"
  | "otp";

export type CheckoutBrowserCategory =
  | "standard"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "other_in_app";

export type AnalyticsEventMap = {
  assessment_start: { mode: "fresh" | "resume" };
  assessment_section: { section: AssessmentAnalyticsSection };
  assessment_complete: undefined;
  otp_request: { intent: "signup" | "login" };
  otp_verify: { intent: "signup" | "login" };
  counselor_viewed: undefined;
  free_role_expanded: { rank: 3 | 4 | 5 };
  paywall_viewed: undefined;
  checkout_started: {
    flow: "account" | "shared";
    browser: CheckoutBrowserCategory;
  };
  payment_method_selected: {
    method: "apple_pay" | "bit" | "google_pay" | "card";
  };
  payment_confirmed: undefined;
  payment_failed: { stage: "checkout" | "return" | "provider" };
  payment_refunded: undefined;
  unlocked_top_roles_viewed: undefined;
  client_error: { source: "global" | "unhandled_rejection" | "error_boundary" };
  review_submit: undefined;
  signup_complete: undefined;
  ai_match_run: undefined;
  report_generate: undefined;
  share: undefined;
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

export function trackEvent<Name extends AnalyticsEventName>(
  name: Name,
  ...args: AnalyticsEventMap[Name] extends undefined
    ? [props?: undefined]
    : [props: AnalyticsEventMap[Name]]
) {
  if (typeof window === "undefined" || !isKnownAnalyticsEvent(name)) return;
  const props = sanitizeAnalyticsProps(
    name,
    args[0] as Record<string, unknown> | undefined,
  );

  if (PLAUSIBLE_DOMAIN) {
    try {
      void fetch(PLAUSIBLE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        referrerPolicy: "origin",
        keepalive: true,
        body: JSON.stringify({
          name,
          url: sanitizeAnalyticsUrl(window.location.href, window.location.origin),
          domain: PLAUSIBLE_DOMAIN,
          ...(props ? { props } : {}),
        }),
      }).catch(() => {});
    } catch {
      // Analytics must never affect product behavior.
    }
    return;
  }

  if (import.meta.env.DEV) console.debug(`[analytics] ${name}`, props ?? "");
}

export function categorizeCheckoutBrowser(userAgent: string): CheckoutBrowserCategory {
  if (/Instagram/i.test(userAgent)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|Messenger/i.test(userAgent)) return "facebook";
  if (/TikTok|musical_ly|BytedanceWebview/i.test(userAgent)) return "tiktok";
  if (/;\s*wv\)|\bwv\b|WebView/i.test(userAgent)) return "other_in_app";
  return "standard";
}

// Compatibility wrappers deliberately drop identifiers, scores, free text,
// error messages, and role data.
export function trackSignupStep(_step: number, _total: number) {}
export function trackSignupComplete() {
  trackEvent("signup_complete");
}
export function trackAiMatch() {
  trackEvent("ai_match_run");
}
export function trackReportGenerate() {
  trackEvent("report_generate");
}
export function trackReviewSubmit(_roleSlug: string) {
  trackEvent("review_submit");
}
export function trackShare(_method: string) {
  trackEvent("share");
}
export function trackError(
  _message: string,
  source?: "global" | "unhandled_rejection" | "error_boundary" | string,
) {
  const safeSource =
    source === "global" || source === "unhandled_rejection" || source === "error_boundary"
      ? source
      : "global";
  trackEvent("client_error", { source: safeSource });
}
