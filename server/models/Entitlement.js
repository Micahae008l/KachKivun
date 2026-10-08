import mongoose from "mongoose";

const entitlementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ["active", "grandfathered", "expired", "revoked"],
      required: true,
      default: "active",
    },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    grandfatheredAt: { type: Date, default: null },
    grandfatherCutoffAt: { type: Date, default: null },
    source: { type: String, default: "manual", trim: true, maxlength: 120 },
    sourceOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentOrder",
      default: null,
    },
    sourcePaymentProvider: {
      type: String,
      enum: ["grow", "grow_link", "mock", null],
      default: null,
    },
    sourceTransactionId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
    sourcePaidAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: "", trim: true, maxlength: 300 },
    revokedByOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentOrder",
      default: null,
    },
    refundedAt: { type: Date, default: null },
    refundTransactionId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
  },
  { timestamps: true },
);

entitlementSchema.index({ userId: 1, productKey: 1 }, { unique: true });
entitlementSchema.index({ productKey: 1, status: 1 });
entitlementSchema.index({ sourceOrderId: 1 });

export default mongoose.model("Entitlement", entitlementSchema);
