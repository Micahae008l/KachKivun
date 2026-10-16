/**
 * Google Analytics 4 and Microsoft Clarity, loaded only after the visitor accepts the cookie
 * notice. Neither loads on pages whose address carries a payment or share token, and GA page
 * views are sent with the same sanitized URL as our own events.
 */
import { sanitizeAnalyticsUrl } from "./analytics-sanitization.js";

const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();
const CLARITY_ID = (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined)?.trim();
const CONSENT_KEY = "kk-analytics-consent";
const PRIVATE_PATH = /^\/(payment\/|checkout\/[^/]+|report\/)/;

export type AnalyticsConsent = "granted" | "denied";
export const thirdPartyAnalyticsConfigured = Boolean(GA_ID || CLARITY_ID);

type Gtag = (...args: unknown[]) => void;
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[] };
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    clarity?: Clarity;
  }
}

let started = false;

/** Runs before first paint: hides the server-rendered cookie notice when the visitor already chose. */
export const CONSENT_BOOT_SCRIPT = `(function(){try{var v=localStorage.getItem("${CONSENT_KEY}");if(v==="granted"||v==="denied")document.documentElement.classList.add("kk-consent-set")}catch(e){}})();`;

export function readAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(consent: AnalyticsConsent) {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Storage blocked: the choice holds for this page only.
  }
  if (consent === "granted") startThirdPartyAnalytics();
}

function addScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function startThirdPartyAnalytics() {
  if (
    started ||
    typeof window === "undefined" ||
    !thirdPartyAnalyticsConfigured ||
    readAnalyticsConsent() !== "granted" ||
    PRIVATE_PATH.test(window.location.pathname)
  ) {
    return;
  }
  started = true;

  if (GA_ID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // gtag.js reads the raw `arguments` object from the queue.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    // Page views are sent by hand (sanitized), not from the raw address.
    window.gtag("config", GA_ID, { send_page_view: false });
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);
    sendAnalyticsPageView();
  }

  if (CLARITY_ID) {
    const queue: unknown[] = [];
    const clarity: Clarity = Object.assign((...args: unknown[]) => void queue.push(args), { q: queue });
    window.clarity = window.clarity || clarity;
    addScript(`https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_ID)}`);
  }
}

export function sendAnalyticsPageView() {
  if (!started || !GA_ID || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_location: sanitizeAnalyticsUrl(window.location.href, window.location.origin),
    page_title: document.title,
  });
}

/** Funnel events go to GA4, and to Clarity as tags so recordings can be filtered by them. */
export function forwardAnalyticsEvent(name: string, props?: Record<string, unknown>) {
  if (!started) return;
  window.gtag?.("event", name, props ?? {});
  window.clarity?.("event", name);
}
