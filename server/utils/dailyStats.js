import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import MatchGeneration from "../models/MatchGeneration.js";
import ReportHistory from "../models/ReportHistory.js";
import RoleReview from "../models/RoleReview.js";
import AiUsageLog from "../models/AiUsageLog.js";

const DAY = 24 * 60 * 60 * 1000;

/** Counts per day for the last `days` days, oldest first (day 0 = the 24h ending now). */
async function perDay(Model, days, match = {}) {
  const now = Date.now();
  const rows = await Model.aggregate([
    { $match: { ...match, createdAt: { $gte: new Date(now - days * DAY) } } },
    { $project: { ago: { $floor: { $divide: [{ $subtract: [new Date(now), "$createdAt"] }, DAY] } } } },
    { $group: { _id: "$ago", n: { $sum: 1 } } },
  ]);
  const counts = Array(days).fill(0);
  for (const r of rows) if (r._id >= 0 && r._id < days) counts[days - 1 - r._id] = r.n;

  return counts;
}

/**
 * The morning report's business numbers: counts only, never names or emails.
 * "Last 24h" is the day ending at the moment of the call; trends cover 7 days.
 */
export async function getDailyStats() {
  const since24h = new Date(Date.now() - DAY);
  const users = { role: "user" };

  const [
    totalUsers,
    signups7d,
    newByStatus,
    activeUsers,
    matches7d,
    reports7d,
    reviews24h,
    pendingReviews,
    aiCost,
  ] = await Promise.all([
    User.countDocuments(users),
    perDay(User, 7, users),
    User.aggregate([
      { $match: { ...users, createdAt: { $gte: since24h } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    RefreshToken.distinct("userId", { createdAt: { $gte: since24h } }).then((ids) => ids.length),
    perDay(MatchGeneration, 7),
    perDay(ReportHistory, 7),
    RoleReview.countDocuments({ createdAt: { $gte: since24h } }),
    RoleReview.countDocuments({ status: "pending" }),
    AiUsageLog.aggregate([
      { $match: { createdAt: { $gte: since24h } } },
      { $group: { _id: null, usd: { $sum: "$estimatedCostUsd" }, calls: { $sum: 1 } } },
    ]),
  ]);

  return {
    users: {
      total: totalUsers,
      new24h: signups7d.at(-1),
      new7d: signups7d.reduce((a, b) => a + b, 0),
      signupsPerDay: signups7d,
      newByStatus: Object.fromEntries(newByStatus.map((r) => [r._id || "unknown", r.n])),
      active24h: activeUsers,
    },
    activity: {
      matches24h: matches7d.at(-1),
      matchesPerDay: matches7d,
      reports24h: reports7d.at(-1),
      reportsPerDay: reports7d,
      reviews24h,
      pendingReviews,
    },
    ai: {
      costUsd24h: Number((aiCost[0]?.usd ?? 0).toFixed(4)),
      calls24h: aiCost[0]?.calls ?? 0,
    },
  };
}
