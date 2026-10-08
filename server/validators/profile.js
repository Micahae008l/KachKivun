import {
  LIMITS,
  fail,
  ok,
  parseEnum,
  parseOptionalIntInRange,
  parseOptionalIsoDate,
  parseString,
  requirePlainObject,
} from "../utils/sanitize.js";
import { YOM_HAMEAH_KEYS } from "../utils/yomHameahKeys.js";
import { SERVICE_MAP } from "../utils/profileApply.js";

const USER_STATUSES = ["Pre-Draft", "Active Duty", "Discharged"];
const SERVICE_LIFECYCLES = Object.keys(SERVICE_MAP);
const DAPAR_SCORES = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const MEDICAL_PROFILES = [21, 45, 64, 72, 82, 97];
const COMBAT_PREFS = [
  "Kravi",
  "Jobnik",
  "Undecided",
  "Mixed",
  "FieldCombat",
  "SupportHQ",
  "TechTrack",
  "MedicalInstruction",
];
const SCHEDULES = ["Yomiyot", "Hamshushim", "Any"];
const FOCUS_OPTS = ["Tech", "Physical", "Research", "Medical", "Any"];
const LOCATIONS = ["Close to home", "Anywhere"];
const FITNESS_LEVELS = ["Low", "Medium", "High", "Unspecified"];
const YOM_SOURCES = ["official", "self", "unknown", "unspecified"];

/** @returns {{ ok: true, value: Record<string, unknown> } | { ok: false, error: string, code?: string }} */
function parseYomHameah(value) {
  const objResult = requirePlainObject(value, "yomHameah");
  if (!objResult.ok) return objResult;
  const raw = objResult.value;
  for (const key of Object.keys(raw)) {
    if (!YOM_HAMEAH_KEYS.includes(key)) return fail(`Unknown yom field: ${key}`);
  }
  const out = {};
  for (const key of YOM_HAMEAH_KEYS) {
    if (raw[key] === undefined) return fail("yomHameah is incomplete");
    const scoreResult = parseOptionalIntInRange(raw[key], { min: 1, max: 5, label: key });
    if (!scoreResult.ok) return scoreResult;
    if (scoreResult.value == null) return fail("yomHameah is incomplete");
    out[key] = scoreResult.value;
  }
  return ok(out);
}

/** @returns {{ ok: true, value: Array<{ questionId: string, score: number }> } | { ok: false, error: string, code?: string }} */
function parseYomQuestionnaire(value) {
  if (!Array.isArray(value)) return fail("yomQuestionnaire must be an array");
  if (value.length > LIMITS.YOM_QUESTIONNAIRE_MAX) return fail("yomQuestionnaire is too long");
  const entries = [];
  for (const item of value) {
    const row = requirePlainObject(item, "yomQuestionnaire item");
    if (!row.ok) return row;
    const qid = parseString(row.value.questionId, {
      maxLen: LIMITS.QUESTION_ID_MAX,
      minLen: 1,
      label: "questionId",
    });
    if (!qid.ok) return qid;
    const score = parseOptionalIntInRange(row.value.score, { min: 1, max: 5, label: "score" });
    if (!score.ok) return score;
    if (score.value == null) return fail("score is required");
    entries.push({ questionId: qid.value, score: score.value });
  }
  return ok(entries);
}

function parseUserPatch(value) {
  const obj = requirePlainObject(value, "user");
  if (!obj.ok) return obj;
  const allowed = ["preferredName", "phone", "serviceLifeCycle"];
  for (const key of Object.keys(obj.value)) {
    if (!allowed.includes(key)) return fail(`Unknown user field: ${key}`);
  }
  const patch = {};
  if (obj.value.preferredName !== undefined) {
    const n = parseString(obj.value.preferredName, {
      maxLen: LIMITS.NAME_MAX,
      label: "preferredName",
      allowEmpty: true,
    });
    if (!n.ok) return n;
    patch.preferredName = n.value;
  }
  if (obj.value.phone !== undefined) {
    const p = parseString(obj.value.phone, {
      maxLen: LIMITS.PHONE_MAX,
      label: "phone",
      allowEmpty: true,
    });
    if (!p.ok) return p;
    patch.phone = p.value.replace(/\s+/g, "");
  }
  if (obj.value.serviceLifeCycle !== undefined) {
    const s = parseEnum(obj.value.serviceLifeCycle, SERVICE_LIFECYCLES, { label: "serviceLifeCycle" });
    if (!s.ok) return s;
    patch.serviceLifeCycle = s.value;
  }
  return ok(patch);
}

function parseStatsPatch(value) {
  const obj = requirePlainObject(value, "stats");
  if (!obj.ok) return obj;
  const allowed = [
    "draftDate",
    "dischargeDate",
    "serviceStartDate",
    "serviceEndDate",
    "daparScore",
    "medicalProfile",
    "gender",
    "yomHameah",
    "yomQuestionnaire",
  ];
  for (const key of Object.keys(obj.value)) {
    if (!allowed.includes(key)) return fail(`Unknown stats field: ${key}`);
  }
  const patch = {};
  for (const dateKey of ["draftDate", "dischargeDate", "serviceStartDate", "serviceEndDate"]) {
    if (obj.value[dateKey] === undefined) continue;
    const d = parseOptionalIsoDate(obj.value[dateKey], dateKey);
    if (!d.ok) return d;
    patch[dateKey] = d.value ? d.value.toISOString() : null;
  }
  if (obj.value.daparScore !== undefined) {
    const d = parseOptionalIntInRange(obj.value.daparScore, { min: 10, max: 90, label: "daparScore" });
    if (!d.ok) return d;
    if (d.value != null && !DAPAR_SCORES.includes(d.value)) return fail("daparScore is invalid");
    patch.daparScore = d.value;
  }
  if (obj.value.medicalProfile !== undefined) {
    const m = parseOptionalIntInRange(obj.value.medicalProfile, { min: 21, max: 97, label: "medicalProfile" });
    if (!m.ok) return m;
    if (m.value != null && !MEDICAL_PROFILES.includes(m.value)) return fail("medicalProfile is invalid");
    patch.medicalProfile = m.value;
  }
  if (obj.value.gender !== undefined) {
    if (obj.value.gender !== null && obj.value.gender !== "male" && obj.value.gender !== "female") {
      return fail("gender is invalid");
    }
    patch.gender = obj.value.gender;
  }
  if (obj.value.yomQuestionnaire !== undefined) {
    const q = parseYomQuestionnaire(obj.value.yomQuestionnaire);
    if (!q.ok) return q;
    patch.yomQuestionnaire = q.value;
  }
  if (obj.value.yomHameah !== undefined) {
    if (obj.value.yomHameah === null) {
      patch.yomHameah = null;
    } else {
      const y = parseYomHameah(obj.value.yomHameah);
      if (!y.ok) return y;
      patch.yomHameah = y.value;
    }
  }
  return ok(patch);
}

function parsePreferencesPatch(value) {
  const obj = requirePlainObject(value, "preferences");
  if (!obj.ok) return obj;
  const allowed = [
    "combatPreference",
    "schedule",
    "focus",
    "location",
    "physicalActivityLevel",
    "yomHameahSource",
  ];
  for (const key of Object.keys(obj.value)) {
    if (!allowed.includes(key)) return fail(`Unknown preferences field: ${key}`);
  }
  const patch = {};
  if (obj.value.combatPreference !== undefined) {
    const v = parseEnum(obj.value.combatPreference, COMBAT_PREFS, { label: "combatPreference" });
    if (!v.ok) return v;
    patch.combatPreference = v.value;
  }
  if (obj.value.schedule !== undefined) {
    const v = parseEnum(obj.value.schedule, SCHEDULES, { label: "schedule" });
    if (!v.ok) return v;
    patch.schedule = v.value;
  }
  if (obj.value.focus !== undefined) {
    const v = parseEnum(obj.value.focus, FOCUS_OPTS, { label: "focus" });
    if (!v.ok) return v;
    patch.focus = v.value;
  }
  if (obj.value.location !== undefined) {
    const v = parseEnum(obj.value.location, LOCATIONS, { label: "location" });
    if (!v.ok) return v;
    patch.location = v.value;
  }
  if (obj.value.physicalActivityLevel !== undefined) {
    const v = parseEnum(obj.value.physicalActivityLevel, FITNESS_LEVELS, {
      label: "physicalActivityLevel",
    });
    if (!v.ok) return v;
    patch.physicalActivityLevel = v.value;
  }
  if (obj.value.yomHameahSource !== undefined) {
    const v = parseEnum(obj.value.yomHameahSource, YOM_SOURCES, { label: "yomHameahSource" });
    if (!v.ok) return v;
    patch.yomHameahSource = v.value;
  }
  return ok(patch);
}

export function validateProfileUpdate(req) {
  const bodyResult = requirePlainObject(req.body, "body");
  if (!bodyResult.ok) return bodyResult;

  // Back-compat: older clients may send gender at the top level.
  if (bodyResult.value.gender !== undefined) {
    const stats =
      bodyResult.value.stats && typeof bodyResult.value.stats === "object" && !Array.isArray(bodyResult.value.stats)
        ? { ...bodyResult.value.stats }
        : {};
    if (stats.gender === undefined) stats.gender = bodyResult.value.gender;
    bodyResult.value.stats = stats;
    delete bodyResult.value.gender;
  }

  const allowedTop = ["status", "user", "stats", "preferences"];
  for (const key of Object.keys(bodyResult.value)) {
    if (!allowedTop.includes(key)) return fail(`Unknown field: ${key}`);
  }

  const sanitized = {};

  if (bodyResult.value.status !== undefined) {
    const s = parseEnum(bodyResult.value.status, USER_STATUSES, { label: "status" });
    if (!s.ok) return s;
    sanitized.status = s.value;
  }
  if (bodyResult.value.user !== undefined) {
    const u = parseUserPatch(bodyResult.value.user);
    if (!u.ok) return u;
    sanitized.user = u.value;
  }
  if (bodyResult.value.stats !== undefined) {
    const st = parseStatsPatch(bodyResult.value.stats);
    if (!st.ok) return st;
    sanitized.stats = st.value;
  }
  if (bodyResult.value.preferences !== undefined) {
    const p = parsePreferencesPatch(bodyResult.value.preferences);
    if (!p.ok) return p;
    sanitized.preferences = p.value;
  }

  if (Object.keys(sanitized).length === 0) {
    return fail("No valid fields to update");
  }

  req.body = sanitized;
  return { ok: true };
}
