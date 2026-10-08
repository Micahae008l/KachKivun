import MatchGeneration from "../models/MatchGeneration.js";
import AiMatchResult from "../models/AiMatchResult.js";
import RoleRecommendation from "../models/RoleRecommendation.js";
import { getRecommendationAccessForUser } from "../utils/recommendationAccess.js";
import {
  serializeRecommendationDetail,
  serializeRecommendationSummary,
} from "../utils/recommendationSerializer.js";
import { sendServerError } from "../utils/httpError.js";

function timestamp(doc) {
  const value = new Date(doc?.createdAt || doc?.updatedAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function mergeHistorySources(recommendations, generations, cached) {
  const output = [];
  const seenProfiles = new Set();

  for (const doc of recommendations) {
    output.push(doc);
    if (doc.profileHash) seenProfiles.add(String(doc.profileHash));
  }
  for (const doc of [...generations, ...cached]) {
    const hash = doc.profileHash ? String(doc.profileHash) : "";
    if (hash && seenProfiles.has(hash)) continue;
    output.push(doc);
    if (hash) seenProfiles.add(hash);
  }

  return output.sort((a, b) => timestamp(b) - timestamp(a)).slice(0, 30);
}

export function buildMatchHistoryDeletionFilter(userId, id, profileHash) {
  const hash = String(profileHash || "").trim();
  return hash ? { userId, profileHash: hash } : { userId, _id: id };
}

/** List recent match generations for the signed-in user. */
export async function listMatchHistory(req, res) {
  try {
    const userId = req.userId;
    const [recommendations, generations, cached, access] = await Promise.all([
      RoleRecommendation.find({ userId }).sort({ createdAt: -1 }).limit(30).lean(),
      MatchGeneration.find({ userId }).sort({ createdAt: -1 }).limit(30).lean(),
      AiMatchResult.find({ userId, endpoint: "match-roles" })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),
      getRecommendationAccessForUser(userId),
    ]);
    const docs = mergeHistorySources(recommendations, generations, cached);

    res.json({
      generations: docs.map((doc) =>
        serializeRecommendationSummary(doc, access),
      ),
      access,
    });
  } catch (err) {
    return sendServerError(res, err, "[ai/match-history/list]");
  }
}

/** Load one generation's full role list. */
export async function getMatchHistory(req, res) {
  try {
    const userId = req.userId;
    const id = String(req.params.id || "").trim();
    let doc = await RoleRecommendation.findOne({ _id: id, userId }).lean();
    if (!doc) {
      doc = await MatchGeneration.findOne({ _id: id, userId }).lean();
    }
    if (!doc) {
      doc = await AiMatchResult.findOne({ _id: id, userId }).lean();
    }
    if (!doc?.roles?.length) {
      return res.status(404).json({ error: "ההפעלה לא נמצאה", code: "NOT_FOUND" });
    }
    const access = await getRecommendationAccessForUser(userId);
    res.json({
      generation: serializeRecommendationDetail(doc, access),
      access,
    });
  } catch (err) {
    return sendServerError(res, err, "[ai/match-history/get]");
  }
}

export async function deleteMatchHistory(req, res) {
  try {
    const userId = req.userId;
    const id = String(req.params.id || "").trim();
    const [recommendation, generation, cached] = await Promise.all([
      RoleRecommendation.findOne({ _id: id, userId }).select("profileHash").lean(),
      MatchGeneration.findOne({ _id: id, userId }).select("profileHash").lean(),
      AiMatchResult.findOne({ _id: id, userId }).select("profileHash").lean(),
    ]);
    const source = recommendation || generation || cached;
    if (!source) return res.status(404).json({ error: "ההפעלה לא נמצאה" });

    const sharedFilter = buildMatchHistoryDeletionFilter(
      userId,
      id,
      source.profileHash,
    );
    await Promise.all([
      RoleRecommendation.deleteMany(sharedFilter),
      MatchGeneration.deleteMany(sharedFilter),
      AiMatchResult.deleteMany(sharedFilter),
    ]);
    res.json({ message: "נמחק מההיסטוריה", id });
  } catch (err) {
    return sendServerError(res, err, "[ai/match-history/delete]");
  }
}
