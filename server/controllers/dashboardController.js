import User from "../models/User.js";
import MilitaryStats from "../models/MilitaryStats.js";
import Preferences from "../models/Preferences.js";
import Assessment from "../models/Assessment.js";
import { computeAiProfileMissing } from "../utils/profileAiReady.js";
import { getTokenCapStatusForUserId } from "../utils/tokenCap.js";
import { sendServerError } from "../utils/httpError.js";


export async function getStats(req, res) {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [stats, preferences, latestAssessment] = await Promise.all([
      MilitaryStats.findOne({ userId }),
      Preferences.findOne({ userId }),
      Assessment.findOne({ userId }).sort({ completedAt: -1, _id: -1 }).lean(),
    ]);

    const { ready: aiReady, missing: aiProfileMissing } = computeAiProfileMissing(
      stats,
      preferences,
      latestAssessment,
    );
    const aiTokens = await getTokenCapStatusForUserId(userId);

    let daysRemaining = null;
    const now = new Date();

    if (user.status === "Pre-Draft" && stats?.draftDate) {
      const diff = new Date(stats.draftDate) - now;
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } else if (user.status === "Active Duty" && stats?.dischargeDate) {
      const diff = new Date(stats.dischargeDate) - now;
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    res.json({
      user: {
        email: user.email,
        preferredName: user.preferredName || "",
        phone: user.phone || "",
        status: user.status,
        createdAt: user.createdAt,
      },
      stats,
      preferences,
      daysRemaining,
      aiReady,
      aiProfileMissing,
      aiTokens,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
}
