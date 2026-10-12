import User from "../models/User.js";
import MilitaryStats from "../models/MilitaryStats.js";
import Preferences from "../models/Preferences.js";
import Assessment from "../models/Assessment.js";
import RoleRecommendation from "../models/RoleRecommendation.js";
import AiMatchResult from "../models/AiMatchResult.js";
import MatchGeneration from "../models/MatchGeneration.js";
import ReportHistory from "../models/ReportHistory.js";
import RoleReview from "../models/RoleReview.js";
import Entitlement from "../models/Entitlement.js";
import AiUsageLog from "../models/AiUsageLog.js";
import RefreshToken from "../models/RefreshToken.js";
import EmailOtp from "../models/EmailOtp.js";

/**
 * Everything a person entered or that was computed about them, keyed by user id.
 * Payment orders and security events are deliberately absent: the privacy policy says
 * transaction and security records may be kept after an account is deleted.
 */
const PERSONAL_COLLECTIONS = {
  MilitaryStats,
  Preferences,
  Assessment,
  RoleRecommendation,
  AiMatchResult,
  MatchGeneration,
  ReportHistory,
  RoleReview,
  Entitlement,
  AiUsageLog,
  RefreshToken,
};

/** Deletes a user and all their personal data. Returns how many documents each collection lost. */
export async function deleteUserData(
  userId,
  email,
  { collections = PERSONAL_COLLECTIONS, OtpModel = EmailOtp, UserModel = User } = {},
) {
  const names = Object.keys(collections);
  const results = await Promise.all(names.map((name) => collections[name].deleteMany({ userId })));
  const deleted = Object.fromEntries(
    names.map((name, index) => [name, results[index]?.deletedCount ?? 0]),
  );
  if (email) {
    deleted.EmailOtp = (await OtpModel.deleteMany({ email }))?.deletedCount ?? 0;
  }
  // The user document goes last, so a failure above leaves an account that can retry.
  deleted.User = (await UserModel.deleteOne({ _id: userId }))?.deletedCount ?? 0;
  return deleted;
}
