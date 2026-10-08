import crypto from "crypto";
import PaymentOrder from "../../models/PaymentOrder.js";
import User from "../../models/User.js";
import { getRecommendationAccessForUser } from "../../utils/recommendationAccess.js";
import { AI_COUNSELOR_TOP_TWO_PRODUCT_KEY, getPaymentProduct } from "./catalog.js";
import { PaymentError } from "./errors.js";
import { normalizeGrowAmountMinor } from "./growNormalization.js";
import { paymentOpenOrderKey } from "./orderState.js";
import { PAYMENT_PRIVATE_SELECT, paymentPersistence } from "./paymentPersistence.js";
import { createOpaqueSecret, hashPaymentSecret } from "./secrets.js";

const CLAIM_CODE_PATTERN = /(?<![A-Z0-9])[A-Z2-9]{6}(?![A-Z0-9])/g;
const PAID_STATUS_TEXT = /^(?:שולם|paid|success)$/i;

function text(value, maxLength = 500) {
  if (value === undefined || value === null) return "";
  if (!["string", "number", "boolean"].includes(typeof value)) return "";
  return String(value)
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseMaybeJson(value) {
  if (isRecord(value) || Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  const source = value.trim();
  if (!source.startsWith("{") && !source.startsWith("[")) return null;
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}

function constantTimeEquals(left, right) {
  const a = Buffer.from(hashPaymentSecret(String(left)), "hex");
  const b = Buffer.from(hashPaymentSecret(String(right)), "hex");
  return crypto.timingSafeEqual(a, b);
}

function collectStrings(value, output, depth = 0) {
  if (depth > 4 || output.length > 200) return;
  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return;
  }
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) {
    for (const item of parsed) collectStrings(item, output, depth + 1);
  } else if (isRecord(parsed)) {
    for (const item of Object.values(parsed)) collectStrings(item, output, depth + 1);
  }
}

/**
 * Grow sends one of two shapes for payment-link payments: the new banking
 * system's `{ status, data: {...} }` envelope, or the legacy flat object with
 * `webhookKey` / `transactionCode`. Legacy webhooks are only sent for
 * successful charges, so they carry no status code.
 */
export function normalizeGrowLinkWebhook(raw) {
  const root = parseMaybeJson(raw) || (isRecord(raw) ? raw : {});
  const data = parseMaybeJson(root.data) || (isRecord(root.data) ? root.data : null);
  const source = data || root;
  const legacy = !data;

  const transactionId = text(source.transactionId || source.transactionCode, 160);
  const statusCode = text(source.statusCode, 20);
  const statusText = text(source.status, 40);
  const paid = legacy
    ? Boolean(text(root.transactionCode))
    : statusCode === "2" || (!statusCode && PAID_STATUS_TEXT.test(statusText));

  const customValues = [];
  for (const key of ["dynamicFields", "purchaseCustomField", "customFields"]) {
    collectStrings(source[key], customValues);
  }
  for (let index = 1; index <= 9; index += 1) {
    collectStrings(source[`cField${index}`], customValues);
  }
  collectStrings(source.description || source.paymentDesc, customValues);
  const claimCodes = [
    ...new Set(
      customValues.flatMap((value) => value.toUpperCase().match(CLAIM_CODE_PATTERN) || []),
    ),
  ].slice(0, 10);

  return {
    transactionId,
    paid,
    statusCode: statusCode || (legacy && paid ? "2" : ""),
    amountMinor: normalizeGrowAmountMinor(source.sum ?? source.paymentSum ?? source.amount),
    payerEmail: text(source.payerEmail || source.email, 254).toLowerCase(),
    webhookKey: text(root.webhookKey || source.webhookKey, 160),
    claimCodes,
  };
}

export function verifyGrowLinkWebhookSecret(callbackSecret, env = process.env) {
  const expected = text(env.GROW_LINK_WEBHOOK_SECRET, 200);
  if (!expected || typeof callbackSecret !== "string" || !callbackSecret) return false;
  return constantTimeEquals(callbackSecret, expected);
}

function logGrowLink(level, event, details) {
  console[level](`[payments/grow_link] ${event}`, JSON.stringify(details));
}

async function findOrderForClaimCodes(claimCodes) {
  if (claimCodes.length === 0) return null;
  return PaymentOrder.findOne({
    provider: "grow_link",
    claimCode: { $in: claimCodes },
    status: { $in: ["pending", "processing", "expired"] },
  })
    .sort({ createdAt: -1 })
    .select(PAYMENT_PRIVATE_SELECT);
}

async function findOrCreateOrderForEmail(email, productKey) {
  if (!email) return { order: null, reason: "no_payer_email" };
  const user = await User.findOne({ email }).select("_id").lean();
  if (!user) return { order: null, reason: "no_account_for_email" };

  const pending = await PaymentOrder.findOne({
    userId: user._id,
    provider: "grow_link",
    productKey,
    status: { $in: ["pending", "processing"] },
  })
    .sort({ createdAt: -1 })
    .select(PAYMENT_PRIVATE_SELECT);
  if (pending) return { order: pending, reason: "email_pending_order" };

  const access = await getRecommendationAccessForUser(user._id);
  if (access.topTwoUnlocked) return { order: null, reason: "already_unlocked" };

  const product = getPaymentProduct(productKey);
  const openOrderKey = paymentOpenOrderKey(user._id, product.productKey);
  await PaymentOrder.updateMany(
    { openOrderKey, status: { $in: ["created", "failed"] } },
    { $set: { status: "expired", openOrderKey: null, expiredAt: new Date() } },
  );
  const order = await PaymentOrder.create({
    userId: user._id,
    productKey: product.productKey,
    amountMinor: product.amountMinor,
    currency: product.currency,
    provider: "grow_link",
    status: "pending",
    callbackSecretHash: hashPaymentSecret(createOpaqueSecret()),
    returnSecretHash: hashPaymentSecret(createOpaqueSecret()),
  });
  return { order, reason: "email_new_order" };
}

/**
 * Returns a result for every authenticated webhook (including ones we cannot
 * act on) so Grow does not retry forever; unmatched payments are logged for
 * the operator to resolve with `scripts/grow-link-admin.mjs`.
 */
export async function processGrowLinkWebhook({
  callbackSecret,
  payload,
  env = process.env,
  persistence = paymentPersistence,
  productKey = AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
}) {
  if (!verifyGrowLinkWebhookSecret(callbackSecret, env)) {
    throw new PaymentError("PAYMENT_CALLBACK_NOT_FOUND", "Not found", 404);
  }
  const evidence = normalizeGrowLinkWebhook(payload);
  const expectedKey = text(env.GROW_WEBHOOK_KEY, 160);
  if (
    expectedKey &&
    !(evidence.webhookKey && constantTimeEquals(evidence.webhookKey, expectedKey))
  ) {
    throw new PaymentError("PAYMENT_CALLBACK_NOT_FOUND", "Not found", 404);
  }

  const summary = {
    transactionId: evidence.transactionId,
    amountMinor: evidence.amountMinor,
    claimCodes: evidence.claimCodes,
    hasEmail: Boolean(evidence.payerEmail),
  };
  if (!evidence.transactionId) {
    logGrowLink("warn", "ignored: missing transaction id", summary);
    return { state: "ignored", reason: "missing_transaction_id" };
  }
  if (!evidence.paid) {
    return { state: "ignored", reason: "not_paid" };
  }
  const product = getPaymentProduct(productKey);
  if (evidence.amountMinor !== product.amountMinor) {
    logGrowLink("warn", "ignored: amount mismatch", summary);
    return { state: "ignored", reason: "amount_mismatch" };
  }

  const owner = await PaymentOrder.findOne({ providerTransactionId: evidence.transactionId })
    .select("_id status")
    .lean();
  if (owner) return { state: owner.status, duplicate: true };

  let order = await findOrderForClaimCodes(evidence.claimCodes);
  let reason = order ? "claim_code" : "";
  if (!order)
    ({ order, reason } = await findOrCreateOrderForEmail(evidence.payerEmail, productKey));
  if (!order) {
    logGrowLink("error", `UNMATCHED payment needs manual review (${reason})`, {
      ...summary,
      payerEmail: evidence.payerEmail,
    });
    return { state: "unmatched", reason };
  }

  const finalized = await persistence.finalizePaid({
    orderId: order._id,
    evidence: {
      transactionId: evidence.transactionId,
      statusCode: evidence.statusCode || "2",
    },
  });
  logGrowLink("info", "paid", { ...summary, order: order.publicId, matchedBy: reason });
  return {
    state: finalized.status || "paid",
    duplicate: Boolean(finalized.duplicate),
    order: finalized.order,
  };
}
