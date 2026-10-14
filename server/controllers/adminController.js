import User from "../models/User.js";
import MilitaryStats from "../models/MilitaryStats.js";
import Preferences from "../models/Preferences.js";
import Assessment from "../models/Assessment.js";
import EmailOtp from "../models/EmailOtp.js";
import AiUsageLog from "../models/AiUsageLog.js";
import RefreshToken from "../models/RefreshToken.js";
import MatchGeneration from "../models/MatchGeneration.js";
import RoleRecommendation from "../models/RoleRecommendation.js";
import PaymentOrder from "../models/PaymentOrder.js";
import Entitlement from "../models/Entitlement.js";
import { computeAiProfileMissing } from "../utils/profileAiReady.js";
import { pricingMeta } from "../utils/openaiPricing.js";
import { sendServerError } from "../utils/httpError.js";
import { deleteUserData } from "../utils/deleteAccount.js";

import {
  buildTokenCapStatus,
  getDefaultTokenCap,
  getTokenCapStatusForUserId,
  resolveTokenCap,
} from "../utils/tokenCap.js";
import { sourcesForUsers } from "../utils/userSource.js";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function formatUsd(n) {
  const v = Number(n) || 0;
  return Math.round(v * 100) / 100;
}

export async function getAdminMe(req, res) {
  try {
    const u = req.adminUser;
    res.json({
      userId: String(u._id),
      email: u.email,
      preferredName: u.preferredName || "",
      role: u.role,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
}

export async function getOverview(req, res) {
  try {
    const [userCounts, usageAgg, recentUsage] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            adminUsers: {
              $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] },
            },
          },
        },
      ]),
      AiUsageLog.aggregate([
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            successCalls: {
              $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
            },
            promptTokens: { $sum: "$promptTokens" },
            completionTokens: { $sum: "$completionTokens" },
            totalTokens: { $sum: "$totalTokens" },
            estimatedCostUsd: { $sum: "$estimatedCostUsd" },
          },
        },
      ]),
      AiUsageLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("userEmail endpoint model totalTokens estimatedCostUsd status createdAt")
        .lean(),
    ]);

    const users = userCounts[0] || { totalUsers: 0, adminUsers: 0 };
    const usage = usageAgg[0] || {
      totalCalls: 0,
      successCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    };

    res.json({
      users: {
        total: users.totalUsers,
        admins: users.adminUsers,
      },
      openai: {
        totalCalls: usage.totalCalls,
        successCalls: usage.successCalls,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd: formatUsd(usage.estimatedCostUsd),
        pricing: pricingMeta(),
      },
      recentUsage,
    });
  } catch (err) {
    return sendServerError(res, err, "[admin/overview]");
  }
}

export async function listUsers(req, res) {
  try {
    const q = String(req.query.q || "")
      .trim()
      .toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));
    const skip = Number(req.query.skip) || 0;

    const filter = {};
    if (q) {
      filter.$or = [
        { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        { preferredName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "email preferredName phone status role tokenCap emailVerifiedAt createdAt updatedAt attribution",
        )
        .lean(),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);
    const sources = await sourcesForUsers(users);
    const [statsList, prefsList, assessmentList, usageByUser, resultsByUser, ordersByUser, unlockedIds] =
      await Promise.all([
      MilitaryStats.find({ userId: { $in: userIds } }).lean(),
      Preferences.find({ userId: { $in: userIds } }).lean(),
      Assessment.find({ userId: { $in: userIds } })
        .sort({ completedAt: -1, _id: -1 })
        .select("userId answers.daparScore answers.medicalProfile answers.yomHameahSource")
        .lean(),
      AiUsageLog.aggregate([
        { $match: { userId: { $in: userIds } } },
        {
          $group: {
            _id: "$userId",
            callCount: { $sum: 1 },
            totalTokens: { $sum: "$totalTokens" },
            estimatedCostUsd: { $sum: "$estimatedCostUsd" },
            lastCallAt: { $max: "$createdAt" },
          },
        },
      ]),
      RoleRecommendation.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: "$userId", lastResultAt: { $max: "$updatedAt" } } },
      ]),
      PaymentOrder.aggregate([
        { $match: { userId: { $in: userIds } } },
        {
          $group: {
            _id: "$userId",
            orders: { $sum: 1 },
            paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
            lastOrderAt: { $max: "$createdAt" },
          },
        },
      ]),
      Entitlement.distinct("userId", {
        userId: { $in: userIds },
        status: { $in: ["active", "grandfathered"] },
      }),
    ]);

    const statsMap = new Map(statsList.map((s) => [String(s.userId), s]));
    const prefsMap = new Map(prefsList.map((p) => [String(p.userId), p]));
    const assessmentMap = new Map();
    for (const assessment of assessmentList) {
      const id = String(assessment.userId);
      if (!assessmentMap.has(id)) assessmentMap.set(id, assessment);
    }
    const usageMap = new Map(usageByUser.map((u) => [String(u._id), u]));
    const resultsMap = new Map(resultsByUser.map((r) => [String(r._id), r]));
    const ordersMap = new Map(ordersByUser.map((o) => [String(o._id), o]));
    const unlockedSet = new Set(unlockedIds.map(String));

    const rows = users.map((u) => {
      const id = String(u._id);
      const stats = statsMap.get(id) ?? null;
      const preferences = prefsMap.get(id) ?? null;
      const { ready: aiReady, missing: aiProfileMissing } = computeAiProfileMissing(
        stats,
        preferences,
        assessmentMap.get(id) ?? null,
      );
      const usage = usageMap.get(id);
      const usedTokens = usage?.totalTokens ?? 0;
      const effectiveCap = resolveTokenCap(u);
      const tokenStatus = buildTokenCapStatus(usedTokens, effectiveCap);
      return {
        id,
        email: u.email,
        preferredName: u.preferredName || "",
        phone: u.phone || "",
        status: u.status,
        role: u.role || "user",
        tokenCap: u.tokenCap ?? null,
        effectiveTokenCap: effectiveCap,
        emailVerifiedAt: u.emailVerifiedAt,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        aiReady,
        aiProfileMissing,
        aiUsage: {
          callCount: usage?.callCount ?? 0,
          totalTokens: usedTokens,
          estimatedCostUsd: formatUsd(usage?.estimatedCostUsd ?? 0),
          lastCallAt: usage?.lastCallAt ?? null,
        },
        aiTokens: tokenStatus,
        source: sources.get(id) ?? { source: "unknown", estimated: true },
        journey: journeyStage({
          assessed: assessmentMap.has(id),
          result: resultsMap.get(id),
          orders: ordersMap.get(id),
          unlocked: unlockedSet.has(id),
        }),
      };
    });

    res.json({
      users: rows,
      total,
      skip,
      limit,
      defaults: { tokenCap: getDefaultTokenCap() },
      funnel: await signupFunnel(),
    });
  } catch (err) {
    return sendServerError(res, err, "[admin/users]");
  }
}

/** Furthest step a user reached: signed up -> assessed -> got results -> started payment -> paid. */
function journeyStage({ assessed, result, orders, unlocked }) {
  const paid = unlocked || (orders?.paid ?? 0) > 0;
  const stage = paid
    ? "paid"
    : orders?.orders
      ? "checkout"
      : result
        ? "results"
        : assessed
          ? "assessed"
          : "signed_up";
  return {
    stage,
    lastResultAt: result?.lastResultAt ?? null,
    orders: orders?.orders ?? 0,
    paidOrders: orders?.paid ?? 0,
    lastOrderAt: orders?.lastOrderAt ?? null,
    unlocked: Boolean(unlocked),
  };
}

/** How many people reached each step, over everyone (not just one page of users). */
async function signupFunnel() {
  const [signedUp, assessed, results, checkout, paidOrders, unlocked] = await Promise.all([
    User.countDocuments({ role: { $ne: "admin" } }),
    Assessment.distinct("userId"),
    RoleRecommendation.distinct("userId"),
    PaymentOrder.distinct("userId"),
    PaymentOrder.distinct("userId", { status: "paid" }),
    Entitlement.distinct("userId", { status: "active" }),
  ]);
  const paid = new Set([...paidOrders, ...unlocked].map(String));
  return {
    signedUp,
    assessed: assessed.length,
    results: results.length,
    checkout: checkout.length,
    paid: paid.size,
  };
}

/** GET /api/admin/users/:id/journey: everything one user did, for the admin dropdown. */
export async function getUserJourney(req, res) {
  try {
    const userId = req.params.id;
    const [user, assessment, generations, recommendation, orders, entitlement, lastSession] =
      await Promise.all([
        User.findById(userId)
          .select("email preferredName phone status createdAt emailVerifiedAt")
          .lean(),
        Assessment.findOne({ userId }).sort({ completedAt: -1 }).select("answers completedAt").lean(),
        MatchGeneration.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
        RoleRecommendation.findOne({ userId })
          .sort({ updatedAt: -1 })
          .select("roles personalAnswer updatedAt")
          .lean(),
        PaymentOrder.find({ userId })
          .sort({ createdAt: -1 })
          .limit(20)
          .select("publicId status amountMinor provider claimCode chosenMethod payerEmail createdAt paidAt refundedAt")
          .lean(),
        Entitlement.findOne({ userId }).select("status createdAt").lean(),
        RefreshToken.findOne({ userId }).sort({ createdAt: -1 }).select("createdAt").lean(),
      ]);
    if (!user) return res.status(404).json({ error: "המשתמש לא נמצא" });

    const toRoles = (roles) =>
      (Array.isArray(roles) ? roles : []).map((role, index) => ({
        rank: Number(role?.rank) || index + 1,
        roleTitle: String(role?.roleTitle || ""),
        matchPercentage: Number.isFinite(Number(role?.matchPercentage))
          ? Math.round(Number(role.matchPercentage))
          : null,
      }));
    // History expires after 90 days; the current result is durable, so it fills in when history is empty.
    const runs = generations.length
      ? generations.map((g) => ({ id: String(g._id), createdAt: g.createdAt, roles: toRoles(g.roles) }))
      : recommendation
        ? [{ id: String(recommendation._id), createdAt: recommendation.updatedAt, roles: toRoles(recommendation.roles) }]
        : [];

    return res.json({
      user: {
        id: String(user._id),
        email: user.email,
        preferredName: user.preferredName || "",
        phone: user.phone || "",
        status: user.status,
        createdAt: user.createdAt,
        emailVerifiedAt: user.emailVerifiedAt ?? null,
        lastSeenAt: lastSession?.createdAt ?? null,
      },
      assessment: assessment ? { completedAt: assessment.completedAt, answers: assessment.answers } : null,
      runs,
      personalAnswer: recommendation?.personalAnswer || "",
      orders: orders.map((o) => ({
        id: o.publicId,
        status: o.status,
        amountMinor: o.amountMinor,
        provider: o.provider,
        claimCode: o.claimCode || "",
        method: o.chosenMethod || "",
        payerEmail: o.payerEmail || "",
        createdAt: o.createdAt,
        paidAt: o.paidAt ?? null,
        refundedAt: o.refundedAt ?? null,
      })),
      entitlement: entitlement ? { status: entitlement.status, since: entitlement.createdAt } : null,
    });
  } catch (err) {
    return sendServerError(res, err, "[admin/user-journey]");
  }
}

export async function updateUserTokenCap(req, res) {
  try {
    const targetId = req.params.id;
    const { tokenCap } = req.body;

    const user = await User.findByIdAndUpdate(
      targetId,
      { $set: { tokenCap } },
      { new: true },
    ).select("email role tokenCap");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const aiTokens = await getTokenCapStatusForUserId(targetId);

    res.json({
      message: tokenCap == null ? "User token cap reset to default" : "User token cap updated",
      user: {
        id: String(user._id),
        email: user.email,
        role: user.role,
        tokenCap: user.tokenCap ?? null,
        effectiveTokenCap: resolveTokenCap(user),
      },
      aiTokens,
    });
  } catch (err) {
    return sendServerError(res, err, "[admin/updateUserTokenCap]");
  }
}

export async function updateUserRole(req, res) {
  try {
    const targetId = req.params.id;
    const { role } = req.body;

    if (String(req.adminUser._id) === String(targetId) && role !== "admin") {
      return res.status(400).json({ error: "Cannot demote your own admin account" });
    }

    const user = await User.findByIdAndUpdate(targetId, { $set: { role } }, { new: true }).select(
      "email role preferredName",
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: role === "admin" ? "User promoted to admin" : "User demoted to user",
      user: {
        id: String(user._id),
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return sendServerError(res, err, "[admin/updateUserRole]");
  }
}

export async function deleteUser(req, res) {
  try {
    const targetId = req.params.id;

    if (String(req.adminUser._id) === String(targetId)) {
      return res.status(400).json({ error: "Cannot delete your own admin account" });
    }

    const user = await User.findById(targetId).select("email");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const email = normalizeEmail(user.email);

    await deleteUserData(targetId, email);

    res.json({ message: "User and related data deleted", deletedUserId: targetId, email });
  } catch (err) {
    return sendServerError(res, err, "[admin/deleteUser]");
  }
}
