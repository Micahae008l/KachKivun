import { PAYMENT_METHOD_PRIORITY } from "./catalog.js";
import { PaymentError } from "./errors.js";

export const GROW_BASE_URLS = Object.freeze({
  sandbox: "https://sandbox.meshulam.co.il/api/light/server/1.0",
  production: "https://secure.meshulam.co.il/api/light/server/1.0",
});

export const PAYMENT_PROVIDERS = Object.freeze(["mock", "grow", "grow_link"]);
const LIVE_PROVIDERS = new Set(["grow", "grow_link"]);
const GROW_LINK_HOST_SUFFIXES = Object.freeze([
  "grow.link",
  "grow.business",
  "grow.website",
  "meshulam.co.il",
]);

const PAGE_CODE_ENV_KEYS = Object.freeze({
  apple_pay: "GROW_PAGE_CODE_APPLE_PAY",
  bit: "GROW_PAGE_CODE_BIT",
  google_pay: "GROW_PAGE_CODE_GOOGLE_PAY",
  card: "GROW_PAGE_CODE_CARD",
});

function text(value) {
  return String(value || "").trim();
}

export function isPaywallEnabled(value = process.env.PAYWALL_ENABLED) {
  return /^(?:1|true|yes|on)$/i.test(text(value));
}

export function parsePaywallLaunchAt(value = process.env.PAYWALL_LAUNCH_AT) {
  const raw = text(value);
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (!match) return null;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    zone,
    ,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = zone === "Z" ? 0 : Number(offsetHourText);
  const offsetMinute = zone === "Z" ? 0 : Number(offsetMinuteText);
  const daysInMonth =
    month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizePaymentsProvider(value) {
  const provider = text(value).toLowerCase();
  return provider || "mock";
}

export function normalizeGrowEnvironment(value) {
  const environment = text(value).toLowerCase();
  if (environment === "test" || environment === "sandbox") return "sandbox";
  if (environment === "prod" || environment === "production" || environment === "live") {
    return "production";
  }
  return environment;
}

function validateIdentifier(value, label, errors, { required = true } = {}) {
  const identifier = text(value);
  if (!identifier) {
    if (required) errors.push(`${label} is required`);
    return;
  }
  if (!/^[A-Za-z0-9_-]{6,160}$/.test(identifier)) {
    errors.push(`${label} has an invalid format`);
  }
}

function parseOrigin(value, label, errors, { requireHttps }) {
  const raw = text(value);
  if (!raw) {
    errors.push(`${label} is required`);
    return "";
  }
  try {
    const url = new URL(raw);
    if (requireHttps && url.protocol !== "https:") {
      errors.push(`${label} must use HTTPS`);
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      errors.push(`${label} must be a plain public origin`);
    }
    return url.origin;
  } catch {
    errors.push(`${label} must be a valid URL`);
    return "";
  }
}

function parsePublicUrl(value, label, errors, { requireHttps }) {
  const raw = text(value);
  if (!raw) {
    errors.push(`${label} is required`);
    return "";
  }
  try {
    const url = new URL(raw);
    if (requireHttps && url.protocol !== "https:") {
      errors.push(`${label} must use HTTPS`);
    }
    if (url.username || url.password || url.search || url.hash) {
      errors.push(`${label} must be a public URL without credentials, a query, or a fragment`);
    }
    return url.toString();
  } catch {
    errors.push(`${label} must be a valid URL`);
    return "";
  }
}

export function parseGrowLinkMethods(value) {
  const requested = text(value || "card,bit")
    .split(",")
    .map((method) => method.trim().toLowerCase())
    .filter(Boolean);
  return PAYMENT_METHOD_PRIORITY.filter((method) => requested.includes(method));
}

function validateGrowLinkEnvironment(env, errors) {
  const raw = text(env.GROW_PAYMENT_LINK_URL);
  if (!raw) {
    errors.push("GROW_PAYMENT_LINK_URL is required when PAYMENTS_PROVIDER=grow_link");
  } else {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      const trusted = GROW_LINK_HOST_SUFFIXES.some(
        (suffix) => host === suffix || host.endsWith(`.${suffix}`),
      );
      if (url.protocol !== "https:" || url.username || url.password || !trusted) {
        errors.push(
          `GROW_PAYMENT_LINK_URL must be an HTTPS link on ${GROW_LINK_HOST_SUFFIXES.join(", ")}`,
        );
      }
    } catch {
      errors.push("GROW_PAYMENT_LINK_URL must be a valid URL");
    }
  }

  const secret = text(env.GROW_LINK_WEBHOOK_SECRET);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(secret)) {
    errors.push(
      "GROW_LINK_WEBHOOK_SECRET must be 32-128 URL-safe characters (e.g. openssl rand -hex 24)",
    );
  }
  const webhookKey = text(env.GROW_WEBHOOK_KEY);
  if (webhookKey && !/^[A-Za-z0-9_-]{4,160}$/.test(webhookKey)) {
    errors.push("GROW_WEBHOOK_KEY has an invalid format");
  }
  if (parseGrowLinkMethods(env.GROW_LINK_METHODS).length === 0) {
    errors.push("GROW_LINK_METHODS must list at least one of apple_pay, bit, google_pay, card");
  }
}

function validateBusinessDetails(env, errors, confirmations) {
  // BUSINESS_PHONE is optional: written contact (email + /contact form) is the support channel.
  // Confirm with counsel whether a phone is also required for distance sales before relying on that.
  for (const [name, maxLength] of [
    ["BUSINESS_LEGAL_NAME", 200],
    ["BUSINESS_ADDRESS", 300],
    ["BUSINESS_CONTACT_EMAIL", 254],
  ]) {
    const value = text(env[name]);
    if (!value) errors.push(`${name} is required when the production paywall is enabled`);
    else if (value.length > maxLength) errors.push(`${name} is too long`);
  }

  const email = text(env.BUSINESS_CONTACT_EMAIL);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("BUSINESS_CONTACT_EMAIL must be a valid email address");
  }

  const phone = text(env.BUSINESS_PHONE);
  if (phone.length > 40) errors.push("BUSINESS_PHONE is too long");
  if (phone && !/^[+\d][+\d().\s-]{5,38}$/.test(phone)) {
    errors.push("BUSINESS_PHONE has an invalid format");
  }

  parsePublicUrl(env.CANCELLATION_URL, "CANCELLATION_URL", errors, { requireHttps: true });
  if (!parsePaywallLaunchAt(env.PAYWALL_LAUNCH_AT)) {
    errors.push("PAYWALL_LAUNCH_AT must be a valid ISO timestamp with a timezone");
  }

  for (const confirmation of confirmations) {
    if (!/^(?:1|true|yes|on)$/i.test(text(env[confirmation]))) {
      errors.push(`${confirmation}=true is required when the production paywall is enabled`);
    }
  }

  // TODO(legal-launch): ISRAELI_LEGAL_REVIEW_CONFIRMED may be set only after
  // Israeli counsel approves the minor and digital-service cancellation wording.
}

export function publicMerchantConfig(env = process.env) {
  const configured = {
    legalName: text(env.BUSINESS_LEGAL_NAME),
    phone: text(env.BUSINESS_PHONE),
    address: text(env.BUSINESS_ADDRESS),
    contactEmail: text(env.BUSINESS_CONTACT_EMAIL),
    cancellationUrl: text(env.CANCELLATION_URL),
  };
  return Object.fromEntries(Object.entries(configured).filter(([, value]) => Boolean(value)));
}

export function resolveGrowPageCodes(env = process.env) {
  const legacyCardPage = text(env.GROW_PAGE_CODE);
  const pageCodes = {};
  for (const method of PAYMENT_METHOD_PRIORITY) {
    const exact = text(env[PAGE_CODE_ENV_KEYS[method]]);
    // GROW_PAGE_CODE is a legacy fallback for the generic/card page only. Wallet
    // methods never silently fall back to a different checkout experience.
    pageCodes[method] = exact || (method === "card" ? legacyCardPage : "");
  }
  return Object.freeze(pageCodes);
}

export function validatePaymentEnvironment(env = process.env) {
  const errors = [];
  const nodeEnvironment = text(env.NODE_ENV).toLowerCase();
  const paywallEnabled = isPaywallEnabled(env.PAYWALL_ENABLED);
  const configuredProvider = text(env.PAYMENTS_PROVIDER).toLowerCase();
  const provider = normalizePaymentsProvider(env.PAYMENTS_PROVIDER);

  if (configuredProvider && !PAYMENT_PROVIDERS.includes(provider)) {
    errors.push("PAYMENTS_PROVIDER must be mock, grow or grow_link");
    return errors;
  }
  if (nodeEnvironment === "production" && configuredProvider && !LIVE_PROVIDERS.has(provider)) {
    errors.push("PAYMENTS_PROVIDER=mock is forbidden in production");
  }

  const growEnvironment = normalizeGrowEnvironment(env.GROW_ENV);
  if (nodeEnvironment === "production" && text(env.GROW_ENV) && growEnvironment !== "production") {
    errors.push("Grow sandbox is forbidden in production");
  }

  // A disabled paywall must not require merchant or Grow credentials. The
  // payment routers return PAYMENT_DISABLED before constructing a provider.
  if (!paywallEnabled) return [...new Set(errors)];

  if (!PAYMENT_PROVIDERS.includes(provider)) {
    errors.push("PAYMENTS_PROVIDER must be mock, grow or grow_link");
    return errors;
  }
  if (nodeEnvironment === "production" && !LIVE_PROVIDERS.has(provider)) {
    errors.push(
      "PAYMENTS_PROVIDER=grow or grow_link is required when the production paywall is enabled",
    );
  }
  if (provider === "grow_link") {
    validateGrowLinkEnvironment(env, errors);
    parseOrigin(env.FRONTEND_URL, "FRONTEND_URL", errors, { requireHttps: true });
    parseOrigin(env.API_PUBLIC_URL, "API_PUBLIC_URL", errors, { requireHttps: true });
    if (nodeEnvironment === "production") {
      validateBusinessDetails(env, errors, ["ISRAELI_LEGAL_REVIEW_CONFIRMED"]);
    }
    return [...new Set(errors)];
  }
  if (provider !== "grow") return [...new Set(errors)];

  if (!Object.hasOwn(GROW_BASE_URLS, growEnvironment)) {
    errors.push("GROW_ENV must be sandbox or production");
  }
  if (nodeEnvironment === "production" && growEnvironment !== "production") {
    errors.push("Grow sandbox is forbidden in production");
  }

  validateIdentifier(env.GROW_USER_ID, "GROW_USER_ID", errors);
  validateIdentifier(env.GROW_API_KEY, "GROW_API_KEY", errors, { required: false });

  const pageCodes = resolveGrowPageCodes(env);
  const configuredMethods = PAYMENT_METHOD_PRIORITY.filter((method) => pageCodes[method]);
  if (configuredMethods.length === 0) {
    errors.push("At least one Grow page code is required");
  }
  for (const method of PAYMENT_METHOD_PRIORITY) {
    validateIdentifier(pageCodes[method], PAGE_CODE_ENV_KEYS[method], errors, {
      required: false,
    });
  }

  parseOrigin(env.FRONTEND_URL, "FRONTEND_URL", errors, { requireHttps: true });
  parseOrigin(env.API_PUBLIC_URL, "API_PUBLIC_URL", errors, { requireHttps: true });
  if (growEnvironment === "production") {
    validateBusinessDetails(env, errors, [
      "GROW_CALLBACK_AUTH_CONFIRMED",
      "GROW_DOMAIN_REVIEW_APPROVED",
      "ISRAELI_LEGAL_REVIEW_CONFIRMED",
    ]);
  }
  return [...new Set(errors)];
}

export function validateLifecyclePaymentEnvironment(env = process.env, providerOverride = null) {
  const errors = [];
  const nodeEnvironment = text(env.NODE_ENV).toLowerCase();
  const provider = normalizePaymentsProvider(providerOverride || env.PAYMENTS_PROVIDER);
  if (!PAYMENT_PROVIDERS.includes(provider)) {
    return ["PAYMENTS_PROVIDER must be mock, grow or grow_link"];
  }
  if (nodeEnvironment === "production" && !LIVE_PROVIDERS.has(provider)) {
    errors.push("PAYMENTS_PROVIDER=mock is forbidden in production");
  }
  if (provider !== "grow") return errors;

  const growEnvironment = normalizeGrowEnvironment(env.GROW_ENV);
  if (!Object.hasOwn(GROW_BASE_URLS, growEnvironment)) {
    errors.push("GROW_ENV must be sandbox or production");
  }
  if (nodeEnvironment === "production" && growEnvironment !== "production") {
    errors.push("Grow sandbox is forbidden in production");
  }
  validateIdentifier(env.GROW_USER_ID, "GROW_USER_ID", errors);
  validateIdentifier(env.GROW_API_KEY, "GROW_API_KEY", errors, { required: false });
  return [...new Set(errors)];
}

export function getPaymentConfig(env = process.env) {
  const errors = validatePaymentEnvironment(env);
  if (errors.length > 0) {
    throw new PaymentError(
      "PAYMENT_CONFIG_INVALID",
      `Payment configuration is invalid: ${errors.join("; ")}`,
      500,
    );
  }

  const enabled = isPaywallEnabled(env.PAYWALL_ENABLED);
  const merchant = Object.freeze(publicMerchantConfig(env));
  if (!enabled) {
    return Object.freeze({
      enabled: false,
      provider: "disabled",
      configuredProvider: normalizePaymentsProvider(env.PAYMENTS_PROVIDER),
      availableMethods: [],
      merchant,
    });
  }

  const provider = normalizePaymentsProvider(env.PAYMENTS_PROVIDER);
  if (provider === "mock") {
    return Object.freeze({
      enabled: true,
      provider,
      frontendOrigin: text(env.FRONTEND_URL) || "http://localhost:8080",
      apiOrigin: text(env.API_PUBLIC_URL) || "http://localhost:3001",
      availableMethods: [...PAYMENT_METHOD_PRIORITY],
      merchant,
    });
  }

  if (provider === "grow_link") {
    return Object.freeze({
      enabled: true,
      provider,
      paymentLinkUrl: new URL(text(env.GROW_PAYMENT_LINK_URL)).toString(),
      availableMethods: parseGrowLinkMethods(env.GROW_LINK_METHODS),
      frontendOrigin: new URL(text(env.FRONTEND_URL)).origin,
      apiOrigin: new URL(text(env.API_PUBLIC_URL)).origin,
      merchant,
    });
  }

  const growEnvironment = normalizeGrowEnvironment(env.GROW_ENV);
  const pageCodes = resolveGrowPageCodes(env);
  return Object.freeze({
    enabled: true,
    provider,
    growEnvironment,
    baseUrl: GROW_BASE_URLS[growEnvironment],
    userId: text(env.GROW_USER_ID),
    apiKey: text(env.GROW_API_KEY),
    pageCodes,
    availableMethods: PAYMENT_METHOD_PRIORITY.filter((method) => pageCodes[method]),
    frontendOrigin: new URL(text(env.FRONTEND_URL)).origin,
    apiOrigin: new URL(text(env.API_PUBLIC_URL)).origin,
    merchant,
    timeoutMs: 12_000,
  });
}

export function getLifecyclePaymentConfig(
  env = process.env,
  { provider: providerOverride = null } = {},
) {
  const errors = validateLifecyclePaymentEnvironment(env, providerOverride);
  if (errors.length > 0) {
    throw new PaymentError(
      "PAYMENT_LIFECYCLE_CONFIG_INVALID",
      `Payment lifecycle configuration is invalid: ${errors.join("; ")}`,
      503,
    );
  }

  const provider = normalizePaymentsProvider(providerOverride || env.PAYMENTS_PROVIDER);
  if (provider === "mock" || provider === "grow_link") {
    return Object.freeze({
      enabled: false,
      lifecycleOnly: true,
      provider,
      availableMethods: [],
    });
  }

  const growEnvironment = normalizeGrowEnvironment(env.GROW_ENV);
  return Object.freeze({
    enabled: false,
    lifecycleOnly: true,
    provider,
    growEnvironment,
    baseUrl: GROW_BASE_URLS[growEnvironment],
    userId: text(env.GROW_USER_ID),
    apiKey: text(env.GROW_API_KEY),
    availableMethods: [],
    timeoutMs: 12_000,
  });
}

export function choosePaymentMethod(config, requestedMethod) {
  const requested = text(requestedMethod);
  if (requested) {
    if (!PAYMENT_METHOD_PRIORITY.includes(requested)) {
      throw new PaymentError("PAYMENT_METHOD_INVALID", "אמצעי התשלום אינו תקין.", 400);
    }
    if (!config.availableMethods.includes(requested)) {
      throw new PaymentError(
        "PAYMENT_METHOD_UNAVAILABLE",
        "אמצעי התשלום שבחרתם אינו זמין כרגע.",
        409,
      );
    }
    return requested;
  }

  const fallback = PAYMENT_METHOD_PRIORITY.find((method) =>
    config.availableMethods.includes(method),
  );
  if (!fallback) {
    throw new PaymentError("PAYMENT_METHOD_UNAVAILABLE", undefined, 503);
  }
  return fallback;
}
