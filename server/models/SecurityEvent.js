import mongoose from "mongoose";

export const SECURITY_EVENT_TYPES = [
  "rate_limit_api",
  "rate_limit_auth",
  "otp_failed",
  "otp_locked",
  "invalid_token",
  "admin_denied",
  "oversized_url",
  "payload_too_large",
  "invalid_json",
  "suspicious_path",
  "not_found_probe",
  "blocked_ip_hit",
  "refresh_token_reuse",
];

export const SECURITY_SEVERITIES = ["low", "medium", "high", "critical"];

const RETENTION_DAYS = 30;

const securityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: SECURITY_EVENT_TYPES,
      required: true,
    },
    severity: {
      type: String,
      enum: SECURITY_SEVERITIES,
      default: "low",
    },
    ip: { type: String, default: "", trim: true },
    method: { type: String, default: "" },
    path: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true, trim: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    statusCode: { type: Number, default: null },
    message: { type: String, default: "" },
  },
  { timestamps: true }
);

securityEventSchema.index({ createdAt: -1 });
securityEventSchema.index({ ip: 1, createdAt: -1 });
securityEventSchema.index({ type: 1, createdAt: -1 });
securityEventSchema.index({ severity: 1, createdAt: -1 });
// Auto-purge old events so the collection cannot grow unbounded.
securityEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 }
);

export default mongoose.model("SecurityEvent", securityEventSchema);
