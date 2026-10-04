import mongoose from "mongoose";

/** One checkout attempt. Only the provider's verified confirmation marks it paid. */
const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["mock", "grow"], required: true },
    product: { type: String, enum: ["top2"], default: "top2" },
    amountAgorot: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "ILS" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    processId: { type: String, default: null },
    processToken: { type: String, default: null, select: false },
    transactionId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    /** The provider's confirmation, for disputes and refunds. */
    raw: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ provider: 1, transactionId: 1 }, { unique: true, partialFilterExpression: { transactionId: { $type: "string" } } });

export default mongoose.model("Payment", paymentSchema);
