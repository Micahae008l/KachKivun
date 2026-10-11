import User from "../models/User.js";
import Assessment from "../models/Assessment.js";
import AiUsageLog from "../models/AiUsageLog.js";
import MatchGeneration from "../models/MatchGeneration.js";
import RoleRecommendation from "../models/RoleRecommendation.js";
import PaymentOrder from "../models/PaymentOrder.js";
import { sendServerError } from "../utils/httpError.js";

const TZ = "Asia/Jerusalem";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Count documents per local day, e.g. { "2026-10-11": 4 }. */
async function perDay(Model, dateField, since, match = {}, sumField = null) {
  const rows = await Model.aggregate([
    { $match: { ...match, [dateField]: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}`, timezone: TZ } },
        value: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
      },
    },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.value]));
}

/** Latest assessment per user, then how often each value of `field` appears (arrays are unwound). */
async function answerCounts(field, isArray = false) {
  const rows = await Assessment.aggregate([
    { $sort: { completedAt: -1 } },
    { $group: { _id: "$userId", value: { $first: `$answers.${field}` } } },
    ...(isArray ? [{ $unwind: "$value" }] : []),
    { $match: { value: { $nin: [null, ""] } } },
    { $group: { _id: "$value", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r) => ({ value: String(r._id), count: r.count }));
}

/** GET /api/admin/insights?days=30: trends, money, what users choose and what the AI recommends. */
export async function getInsights(req, res) {
  try {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const since = new Date(Date.now() - days * DAY_MS);
    const notAdmin = { role: { $ne: "admin" } };

    const [
      signups,
      assessments,
      runs,
      checkouts,
      paidCount,
      revenue,
      aiCost,
      totals,
      paidAllTime,
      orderStatuses,
      topPicks,
      topAppearances,
      notes,
      runsPerUser,
      ...distributions
    ] = await Promise.all([
      perDay(User, "createdAt", since, notAdmin),
      perDay(Assessment, "completedAt", since),
      perDay(MatchGeneration, "createdAt", since),
      perDay(PaymentOrder, "createdAt", since),
      perDay(PaymentOrder, "paidAt", since, { status: "paid" }),
      perDay(PaymentOrder, "paidAt", since, { status: "paid" }, "amountMinor"),
      perDay(AiUsageLog, "createdAt", since, {}, "estimatedCostUsd"),
      Promise.all([
        User.countDocuments(notAdmin),
        Assessment.distinct("userId"),
        RoleRecommendation.distinct("userId"),
        PaymentOrder.distinct("userId"),
        PaymentOrder.distinct("userId", { status: "paid" }),
        AiUsageLog.aggregate([{ $group: { _id: null, usd: { $sum: "$estimatedCostUsd" } } }]),
      ]),
      PaymentOrder.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, minor: { $sum: "$amountMinor" }, orders: { $sum: 1 } } },
      ]),
      PaymentOrder.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      RoleRecommendation.aggregate([
        { $unwind: "$roles" },
        { $match: { "roles.rank": 1 } },
        { $group: { _id: "$roles.roleTitle", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      RoleRecommendation.aggregate([
        { $unwind: "$roles" },
        { $group: { _id: "$roles.roleTitle", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Assessment.find({ "answers.extraNote": { $nin: [null, ""] } })
        .sort({ completedAt: -1 })
        .limit(15)
        .select("answers.extraNote answers.preferredName completedAt")
        .lean(),
      MatchGeneration.aggregate([
        { $group: { _id: "$userId", runs: { $sum: 1 } } },
        { $group: { _id: null, users: { $sum: 1 }, runs: { $sum: "$runs" } } },
      ]),
      answerCounts("rolesInterested", true),
      answerCounts("motivations", true),
      answerCounts("rolesAvoided", true),
      answerCounts("combatPreference"),
      answerCounts("focus"),
      answerCounts("daparScore"),
      answerCounts("medicalProfile"),
      answerCounts("yomHameahSource"),
      answerCounts("gender"),
    ]);

    // One row per day in the period, zero-filled, oldest first.
    const series = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const key = new Date(Date.now() - i * DAY_MS).toLocaleDateString("en-CA", { timeZone: TZ });
      series.push({
        date: key,
        signups: signups[key] ?? 0,
        assessments: assessments[key] ?? 0,
        runs: runs[key] ?? 0,
        checkouts: checkouts[key] ?? 0,
        paid: paidCount[key] ?? 0,
        revenueIls: (revenue[key] ?? 0) / 100,
        aiCostUsd: Math.round((aiCost[key] ?? 0) * 10000) / 10000,
      });
    }
    const sum = (k) => series.reduce((acc, row) => acc + row[k], 0);
    const [signedUp, assessed, results, checkout, paid, aiAll] = totals;
    const [interests, motivations, avoided, direction, focus, dapar, medical, yomSource, gender] =
      distributions;

    res.json({
      days,
      series,
      period: {
        signups: sum("signups"),
        assessments: sum("assessments"),
        runs: sum("runs"),
        checkouts: sum("checkouts"),
        paid: sum("paid"),
        revenueIls: Math.round(sum("revenueIls") * 100) / 100,
        aiCostUsd: Math.round(sum("aiCostUsd") * 100) / 100,
      },
      allTime: {
        funnel: {
          signedUp,
          assessed: assessed.length,
          results: results.length,
          checkout: checkout.length,
          paid: paid.length,
        },
        revenueIls: (paidAllTime[0]?.minor ?? 0) / 100,
        paidOrders: paidAllTime[0]?.orders ?? 0,
        aiCostUsd: Math.round((aiAll[0]?.usd ?? 0) * 100) / 100,
        runsPerUser: runsPerUser[0]?.users
          ? Math.round((runsPerUser[0].runs / runsPerUser[0].users) * 10) / 10
          : 0,
      },
      orderStatuses: orderStatuses.map((r) => ({ status: r._id, count: r.count })),
      topPicks: topPicks.map((r) => ({ roleTitle: r._id, count: r.count })),
      topAppearances: topAppearances.map((r) => ({ roleTitle: r._id, count: r.count })),
      notes: notes.map((n) => ({
        note: n.answers?.extraNote || "",
        name: n.answers?.preferredName || "",
        at: n.completedAt,
      })),
      answers: {
        interests,
        motivations,
        avoided,
        direction,
        focus,
        dapar,
        medical,
        yomSource,
        gender,
      },
    });
  } catch (err) {
    return sendServerError(res, err, "[admin/insights]");
  }
}
