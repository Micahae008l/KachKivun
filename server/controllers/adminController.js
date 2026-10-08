import User from "../models/User.js";
import MilitaryStats from "../models/MilitaryStats.js";
import Preferences from "../models/Preferences.js";
import Assessment from "../models/Assessment.js";
import EmailOtp from "../models/EmailOtp.js";
import AiUsageLog from "../models/AiUsageLog.js";
import RefreshToken from "../models/RefreshToken.js";
import { computeAiProfileMissing } from "../utils/profileAiReady.js";
import { pricingMeta } from "../utils/openaiPricing.js";
import { sendServerError } from "../utils/httpError.js";

import {
  buildTokenCapStatus,
  getDefaultTokenCap,
  getTokenCapStatusForUserId,
  resolveTokenCap,
} from "../utils/tokenCap.js";

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
    const limit = Number(req.query.limit) || 50;
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
          "email preferredName phone status role tokenCap emailVerifiedAt createdAt updatedAt",
        )
        .lean(),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);
    const [statsList, prefsList, assessmentList, usageByUser] = await Promise.all([
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
    ]);

    const statsMap = new Map(statsList.map((s) => [String(s.userId), s]));
    const prefsMap = new Map(prefsList.map((p) => [String(p.userId), p]));
    const assessmentMap = new Map();
    for (const assessment of assessmentList) {
      const id = String(assessment.userId);
      if (!assessmentMap.has(id)) assessmentMap.set(id, assessment);
    }
    const usageMap = new Map(usageByUser.map((u) => [String(u._id), u]));

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
      };
    });

    res.json({
      users: rows,
      total,
      skip,
      limit,
      defaults: { tokenCap: getDefaultTokenCap() },
    });
  } catch (err) {
    return sendServerError(res, err, "[admin/users]");
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

    await Promise.all([
      MilitaryStats.deleteOne({ userId: targetId }),
      Preferences.deleteOne({ userId: targetId }),
      AiUsageLog.deleteMany({ userId: targetId }),
      RefreshToken.deleteMany({ userId: targetId }),
      EmailOtp.deleteMany({ email }),
      User.deleteOne({ _id: targetId }),
    ]);

    res.json({ message: "User and related data deleted", deletedUserId: targetId, email });
  } catch (err) {
    return sendServerError(res, err, "[admin/deleteUser]");
  }
}
