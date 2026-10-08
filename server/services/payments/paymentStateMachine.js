import { PaymentError } from "./errors.js";
import { isGrowPaidEvidence, normalizeGrowCallback } from "./growNormalization.js";
import { hashPaymentSecret, paymentSecretMatches } from "./secrets.js";

const GROW_TRANSACTION_TYPES = Object.freeze({
  card: "1",
  bit: "6",
  apple_pay: "13",
  google_pay: "14",
});

function sameOpaqueValue(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !left || !right) return false;
  const leftHash = hashPaymentSecret(left);
  return paymentSecretMatches(right, leftHash);
}

function assertEqual(actual, expected, code, message) {
  if (String(actual) !== String(expected)) {
    throw new PaymentError(code, message, 409);
  }
}

function verifyGrowStaticEvidence(order, evidence) {
  if (order.provider !== "grow") {
    throw new PaymentError("PAYMENT_PROVIDER_MISMATCH", undefined, 409);
  }
  assertEqual(
    evidence.processId,
    order.growProcessId,
    "PAYMENT_PROCESS_MISMATCH",
    "מזהה תהליך התשלום אינו תואם.",
  );
  if (
    !order.growProcessTokenHash ||
    !paymentSecretMatches(evidence.processToken, order.growProcessTokenHash)
  ) {
    throw new PaymentError("PAYMENT_PROCESS_TOKEN_MISMATCH", "אסימון תהליך התשלום אינו תואם.", 409);
  }
  assertEqual(
    evidence.productKey,
    order.productKey,
    "PAYMENT_PRODUCT_MISMATCH",
    "המוצר שאושר אינו תואם להזמנה.",
  );
  assertEqual(
    evidence.amountMinor,
    order.amountMinor,
    "PAYMENT_AMOUNT_MISMATCH",
    "סכום התשלום אינו תואם להזמנה.",
  );
  assertEqual(
    evidence.currency,
    order.currency,
    "PAYMENT_CURRENCY_MISMATCH",
    "מטבע התשלום אינו תואם להזמנה.",
  );
  const expectedTransactionType = GROW_TRANSACTION_TYPES[order.chosenMethod];
  if (expectedTransactionType) {
    assertEqual(
      evidence.transactionTypeId,
      expectedTransactionType,
      "PAYMENT_METHOD_MISMATCH",
      "אמצעי התשלום שאושר אינו תואם להזמנה.",
    );
  }
  return evidence;
}

export function verifyGrowPaymentEvidence(order, evidence) {
  verifyGrowStaticEvidence(order, evidence);
  if (!isGrowPaidEvidence(evidence)) {
    throw new PaymentError("PAYMENT_NOT_CONFIRMED", "התשלום עדיין לא אושר על ידי הספק.", 409, {
      retryable: true,
    });
  }
  return evidence;
}

export function verifyGrowRefundEvidence(order, evidence) {
  verifyGrowStaticEvidence(order, evidence);
  assertEqual(
    evidence.transactionId,
    order.growTransactionId,
    "PAYMENT_TRANSACTION_MISMATCH",
    "מזהה העסקה אינו תואם להזמנה.",
  );
  if (evidence.statusCode !== "3") {
    throw new PaymentError(
      "PAYMENT_REFUND_NOT_CONFIRMED",
      "הזיכוי עדיין לא אושר על ידי הספק.",
      409,
      { retryable: true },
    );
  }
  return evidence;
}

export function compareGrowTransactionEvidence(callbackEvidence, inquiryEvidence) {
  assertEqual(
    callbackEvidence.transactionId,
    inquiryEvidence.transactionId,
    "PAYMENT_TRANSACTION_MISMATCH",
    "מזהה העסקה אינו תואם לבדיקת הספק.",
  );
  if (!sameOpaqueValue(callbackEvidence.transactionToken, inquiryEvidence.transactionToken)) {
    throw new PaymentError(
      "PAYMENT_TRANSACTION_TOKEN_MISMATCH",
      "אסימון העסקה אינו תואם לבדיקת הספק.",
      409,
    );
  }
  return inquiryEvidence;
}

export async function verifyApproveAndGrantGrowPayment({
  order,
  callbackPayload = null,
  provider,
  persistence,
  now = new Date(),
}) {
  if (["refund_requested", "refunded"].includes(order.status)) {
    return { state: order.status, duplicate: true, order };
  }
  if (order.status === "paid") {
    return { state: "paid", duplicate: true, order };
  }
  if (!order.growProcessId || !order.growProcessToken || !order.growProcessTokenHash) {
    throw new PaymentError("PAYMENT_PROCESS_INCOMPLETE", "תהליך התשלום טרם נוצר.", 409, {
      retryable: true,
    });
  }

  const callbackEvidence = callbackPayload
    ? verifyGrowPaymentEvidence(order, normalizeGrowCallback(callbackPayload))
    : null;

  // Grow does not currently document an HMAC for this callback. The URL secret
  // is checked by the controller, then this independent server-to-server inquiry
  // must confirm every immutable field. Inquiry failure always fails closed.
  const inquiryEvidence = verifyGrowPaymentEvidence(
    order,
    await provider.getPaymentProcessInfo({ order }),
  );
  if (callbackEvidence) compareGrowTransactionEvidence(callbackEvidence, inquiryEvidence);

  const existingOrder = await persistence.findTransactionOwner(
    inquiryEvidence.transactionId,
    order._id,
  );
  if (existingOrder) {
    throw new PaymentError("PAYMENT_TRANSACTION_DUPLICATE", "העסקה כבר משויכת להזמנה אחרת.", 409);
  }

  const approval = await provider.approveTransaction({
    order,
    evidence: inquiryEvidence,
  });
  if (!approval?.confirmed) {
    throw new PaymentError("PAYMENT_APPROVAL_UNCONFIRMED", "ספק התשלום לא אישר את העסקה.", 502, {
      retryable: true,
    });
  }

  const finalized = await persistence.finalizePaid({
    orderId: order._id,
    evidence: inquiryEvidence,
    now,
  });
  return {
    state: finalized.status || "paid",
    duplicate: Boolean(finalized.duplicate),
    order: finalized.order || finalized,
  };
}

export function buildMockPaymentEvidence(order, now = new Date()) {
  const transactionId = `mock-${order.publicId}`;
  const transactionToken = hashPaymentSecret(`${transactionId}:${now.toISOString()}`);
  return {
    processId: order.providerProcessId,
    processToken: order.providerProcessToken,
    transactionId,
    transactionToken,
    transactionTypeId: GROW_TRANSACTION_TYPES[order.chosenMethod] || "1",
    paymentType: "2",
    amountMinor: order.amountMinor,
    amountMajor: (order.amountMinor / 100).toFixed(2),
    statusCode: "2",
    statusText: "mock_paid",
    productKey: order.productKey,
    currency: order.currency,
    approvalFields: {},
  };
}
