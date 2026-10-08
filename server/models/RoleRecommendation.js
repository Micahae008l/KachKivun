import mongoose from "mongoose";

const scoreBreakdownSchema = new mongoose.Schema(
  {
    preference: { type: Number, required: true, min: 0, max: 100 },
    focus: { type: Number, required: true, min: 0, max: 100 },
    yom: { type: Number, required: true, min: 0, max: 100 },
    eligibility: { type: Number, required: true, min: 0, max: 100 },
    catalogQuality: { type: Number, required: true, min: 0, max: 100 },
    structuredAssessment: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const rankedRoleSchema = new mongoose.Schema(
  {
    rank: { type: Number, required: true, min: 1, max: 5 },
    roleTitle: { type: String, required: true, trim: true, maxlength: 240 },
    matchPercentage: { type: Number, required: true, min: 0, max: 100 },
    scoreBreakdown: { type: scoreBreakdownSchema, required: true },
    summary: { type: String, default: "", trim: true, maxlength: 600 },
    description: { type: String, default: "", trim: true, maxlength: 4000 },
    tags: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
    },
    nextStepPrompts: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      default: [],
    },
    category: { type: String, default: "", trim: true, maxlength: 240 },
    combat: { type: Boolean, default: false },
    dayToDay: { type: String, default: "", trim: true, maxlength: 4000 },
    requirements: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      default: [],
    },
    locations: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      default: [],
    },
    serviceLengthLabel: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { _id: false },
);

const roleRecommendationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    profileHash: { type: String, required: true, trim: true, index: true },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      default: null,
    },
    profileSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    engineVersion: { type: String, required: true, trim: true },
    scoringVersion: { type: String, required: true, trim: true },
    catalogVersion: { type: String, required: true, trim: true },
    promptVersion: { type: String, required: true, trim: true },
    roles: {
      type: [rankedRoleSchema],
      required: true,
      validate: {
        validator(roles) {
          if (!Array.isArray(roles) || roles.length !== 5) return false;
          const ranks = roles.map((role) => role.rank).sort((a, b) => a - b);
          return ranks.every((rank, index) => rank === index + 1);
        },
        message: "recommendation must contain exactly one complete role for each rank 1-5",
      },
    },
    notice: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

roleRecommendationSchema.index({ userId: 1, profileHash: 1 }, { unique: true });
roleRecommendationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("RoleRecommendation", roleRecommendationSchema);
