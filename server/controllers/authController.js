import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import MilitaryStats from "../models/MilitaryStats.js";
import Preferences from "../models/Preferences.js";
import Assessment from "../models/Assessment.js";
import EmailOtp from "../models/EmailOtp.js";
import RefreshToken from "../models/RefreshToken.js";
import { computeAiProfileMissing } from "../utils/profileAiReady.js";
import { applyUserPatch, applyStatsPatch, applyPreferencesPatch } from "../utils/profileApply.js";
import { sendOtpEmail } from "../utils/email.js";
import {
  REFRESH_TOKEN_COOKIE,
  clearRefreshCookie,
  createRefreshTokenSession,
  hashRefreshToken,
  readCookie,
  refreshCookieOptions,
  revokeRefreshToken,
} from "../utils/refreshTokens.js";
import { logSecurityEvent } from "../utils/securityLog.js";
import { sendServerError } from "../utils/httpError.js";


const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 45;
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function userSessionPayload(user, extra = {}) {
  return {
    token: signToken(user._id),
    userId: String(user._id),
    status: user.status,
    role: user.role || "user",
    ...extra,
  };
}

async function setRefreshCookieForUser(req, res, userId) {
  const session = await createRefreshTokenSession(userId, req);
  res.cookie(REFRESH_TOKEN_COOKIE, session.token, refreshCookieOptions());
  return session;
}

function createOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function ensureUserScaffold(userId) {
  await MilitaryStats.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true },
  );
  await Preferences.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true },
  );
}

const SIGNUP_ACCOUNT_EXISTS_MSG = "כבר יש חשבון עם האימייל הזה. השתמשו בדף הכניסה במקום הרשמה.";

/** True when signup must be denied — existing user with a complete profile. */
async function existingUserBlocksSignup(email) {
  const user = await User.findOne({ email }).select("_id preferredName");
  if (!user) return false;

  const [stats, preferences, latestAssessment] = await Promise.all([
    MilitaryStats.findOne({ userId: user._id }),
    Preferences.findOne({ userId: user._id }),
    Assessment.findOne({ userId: user._id }).sort({ completedAt: -1, _id: -1 }).lean(),
  ]);
  const preferred = String(user.preferredName || "").trim();
  const { ready: profileFieldsReady } = computeAiProfileMissing(
    stats,
    preferences,
    latestAssessment,
  );
  return preferred.length > 0 && profileFieldsReady;
}

function rejectSignupExistingAccount(res) {
  return res.status(409).json({
    error: SIGNUP_ACCOUNT_EXISTS_MSG,
    code: "ACCOUNT_EXISTS",
    redirect: "login",
  });
}

function buildStatsFromProfile(profile) {
  const stats = {};
  if (profile.draftDate !== undefined) stats.draftDate = profile.draftDate;
  if (profile.dischargeDate !== undefined) stats.dischargeDate = profile.dischargeDate;
  if (profile.serviceStartDate !== undefined) stats.serviceStartDate = profile.serviceStartDate;
  if (profile.serviceEndDate !== undefined) stats.serviceEndDate = profile.serviceEndDate;
  if (profile.daparScore !== undefined) stats.daparScore = profile.daparScore;
  if (profile.medicalProfile !== undefined) stats.medicalProfile = profile.medicalProfile;
  if (profile.yomHameah !== undefined) stats.yomHameah = profile.yomHameah;
  if (Array.isArray(profile.yomQuestionnaire) && profile.yomQuestionnaire.length > 0) {
    stats.yomQuestionnaire = profile.yomQuestionnaire;
  }
  return stats;
}

export async function register(req, res) {
  return res.status(410).json({ error: "הרשמה עם סיסמה הוחלפה בכניסה עם קוד חד־פעמי." });
}

export async function login(req, res) {
  return res.status(410).json({ error: "כניסה עם סיסמה הוחלפה בכניסה עם קוד חד־פעמי." });
}

export async function getSession(req, res) {
  try {
    const user = await User.findById(req.userId).select("email role preferredName status");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      userId: String(user._id),
      email: user.email,
      role: user.role || "user",
      preferredName: user.preferredName || "",
      status: user.status,
    });
  } catch (err) {
    return sendServerError(res, err, "[auth/me]");
  }
}

// Two tabs refreshing at once legitimately send the just-rotated token; only older reuse counts.
const REFRESH_REUSE_GRACE_MS = 30_000;

/**
 * A rotated refresh token coming back after the grace window means a copy of it exists
 * somewhere else (a stolen cookie). Revoke every session of that user so the thief's copy
 * dies too, and log it for the admin security page.
 */
export async function handleRefreshTokenReuse(tokenHash, req, now = Date.now()) {
  const used = await RefreshToken.findOne({ tokenHash }).select("userId revokedAt replacedByTokenHash");
  if (!used?.revokedAt || !used.replacedByTokenHash) return false;
  if (now - used.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS) return false;
  await RefreshToken.updateMany(
    { userId: used.userId, revokedAt: null },
    { $set: { revokedAt: new Date(now) } },
  );
  logSecurityEvent("refresh_token_reuse", req, {
    statusCode: 401,
    userId: used.userId,
    message: "rotated refresh token reused; all sessions revoked",
  });
  return true;
}

export async function refreshSession(req, res) {
  try {
    const rawToken = readCookie(req, REFRESH_TOKEN_COOKIE);
    if (!rawToken) {
      return res
        .status(401)
        .json({ error: "Refresh token required", code: "REFRESH_TOKEN_REQUIRED" });
    }

    const tokenHash = hashRefreshToken(rawToken);
    // Claim the token atomically so two simultaneous refreshes cannot both rotate it.
    const existing = await RefreshToken.findOneAndUpdate(
      { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { revokedAt: new Date() } },
      { new: true },
    );

    if (!existing) {
      await handleRefreshTokenReuse(tokenHash, req);
      clearRefreshCookie(res);
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token", code: "REFRESH_TOKEN_INVALID" });
    }

    const user = await User.findById(existing.userId).select("email role preferredName status");
    if (!user) {
      await revokeRefreshToken(rawToken);
      clearRefreshCookie(res);
      return res.status(404).json({ error: "User not found" });
    }

    const replacement = await createRefreshTokenSession(user._id, req);
    existing.replacedByTokenHash = replacement.tokenHash;
    await existing.save();
    res.cookie(REFRESH_TOKEN_COOKIE, replacement.token, refreshCookieOptions());

    res.json(userSessionPayload(user));
  } catch (err) {
    return sendServerError(res, err, "[auth/refresh]");
  }
}

export async function logout(req, res) {
  try {
    const rawToken = readCookie(req, REFRESH_TOKEN_COOKIE);
    if (rawToken) await revokeRefreshToken(rawToken);
    clearRefreshCookie(res);
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error("[auth/logout]", err);
    clearRefreshCookie(res);
    return sendServerError(res, err);
  }
}

export async function requestOtp(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const { intent } = req.body;

    if (intent === "signup" && (await existingUserBlocksSignup(email))) {
      return rejectSignupExistingAccount(res);
    }

    const recent = await EmailOtp.findOne({
      email,
      purpose: "login",
      consumedAt: null,
      createdAt: { $gt: new Date(Date.now() - OTP_RESEND_SECONDS * 1000) },
    }).sort({ createdAt: -1 });
    if (recent) {
      return res.status(429).json({
        error: `אפשר לשלוח קוד חדש בעוד ${OTP_RESEND_SECONDS} שניות`,
        code: "OTP_RESEND_COOLDOWN",
      });
    }

    const code = createOtpCode();
    const codeHash = await bcrypt.hash(code, 12);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await EmailOtp.updateMany(
      { email, purpose: "login", consumedAt: null },
      { $set: { consumedAt: new Date() } },
    );
    const otpDoc = new EmailOtp({
      email,
      codeHash,
      purpose: "login",
      expiresAt,
    });
    await otpDoc.save();

    let delivery;
    try {
      delivery = await sendOtpEmail(email, code);
    } catch (sendErr) {
      console.error("[auth/request-otp] send mail failed:", sendErr);
      await otpDoc.deleteOne();
      return res.status(502).json({
        error:
          "לא הצלחנו לשלוח את האימייל. בדקו את הגדרת ה-SMTP (למשל Gmail: סיסמת אפליקציה, כתובת שולח תואמת ל-SMTP_USER) או נסו שוב.",
        code: "EMAIL_DELIVERY_FAILED",
      });
    }

    const payload = {
      message: "קוד נשלח לאימייל",
      expiresInSeconds: OTP_TTL_MINUTES * 60,
      delivery: delivery.delivered ? "email" : "console",
    };
    if (!delivery.delivered && process.env.NODE_ENV !== "production") {
      payload.devCode = code;
    }
    res.json(payload);
  } catch (err) {
    return sendServerError(res, err, "[auth/request-otp]");
  }
}

export async function verifyOtp(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code ?? "").replace(/[^0-9]/g, "");
    const { intent } = req.body;

    if (intent === "signup" && (await existingUserBlocksSignup(email))) {
      return rejectSignupExistingAccount(res);
    }

    const otp = await EmailOtp.findOne({
      email,
      purpose: "login",
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otp) {
      console.warn(`[auth/verify-otp] no active code for ${email} (expired, used, or never sent) — codeLen=${code.length}`);
      return res.status(400).json({
        error: "הקוד פג תוקף או לא נמצא. שלחו קוד חדש.",
        code: "OTP_EXPIRED",
      });
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      otp.consumedAt = new Date();
      await otp.save();
      logSecurityEvent("otp_locked", req, {
        statusCode: 429,
        email,
        message: `code locked after ${otp.attempts} failed attempts`,
      });
      console.warn(`[auth/verify-otp] code locked for ${email} (${otp.attempts} attempts) — auto-sending a fresh code is required`);
      return res.status(429).json({
        error: "יותר מדי ניסיונות. שלחו קוד חדש.",
        code: "OTP_MAX_ATTEMPTS",
      });
    }

    const valid = await bcrypt.compare(code, otp.codeHash);
    if (!valid) {
      otp.attempts += 1;
      await otp.save();
      logSecurityEvent("otp_failed", req, {
        statusCode: 401,
        email,
        message: `wrong code, attempt ${otp.attempts}/${OTP_MAX_ATTEMPTS}`,
      });
      console.warn(`[auth/verify-otp] MISMATCH for ${email} — entered codeLen=${code.length}, attempt ${otp.attempts}/${OTP_MAX_ATTEMPTS}`);
      return res.status(401).json({ error: "קוד שגוי", code: "OTP_INVALID" });
    }
    console.log(`[auth/verify-otp] OK for ${email}`);

    otp.consumedAt = new Date();
    await otp.save();

    const user = await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { email }, $set: { emailVerifiedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await ensureUserScaffold(user._id);

    const [stats, preferences, latestAssessment] = await Promise.all([
      MilitaryStats.findOne({ userId: user._id }),
      Preferences.findOne({ userId: user._id }),
      Assessment.findOne({ userId: user._id }).sort({ completedAt: -1, _id: -1 }).lean(),
    ]);
    const preferred = String(user.preferredName || "").trim();
    const { ready: profileFieldsReady } = computeAiProfileMissing(
      stats,
      preferences,
      latestAssessment,
    );
    const profileComplete = preferred.length > 0 && profileFieldsReady;

    await setRefreshCookieForUser(req, res, user._id);

    res.json({
      ...userSessionPayload(user),
      /** True until profile is complete enough for AI (same gate as match-roles). */
      isNewUser: !profileComplete,
    });
  } catch (err) {
    console.error("[auth/verify-otp]", err);
    if (err?.code === 11000) {
      return res.status(409).json({ error: "האימייל כבר בשימוש. נסו שוב." });
    }
    return sendServerError(res, err);
  }
}
