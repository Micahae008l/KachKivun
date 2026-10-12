import MilitaryStats from "../models/MilitaryStats.js";
import Preferences from "../models/Preferences.js";
import Assessment from "../models/Assessment.js";
import RoleRecommendation from "../models/RoleRecommendation.js";
import { computeAiProfileMissing } from "../utils/profileAiReady.js";
import { getIdfRoleCatalogV3 } from "../utils/roleCatalogV3.js";
import { getRecommendationAccessForUser } from "../utils/recommendationAccess.js";
import { buildProfileForMatch } from "../utils/matchProfile.js";
import {
  buildQuestionnairePlan,
  buildWhatIf,
  fullExtras,
  redactExtras,
} from "../utils/matchExtras.js";
import { LOCKED_TOP_RANKS } from "../utils/recommendationSerializer.js";
import { sendServerError } from "../utils/httpError.js";

/**
 * Questionnaire plan and "what would change" for the user's saved recommendation.
 * Free users get the free places in full; the paid places stay in position without a name.
 */
export async function getMatchExtras(req, res) {
  try {
    const userId = req.userId;
    const id = String(req.query.recommendationId || "").trim();
    const [stats, preferences, latestAssessment, access] = await Promise.all([
      MilitaryStats.findOne({ userId }),
      Preferences.findOne({ userId }),
      Assessment.findOne({ userId }).sort({ completedAt: -1, _id: -1 }).lean(),
      getRecommendationAccessForUser(userId),
    ]);
    if (!computeAiProfileMissing(stats, preferences, latestAssessment).ready) {
      return res.status(400).json({ error: "השלימו את הפרופיל קודם", code: "PROFILE_INCOMPLETE" });
    }

    const byId = /^[a-f0-9]{24}$/i.test(id)
      ? await RoleRecommendation.findOne({ _id: id, userId }).lean()
      : null;
    const recommendation =
      byId || (await RoleRecommendation.findOne({ userId }).sort({ createdAt: -1 }).lean());
    if (!recommendation?.roles?.length) {
      return res.status(404).json({ error: "עוד אין התאמות שמורות", code: "NOT_FOUND" });
    }

    const profile = buildProfileForMatch(stats, preferences, latestAssessment);
    const catalogRoles = getIdfRoleCatalogV3()?.roles || [];
    const plan = buildQuestionnairePlan(recommendation.roles, catalogRoles, profile);
    const whatIf = buildWhatIf(catalogRoles, profile);

    const unlocked = access.topTwoUnlocked === true;
    res.json({
      unlocked,
      ...(unlocked ? fullExtras(plan, whatIf) : redactExtras(plan, whatIf, LOCKED_TOP_RANKS)),
    });
  } catch (err) {
    return sendServerError(res, err, "[ai/match-extras]");
  }
}
