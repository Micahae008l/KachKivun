import mongoose from "mongoose";

/**
 * A code that unlocks the paid places for free. Each redemption creates an entitlement with
 * source "promo" and the code in sourceTransactionId, so every unlock can be traced back.
 */
const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 32,
    },
    /** What it is for, e.g. "בדיקות" or "מבצע אינסטגרם". Admin-only. */
    note: { type: String, default: "", trim: true, maxlength: 200 },
    /** null means unlimited. */
    maxUses: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("PromoCode", promoCodeSchema);
