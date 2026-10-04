import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null,
      select: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    preferredName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pre-Draft", "Active Duty", "Discharged"],
      default: "Pre-Draft",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },
    /** Per-user lifetime AI token cap; null inherits DEFAULT_USER_TOKEN_CAP. Admins ignore caps. */
    tokenCap: {
      type: Number,
      default: null,
      min: 0,
    },
    /** Set once the user paid to see their top 2 matches; unlocks them for good. */
    topMatchesUnlockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
