import mongoose from "mongoose";

/**
 * A Grow payment-link payment that matched no account (different email and phone, no code,
 * several checkouts open at once). The buyer claims it from their account by the email or
 * phone they paid with, so nothing has to be unlocked by hand.
 */
const unclaimedPaymentSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, maxlength: 160 },
    amountMinor: { type: Number, required: true },
    payerEmail: { type: String, default: "", maxlength: 254 },
    payerPhone: { type: String, default: "", maxlength: 20 },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

unclaimedPaymentSchema.index({ payerEmail: 1, claimedAt: 1 });
unclaimedPaymentSchema.index({ payerPhone: 1, claimedAt: 1 });

export default mongoose.model("UnclaimedPayment", unclaimedPaymentSchema);
