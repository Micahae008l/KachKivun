import User from "../models/User.js";
import MilitaryStats from "../models/MilitaryStats.js";
import Preferences from "../models/Preferences.js";
import { addMonths, aggregateYomFromAnswers, loadYomQuestionDefs } from "./yomLoad.js";
import { isValidYomHameah12, migrateLegacyYomHameahTo12 } from "./yomHameah12Keys.js";

export const SERVICE_MAP = {
  pre: "Pre-Draft",
  serving: "Active Duty",
  veteran: "Discharged",
};

export function setDateField(update, key, value) {
  if (value === undefined) return;
  update[key] = value ? new Date(value) : null;
}

/**
 * @param {import("mongoose").Types.ObjectId} userId
 * @param {Record<string, unknown>} userPatch
 */
export async function applyUserPatch(userId, userPatch) {
  if (!userPatch || typeof userPatch !== "object") return;
  const u = {};
  if (userPatch.preferredName !== undefined) {
    const n = String(userPatch.preferredName).trim().slice(0, 120);
    u.preferredName = n;
  }
  if (userPatch.phone !== undefined) {
    u.phone = String(userPatch.phone)
      .trim()
      .replace(/\s+/g, "")
      .slice(0, 20);
  }
  if (userPatch.serviceLifeCycle === "pre" || userPatch.serviceLifeCycle === "serving" || userPatch.serviceLifeCycle === "veteran") {
    u.status = SERVICE_MAP[userPatch.serviceLifeCycle];
  }
  if (Object.keys(u).length) await User.findByIdAndUpdate(userId, u);
}

/**
 * @param {import("mongoose").Types.ObjectId} userId
 * @param {Record<string, unknown>} stats
 */
export async function applyStatsPatch(userId, stats) {
  if (!stats || typeof stats !== "object") return;
  const update = {};
  setDateField(update, "draftDate", stats.draftDate);
  setDateField(update, "dischargeDate", stats.dischargeDate);
  setDateField(update, "serviceStartDate", stats.serviceStartDate);
  setDateField(update, "serviceEndDate", stats.serviceEndDate);

  const DAPAR = new Set([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  const MEDICAL = new Set([21, 45, 64, 72, 82, 97]);
  if (stats.daparScore !== undefined && (stats.daparScore === null || DAPAR.has(stats.daparScore))) {
    update.daparScore = stats.daparScore;
  }
  if (
    stats.medicalProfile !== undefined &&
    (stats.medicalProfile === null || MEDICAL.has(stats.medicalProfile))
  ) {
    update.medicalProfile = stats.medicalProfile;
  }
  if (stats.gender === "male" || stats.gender === "female" || stats.gender === null) {
    update.gender = stats.gender;
  }

  if (Array.isArray(stats.yomQuestionnaire) && stats.yomQuestionnaire.length > 0) {
    update.yomQuestionnaire = stats.yomQuestionnaire.map((x) => ({
      questionId: String(x.questionId),
      score: Number(x.score),
    }));
    try {
      const defs = loadYomQuestionDefs();
      const yom = aggregateYomFromAnswers(update.yomQuestionnaire, defs);
      if (yom) update.yomHameah = yom;
    } catch {
      /* keep manual yomHameah if file missing */
    }
  } else if (stats.yomHameah !== undefined) {
    if (stats.yomHameah === null) {
      update.yomHameah = null;
      update.yomQuestionnaire = [];
    } else {
      const migrated = migrateLegacyYomHameahTo12(stats.yomHameah);
      if (isValidYomHameah12(migrated)) {
        update.yomHameah = migrated;
      } else if (isValidYomHameah12(stats.yomHameah)) {
        update.yomHameah = stats.yomHameah;
      }
      update.yomQuestionnaire = [];
    }
  }

  if (Object.keys(update).length) {
    await MilitaryStats.findOneAndUpdate({ userId }, { $set: update }, { new: true, upsert: true });
  }

  const userAfter = await User.findById(userId).select("status");
  const doc = await MilitaryStats.findOne({ userId });
  if (userAfter?.status === "Active Duty" && doc?.serviceStartDate && !doc.dischargeDate) {
    const end = addMonths(doc.serviceStartDate, 32);
    await MilitaryStats.findOneAndUpdate({ userId }, { $set: { dischargeDate: end } });
  }
}

/**
 * @param {import("mongoose").Types.ObjectId} userId
 * @param {Record<string, unknown>} preferences
 */
const COMBAT_PREFS = new Set([
  "Kravi",
  "Jobnik",
  "Undecided",
  "Mixed",
  "FieldCombat",
  "SupportHQ",
  "TechTrack",
  "MedicalInstruction",
]);
const SCHEDULES = new Set(["Yomiyot", "Hamshushim", "Any"]);
const FOCUS_OPTS = new Set(["Tech", "Physical", "Research", "Medical", "Any"]);
const LOCATIONS = new Set(["Close to home", "Anywhere"]);
const FITNESS_LEVELS = new Set(["Low", "Medium", "High", "Unspecified"]);
const YOM_SOURCES = new Set(["official", "self", "unknown", "unspecified"]);

export async function applyPreferencesPatch(userId, preferences) {
  if (!preferences || typeof preferences !== "object") return;
  const p = {};
  if (preferences.combatPreference !== undefined && COMBAT_PREFS.has(preferences.combatPreference)) {
    p.combatPreference = preferences.combatPreference;
  }
  if (preferences.schedule !== undefined && SCHEDULES.has(preferences.schedule)) {
    p.schedule = preferences.schedule;
  }
  if (preferences.focus !== undefined && FOCUS_OPTS.has(preferences.focus)) {
    p.focus = preferences.focus;
  }
  if (preferences.location !== undefined && LOCATIONS.has(preferences.location)) {
    p.location = preferences.location;
  }
  if (
    preferences.physicalActivityLevel !== undefined &&
    FITNESS_LEVELS.has(preferences.physicalActivityLevel)
  ) {
    p.physicalActivityLevel = preferences.physicalActivityLevel;
  }
  if (preferences.yomHameahSource !== undefined && YOM_SOURCES.has(preferences.yomHameahSource)) {
    p.yomHameahSource = preferences.yomHameahSource;
  }
  if (Object.keys(p).length) {
    await Preferences.findOneAndUpdate({ userId }, { $set: p }, { new: true, upsert: true });
  }
}
