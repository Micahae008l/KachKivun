import {
  fail,
  ok,
  parseEnum,
  parseIntInRange,
  parseString,
  requirePlainObject,
} from "../utils/sanitize.js";
import { YOM_HAMEAH_KEYS } from "../utils/yomHameahKeys.js";
import {
  ASSESSMENT_SCHEMA_VERSIONS,
  COMBAT_PREFERENCES,
  COMBAT_READINESS,
  DAPAR_SCORES,
  ENVIRONMENTS,
  EXIT_PREFERENCES,
  BASE_PREFERENCES,
  FITNESS_LEVELS,
  FOCUS_PREFERENCES,
  GENDERS,
  LEADERSHIP_PREFERENCES,
  MEDICAL_PROFILES,
  MOTIVATIONS,
  PULL_UP_BANDS,
  PUSH_UP_BANDS,
  ROLE_AVOIDANCES,
  ROLE_INTERESTS,
  RUN_3KM_BANDS,
  SERVICE_LIFE_CYCLES,
  STRESS_PREFERENCES,
  TECHNICAL_AREAS,
  TECHNICAL_LEVELS,
  UNKNOWN_ASSESSMENT_VALUE,
  YOM_SOURCES,
  deriveAssessmentBranches,
  neutralYomHameahScores,
} from "../utils/assessmentValues.js";

function rejectUnknownFields(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) return fail(`Unknown ${label} field: ${key}`);
  }
  return ok(value);
}

function parseStrictString(value, options) {
  if (typeof value !== "string") return fail(`${options.label} must be a string`);
  return parseString(value, options);
}

function parseAllowedScore(value, allowed, label) {
  const result = parseIntInRange(value, {
    min: Math.min(...allowed),
    max: Math.max(...allowed),
    label,
  });
  if (!result.ok) return result;
  return allowed.includes(result.value) ? result : fail(`${label} is invalid`);
}

function parseAllowedScoreOrUnknown(value, allowed, label) {
  return value === UNKNOWN_ASSESSMENT_VALUE
    ? ok(UNKNOWN_ASSESSMENT_VALUE)
    : parseAllowedScore(value, allowed, label);
}

function parseEnumArray(value, allowed, { label, min = 0, max }) {
  if (!Array.isArray(value)) return fail(`${label} must be an array`);
  if (value.length < min || value.length > max) {
    return fail(`${label} must contain between ${min} and ${max} values`);
  }
  const output = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowed.includes(item)) {
      return fail(`${label} contains an invalid value`);
    }
    if (output.includes(item)) return fail(`${label} cannot contain duplicate values`);
    output.push(item);
  }
  return ok(output);
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fail("draftDate must use YYYY-MM-DD");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return fail("draftDate is invalid");
  }
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2038) return fail("draftDate is outside the supported range");
  return ok(value);
}

function parseYomHameah(value) {
  const object = requirePlainObject(value, "yomHameah");
  if (!object.ok) return object;
  const unknown = rejectUnknownFields(object.value, YOM_HAMEAH_KEYS, "yomHameah");
  if (!unknown.ok) return unknown;

  const output = {};
  for (const key of YOM_HAMEAH_KEYS) {
    const score = parseIntInRange(object.value[key], { min: 1, max: 5, label: key });
    if (!score.ok) return score;
    output[key] = score.value;
  }
  return ok(output);
}

function parseCombatDetails(value, required) {
  if (!required && (value === undefined || value === null)) return ok(null);
  const object = requirePlainObject(value, "combatDetails");
  if (!object.ok) return object;
  const allowedFields = ["run3kmBand", "pullUpsBand", "pushUpsBand", "readiness"];
  const unknown = rejectUnknownFields(object.value, allowedFields, "combatDetails");
  if (!unknown.ok) return unknown;
  if (!required) return ok(null);

  const run = parseEnum(object.value.run3kmBand, RUN_3KM_BANDS, { label: "run3kmBand" });
  if (!run.ok) return run;
  const pull = parseEnum(object.value.pullUpsBand, PULL_UP_BANDS, { label: "pullUpsBand" });
  if (!pull.ok) return pull;
  const push = parseEnum(object.value.pushUpsBand, PUSH_UP_BANDS, { label: "pushUpsBand" });
  if (!push.ok) return push;
  const readiness = parseEnum(object.value.readiness, COMBAT_READINESS, {
    label: "combat readiness",
  });
  if (!readiness.ok) return readiness;

  return ok({
    run3kmBand: run.value,
    pullUpsBand: pull.value,
    pushUpsBand: push.value,
    readiness: readiness.value,
  });
}

function parseTechnicalDetails(value, required) {
  if (!required && (value === undefined || value === null)) return ok(null);
  const object = requirePlainObject(value, "technicalDetails");
  if (!object.ok) return object;
  const unknown = rejectUnknownFields(object.value, ["level", "areas"], "technicalDetails");
  if (!unknown.ok) return unknown;
  if (!required) return ok(null);

  const level = parseEnum(object.value.level, TECHNICAL_LEVELS, { label: "technical level" });
  if (!level.ok) return level;
  const areas = parseEnumArray(object.value.areas, TECHNICAL_AREAS, {
    label: "technical areas",
    min: 1,
    max: 4,
  });
  if (!areas.ok) return areas;
  if (areas.value.includes("undecided") && areas.value.length > 1) {
    return fail("technical areas cannot combine undecided with other values");
  }
  return ok({ level: level.value, areas: areas.value });
}

function parseAnswers(value) {
  const object = requirePlainObject(value, "answers");
  if (!object.ok) return object;
  const allowedFields = [
    "serviceLifeCycle",
    "preferredName",
    "gender",
    "daparScore",
    "medicalProfile",
    "draftDate",
    "yomHameah",
    "yomHameahSource",
    "combatPreference",
    "focus",
    "focusExtra",
    "physicalActivityLevel",
    "rolesInterested",
    "rolesAvoided",
    "exitsPreference",
    "basePreference",
    "environment",
    "leadership",
    "stress",
    "motivations",
    "combatDetails",
    "technicalDetails",
    "extraNote",
  ];
  const unknown = rejectUnknownFields(object.value, allowedFields, "answers");
  if (!unknown.ok) return unknown;
  const raw = object.value;

  const service = parseEnum(raw.serviceLifeCycle, SERVICE_LIFE_CYCLES, {
    label: "serviceLifeCycle",
  });
  if (!service.ok) return service;
  const preferredName = parseStrictString(raw.preferredName, {
    label: "preferredName",
    minLen: 1,
    maxLen: 120,
  });
  if (!preferredName.ok) return preferredName;
  const gender = parseEnum(raw.gender, GENDERS, { label: "gender" });
  if (!gender.ok) return gender;
  const dapar = parseAllowedScoreOrUnknown(raw.daparScore, DAPAR_SCORES, "daparScore");
  if (!dapar.ok) return dapar;
  const medical = parseAllowedScoreOrUnknown(
    raw.medicalProfile,
    MEDICAL_PROFILES,
    "medicalProfile",
  );
  if (!medical.ok) return medical;
  const draftDate = parseDateOnly(raw.draftDate);
  if (!draftDate.ok) return draftDate;
  const yomSource = parseEnum(raw.yomHameahSource, YOM_SOURCES, {
    label: "yomHameahSource",
  });
  if (!yomSource.ok) return yomSource;
  const yom =
    yomSource.value === UNKNOWN_ASSESSMENT_VALUE
      ? ok(neutralYomHameahScores())
      : parseYomHameah(raw.yomHameah);
  if (!yom.ok) return yom;
  const combatPreference = parseEnum(raw.combatPreference, COMBAT_PREFERENCES, {
    label: "combatPreference",
  });
  if (!combatPreference.ok) return combatPreference;
  const focus = parseEnum(raw.focus, FOCUS_PREFERENCES, { label: "focus" });
  if (!focus.ok) return focus;
  const fitness = parseEnum(raw.physicalActivityLevel, FITNESS_LEVELS, {
    label: "physicalActivityLevel",
  });
  if (!fitness.ok) return fitness;
  const rolesInterested = parseEnumArray(raw.rolesInterested, ROLE_INTERESTS, {
    label: "rolesInterested",
    min: 1,
    max: 5,
  });
  if (!rolesInterested.ok) return rolesInterested;
  if (rolesInterested.value.includes("undecided") && rolesInterested.value.length > 1) {
    return fail("rolesInterested cannot combine undecided with other values");
  }
  // Extra day-to-day focus areas beyond the main one; optional for older clients.
  const focusExtra =
    raw.focusExtra === undefined
      ? { ok: true, value: [] }
      : parseEnumArray(raw.focusExtra, FOCUS_PREFERENCES, { label: "focusExtra", max: 3 });
  if (!focusExtra.ok) return focusExtra;
  const rolesAvoided = parseEnumArray(raw.rolesAvoided, ROLE_AVOIDANCES, {
    label: "rolesAvoided",
    max: 6,
  });
  if (!rolesAvoided.ok) return rolesAvoided;
  // exitsPreference is legacy (old clients); basePreference replaces it. Both default to no_preference.
  const exits =
    raw.exitsPreference === undefined
      ? ok("no_preference")
      : parseEnum(raw.exitsPreference, EXIT_PREFERENCES, { label: "exitsPreference" });
  if (!exits.ok) return exits;
  const basePreference =
    raw.basePreference === undefined
      ? ok("no_preference")
      : parseEnum(raw.basePreference, BASE_PREFERENCES, { label: "basePreference" });
  if (!basePreference.ok) return basePreference;
  const environment = parseEnum(raw.environment, ENVIRONMENTS, { label: "environment" });
  if (!environment.ok) return environment;
  const leadership = parseEnum(raw.leadership, LEADERSHIP_PREFERENCES, {
    label: "leadership",
  });
  if (!leadership.ok) return leadership;
  const stress = parseEnum(raw.stress, STRESS_PREFERENCES, { label: "stress" });
  if (!stress.ok) return stress;
  const motivationValues = parseEnumArray(raw.motivations, MOTIVATIONS, {
    label: "motivations",
    min: 1,
    max: 4,
  });
  if (!motivationValues.ok) return motivationValues;
  if (motivationValues.value.includes("unsure") && motivationValues.value.length > 1) {
    return fail("motivations cannot combine unsure with other values");
  }
  const extraNote =
    raw.extraNote === undefined
      ? ok("")
      : parseStrictString(raw.extraNote, {
          label: "extraNote",
          maxLen: 400,
          allowEmpty: true,
        });
  if (!extraNote.ok) return extraNote;

  const base = {
    serviceLifeCycle: service.value,
    preferredName: preferredName.value,
    gender: gender.value,
    daparScore: dapar.value,
    medicalProfile: medical.value,
    draftDate: draftDate.value,
    yomHameah: yom.value,
    yomHameahSource: yomSource.value,
    combatPreference: combatPreference.value,
    focus: focus.value,
    focusExtra: focusExtra.value.filter((value) => value !== focus.value),
    physicalActivityLevel: fitness.value,
    rolesInterested: rolesInterested.value,
    rolesAvoided: rolesAvoided.value,
    exitsPreference: exits.value,
    basePreference: basePreference.value,
    environment: environment.value,
    leadership: leadership.value,
    stress: stress.value,
    motivations: motivationValues.value,
    extraNote: extraNote.value,
  };
  const branches = deriveAssessmentBranches(base);
  const combatDetails = parseCombatDetails(raw.combatDetails, branches.wantsCombat);
  if (!combatDetails.ok) return combatDetails;
  const technicalDetails = parseTechnicalDetails(raw.technicalDetails, branches.wantsTechnical);
  if (!technicalDetails.ok) return technicalDetails;

  return ok({
    answers: {
      ...base,
      combatDetails: combatDetails.value,
      technicalDetails: technicalDetails.value,
    },
    branches,
  });
}

export function validateAssessmentCompletion(req) {
  const body = requirePlainObject(req.body, "body");
  if (!body.ok) return body;
  const unknown = rejectUnknownFields(
    body.value,
    ["schemaVersion", "clientDraftId", "answers"],
    "body",
  );
  if (!unknown.ok) return unknown;

  const version = parseAllowedScore(
    body.value.schemaVersion,
    ASSESSMENT_SCHEMA_VERSIONS,
    "schemaVersion",
  );
  if (!version.ok) return version;
  const clientDraftId = parseStrictString(body.value.clientDraftId, {
    label: "clientDraftId",
    minLen: 8,
    maxLen: 80,
  });
  if (!clientDraftId.ok) return clientDraftId;
  if (!/^[a-zA-Z0-9_-]+$/.test(clientDraftId.value)) {
    return fail("clientDraftId is invalid");
  }
  const parsed = parseAnswers(body.value.answers);
  if (!parsed.ok) return parsed;

  req.body = {
    schemaVersion: version.value,
    clientDraftId: clientDraftId.value,
    answers: parsed.value.answers,
    branches: parsed.value.branches,
  };
  return { ok: true };
}
