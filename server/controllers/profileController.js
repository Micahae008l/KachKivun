import User from "../models/User.js";
import { applyUserPatch, applyStatsPatch, applyPreferencesPatch } from "../utils/profileApply.js";
import { sendServerError } from "../utils/httpError.js";
import { deleteUserData } from "../utils/deleteAccount.js";
import { clearRefreshCookie } from "../utils/refreshTokens.js";
import { buildAttribution } from "../utils/userSource.js";

const CONSENT_SOURCES = ["signup", "dashboard"];

/** Strict body for the marketing opt-in: a real boolean and where it was set, nothing else. */
export function parseConsentBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.some((k) => k !== "granted" && k !== "source")) return null;
  if (typeof body.granted !== "boolean" || !CONSENT_SOURCES.includes(body.source)) return null;
  return { granted: body.granted, source: body.source };
}

export async function setMarketingConsent(req, res) {
  try {
    const consent = parseConsentBody(req.body);
    if (!consent) return res.status(400).json({ error: "Invalid body", code: "VALIDATION_ERROR" });
    await User.updateOne(
      { _id: req.userId },
      { $set: { marketingConsent: { ...consent, at: new Date() } } },
    );
    return res.json({ ok: true, granted: consent.granted });
  } catch (err) {
    return sendServerError(res, err, "[profile/marketing-consent]");
  }
}

export async function updateProfile(req, res) {
  try {
    const { status, stats, preferences, user: userPatch } = req.body;
    const userId = req.userId;

    if (userPatch && typeof userPatch === "object" && Object.keys(userPatch).length > 0) {
      await applyUserPatch(userId, userPatch);
    }
    if (status) {
      await User.findByIdAndUpdate(userId, { status });
    }

    if (stats && typeof stats === "object") {
      await applyStatsPatch(userId, stats);
    }

    if (preferences && typeof preferences === "object") {
      await applyPreferencesPatch(userId, preferences);
    }

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    return sendServerError(res, err);
  }
}

/** The exact word the user must type; a session alone should not be enough to erase an account. */
export const DELETE_CONFIRMATION = "מחיקה";

/** A signed-in user deletes their own account and personal data. */
export async function deleteAccount(req, res) {
  try {
    if (String(req.body?.confirm || "").trim() !== DELETE_CONFIRMATION) {
      return res
        .status(400)
        .json({ error: "כדי למחוק את החשבון הקלידו: מחיקה", code: "CONFIRM_REQUIRED" });
    }
    const user = await User.findById(req.userId).select("email role");
    if (!user) return res.status(404).json({ error: "המשתמש לא נמצא" });
    // An admin erasing themselves could leave the site with no admin; another admin does it.
    if (user.role === "admin") {
      return res
        .status(403)
        .json({ error: "חשבון מנהל נמחק רק על ידי מנהל אחר", code: "ADMIN_ACCOUNT" });
    }
    await deleteUserData(
      req.userId,
      String(user.email || "")
        .trim()
        .toLowerCase(),
    );
    clearRefreshCookie(res);
    res.json({ message: "החשבון והנתונים האישיים נמחקו" });
  } catch (err) {
    return sendServerError(res, err, "[profile/delete-account]");
  }
}

/** POST /api/profile/attribution: remember where this user came from, if not known yet. */
export async function recordAttribution(req, res) {
  try {
    const user = await User.findById(req.userId).select("createdAt attribution.source").lean();
    if (!user) return res.status(404).json({ error: "not found" });
    if (user.attribution?.source) return res.json({ ok: true, kept: true });
    // A first visit more than a few hours after signup can't tell us how they first arrived.
    const afterSignup = Date.now() - new Date(user.createdAt).getTime() > 6 * 60 * 60 * 1000;
    const attribution = buildAttribution(req.body || {}, req.get("user-agent") || "", { afterSignup });
    await User.updateOne(
      { _id: req.userId, "attribution.source": { $exists: false } },
      { $set: { attribution } },
    );
    return res.json({ ok: true, source: attribution.source });
  } catch (err) {
    return sendServerError(res, err, "[profile/attribution]");
  }
}
