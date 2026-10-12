import crypto from "crypto";
import PaymentOrder from "../../models/PaymentOrder.js";
import UnclaimedPayment from "../../models/UnclaimedPayment.js";
import User from "../../models/User.js";
import { getRecommendationAccessForUser } from "../../utils/recommendationAccess.js";
import { acceptedAmountsMinor, AI_COUNSELOR_TOP_TWO_PRODUCT_KEY, getPaymentProduct } from "./catalog.js";
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

/** Best-effort ping to the owner's Slack (SLACK_WEBHOOK_URL); never delays or fails the webhook. */
function notifySlack(env, message) {
  const url = text(env.SLACK_WEBHOOK_URL, 500);
  if (!url.startsWith("https://hooks.slack.com/")) return;
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: message }),
    signal: AbortSignal.timeout(5000),
  }).catch((error) => logGrowLink("warn", "slack notify failed", { error: error.message }));
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
const UNSAFE_KEY_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Grow posts form fields as flat bracket keys ("data[transactionId]", "data[customFields][cField1]").
 * Rebuild the nesting they describe; keys that try to reach the prototype are dropped.
 */
export function unflattenBracketKeys(record) {
  if (!isRecord(record) || !Object.keys(record).some((key) => key.includes("["))) return record;
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    const match = /^([^[\]]+)((?:\[[^[\]]*\])*)$/.exec(key);
    const path = match
      ? [match[1], ...[...match[2].matchAll(/\[([^[\]]*)\]/g)].map((m) => m[1])]
      : [key];
    if (path.some((segment) => UNSAFE_KEY_SEGMENTS.has(segment))) continue;
    let node = out;
    for (let i = 0; i < path.length - 1; i += 1) {
      if (!isRecord(node[path[i]])) node[path[i]] = {};
      node = node[path[i]];
    }
    node[path[path.length - 1]] = value;
  }
  return out;
}

export function normalizeGrowLinkWebhook(raw) {
  const root = unflattenBracketKeys(parseMaybeJson(raw) || (isRecord(raw) ? raw : {}));
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
    payerPhone: israeliMobileDigits(source.payerPhone || source.phone),
    webhookKey: text(root.webhookKey || source.webhookKey, 160),
    claimCodes,
    // Field names only (never values), so an unexpected shape is diagnosable from the log.
    fieldNames: [
      ...Object.keys(root),
      ...(data ? Object.keys(data).map((k) => `data.${k}`) : []),
    ].slice(0, 60),
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

/** "050-123 4567", "+972501234567", "0501234567" all become "501234567"; anything else is "". */
export function israeliMobileDigits(value) {
  const digits = text(value, 40)
    .replace(/\D/g, "")
    .replace(/^(?:972|0)/, "");
  return /^5\d{8}$/.test(digits) ? digits : "";
}

/** Grow requires a phone, so it backs up the email when the buyer typed a different one. */
async function findUserForPayer({ payerEmail, payerPhone }) {
  if (payerEmail) {
    const user = await User.findOne({ email: payerEmail }).select("_id").lean();
    if (user) return { user, via: "email" };
  }
  if (payerPhone) {
    // Stored phones may keep dashes or a +972 prefix. Phones are not unique, so only a single hit counts.
    const pattern = `^(?:\\+?972-?|0)?${payerPhone.split("").join("-?")}$`;
    const users = await User.find({ phone: { $regex: pattern } })
      .select("_id")
      .limit(2)
      .lean();
    if (users.length === 1) return { user: users[0], via: "phone" };
  }
  return { user: null, via: "" };
}

async function findOrCreateOrderForPayer(payer, productKey) {
  if (!payer.payerEmail && !payer.payerPhone) return { order: null, reason: "no_payer_contact" };
  const { user, via } = await findUserForPayer(payer);
  if (!user) return { order: null, reason: "no_account_for_payer" };
  return orderForUser(user._id, payer.amountMinor, productKey, via);
}

/** The user's open link order, or a fresh pending one to settle the payment against. */
async function orderForUser(userId, amountMinor, productKey, via) {
  const pending = await PaymentOrder.findOne({
    userId,
    provider: "grow_link",
    productKey,
    status: { $in: ["pending", "processing"] },
  })
    .sort({ createdAt: -1 })
    .select(PAYMENT_PRIVATE_SELECT);
  if (pending) return { order: pending, reason: `${via}_pending_order` };

  const access = await getRecommendationAccessForUser(userId);
  if (access.topTwoUnlocked) return { order: null, reason: "already_unlocked" };

  const product = getPaymentProduct(productKey);
  const openOrderKey = paymentOpenOrderKey(userId, product.productKey);
  await PaymentOrder.updateMany(
    { openOrderKey, status: { $in: ["created", "failed"] } },
    { $set: { status: "expired", openOrderKey: null, expiredAt: new Date() } },
  );
  const order = await PaymentOrder.create({
    userId,
    productKey: product.productKey,
    // Record what was actually paid (sale or regular price; both passed the gate).
    amountMinor: Number.isSafeInteger(amountMinor) ? amountMinor : product.amountMinor,
    currency: product.currency,
    provider: "grow_link",
    status: "pending",
    callbackSecretHash: hashPaymentSecret(createOpaqueSecret()),
    returnSecretHash: hashPaymentSecret(createOpaqueSecret()),
  });
  return { order, reason: `${via}_new_order` };
}

const RECENT_CHECKOUT_MS = 30 * 60 * 1000;

/**
 * Nothing on the payment names an account, but if exactly one person pressed "pay" in the last
 * 30 minutes and has not paid yet, this payment is theirs. Two or more at once stay unmatched.
 */
async function findRecentCheckoutOrder(productKey, now = Date.now()) {
  const orders = await PaymentOrder.find({
    provider: "grow_link",
    productKey,
    status: { $in: ["pending", "processing"] },
    checkoutStartedAt: { $gte: new Date(now - RECENT_CHECKOUT_MS) },
  })
    .sort({ checkoutStartedAt: -1 })
    .limit(5)
    .select(PAYMENT_PRIVATE_SELECT);
  const users = new Set(orders.map((order) => String(order.userId)));
  return users.size === 1 ? orders[0] : null;
}

/** What a buyer typed to find their payment: an email, or an Israeli mobile number. */
export function parseClaimContact(value) {
  const raw = text(value, 254).toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { email: raw, phone: "" };
  return { email: "", phone: israeliMobileDigits(raw) };
}

const CLAIM_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A signed-in buyer attaches a parked payment to their account. Their own email and phone are
 * always tried; `contact` adds the email or phone they typed on Grow's page if it was different.
 */
export async function claimUnclaimedPayment({
  userId,
  contact = "",
  env = process.env,
  persistence = paymentPersistence,
  productKey = AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
}) {
  const user = await User.findById(userId).select("email phone").lean();
  if (!user) return { state: "not_found" };
  const access = await getRecommendationAccessForUser(userId);
  if (access.topTwoUnlocked) return { state: "already_unlocked" };

  const typed = parseClaimContact(contact);
  const emails = [...new Set([text(user.email, 254).toLowerCase(), typed.email].filter(Boolean))];
  const phones = [...new Set([israeliMobileDigits(user.phone), typed.phone].filter(Boolean))];
  if (!emails.length && !phones.length) return { state: "not_found" };

  const payment = await UnclaimedPayment.findOneAndUpdate(
    {
      claimedAt: null,
      createdAt: { $gte: new Date(Date.now() - CLAIM_WINDOW_MS) },
      $or: [
        ...(emails.length ? [{ payerEmail: { $in: emails } }] : []),
        ...(phones.length ? [{ payerPhone: { $in: phones } }] : []),
      ],
    },
    { $set: { claimedBy: userId, claimedAt: new Date() } },
    { new: true, sort: { createdAt: -1 } },
  );
  if (!payment) return { state: "not_found" };

  try {
    const { order } = await orderForUser(userId, payment.amountMinor, productKey, "claim");
    if (!order) return { state: "already_unlocked" };
    const finalized = await persistence.finalizePaid({
      orderId: order._id,
      evidence: { transactionId: payment.transactionId, statusCode: "2" },
    });
    logGrowLink("info", "paid (claimed by buyer)", {
      transactionId: payment.transactionId,
      order: order.publicId,
    });
    notifySlack(
      env,
      `:white_check_mark: A buyer claimed their unmatched payment (transaction ${payment.transactionId}); places 3, 2 and 1 unlocked.`,
    );
    return { state: finalized.status || "paid" };
  } catch (error) {
    // Put it back so the buyer (or the operator) can try again.
    await UnclaimedPayment.updateOne(
      { _id: payment._id },
      { $set: { claimedBy: null, claimedAt: null } },
    );
    throw error;
  }
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
    logGrowLink("warn", "ignored: missing transaction id", {
      ...summary,
      fields: evidence.fieldNames,
    });
    return { state: "ignored", reason: "missing_transaction_id" };
  }
  if (!evidence.paid) {
    return { state: "ignored", reason: "not_paid" };
  }
  const product = getPaymentProduct(productKey);
  // Either real price counts, so switching the Grow link a little before or after a sale
  // boundary never leaves someone who paid without an unlock.
  if (!acceptedAmountsMinor(productKey).includes(evidence.amountMinor)) {
    logGrowLink("warn", "ignored: amount mismatch", summary);
    notifySlack(
      env,
      `:warning: Grow payment with an unexpected amount (${(evidence.amountMinor ?? 0) / 100} ILS, transaction ${evidence.transactionId}). Nothing was unlocked; check it in Grow.`,
    );
    return { state: "ignored", reason: "amount_mismatch" };
  }

  const owner = await PaymentOrder.findOne({ providerTransactionId: evidence.transactionId })
    .select("_id status")
    .lean();
  if (owner) return { state: owner.status, duplicate: true };

  let order = await findOrderForClaimCodes(evidence.claimCodes);
  let reason = order ? "claim_code" : "";
  if (!order) ({ order, reason } = await findOrCreateOrderForPayer(evidence, productKey));
  if (!order && reason !== "already_unlocked") {
    order = await findRecentCheckoutOrder(productKey);
    if (order) reason = "recent_checkout";
  }
  if (!order) {
    await UnclaimedPayment.updateOne(
      { transactionId: evidence.transactionId },
      {
        $setOnInsert: {
          amountMinor: evidence.amountMinor,
          payerEmail: evidence.payerEmail,
          payerPhone: evidence.payerPhone,
        },
      },
      { upsert: true },
    );
    logGrowLink("warn", `unmatched payment parked for the buyer to claim (${reason})`, {
      ...summary,
      payerEmail: evidence.payerEmail,
      payerPhone: evidence.payerPhone,
    });
    notifySlack(
      env,
      `:hourglass: ₪${evidence.amountMinor / 100} paid, not matched yet (${reason.replace(/_/g, " ")}). The buyer can claim it from their account with ${evidence.payerEmail || "the phone they paid with"}. Transaction ${evidence.transactionId}.`,
    );
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
  if (!finalized.duplicate) {
    notifySlack(
      env,
      `:moneybag: New payment: ₪${evidence.amountMinor / 100}, places 3, 2 and 1 unlocked (matched by ${reason.replace(/_/g, " ")}). Transaction ${evidence.transactionId}.`,
    );
  }
  return {
    state: finalized.status || "paid",
    duplicate: Boolean(finalized.duplicate),
    order: finalized.order,
  };
}
