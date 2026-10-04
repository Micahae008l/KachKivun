/**
 * Privacy-friendly analytics — PostHog and/or Plausible.
 *
 * Set VITE_POSTHOG_KEY (and VITE_POSTHOG_HOST, default EU cloud) to enable PostHog,
 * VITE_PLAUSIBLE_DOMAIN to enable Plausible.
 * All events are fire-and-forget; failures are silently ignored.
 * No cookies, no PII, no third-party trackers.
 */

import type { PostHog } from "posthog-js";

const PLAUSIBLE_DOMAIN = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined)?.trim();
const PLAUSIBLE_API = (import.meta.env.VITE_PLAUSIBLE_API as string | undefined)?.trim() || "https://plausible.io/api/event";
const POSTHOG_KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim();
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim() || "https://eu.i.posthog.com";

type EventProps = Record<string, string | number | boolean>;

let posthog: Promise<PostHog | null> | null = null;

/**
 * Start PostHog in the browser, once. Kept to what the privacy page promises:
 * cookieless (nothing stored on the device), anonymous (no person profiles, never
 * identified by name or email), no autocapture of clicks or typed text, no recordings.
 * The library loads lazily so it never weighs on the first paint.
 */
export function initAnalytics() {
  if (!POSTHOG_KEY || typeof window === "undefined" || posthog) return;
  posthog = import("posthog-js")
    .then(({ default: ph }) => {
      ph.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        cookieless_mode: "always",
        person_profiles: "never",
        capture_pageview: "history_change",
        capture_pageleave: true,
        autocapture: false,
        disable_session_recording: true,
        disable_surveys: true,
      });
      return ph;
    })
    .catch(() => null);
}

/**
 * Track a custom event.
 * Sends to PostHog and/or Plausible, whichever is configured.
 * Otherwise logs to console in development.
 */
export function trackEvent(name: string, props?: EventProps) {
  if (posthog) {
    void posthog.then((ph) => ph?.capture(name, props)).catch(() => {});
  }

  if (PLAUSIBLE_DOMAIN) {
    // Use Plausible's events API
    try {
      const w = window as typeof window & { plausible?: (name: string, opts?: { props?: EventProps }) => void };
      if (w.plausible) {
        w.plausible(name, props ? { props } : undefined);
      } else {
        // Fallback: direct API call if script hasn't loaded
        fetch(PLAUSIBLE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            url: window.location.href,
            domain: PLAUSIBLE_DOMAIN,
            props,
          }),
        }).catch(() => {});
      }
    } catch {
      // Silently fail
    }
    return;
  }

  // Development: log to console
  if (import.meta.env.DEV) {
    console.log(`[analytics] ${name}`, props ?? "");
  }
}

/**
 * Plausible script tag attributes for the root document.
 * Returns null if not configured.
 */
export function getPlausibleScriptUrl(): string | null {
  if (!PLAUSIBLE_DOMAIN) return null;
  const base = PLAUSIBLE_API.replace("/api/event", "");
  return `${base}/js/script.js`;
}

export function getPlausibleDomain(): string | null {
  return PLAUSIBLE_DOMAIN ?? null;
}

// ── Predefined events ──────────────────────────────────────────────────────

/** The signup funnel: one event per wizard screen, then code sent → verified → complete. */
export function trackSignupStep(step: number, total: number, name: string) {
  trackEvent("signup_step", { step, total, name });
}

export function trackSignupCodeSent(resent: boolean) {
  trackEvent("signup_code_sent", { resent });
}

export function trackSignupCodeVerified(newUser: boolean) {
  trackEvent("signup_code_verified", { new_user: newUser });
}

/** `code` is the API's error code (never the typed value). */
export function trackSignupError(step: string, code: string) {
  trackEvent("signup_error", { step, code });
}

export function trackSignupComplete() {
  trackEvent("signup_complete");
}

export function trackAiMatch() {
  trackEvent("ai_match_run");
}

export function trackReportGenerate() {
  trackEvent("report_generate");
}

export function trackReviewSubmit(roleSlug: string) {
  trackEvent("review_submit", { role: roleSlug });
}

export function trackShare(method: string) {
  trackEvent("share", { method });
}

export function trackError(message: string, source?: string) {
  trackEvent("client_error", { message: message.slice(0, 200), source: source ?? "unknown" });
}
