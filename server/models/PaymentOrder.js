import crypto from "crypto";
import mongoose from "mongoose";

export const PAYMENT_ORDER_STATUSES = Object.freeze([
  "created",
  "pending",
  "processing",
  "paid",
  "failed",
  "refund_requested",
  "refunded",
  "expired",
]);

export const PAYMENT_METHODS = Object.freeze(["apple_pay", "bit", "google_pay", "card"]);

const sanitizedErrorSchema = new mongoose.Schema(
  {
    code: { type: String, default: "", maxlength: 120 },
    message: { type: String, default: "", maxlength: 300 },
    at: { type: Date, default: null },
  },
  { _id: false },
);

const paymentOrderSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => crypto.randomUUID(),
      match: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },
    productKey: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 120,
    },
    amountMinor: {
      type: Number,
      required: true,
      immutable: true,
      min: 1,
      default: 1000,
    },
    currency: {
      type: String,
      required: true,
      immutable: true,
      enum: ["ILS"],
      default: "ILS",
    },
    status: {
      type: String,
      required: true,
      enum: PAYMENT_ORDER_STATUSES,
      default: "created",
      index: true,
    },
    provider: {
      type: String,
      required: true,
      immutable: true,
      enum: ["grow", "grow_link", "mock"],
    },
    claimCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      match: /^[A-Z2-9]{6}$/,
    },
    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    openOrderKey: {
      type: String,
      default: null,
      trim: true,
      maxlength: 180,
    },
    payerFullName: { type: String, default: "", trim: true, maxlength: 120 },
    payerPhone: { type: String, default: "", trim: true, maxlength: 20 },
    payerEmail: { type: String, default: "", trim: true, lowercase: true, maxlength: 254 },
    termsAndCancellationAcceptedAt: { type: Date, default: null },
    adultPayerConfirmedAt: { type: Date, default: null },
    chosenMethod: {
      type: String,
      enum: [...PAYMENT_METHODS, null],
      default: null,
    },
    callbackSecretHash: {
      type: String,
      required: true,
      select: false,
      maxlength: 64,
    },
    returnSecretHash: {
      type: String,
      required: true,
      select: false,
      maxlength: 64,
    },
    shareTokenHash: {
      type: String,
      default: null,
      select: false,
      maxlength: 64,
    },
    shareExpiresAt: { type: Date, default: null },
    checkoutUrl: { type: String, default: "", select: false, maxlength: 2048 },
    providerProcessId: { type: String, default: null, trim: true, maxlength: 200 },
    providerProcessToken: { type: String, default: null, select: false, maxlength: 500 },
    providerProcessTokenHash: { type: String, default: null, select: false, maxlength: 64 },
    growPageCode: { type: String, default: "", select: false, maxlength: 160 },
    growProcessId: { type: String, default: null, trim: true, maxlength: 160 },
    growProcessToken: { type: String, default: null, select: false, maxlength: 500 },
    growProcessTokenHash: { type: String, default: null, select: false, maxlength: 64 },
    growTransactionId: { type: String, default: null, trim: true, maxlength: 160 },
    growTransactionToken: { type: String, default: null, select: false, maxlength: 500 },
    growTransactionTokenHash: { type: String, default: null, select: false, maxlength: 64 },
    providerTransactionId: { type: String, default: null, trim: true, maxlength: 200 },
    providerStatusCode: { type: String, default: "", trim: true, maxlength: 80 },
    refundTransactionId: { type: String, default: null, trim: true, maxlength: 160 },
    refundProviderStatus: { type: String, default: "", trim: true, maxlength: 120 },
    refundReason: { type: String, default: "", trim: true, maxlength: 200 },
    invoiceNumber: { type: String, default: "", trim: true, maxlength: 160 },
    invoiceUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    invoiceTransactionId: { type: String, default: "", trim: true, maxlength: 160 },
    refundInvoiceNumber: { type: String, default: "", trim: true, maxlength: 160 },
    refundInvoiceUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    refundInvoiceTransactionId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    sanitizedError: { type: sanitizedErrorSchema, default: null },
    createOutcome: {
      type: String,
      enum: ["none", "definitive_failure", "uncertain", "process_created"],
      default: "none",
    },
    checkoutStartedAt: { type: Date, default: null },
    processCreatedAt: { type: Date, default: null },
    callbackReceivedAt: { type: Date, default: null },
    callbackAttempts: { type: Number, default: 0, min: 0 },
    inquiryConfirmedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    refundRequestedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "", trim: true, maxlength: 200 },
    lastReconciledAt: { type: Date, default: null },
    invoiceReceivedAt: { type: Date, default: null },
    refundInvoiceReceivedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  },
);

paymentOrderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
paymentOrderSchema.index(
  { openOrderKey: 1 },
  {
    unique: true,
    partialFilterExpression: { openOrderKey: { $type: "string" } },
  },
);
paymentOrderSchema.index(
  { provider: 1, providerTransactionId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerTransactionId: { $type: "string" } },
  },
);
paymentOrderSchema.index(
  { growTransactionId: 1 },
  {
    unique: true,
    partialFilterExpression: { growTransactionId: { $type: "string" } },
  },
);
paymentOrderSchema.index(
  { growProcessId: 1 },
  {
    unique: true,
    partialFilterExpression: { growProcessId: { $type: "string" } },
  },
);
paymentOrderSchema.index(
  { provider: 1, providerProcessId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerProcessId: { $type: "string" } },
  },
);
paymentOrderSchema.index(
  { shareTokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: { shareTokenHash: { $type: "string" } },
  },
);
paymentOrderSchema.index(
  { claimCode: 1 },
  {
    unique: true,
    partialFilterExpression: { claimCode: { $type: "string" } },
  },
);
paymentOrderSchema.index({ userId: 1, createdAt: -1 });
paymentOrderSchema.index({ status: 1, updatedAt: 1 });

export default mongoose.model("PaymentOrder", paymentOrderSchema);
