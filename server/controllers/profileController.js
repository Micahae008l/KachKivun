import User from "../models/User.js";
import { applyUserPatch, applyStatsPatch, applyPreferencesPatch } from "../utils/profileApply.js";
import { sendServerError } from "../utils/httpError.js";
import { deleteUserData } from "../utils/deleteAccount.js";
import { clearRefreshCookie } from "../utils/refreshTokens.js";

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
