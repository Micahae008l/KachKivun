import mongoose from "mongoose";

const aiUsageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },
    endpoint: {
      type: String,
      required: true,
      default: "match-roles",
    },
    model: {
      type: String,
      default: "",
    },
    promptTokens: { type: Number, default: 0, min: 0 },
    completionTokens: { type: Number, default: 0, min: 0 },
    totalTokens: { type: Number, default: 0, min: 0 },
    estimatedCostUsd: { type: Number, default: 0, min: 0 },
    durationMs: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["success", "parse_error", "api_error", "persistence_error", "cache_hit"],
      default: "success",
    },
    finishReason: { type: String, default: null },
    openaiRequestId: { type: String, default: null },
    filteredRoleCount: { type: Number, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

aiUsageLogSchema.index({ createdAt: -1 });
aiUsageLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("AiUsageLog", aiUsageLogSchema);
