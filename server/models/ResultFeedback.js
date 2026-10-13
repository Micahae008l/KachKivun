import mongoose from "mongoose";

export const FEEDBACK_REASONS = Object.freeze([
  "not_me",
  "missing_role",
  "too_generic",
  "wrong_info",
  "request_ignored",
  "other",
]);

/** A paying user's rating of one result (one per user per result; re-rating overwrites). */
const resultFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    resultId: { type: String, required: true, maxlength: 40 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    reasons: { type: [{ type: String, enum: FEEDBACK_REASONS }], default: [] },
    comment: { type: String, default: "", maxlength: 500 },
    // What was rated, so the admin view can show it next to the score.
    roleTitles: { type: [String], default: [] },
  },
  { timestamps: true },
);

resultFeedbackSchema.index({ userId: 1, resultId: 1 }, { unique: true });
resultFeedbackSchema.index({ createdAt: -1 });

export default mongoose.model("ResultFeedback", resultFeedbackSchema);
