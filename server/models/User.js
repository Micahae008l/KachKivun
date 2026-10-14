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
    /** Where the user came from (first known visit): see utils/userSource.js. Admin analytics only. */
    attribution: {
      type: new mongoose.Schema(
        {
          source: { type: String, maxlength: 40 },
          medium: { type: String, maxlength: 40, default: "" },
          campaign: { type: String, maxlength: 80, default: "" },
          referrer: { type: String, maxlength: 120, default: "" },
          platform: { type: String, maxlength: 20, default: "" },
          landingPath: { type: String, maxlength: 120, default: "" },
          at: { type: Date },
          /** Recorded on a visit after signup, so it may not be how they first arrived. */
          afterSignup: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
