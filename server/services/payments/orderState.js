import { PaymentError } from "./errors.js";

export const OPEN_PAYMENT_ORDER_STATUSES = Object.freeze([
  "created",
  "processing",
  "pending",
]);

export function paymentOpenOrderKey(userId, productKey) {
  const owner = String(userId || "").trim();
  const product = String(productKey || "").trim();
  if (!owner || !product) {
    throw new TypeError("userId and productKey are required for an open payment order");
  }
  return `${owner}:${product}`;
}

export function isDefinitiveFailedCreate(order) {
  return Boolean(
    order?.status === "failed" &&
      order.createOutcome === "definitive_failure" &&
      !order.providerProcessId &&
      !order.growProcessId &&
      !order.processCreatedAt,
  );
}

export function cancellationActionForStatus(status) {
  if (status === "paid" || status === "refund_requested") return "refund_required";
  if (status === "pending" || status === "processing") return "provider_unavailable";
  if (status === "refunded" || status === "expired") return "unchanged";
  if (status === "created" || status === "failed") return "expire";
  return "invalid";
}

export function refundOutcomeMayExist(providerResponded, error) {
  return Boolean(providerResponded || error?.outcomeUnknown);
}

export function payerPurgeFields() {
  return { payerFullName: "", payerPhone: "", payerEmail: "" };
}

export function classifyInvoiceReceipt(order, transactionId) {
  const incoming = String(transactionId || "").trim();
  const saleTransactionId = String(
    order?.providerTransactionId || order?.growTransactionId || "",
  ).trim();
  const refundTransactionId = String(order?.refundTransactionId || "").trim();

  if (incoming && saleTransactionId && incoming === saleTransactionId) return "sale";
  if (
    incoming &&
    refundTransactionId &&
    incoming === refundTransactionId &&
    ["refund_requested", "refunded"].includes(order?.status)
  ) {
    return "refund";
  }
  throw new PaymentError(
    "PAYMENT_INVOICE_TRANSACTION_MISMATCH",
    "Invalid invoice.",
    409,
  );
}
