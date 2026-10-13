import AiMatchResult from "../models/AiMatchResult.js";
import MatchGeneration from "../models/MatchGeneration.js";
import ResultFeedback, { FEEDBACK_REASONS } from "../models/ResultFeedback.js";
import RoleRecommendation from "../models/RoleRecommendation.js";
import User from "../models/User.js";
import { getRecommendationAccessForUser } from "../utils/recommendationAccess.js";
import { sendServerError } from "../utils/httpError.js";
import { notifySlack } from "../utils/slack.js";

const ID = /^[a-f0-9]{24}$/i;

/** The user's own result with this id, from any of the places a result can live. */
async function ownResult(userId, id) {
  if (!ID.test(id)) return null;
  for (const Model of [RoleRecommendation, MatchGeneration, AiMatchResult]) {
    const doc = await Model.findOne({ _id: id, userId })
      .select("roles.rank roles.roleTitle")
      .lean();
    if (doc) return doc;
  }
  return null;
}

function shape(doc) {
  return doc
    ? { rating: doc.rating, reasons: doc.reasons, comment: doc.comment, updatedAt: doc.updatedAt }
    : null;
}

/** GET /api/ai/result-feedback?resultId=… → the user's rating of that result, if any. */
export async function getResultFeedback(req, res) {
  try {
    const resultId = String(req.query.resultId || "").trim();
    if (!ID.test(resultId)) return res.json({ feedback: null });
    const doc = await ResultFeedback.findOne({ userId: req.userId, resultId }).lean();
    return res.json({ feedback: shape(doc) });
  } catch (err) {
    return sendServerError(res, err, "[ai/result-feedback:get]");
  }
}

/** POST /api/ai/result-feedback { resultId, rating, reasons?, comment? }: paying users rate a result. */
export async function saveResultFeedback(req, res) {
  try {
    const userId = req.userId;
    const resultId = String(req.body?.resultId || "").trim();
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "דירוג בין 1 ל־5", code: "INVALID_RATING" });
    }
    const reasons = Array.isArray(req.body?.reasons)
      ? [...new Set(req.body.reasons.filter((r) => FEEDBACK_REASONS.includes(r)))]
      : [];
    const comment =
      typeof req.body?.comment === "string" ? req.body.comment.trim().slice(0, 500) : "";

    const [result, access] = await Promise.all([
      ownResult(userId, resultId),
      getRecommendationAccessForUser(userId),
    ]);
    if (!result) return res.status(404).json({ error: "התוצאה לא נמצאה", code: "NOT_FOUND" });
    if (access.topTwoUnlocked !== true) {
      return res
        .status(403)
        .json({ error: "הדירוג פתוח למי שפתח את כל ההתאמות", code: "NOT_UNLOCKED" });
    }

    const roleTitles = [...(result.roles || [])]
      .sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))
      .map((r) => r.roleTitle)
      .filter(Boolean)
      .slice(0, 5);
    const before = await ResultFeedback.findOne({ userId, resultId })
      .select("rating reasons comment")
      .lean();
    const doc = await ResultFeedback.findOneAndUpdate(
      { userId, resultId },
      { $set: { rating, reasons, comment, roleTitles } },
      { upsert: true, new: true, runValidators: true },
    ).lean();

    // Tell the owner about low scores, once per change (not on every repeated click).
    const changed =
      !before ||
      before.rating !== rating ||
      before.comment !== comment ||
      String(before.reasons) !== String(reasons);
    if (rating <= 3 && changed) {
      const user = await User.findById(userId).select("email").lean();
      notifySlack(
        process.env,
        `:star: ${"★".repeat(rating)}${"☆".repeat(5 - rating)} from ${user?.email || "a user"}${
          reasons.length ? ` · ${reasons.join(", ")}` : ""
        }${comment ? `\n> ${comment.replace(/\n/g, " ")}` : ""}\nResult: ${roleTitles.join(" · ")}`,
      );
    }
    return res.json({ feedback: shape(doc) });
  } catch (err) {
    return sendServerError(res, err, "[ai/result-feedback:save]");
  }
}
