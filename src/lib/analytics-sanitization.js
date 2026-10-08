const ASSESSMENT_SECTIONS = new Set([
  "direction",
  "roles",
  "preferences",
  "environment",
  "style",
  "combat",
  "technical",
  "scores",
  "yom",
  "checkpoint",
  "motivation",
  "identity",
  "review",
  "email",
  "otp",
]);

const PAYMENT_METHODS = new Set(["apple_pay", "bit", "google_pay", "card"]);
const BROWSER_CATEGORIES = new Set([
  "standard",
  "instagram",
  "facebook",
  "tiktok",
  "other_in_app",
]);

const EVENT_PROP_RULES = Object.freeze({
  assessment_start: {
    mode: (value) => (value === "fresh" || value === "resume" ? value : undefined),
  },
  assessment_section: {
    section: (value) =>
      typeof value === "string" && ASSESSMENT_SECTIONS.has(value) ? value : undefined,
  },
  assessment_complete: {},
  otp_request: {
    intent: (value) => (value === "signup" || value === "login" ? value : undefined),
  },
  otp_verify: {
    intent: (value) => (value === "signup" || value === "login" ? value : undefined),
  },
  counselor_viewed: {},
  free_role_expanded: {
    rank: (value) => ([3, 4, 5].includes(value) ? value : undefined),
  },
  paywall_viewed: {},
  checkout_started: {
    flow: (value) => (value === "account" || value === "shared" ? value : undefined),
    browser: (value) =>
      typeof value === "string" && BROWSER_CATEGORIES.has(value) ? value : undefined,
  },
  payment_method_selected: {
    method: (value) =>
      typeof value === "string" && PAYMENT_METHODS.has(value) ? value : undefined,
  },
  payment_confirmed: {},
  payment_failed: {
    stage: (value) =>
      ["checkout", "return", "provider"].includes(value) ? value : undefined,
  },
  payment_refunded: {},
  unlocked_top_roles_viewed: {},
  client_error: {
    source: (value) =>
      ["global", "unhandled_rejection", "error_boundary"].includes(value)
        ? value
        : undefined,
  },
  review_submit: {},
  signup_complete: {},
  ai_match_run: {},
  report_generate: {},
  share: {},
});

export function normalizeAnalyticsPath(pathname) {
  let path = typeof pathname === "string" ? pathname : "/";
  path = path.split(/[?#]/, 1)[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");

  if (/^\/checkout\/[^/]+/i.test(path)) return "/checkout/:share";
  if (/^\/payment\/return(?:\/|$)/i.test(path)) return "/payment/return";
  if (/^\/report\/[^/]+/i.test(path)) return "/report/:id";
  return path.length > 1 ? path.replace(/\/+$/, "") : "/";
}

export function sanitizeAnalyticsUrl(input, fallbackOrigin = "https://analytics.invalid") {
  try {
    const url = new URL(String(input || "/"), fallbackOrigin);
    const origin = /^https?:$/.test(url.protocol) ? url.origin : new URL(fallbackOrigin).origin;
    return `${origin}${normalizeAnalyticsPath(url.pathname)}`;
  } catch {
    return `${new URL(fallbackOrigin).origin}/`;
  }
}

export function sanitizeAnalyticsProps(eventName, input) {
  const rules = EVENT_PROP_RULES[eventName];
  if (!rules || !input || typeof input !== "object" || Array.isArray(input)) return undefined;

  const output = {};
  for (const [key, sanitize] of Object.entries(rules)) {
    const value = sanitize(input[key]);
    if (value !== undefined) output[key] = value;
  }
  return Object.keys(output).length ? output : undefined;
}

export function isKnownAnalyticsEvent(eventName) {
  return Object.hasOwn(EVENT_PROP_RULES, eventName);
}
