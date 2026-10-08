import { PaymentError } from "./errors.js";

const APPROVAL_FIELD_NAMES = Object.freeze([
  "transactionId",
  "transactionToken",
  "transactionTypeId",
  "paymentType",
  "sum",
  "firstPaymentSum",
  "periodicalPaymentSum",
  "paymentsNum",
  "allPaymentsNum",
  "paymentDate",
  "asmachta",
  "description",
  "fullName",
  "payerPhone",
  "payerEmail",
  "cardSuffix",
  "cardType",
  "cardTypeCode",
  "cardBrand",
  "cardBrandCode",
  "cardExp",
  "processId",
  "processToken",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObject(value) {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return null;
  const source = value.trim();
  if (!source || (!source.startsWith("{") && !source.startsWith("["))) return null;
  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) return isRecord(parsed[0]) ? parsed[0] : null;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizedKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function safeScalar(value, maxLength = 500) {
  if (value === undefined || value === null) return "";
  if (!["string", "number", "boolean"].includes(typeof value)) return "";
  return String(value)
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function lookup(source, names) {
  if (!isRecord(source)) return "";
  const wanted = names.map(normalizedKey);
  const entries = Object.entries(source).map(([key, value]) => ({
    candidate: normalizedKey(key),
    value,
  }));
  for (const name of wanted) {
    for (const { candidate, value } of entries) {
      if (candidate !== name) continue;
      const scalar = safeScalar(value);
      if (scalar) return scalar;
    }
    for (const { candidate, value } of entries) {
      if ([`data${name}`, `customfields${name}`, `datacustomfields${name}`].includes(candidate)) {
        const scalar = safeScalar(value);
        if (scalar) return scalar;
      }
    }
  }
  return "";
}

function sourcesFor(raw) {
  const root = parseJsonObject(raw) || (isRecord(raw) ? raw : {});
  const data = parseJsonObject(root.data);
  const primary = data || (isRecord(root.data) ? root.data : root);
  const custom =
    parseJsonObject(primary.customFields) ||
    (isRecord(primary.customFields) ? primary.customFields : null) ||
    parseJsonObject(root.customFields) ||
    (isRecord(root.customFields) ? root.customFields : null);
  return { root, primary, custom, sources: [primary, custom, root].filter(Boolean) };
}

function pick(context, ...names) {
  for (const source of context.sources) {
    const value = lookup(source, names);
    if (value) return value;
  }
  return "";
}

function providerSucceeded(value) {
  if (value === true || value === 1) return true;
  return /^(?:1|true|success|ok)$/i.test(safeScalar(value));
}

function sanitizedGrowFailure(root, operation) {
  const err = root?.err;
  const errorObject = parseJsonObject(err) || (isRecord(err) ? err : null);
  const providerCode =
    safeScalar(errorObject?.id || errorObject?.code || root?.errorCode, 40) || "REJECTED";
  const message = safeScalar(errorObject?.message || err || root?.message, 180);
  const already =
    operation === "approveTransaction" && /already.{0,30}approv|כבר.{0,30}אושר/i.test(message);
  if (already) return { alreadyApproved: true };
  throw new PaymentError(
    `GROW_${operation.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_${providerCode.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`,
    "ספק התשלום דחה את הבקשה.",
    502,
  );
}

export function requireSuccessfulGrowEnvelope(raw, operation) {
  const context = sourcesFor(raw);
  if (!providerSucceeded(context.root.status)) {
    const result = sanitizedGrowFailure(context.root, operation);
    if (result?.alreadyApproved) return { ...context, alreadyApproved: true };
  }
  return context;
}

export function normalizeGrowAmountMinor(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    const minor = Math.round(value * 100);
    return Math.abs(value * 100 - minor) < 1e-7 ? minor : null;
  }
  const raw = safeScalar(value, 40).replace(/\s/g, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.replace(",", ".").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

function requiredIdentifier(value, label) {
  const identifier = safeScalar(value, 500);
  if (!identifier || !/^[A-Za-z0-9_%+./=-]+$/.test(identifier)) {
    throw new PaymentError("GROW_RESPONSE_INVALID", `Grow response is missing ${label}.`, 502);
  }
  return identifier;
}

function paymentEvidenceFromContext(context) {
  const processId = requiredIdentifier(pick(context, "processId"), "processId");
  const processToken = requiredIdentifier(pick(context, "processToken"), "processToken");
  const transactionId = requiredIdentifier(pick(context, "transactionId"), "transactionId");
  const transactionToken = requiredIdentifier(
    pick(context, "transactionToken"),
    "transactionToken",
  );
  const amountRaw = pick(context, "sum", "amount");
  const amountMinor = normalizeGrowAmountMinor(amountRaw);
  if (amountMinor === null) {
    throw new PaymentError("GROW_RESPONSE_INVALID", "Grow returned an invalid amount.", 502);
  }

  const approvalFields = {};
  for (const name of APPROVAL_FIELD_NAMES) {
    const value = pick(context, name);
    if (value) approvalFields[name] = value;
  }

  return {
    processId,
    processToken,
    transactionId,
    transactionToken,
    refundTransactionId: pick(context, "refundedTransactionId", "refundTransactionId") || null,
    transactionTypeId: pick(context, "transactionTypeId", "TransactionTypeId"),
    paymentType: pick(context, "paymentType"),
    amountMinor,
    amountMajor: amountRaw,
    statusCode: pick(context, "statusCode"),
    statusText: pick(context, "transactionStatus", "statusText", "dataStatus", "status"),
    productKey: pick(context, "cField1", "productKey", "description"),
    currency: pick(context, "cField2", "currency").toUpperCase(),
    approvalFields,
  };
}

export function normalizeGrowCallback(raw) {
  const context = sourcesFor(raw);
  return paymentEvidenceFromContext(context);
}

export function normalizeGrowInquiryResponse(raw) {
  const context = requireSuccessfulGrowEnvelope(raw, "getPaymentProcessInfo");
  return paymentEvidenceFromContext(context);
}

function validGrowCheckoutUrl(value, expectedBaseUrl) {
  try {
    const url = new URL(value);
    const base = new URL(expectedBaseUrl);
    return (
      url.protocol === "https:" && url.hostname === base.hostname && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

export function normalizeGrowCreateResponse(raw, expectedBaseUrl) {
  const context = requireSuccessfulGrowEnvelope(raw, "createPaymentProcess");
  const processId = requiredIdentifier(pick(context, "processId"), "processId");
  const processToken = requiredIdentifier(pick(context, "processToken"), "processToken");
  const checkoutUrl = pick(context, "url", "paymentUrl", "paymentProcessUrl", "urlToPay");
  if (!validGrowCheckoutUrl(checkoutUrl, expectedBaseUrl)) {
    throw new PaymentError("GROW_RESPONSE_INVALID", "Grow returned an invalid checkout URL.", 502);
  }
  return { processId, processToken, checkoutUrl };
}

export function normalizeGrowApprovalResponse(raw) {
  const context = requireSuccessfulGrowEnvelope(raw, "approveTransaction");
  return { confirmed: true, alreadyApproved: Boolean(context.alreadyApproved) };
}

export function normalizeGrowRefundResponse(raw) {
  const context = requireSuccessfulGrowEnvelope(raw, "refundTransaction");
  const statusCode = pick(context, "statusCode");
  const statusText = pick(context, "refundStatus", "statusText", "dataStatus", "status");
  const refundTransactionId = pick(context, "refundedTransactionId", "refundTransactionId");
  const transactionId = pick(context, "transactionId");
  const amountMinor = normalizeGrowAmountMinor(pick(context, "refundSum", "sum", "amount"));
  const confirmed =
    statusCode === "3" && Boolean(refundTransactionId) && /זוכ|refund|credit/i.test(statusText);
  return {
    state: confirmed ? "confirmed" : "requested",
    statusCode,
    statusText: safeScalar(statusText, 120),
    refundTransactionId: safeScalar(refundTransactionId, 160) || null,
    transactionId: safeScalar(transactionId, 160) || null,
    amountMinor,
  };
}

export function normalizeGrowInvoiceCallback(raw) {
  const context = sourcesFor(raw);
  const transactionId = safeScalar(pick(context, "transactionCode", "transactionId"), 160);
  const invoiceNumber = safeScalar(pick(context, "invoiceNumber"), 160);
  const invoiceUrl = safeScalar(pick(context, "invoiceUrl"), 2048);
  let safeUrl = "";
  try {
    const parsed = new URL(invoiceUrl);
    const trustedHost =
      parsed.hostname === "meshulam.co.il" ||
      parsed.hostname.endsWith(".meshulam.co.il") ||
      parsed.hostname === "grow.business" ||
      parsed.hostname.endsWith(".grow.business");
    if (parsed.protocol === "https:" && trustedHost && !parsed.username && !parsed.password) {
      safeUrl = parsed.toString();
    }
  } catch {
    safeUrl = "";
  }
  if (!transactionId || !invoiceNumber || !safeUrl) {
    throw new PaymentError("GROW_INVOICE_INVALID", "Invalid invoice callback.", 400);
  }
  return { transactionId, invoiceNumber, invoiceUrl: safeUrl };
}

export function isGrowPaidEvidence(evidence) {
  return evidence?.statusCode === "2";
}
