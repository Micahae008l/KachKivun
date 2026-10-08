import crypto from "crypto";
import PaymentOrder from "../../models/PaymentOrder.js";
import User from "../../models/User.js";
import { getRecommendationAccessForUser } from "../../utils/recommendationAccess.js";
import { getPaymentConfig, choosePaymentMethod } from "./config.js";
import {
  AI_COUNSELOR_TOP_TWO_PRODUCT_KEY,
  getPaymentProduct,
  PAYMENT_METHOD_PRIORITY,
  publicPaymentProduct,
} from "./catalog.js";
import { cleanPaymentError, PaymentError } from "./errors.js";
import { normalizeGrowInvoiceCallback } from "./growNormalization.js";
import {
  PAYMENT_PRIVATE_SELECT,
  findPrivateOrderByPublicId,
  findPrivateOrderByShareHash,
  paymentPersistence,
} from "./paymentPersistence.js";
import { createLifecyclePaymentProvider, createPaymentProvider } from "./providerFactory.js";
import {
  cancellationActionForStatus,
  classifyInvoiceReceipt,
  isDefinitiveFailedCreate,
  OPEN_PAYMENT_ORDER_STATUSES,
  payerPurgeFields,
  paymentOpenOrderKey,
  refundOutcomeMayExist,
} from "./orderState.js";
import {
  buildMockPaymentEvidence,
  verifyApproveAndGrantGrowPayment,
  verifyGrowRefundEvidence,
} from "./paymentStateMachine.js";
import { createOpaqueSecret, hashPaymentSecret, paymentSecretMatches } from "./secrets.js";

const SHARE_LIFETIME_MS = 48 * 60 * 60 * 1000;
export const CANCELLATION_ORDER_STATUSES = Object.freeze(["paid", "refund_requested", "refunded"]);

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializePaymentOrder(order, { includeCheckoutUrl = true } = {}) {
  const refundState =
    order.status === "refunded"
      ? "provider_confirmed"
      : order.status === "refund_requested"
        ? "pending_provider"
        : order.status === "paid"
          ? "eligible"
          : "not_eligible";
  const output = {
    id: order.publicId,
    product: publicPaymentProduct(order.productKey),
    status: order.status,
    provider: order.provider,
    paymentMethod: order.chosenMethod || null,
    confirmations: {
      termsAndCancellationAccepted: Boolean(order.termsAndCancellationAcceptedAt),
      adultPayerConfirmed: Boolean(order.adultPayerConfirmedAt),
    },
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    paidAt: iso(order.paidAt),
    refundRequestedAt: iso(order.refundRequestedAt),
    refundedAt: iso(order.refundedAt),
    cancellation: {
      requestEligible: order.status === "paid",
      state: refundState,
    },
    invoice:
      ["paid", "refund_requested", "refunded"].includes(order.status) &&
      order.invoiceNumber &&
      order.invoiceUrl
        ? { number: order.invoiceNumber, url: order.invoiceUrl }
        : null,
    refundReceipt:
      ["refund_requested", "refunded"].includes(order.status) &&
      order.refundInvoiceNumber &&
      order.refundInvoiceUrl
        ? { number: order.refundInvoiceNumber, url: order.refundInvoiceUrl }
        : null,
  };
  if (includeCheckoutUrl && order.checkoutUrl) output.checkoutUrl = order.checkoutUrl;
  if (order.provider === "grow_link" && order.status === "pending" && order.claimCode) {
    output.claimCode = order.claimCode;
    if (order.$locals?.returnUrl) output.returnUrl = order.$locals.returnUrl;
  }
  if (order.provider === "mock" && order.status === "pending") {
    output.requiresMockConfirmation = true;
  }
  return output;
}

function buildPaymentUrls(config, order, callbackSecret, returnSecret) {
  const successUrl = new URL("/payment/return", config.frontendOrigin);
  successUrl.searchParams.set("order", order.publicId);
  successUrl.searchParams.set("token", returnSecret);
  successUrl.searchParams.set("flow", order.shareTokenHash ? "parent" : "account");
  const cancelUrl = new URL("/payment/return", config.frontendOrigin);
  cancelUrl.searchParams.set("order", order.publicId);
  cancelUrl.searchParams.set("token", returnSecret);
  cancelUrl.searchParams.set("flow", order.shareTokenHash ? "parent" : "account");
  cancelUrl.searchParams.set("interrupted", "1");

  const callbackPart = `${encodeURIComponent(order.publicId)}/${encodeURIComponent(
    callbackSecret,
  )}`;
  return {
    successUrl: successUrl.toString(),
    cancelUrl: cancelUrl.toString(),
    notifyUrl: `${config.apiOrigin}/api/payments/webhooks/grow/notify/${callbackPart}`,
    invoiceNotifyUrl: `${config.apiOrigin}/api/payments/webhooks/grow/invoice/${callbackPart}`,
  };
}

export function getPublicPaymentOffer(config = getPaymentConfig()) {
  const configuredProvider =
    config.provider === "disabled" ? config.configuredProvider : config.provider;
  return {
    enabled: Boolean(config.enabled),
    personalizedFunnelV2:
      typeof config.personalizedFunnelV2 === "boolean"
        ? config.personalizedFunnelV2
        : !/^(?:0|false|no|off)$/i.test(String(process.env.PERSONALIZED_FUNNEL_V2 || "").trim()),
    product: publicPaymentProduct(),
    paymentMethods: config.enabled
      ? PAYMENT_METHOD_PRIORITY.filter((method) => config.availableMethods.includes(method))
      : [],
    processor: processorLabel(configuredProvider),
    receiptsProvided: isGrowProvider(configuredProvider),
    hostedPayerDetails: configuredProvider === "grow_link",
    merchant: { ...(config.merchant || {}) },
  };
}

function isGrowProvider(provider) {
  return provider === "grow" || provider === "grow_link";
}

function processorLabel(provider) {
  return isGrowProvider(provider) ? "Grow" : "Mock (development only)";
}

const CLAIM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function createClaimCode() {
  const bytes = crypto.randomBytes(6);
  return [...bytes].map((byte) => CLAIM_CODE_ALPHABET[byte % CLAIM_CODE_ALPHABET.length]).join("");
}

export async function listAuthenticatedPaymentOrders({
  userId,
  limit = 25,
  provider,
  persistence = paymentPersistence,
}) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 25));
  const orders = await PaymentOrder.find({
    userId,
    status: { $in: CANCELLATION_ORDER_STATUSES },
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit)
    .select(PAYMENT_PRIVATE_SELECT);
  const reconciled = [];
  for (const order of orders) {
    if (order.status !== "refund_requested") {
      reconciled.push(order);
      continue;
    }
    const result = await reconcileOrder(order, {
      provider,
      persistence,
    });
    reconciled.push(result.order);
  }
  return reconciled.map((order) => serializePaymentOrder(order, { includeCheckoutUrl: false }));
}

async function ensureNotAlreadyEntitled(userId, productKey) {
  if (productKey !== AI_COUNSELOR_TOP_TWO_PRODUCT_KEY) return;
  const access = await getRecommendationAccessForUser(userId);
  if (access.topTwoUnlocked) {
    throw new PaymentError("PAYMENT_ALREADY_ENTITLED", "המוצר כבר פתוח בחשבון הזה.", 409);
  }
}

async function accountEmailForUser(userId) {
  const user = await User.findById(userId).select("email emailVerifiedAt").lean();
  const email = String(user?.email || "")
    .trim()
    .toLowerCase();
  if (!email || !user?.emailVerifiedAt) {
    throw new PaymentError(
      "PAYMENT_ACCOUNT_EMAIL_MISSING",
      "לא נמצאה כתובת אימייל מאומתת בחשבון.",
      409,
    );
  }
  return email;
}

async function createOrder({
  userId,
  productKey,
  provider,
  idempotencyKey = null,
  shareTokenHash = null,
  shareExpiresAt = null,
}) {
  const product = getPaymentProduct(productKey);
  return PaymentOrder.create({
    userId,
    productKey: product.productKey,
    amountMinor: product.amountMinor,
    currency: product.currency,
    provider,
    openOrderKey: paymentOpenOrderKey(userId, product.productKey),
    idempotencyKey,
    shareTokenHash,
    shareExpiresAt,
    callbackSecretHash: hashPaymentSecret(createOpaqueSecret()),
    returnSecretHash: hashPaymentSecret(createOpaqueSecret()),
  });
}

async function findOpenOrderForUserProduct(userId, productKey) {
  const openOrderKey = paymentOpenOrderKey(userId, productKey);
  let order = await PaymentOrder.findOne({
    $or: [
      { openOrderKey },
      {
        userId,
        productKey,
        status: { $in: OPEN_PAYMENT_ORDER_STATUSES },
        openOrderKey: null,
      },
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .select(PAYMENT_PRIVATE_SELECT);
  if (!order || order.openOrderKey) return order;

  try {
    order = await PaymentOrder.findOneAndUpdate(
      {
        _id: order._id,
        status: { $in: OPEN_PAYMENT_ORDER_STATUSES },
        openOrderKey: null,
      },
      { $set: { openOrderKey } },
      { new: true, runValidators: true },
    ).select(PAYMENT_PRIVATE_SELECT);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    order = await PaymentOrder.findOne({ openOrderKey }).select(PAYMENT_PRIVATE_SELECT);
  }
  return order;
}

export async function startOrderCheckout({
  order,
  payer,
  confirmations,
  requestedMethod,
  config = getPaymentConfig(),
  provider = createPaymentProvider({ config }),
}) {
  if (config.provider !== order.provider) {
    throw new PaymentError(
      "PAYMENT_PROVIDER_CHANGED",
      "הגדרת ספק התשלום השתנתה. יש ליצור הזמנה חדשה.",
      409,
    );
  }
  if (
    confirmations?.termsAndCancellationAccepted !== true ||
    confirmations?.adultPayerConfirmed !== true
  ) {
    throw new PaymentError(
      "PAYMENT_CONFIRMATIONS_REQUIRED",
      "יש לאשר את התנאים ואת גיל המשלם או המשלמת.",
      400,
    );
  }
  if (order.status !== "created") {
    throw new PaymentError(
      "PAYMENT_CHECKOUT_ALREADY_STARTED",
      "תהליך תשלום עבור הזמנה זו כבר התחיל.",
      409,
    );
  }

  if (config.provider === "grow" && (!payer?.fullName || !payer?.phone)) {
    throw new PaymentError("PAYMENT_PAYER_REQUIRED", "יש למלא שם מלא ומספר נייד.", 400);
  }
  const method = choosePaymentMethod(config, requestedMethod);
  const callbackSecret = createOpaqueSecret();
  const returnSecret = createOpaqueSecret();
  const confirmedAt = new Date();
  let claimed;
  try {
    claimed = await PaymentOrder.findOneAndUpdate(
      { _id: order._id, status: "created" },
      {
        $set: {
          status: "processing",
          openOrderKey: paymentOpenOrderKey(order.userId, order.productKey),
          payerFullName: payer?.fullName || "",
          payerPhone: payer?.phone || "",
          payerEmail: payer?.email || "",
          ...(order.provider === "grow_link" ? { claimCode: createClaimCode() } : {}),
          termsAndCancellationAcceptedAt: confirmedAt,
          adultPayerConfirmedAt: confirmedAt,
          chosenMethod: method,
          createOutcome: "none",
          callbackSecretHash: hashPaymentSecret(callbackSecret),
          returnSecretHash: hashPaymentSecret(returnSecret),
          checkoutStartedAt: new Date(),
          sanitizedError: null,
        },
      },
      { new: true, runValidators: true },
    ).select(PAYMENT_PRIVATE_SELECT);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    throw new PaymentError(
      "PAYMENT_OPEN_ORDER_EXISTS",
      "כבר קיימת הזמנת תשלום פתוחה עבור מוצר זה.",
      409,
    );
  }
  if (!claimed) {
    throw new PaymentError(
      "PAYMENT_CHECKOUT_ALREADY_STARTED",
      "תהליך תשלום עבור הזמנה זו כבר התחיל.",
      409,
    );
  }

  const product = getPaymentProduct(claimed.productKey);
  const urls = buildPaymentUrls(config, claimed, callbackSecret, returnSecret);
  let processMayExist = false;
  try {
    const process = await provider.createPaymentProcess({
      order: claimed,
      payer,
      method,
      product,
      urls,
    });
    processMayExist = true;
    const processTokenHash = hashPaymentSecret(process.processToken);
    const set = {
      status: "pending",
      providerProcessId: process.processId,
      providerProcessToken: process.processToken,
      providerProcessTokenHash: processTokenHash,
      checkoutUrl: process.checkoutUrl || "",
      processCreatedAt: new Date(),
      createOutcome: "process_created",
      sanitizedError: null,
      // Payer contact details are needed only for Grow process creation. Once
      // its durable identifiers are stored, retaining duplicate PII is unnecessary.
      ...payerPurgeFields(),
    };
    if (claimed.provider === "grow") {
      set.growPageCode = process.pageCode;
      set.growProcessId = process.processId;
      set.growProcessToken = process.processToken;
      set.growProcessTokenHash = processTokenHash;
    }
    const updated = await PaymentOrder.findOneAndUpdate(
      { _id: claimed._id, status: "processing", providerProcessId: null },
      { $set: set },
      { new: true, runValidators: true },
    ).select(PAYMENT_PRIVATE_SELECT);
    if (!updated) {
      throw new PaymentError(
        "PAYMENT_PROCESS_PERSISTENCE_UNCERTAIN",
        "תהליך התשלום נוצר אך שמירת מצבו טרם הושלמה.",
        503,
        { outcomeUnknown: true, retryable: true },
      );
    }
    // The return token is never stored in plaintext, so it is only available to
    // the response for this request.
    if (updated.provider === "grow_link") updated.$locals.returnUrl = urls.successUrl;
    return updated;
  } catch (error) {
    const uncertain = processMayExist || Boolean(error?.outcomeUnknown);
    // An uncertain create remains processing and retains transient payer fields:
    // operators may need the exact request to reconcile a provider-side process.
    await PaymentOrder.updateOne(
      { _id: claimed._id, status: "processing" },
      {
        $set: {
          status: uncertain ? "processing" : "failed",
          createOutcome: uncertain ? "uncertain" : "definitive_failure",
          openOrderKey: uncertain ? claimed.openOrderKey : null,
          failedAt: uncertain ? null : new Date(),
          sanitizedError: cleanPaymentError(error),
          ...(uncertain ? {} : payerPurgeFields()),
        },
      },
    );
    throw error;
  }
}

export async function createAuthenticatedCheckout({
  userId,
  payload,
  config = getPaymentConfig(),
  provider = createPaymentProvider({ config }),
}) {
  let existing = await PaymentOrder.findOne({
    userId,
    idempotencyKey: payload.idempotencyKey,
  }).select(PAYMENT_PRIVATE_SELECT);
  if (existing && ["pending", "processing"].includes(existing.status)) {
    return serializePaymentOrder(existing);
  }
  if (existing && !["created", "failed"].includes(existing.status)) {
    return serializePaymentOrder(existing);
  }

  await ensureNotAlreadyEntitled(userId, payload.productKey);
  const payerEmail = await accountEmailForUser(userId);
  if (existing?.status === "failed") {
    if (!isDefinitiveFailedCreate(existing)) {
      return serializePaymentOrder(existing);
    }
    try {
      existing = await PaymentOrder.findOneAndUpdate(
        {
          _id: existing._id,
          status: "failed",
          createOutcome: "definitive_failure",
          providerProcessId: null,
          growProcessId: null,
          processCreatedAt: null,
        },
        {
          $set: {
            status: "created",
            openOrderKey: paymentOpenOrderKey(userId, existing.productKey),
            failedAt: null,
            createOutcome: "none",
            sanitizedError: null,
          },
        },
        { new: true, runValidators: true },
      ).select(PAYMENT_PRIVATE_SELECT);
    } catch (error) {
      if (error?.code !== 11000) throw error;
      existing = await findOpenOrderForUserProduct(userId, payload.productKey);
    }
    if (!existing) {
      throw new PaymentError("PAYMENT_STATE_CONFLICT", undefined, 409);
    }
    if (["pending", "processing"].includes(existing.status)) {
      return serializePaymentOrder(existing);
    }
    if (existing.status !== "created") {
      throw new PaymentError("PAYMENT_STATE_CONFLICT", undefined, 409);
    }
  }

  if (!existing) {
    const openOrder = await findOpenOrderForUserProduct(userId, payload.productKey);
    if (openOrder) {
      if (["pending", "processing"].includes(openOrder.status)) {
        return serializePaymentOrder(openOrder);
      }
      throw new PaymentError(
        "PAYMENT_OPEN_ORDER_EXISTS",
        "כבר קיימת הזמנת תשלום פתוחה עבור מוצר זה.",
        409,
      );
    }
  }

  let order;
  if (existing) {
    order = existing;
  } else {
    try {
      order = await createOrder({
        userId,
        productKey: payload.productKey,
        provider: config.provider,
        idempotencyKey: payload.idempotencyKey,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      order =
        (await PaymentOrder.findOne({
          userId,
          idempotencyKey: payload.idempotencyKey,
        }).select(PAYMENT_PRIVATE_SELECT)) ||
        (await findOpenOrderForUserProduct(userId, payload.productKey));
      if (!order) throw error;
      if (["pending", "processing"].includes(order.status)) {
        return serializePaymentOrder(order);
      }
      if (order.status !== "created") {
        throw new PaymentError("PAYMENT_STATE_CONFLICT", undefined, 409);
      }
    }
  }

  const started = await startOrderCheckout({
    order,
    payer: { ...payload.payer, email: payerEmail },
    confirmations: payload.confirmations,
    requestedMethod: payload.paymentMethod,
    config,
    provider,
  });
  return serializePaymentOrder(started);
}

export async function createParentShare({ userId, productKey, config = getPaymentConfig() }) {
  await ensureNotAlreadyEntitled(userId, productKey);
  await accountEmailForUser(userId);
  const product = getPaymentProduct(productKey);
  const shareToken = createOpaqueSecret();
  const shareExpiresAt = new Date(Date.now() + SHARE_LIFETIME_MS);
  const openOrderKey = paymentOpenOrderKey(userId, product.productKey);
  let order = await findOpenOrderForUserProduct(userId, product.productKey);
  if (order) {
    if (["processing", "pending"].includes(order.status)) {
      throw new PaymentError(
        "PAYMENT_CHECKOUT_ALREADY_STARTED",
        "כבר התחיל תהליך תשלום עבור מוצר זה.",
        409,
      );
    }
    if (order.status !== "created" || !order.shareTokenHash) {
      throw new PaymentError("PAYMENT_OPEN_ORDER_EXISTS", undefined, 409);
    }
    order = await PaymentOrder.findOneAndUpdate(
      {
        _id: order._id,
        status: "created",
        openOrderKey,
        shareTokenHash: order.shareTokenHash,
      },
      {
        $set: {
          shareTokenHash: hashPaymentSecret(shareToken),
          shareExpiresAt,
        },
      },
      { new: true, runValidators: true },
    ).select(PAYMENT_PRIVATE_SELECT);
    if (!order) throw new PaymentError("PAYMENT_STATE_CONFLICT", undefined, 409);
  } else {
    try {
      order = await createOrder({
        userId,
        productKey,
        provider: config.provider,
        shareTokenHash: hashPaymentSecret(shareToken),
        shareExpiresAt,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      throw new PaymentError(
        "PAYMENT_OPEN_ORDER_EXISTS",
        "כבר קיימת הזמנת תשלום פתוחה עבור מוצר זה.",
        409,
      );
    }
  }
  return {
    shareUrl: `${config.frontendOrigin}/checkout/${encodeURIComponent(shareToken)}`,
    expiresAt: shareExpiresAt.toISOString(),
    product: publicPaymentProduct(order.productKey),
  };
}

function validateShareTokenShape(shareToken) {
  return (
    typeof shareToken === "string" &&
    shareToken.length >= 32 &&
    shareToken.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(shareToken)
  );
}

export function isParentShareExpired(order, now = new Date()) {
  return !order?.shareExpiresAt || new Date(order.shareExpiresAt) <= now;
}

export function buildParentShareSummary(
  order,
  now = new Date(),
  paymentMethods = PAYMENT_METHOD_PRIORITY,
  publicPaymentInfo = {},
) {
  if (isParentShareExpired(order, now)) {
    throw new PaymentError("PAYMENT_SHARE_EXPIRED", "תוקף הקישור פג.", 410);
  }
  return {
    product: publicPaymentProduct(order.productKey),
    expiresAt: iso(order.shareExpiresAt),
    available: ["created", "processing", "pending"].includes(order.status),
    status: order.status,
    paymentMethods: PAYMENT_METHOD_PRIORITY.filter((method) => paymentMethods.includes(method)),
    ...(publicPaymentInfo.processor ? { processor: publicPaymentInfo.processor } : {}),
    ...(typeof publicPaymentInfo.receiptsProvided === "boolean"
      ? { receiptsProvided: publicPaymentInfo.receiptsProvided }
      : {}),
    merchant: { ...(publicPaymentInfo.merchant || {}) },
  };
}

export async function getOrderForShare(shareToken, now = new Date()) {
  if (!validateShareTokenShape(shareToken)) {
    throw new PaymentError("PAYMENT_SHARE_NOT_FOUND", "הקישור אינו תקין.", 404);
  }
  const hash = hashPaymentSecret(shareToken);
  const order = await findPrivateOrderByShareHash(hash);
  if (!order || !paymentSecretMatches(shareToken, order.shareTokenHash)) {
    throw new PaymentError("PAYMENT_SHARE_NOT_FOUND", "הקישור אינו תקין.", 404);
  }
  if (isParentShareExpired(order, now)) {
    if (order.status === "created") {
      await PaymentOrder.updateOne(
        { _id: order._id, status: "created" },
        {
          $set: {
            status: "expired",
            openOrderKey: null,
            shareTokenHash: null,
            expiredAt: now,
          },
        },
      );
    }
    throw new PaymentError("PAYMENT_SHARE_EXPIRED", "תוקף הקישור פג.", 410);
  }
  return order;
}

export async function getParentShareSummary(
  shareToken,
  now = new Date(),
  config = getPaymentConfig(),
) {
  const order = await getOrderForShare(shareToken, now);
  const configuredProvider =
    config.provider === "disabled" ? config.configuredProvider : config.provider;
  return {
    ...buildParentShareSummary(order, now, config.availableMethods, {
      processor: processorLabel(configuredProvider),
      receiptsProvided: isGrowProvider(configuredProvider),
      merchant: config.merchant,
    }),
    hostedPayerDetails: configuredProvider === "grow_link",
  };
}

export async function checkoutParentShare({
  shareToken,
  payload,
  config = getPaymentConfig(),
  provider = createPaymentProvider({ config }),
}) {
  const order = await getOrderForShare(shareToken);
  const payerEmail = await accountEmailForUser(order.userId);
  await ensureNotAlreadyEntitled(order.userId, order.productKey);
  const started = await startOrderCheckout({
    order,
    payer: { ...payload.payer, email: payerEmail },
    confirmations: payload.confirmations,
    requestedMethod: payload.paymentMethod,
    config,
    provider,
  });
  return serializePaymentOrder(started);
}

export async function reconcileOrder(order, { provider, persistence = paymentPersistence } = {}) {
  if (order.provider !== "grow") return { order, reconciliation: "not_needed" };
  if (order.status === "refund_requested") {
    try {
      const lifecycleProvider = provider || createLifecyclePaymentProvider({ order });
      const evidence = verifyGrowRefundEvidence(
        order,
        await lifecycleProvider.getPaymentProcessInfo({ order }),
      );
      const refund = await persistence.finalizeRefund({
        orderId: order._id,
        refundTransactionId:
          evidence.refundTransactionId ||
          order.refundTransactionId ||
          `grow-${evidence.transactionId}`,
        providerStatus: evidence.statusCode,
      });
      return { order: refund.order, reconciliation: "refunded" };
    } catch (error) {
      await PaymentOrder.updateOne({ _id: order._id }, { $set: { lastReconciledAt: new Date() } });
      return { order, reconciliation: error?.code || "unavailable" };
    }
  }
  if (
    !["pending", "processing", "failed", "expired"].includes(order.status) ||
    !order.growProcessId ||
    !order.growProcessToken
  ) {
    return { order, reconciliation: "not_needed" };
  }

  try {
    const lifecycleProvider = provider || createLifecyclePaymentProvider({ order });
    const result = await verifyApproveAndGrantGrowPayment({
      order,
      provider: lifecycleProvider,
      persistence,
    });
    return { order: result.order, reconciliation: result.state };
  } catch (error) {
    await PaymentOrder.updateOne({ _id: order._id }, { $set: { lastReconciledAt: new Date() } });
    return { order, reconciliation: error?.code || "unavailable" };
  }
}

export async function getAuthenticatedOrderStatus({ userId, publicId, provider, persistence }) {
  let order = await findPrivateOrderByPublicId(publicId, { userId });
  if (!order) throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "ההזמנה לא נמצאה.", 404);
  const reconciled = await reconcileOrder(order, { provider, persistence });
  order = reconciled.order;
  return {
    order: serializePaymentOrder(order),
    reconciliation: reconciled.reconciliation,
  };
}

export async function getReturnOrderStatus({ publicId, returnToken, provider, persistence }) {
  let order = await findPrivateOrderByPublicId(publicId);
  if (!order || !paymentSecretMatches(returnToken, order.returnSecretHash)) {
    throw new PaymentError("PAYMENT_RETURN_NOT_FOUND", "הקישור אינו תקין.", 404);
  }
  const reconciled = await reconcileOrder(order, { provider, persistence });
  order = reconciled.order;
  return {
    order: serializePaymentOrder(order, { includeCheckoutUrl: false }),
    reconciliation: reconciled.reconciliation,
  };
}

export async function processGrowCallback({
  publicId,
  callbackSecret,
  payload,
  provider,
  persistence = paymentPersistence,
}) {
  const order = await findPrivateOrderByPublicId(publicId);
  if (!order || !paymentSecretMatches(callbackSecret, order.callbackSecretHash)) {
    throw new PaymentError("PAYMENT_CALLBACK_NOT_FOUND", "Not found", 404);
  }
  await PaymentOrder.updateOne(
    { _id: order._id },
    {
      $set: { callbackReceivedAt: new Date() },
      $inc: { callbackAttempts: 1 },
    },
  );
  const lifecycleProvider = provider || createLifecyclePaymentProvider({ order });
  return verifyApproveAndGrantGrowPayment({
    order,
    callbackPayload: payload,
    provider: lifecycleProvider,
    persistence,
  });
}

export async function processGrowInvoiceCallback({ publicId, callbackSecret, payload }) {
  const order = await findPrivateOrderByPublicId(publicId);
  if (!order || !paymentSecretMatches(callbackSecret, order.callbackSecretHash)) {
    throw new PaymentError("PAYMENT_CALLBACK_NOT_FOUND", "Not found", 404);
  }
  const invoice = normalizeGrowInvoiceCallback(payload);
  const isRefundReceipt = classifyInvoiceReceipt(order, invoice.transactionId) === "refund";
  const existingTransactionId = isRefundReceipt
    ? order.refundInvoiceTransactionId
    : order.invoiceTransactionId;
  if (existingTransactionId && invoice.transactionId !== existingTransactionId) {
    throw new PaymentError("PAYMENT_INVOICE_TRANSACTION_MISMATCH", "Invalid invoice.", 409);
  }
  const transactionField = isRefundReceipt ? "refundInvoiceTransactionId" : "invoiceTransactionId";
  const numberField = isRefundReceipt ? "refundInvoiceNumber" : "invoiceNumber";
  const urlField = isRefundReceipt ? "refundInvoiceUrl" : "invoiceUrl";
  const receivedAtField = isRefundReceipt ? "refundInvoiceReceivedAt" : "invoiceReceivedAt";
  const updated = await PaymentOrder.findOneAndUpdate(
    {
      _id: order._id,
      provider: "grow",
      $or: [{ [transactionField]: "" }, { [transactionField]: invoice.transactionId }],
    },
    {
      $set: {
        [transactionField]: invoice.transactionId,
        [numberField]: invoice.invoiceNumber,
        [urlField]: invoice.invoiceUrl,
        [receivedAtField]: new Date(),
      },
    },
    { new: true, runValidators: true },
  );
  return { order: updated };
}

export async function cancelPaymentOrder({ userId, publicId, reason = "" }) {
  let order = await findPrivateOrderByPublicId(publicId, { userId });
  if (!order) throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "ההזמנה לא נמצאה.", 404);
  const linkOrderPending = order.provider === "grow_link" && order.status === "pending";
  const action = linkOrderPending ? "expire" : cancellationActionForStatus(order.status);
  if (action === "refund_required") {
    throw new PaymentError("PAYMENT_REFUND_REQUIRED", "התשלום כבר נקלט. יש לבקש זיכוי.", 409);
  }
  if (action === "unchanged") {
    return serializePaymentOrder(order);
  }
  if (action === "provider_unavailable") {
    throw new PaymentError(
      "PAYMENT_PROVIDER_CANCELLATION_UNAVAILABLE",
      "לא ניתן לבטל תהליך תשלום שכבר נוצר אצל הספק. יש להמתין לעדכון מצבו.",
      409,
    );
  }
  if (action !== "expire") {
    throw new PaymentError("PAYMENT_CANCELLATION_STATE_INVALID", undefined, 409);
  }
  order = await PaymentOrder.findOneAndUpdate(
    {
      _id: order._id,
      status: { $in: linkOrderPending ? ["pending"] : ["created", "failed"] },
    },
    {
      $set: {
        status: "expired",
        openOrderKey: null,
        shareTokenHash: null,
        claimCode: null,
        expiredAt: new Date(),
        cancellationReason: String(reason || "").slice(0, 200),
      },
    },
    { new: true, runValidators: true },
  ).select(PAYMENT_PRIVATE_SELECT);
  if (!order) order = await findPrivateOrderByPublicId(publicId, { userId });
  return serializePaymentOrder(order);
}

export async function refundPaymentOrder({
  userId,
  publicId,
  reason = "",
  provider,
  persistence = paymentPersistence,
}) {
  let order = await findPrivateOrderByPublicId(publicId, { userId });
  if (!order) throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "ההזמנה לא נמצאה.", 404);
  if (order.status === "refunded") {
    return { order: serializePaymentOrder(order), duplicate: true };
  }
  if (order.status === "refund_requested") {
    const reconciled = await reconcileOrder(order, { provider, persistence });
    return {
      order: serializePaymentOrder(reconciled.order),
      duplicate: true,
      reconciliation: reconciled.reconciliation,
    };
  }
  if (order.status !== "paid") {
    throw new PaymentError("PAYMENT_REFUND_STATE_INVALID", "ניתן לזכות רק תשלום שאושר.", 409);
  }

  order = await PaymentOrder.findOneAndUpdate(
    { _id: order._id, status: "paid" },
    {
      $set: {
        status: "refund_requested",
        refundRequestedAt: new Date(),
        refundReason: String(reason || "").slice(0, 200),
        sanitizedError: null,
      },
    },
    { new: true, runValidators: true },
  ).select(PAYMENT_PRIVATE_SELECT);
  if (!order) {
    order = await findPrivateOrderByPublicId(publicId, { userId });
    return { order: serializePaymentOrder(order), duplicate: true };
  }

  const lifecycleProvider = provider || createLifecyclePaymentProvider({ order });
  let refundMayHaveSucceeded = false;
  try {
    const response = await lifecycleProvider.refundTransaction({ order });
    refundMayHaveSucceeded = true;
    if (response.state !== "confirmed") {
      const pending = await PaymentOrder.findOneAndUpdate(
        { _id: order._id, status: "refund_requested" },
        {
          $set: {
            refundProviderStatus: response.statusCode || response.statusText || "requested",
          },
        },
        { new: true, runValidators: true },
      );
      if (order.provider === "grow_link") {
        console.error(
          `[payments/grow_link] REFUND REQUESTED: refund transaction ${order.providerTransactionId} in the Grow dashboard, then run: node scripts/grow-link-admin.mjs refunded ${order.publicId}`,
        );
      }
      return { order: serializePaymentOrder(pending), duplicate: false };
    }
    if (
      order.provider === "grow" &&
      (response.transactionId !== order.growTransactionId ||
        response.amountMinor !== order.amountMinor)
    ) {
      throw new PaymentError(
        "PAYMENT_REFUND_CONFIRMATION_MISMATCH",
        "פרטי אישור הזיכוי אינם תואמים להזמנה.",
        502,
        { outcomeUnknown: true },
      );
    }
    const finalized = await persistence.finalizeRefund({
      orderId: order._id,
      refundTransactionId: response.refundTransactionId,
      providerStatus: response.statusCode || response.statusText,
    });
    return { order: serializePaymentOrder(finalized.order), duplicate: false };
  } catch (error) {
    const uncertain = refundOutcomeMayExist(refundMayHaveSucceeded, error);
    await PaymentOrder.updateOne(
      { _id: order._id, status: "refund_requested" },
      {
        $set: {
          ...(uncertain ? {} : { status: "paid" }),
          sanitizedError: cleanPaymentError(error),
        },
      },
    );
    throw error;
  }
}

export async function confirmMockPayment({
  userId = null,
  publicId,
  returnToken = null,
  env = process.env,
  persistence = paymentPersistence,
}) {
  if (
    String(env.NODE_ENV || "")
      .trim()
      .toLowerCase() === "production"
  ) {
    throw new PaymentError("MOCK_PAYMENTS_FORBIDDEN", "Not found", 404);
  }
  const order = await findPrivateOrderByPublicId(publicId, userId ? { userId } : {});
  const returnAuthorized =
    !userId &&
    typeof returnToken === "string" &&
    paymentSecretMatches(returnToken, order?.returnSecretHash);
  if (!order || order.provider !== "mock" || (!userId && !returnAuthorized)) {
    throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "ההזמנה לא נמצאה.", 404);
  }
  if (order.status === "paid") {
    return { order: serializePaymentOrder(order), duplicate: true };
  }
  if (order.status !== "pending") {
    throw new PaymentError("PAYMENT_MOCK_STATE_INVALID", undefined, 409);
  }
  const evidence = buildMockPaymentEvidence(order);
  const owner = await persistence.findTransactionOwner(evidence.transactionId, order._id);
  if (owner) throw new PaymentError("PAYMENT_TRANSACTION_DUPLICATE", undefined, 409);
  const finalized = await persistence.finalizePaid({
    orderId: order._id,
    evidence,
  });
  return {
    order: serializePaymentOrder(finalized.order),
    duplicate: Boolean(finalized.duplicate),
  };
}
