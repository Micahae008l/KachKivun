import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreRole,
  buildCandidatePool,
  blendPercent,
  toDisplayPercent,
  isFlatYom,
  computeProfileHash,
  rankRolesV3,
  structuredAssessmentFit,
  buildProfileNotice,
  sanitizeScoreBreakdown,
  SCORE_BREAKDOWN_KEYS,
} from "../utils/roleScoring.js";
import { normalizeRoleV3 } from "../utils/roleCatalogV3.js";
import { preFilterRoles } from "../utils/rolePreFilter.js";

const flatYom = Object.fromEntries(
  ["technicalActivation","spatialPerception","dataProcessing","teamwork","command","instruction","interpersonalCare","diligencePersistence","sustainedAttention","speedAndAccuracy","managementOrganization","disciplineMaturity"].map((k) => [k, 3])
);
const richYom = { ...flatYom, technicalActivation: 5, dataProcessing: 5, command: 1, instruction: 1 };

const techProfile = {
  daparScore: 80, medicalProfile: 82, combatPreference: "TechTrack",
  focus: "Tech", physicalActivityLevel: "Low", yom: richYom,
};

const techRole = normalizeRoleV3({
  roleTitle: "מפתח/ת תוכנה", category: "סייבר וטכנולוגיה", combat: false, selective: true,
  preferenceTags: ["coding", "software", "cyber"], validationLevel: "official_public_validated",
});
const combatRole = normalizeRoleV3({
  roleTitle: "לוחם/ת חי\"ר", category: "לחימה", combat: true, selective: false,
  preferenceTags: ["combat", "fieldwork"], validationLevel: "official_family_validated",
});

test("weights sum to 1.0 (basePercent stays in band on all-neutral)", () => {
  // A role scoring ~0.5 everywhere must land inside [42,94].
  const r = scoreRole(techRole, techProfile);
  assert.ok(r.basePercent >= 42 && r.basePercent <= 94, `basePercent ${r.basePercent} out of band`);
});

test("unknown role-specific floor does not fabricate a hard eligibility gate", () => {
  const at64 = scoreRole(combatRole, {
    ...techProfile,
    medicalProfile: 64,
    combatPreference: "FieldCombat",
  });
  assert.equal(at64.eligible, true);
  assert.equal(combatRole.medicalFloor, null);
});

test("reviewed combat medical floor is a hard deterministic gate", () => {
  const reviewedCombat = normalizeRoleV3({
    ...combatRole,
    medicalFloor: 82,
    enrichment: { status: "reviewed", confidence: "high" },
  });
  const at64 = scoreRole(reviewedCombat, {
    ...techProfile,
    medicalProfile: 64,
    combatPreference: "FieldCombat",
  });
  assert.equal(at64.eligible, false);
  assert.ok(at64.hardFailReasons.some((r) => r.includes("82") || r.includes("פרופיל")));
});

test("hard gate: combat role blocked when medical < 64", () => {
  const r = scoreRole(combatRole, { ...techProfile, medicalProfile: 45, combatPreference: "FieldCombat" });
  assert.equal(r.eligible, false);
  assert.ok(r.hardFailReasons.length > 0);
});

test("unknown DAPAR and medical values never become numeric-zero hard failures", () => {
  const reviewedCombat = normalizeRoleV3({
    ...combatRole,
    daparFloor: 70,
    medicalFloor: 82,
    enrichment: { status: "reviewed", confidence: "high" },
  });
  const result = scoreRole(reviewedCombat, {
    ...techProfile,
    daparScore: "unknown",
    medicalProfile: "unknown",
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(result.hardFailReasons, []);
  assert.equal(result.scoreBreakdown.eligibility, 50);
});

test("legacy prefilter also keeps roles open when threshold data is unknown", () => {
  const roles = [
    {
      roleTitle: "מסלול לחימה",
      combat: true,
      selective: false,
      preferenceTags: ["combat"],
    },
    {
      roleTitle: "מסלול טכנולוגי",
      combat: false,
      selective: true,
      preferenceTags: ["coding"],
    },
  ];
  const output = preFilterRoles(
    roles,
    { daparScore: "unknown", medicalProfile: "unknown" },
    {
      combatPreference: "Mixed",
      focus: "Tech",
      physicalActivityLevel: "Medium",
    },
    null,
  );
  assert.deepEqual(
    new Set(output.map((role) => role.roleTitle)),
    new Set(roles.map((role) => role.roleTitle)),
  );
});

test("combat role allowed at medical 82", () => {
  const r = scoreRole(combatRole, { ...techProfile, medicalProfile: 82, combatPreference: "FieldCombat" });
  assert.equal(r.eligible, true);
});

test("combat medic floor 64 remains open at profile 64", () => {
  const medic = normalizeRoleV3({
    roleTitle: "חובש/ת קרבי/ת",
    category: "לחימה",
    combat: true,
    medicalFloor: 64,
    preferenceTags: ["combat", "medicine"],
    enrichment: { status: "reviewed", confidence: "high" },
  });
  const r = scoreRole(medic, { ...techProfile, medicalProfile: 64, combatPreference: "FieldCombat" });
  assert.equal(r.eligible, true);
  assert.equal(medic.medicalFloor, 64);
});

test("self-estimated yom has less swing than official מא״ה", () => {
  // Force non-flat weights on both ends so we isolate SELF_YOM_SIGNAL dampening.
  const lowYom = { ...richYom, technicalActivation: 1, dataProcessing: 1, command: 5, instruction: 5 };
  const base = { ...techProfile, yomFlat: false };
  const highOfficial = scoreRole(techRole, { ...base, yom: richYom, yomSource: "official" }).base01;
  const lowOfficial = scoreRole(techRole, { ...base, yom: lowYom, yomSource: "official" }).base01;
  const highSelf = scoreRole(techRole, { ...base, yom: richYom, yomSource: "self" }).base01;
  const lowSelf = scoreRole(techRole, { ...base, yom: lowYom, yomSource: "self" }).base01;
  const officialSwing = highOfficial - lowOfficial;
  const selfSwing = highSelf - lowSelf;
  assert.ok(selfSwing < officialSwing, `expected self swing ${selfSwing} < official ${officialSwing}`);
});

test("unknown מא״ה placeholders are neutral and carry no personal signal", () => {
  const lowYom = {
    ...richYom,
    technicalActivation: 1,
    dataProcessing: 1,
    command: 5,
    instruction: 5,
  };
  const high = scoreRole(techRole, {
    ...techProfile,
    yom: richYom,
    yomSource: "unknown",
  });
  const low = scoreRole(techRole, {
    ...techProfile,
    yom: lowYom,
    yomSource: "unknown",
  });
  assert.equal(high.scoreBreakdown.yom, 50);
  assert.equal(low.scoreBreakdown.yom, 50);
  assert.equal(high.basePercent, low.basePercent);
});

test("reviewed dapar floor is a HARD gate; ai_draft floor is soft", () => {
  const reviewed = normalizeRoleV3({ ...techRole, daparFloor: 70, enrichment: { status: "reviewed", confidence: "high" } });
  const draft = normalizeRoleV3({ ...techRole, daparFloor: 70, enrichment: { status: "ai_draft", confidence: "medium" } });
  const lowDapar = { ...techProfile, daparScore: 50 };
  assert.equal(scoreRole(reviewed, lowDapar).eligible, false, "reviewed floor should hard-gate");
  const draftScore = scoreRole(draft, lowDapar);
  assert.equal(draftScore.eligible, true, "ai_draft floor must not hard-gate");
  // soft penalty ⇒ strictly lower base than no-floor role
  const noFloor = scoreRole(techRole, lowDapar);
  assert.ok(draftScore.base01 < noFloor.base01, "ai_draft floor breach should lower score");
});

test("better tech profile scores tech role higher than weak one", () => {
  const strong = scoreRole(techRole, techProfile).basePercent;
  const weak = scoreRole(techRole, { ...techProfile, daparScore: 20, focus: "Physical", yom: flatYom }).basePercent;
  assert.ok(strong > weak, `expected ${strong} > ${weak}`);
});

test("blendPercent clamps adjustment to ±8 and result to [40,96]", () => {
  assert.equal(blendPercent(90, 20), 96);
  assert.equal(blendPercent(90, 8), 96); // 98 clamped
  assert.equal(blendPercent(45, -20), 40); // 37 clamped
  assert.equal(blendPercent(70, 5), 75);
  assert.equal(blendPercent(70, 0), 70);
});

test("toDisplayPercent maps 0→42 and 1→94", () => {
  assert.equal(toDisplayPercent(0), 42);
  assert.equal(toDisplayPercent(1), 94);
});

test("isFlatYom detects uniform vs varied", () => {
  assert.equal(isFlatYom(flatYom), true);
  assert.equal(isFlatYom(richYom), false);
});

test("determinism: same profile → identical scores across runs", () => {
  const a = scoreRole(techRole, techProfile);
  const b = scoreRole(techRole, techProfile);
  assert.deepEqual(a, b);
});

test("buildCandidatePool is deterministic and respects category cap", () => {
  const roles = [];
  for (let i = 0; i < 12; i++) {
    roles.push(normalizeRoleV3({
      roleTitle: `role-${i}`, category: i < 8 ? "סייבר וטכנולוגיה" : `cat-${i}`,
      combat: false, selective: true, preferenceTags: ["coding", "software"],
      validationLevel: "official_public_validated",
    }));
  }
  const p1 = buildCandidatePool(roles, techProfile, { poolSize: 6, maxPerCategory: 2 });
  const p2 = buildCandidatePool(roles, techProfile, { poolSize: 6, maxPerCategory: 2 });
  assert.deepEqual(p1.map((r) => r.roleTitle), p2.map((r) => r.roleTitle), "pool must be identical across runs");
  const techCatCount = p1.filter((r) => r.category === "סייבר וטכנולוגיה").length;
  assert.ok(techCatCount <= 2, `category cap violated: ${techCatCount}`);
});

test("computeProfileHash is stable and sensitive to changes", () => {
  const h1 = computeProfileHash(techProfile, "v3", "p1");
  const h2 = computeProfileHash(techProfile, "v3", "p1");
  const h3 = computeProfileHash({ ...techProfile, daparScore: 70 }, "v3", "p1");
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test("profile hash distinguishes explicit unknown from legacy missing thresholds", () => {
  const missing = computeProfileHash(
    { ...techProfile, daparScore: null, medicalProfile: null },
    "v3",
    "p1",
  );
  const explicitUnknown = computeProfileHash(
    { ...techProfile, daparScore: "unknown", medicalProfile: "unknown" },
    "v3",
    "p1",
  );
  assert.notEqual(missing, explicitUnknown);
});

test("score breakdown sanitization persists only fixed rounded 0-100 factors", () => {
  const sanitized = sanitizeScoreBreakdown({
    preference: 91.6,
    focus: -9,
    yom: 50.4,
    eligibility: 120,
    catalogQuality: 77.7,
    structuredAssessment: 63.2,
    nestedPrompt: { secret: "do not persist" },
  });
  assert.deepEqual(Object.keys(sanitized), SCORE_BREAKDOWN_KEYS);
  assert.deepEqual(sanitized, {
    preference: 92,
    focus: 0,
    yom: 50,
    eligibility: 100,
    catalogQuality: 78,
    structuredAssessment: 63,
  });
});

test("unknown eligibility data produces a prominent verification caveat", () => {
  const notice = buildProfileNotice({
    daparScore: "unknown",
    medicalProfile: "unknown",
    yomSource: "unknown",
  });
  assert.match(notice, /לא ניתן לאמת זכאות מלאה/);
  assert.match(notice, /אינם נחשבים כאפס/);
});

test("structured assessment signals deterministically affect v3 ranking", () => {
  const programmingRole = normalizeRoleV3({
    roleTitle: "מסלול תכנות",
    category: "טכנולוגיה",
    combat: false,
    selective: false,
    preferenceTags: ["coding", "software"],
    validationLevel: "official_family_validated",
  });
  const logisticsRole = normalizeRoleV3({
    roleTitle: "מסלול לוגיסטיקה",
    category: "לוגיסטיקה",
    combat: false,
    selective: false,
    preferenceTags: ["logistics"],
    physicalDemand: 2,
    validationLevel: "official_family_validated",
  });
  const profile = {
    ...techProfile,
    focus: "Any",
    physicalActivityLevel: "Medium",
    yom: flatYom,
    assessmentSignals: {
      rolesInterested: ["technology_engineering"],
      rolesAvoided: [],
      exitsPreference: "no_preference",
      environment: "no_preference",
      leadership: "open",
      stress: "moderate",
      motivations: ["career"],
      technicalDetails: { level: "advanced", areas: ["programming"] },
    },
  };

  const first = rankRolesV3([logisticsRole, programmingRole], profile, { limit: 2 });
  const second = rankRolesV3([logisticsRole, programmingRole], profile, { limit: 2 });
  assert.deepEqual(
    first.map((role) => role.roleTitle),
    ["מסלול תכנות", "מסלול לוגיסטיקה"],
  );
  assert.deepEqual(
    first.map((role) => [role.roleTitle, role.basePercent]),
    second.map((role) => [role.roleTitle, role.basePercent]),
  );
});

test("profile hash is stable under structured assessment array ordering", () => {
  const assessmentA = {
    rolesInterested: ["cyber", "intelligence", "technology_engineering"],
    rolesAvoided: ["monotonous", "office_only"],
    motivations: ["career", "challenge", "personal_growth"],
    environment: "mixed",
    exitsPreference: "hamshushim",
    leadership: "want_lead",
    stress: "high",
    technicalDetails: {
      level: "advanced",
      areas: ["networks", "programming", "cybersecurity"],
    },
  };
  const assessmentB = {
    ...assessmentA,
    rolesInterested: [...assessmentA.rolesInterested].reverse(),
    rolesAvoided: [...assessmentA.rolesAvoided].reverse(),
    motivations: [...assessmentA.motivations].reverse(),
    technicalDetails: {
      ...assessmentA.technicalDetails,
      areas: [...assessmentA.technicalDetails.areas].reverse(),
    },
  };

  const h1 = computeProfileHash(
    { ...techProfile, assessmentSignals: assessmentA },
    "catalog-v3",
    "prompt-v3",
    "v3",
  );
  const h2 = computeProfileHash(
    { ...techProfile, assessmentSignals: assessmentB },
    "catalog-v3",
    "prompt-v3",
    "v3",
  );
  const h3 = computeProfileHash(
    {
      ...techProfile,
      assessmentSignals: { ...assessmentA, motivations: ["contribution"] },
    },
    "catalog-v3",
    "prompt-v3",
    "v3",
  );
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test("all known structured fields score while unknown environment and exits stay neutral", () => {
  const structuredRole = normalizeRoleV3({
    roleTitle: "מסלול משולב",
    category: "מבצעי",
    combat: true,
    preferenceTags: ["combat", "coding", "leadership"],
    environment: "field",
    exitPatterns: ["twelve_two"],
    leadershipDemand: 5,
    stressDemand: 5,
    motivationSignals: ["challenge"],
    technicalAreas: ["programming"],
    technicalLevelDemand: 4,
    combatFitnessDemand: 5,
    combatReadinessDemand: 4,
  });
  const matching = structuredAssessmentFit(structuredRole, {
    rolesInterested: ["combat", "technology_engineering"],
    rolesAvoided: ["office_only"],
    environment: "field",
    exitsPreference: "twelve_two",
    leadership: "want_lead",
    stress: "high",
    motivations: ["challenge"],
    technicalDetails: { level: "expert", areas: ["programming"] },
    combatDetails: {
      run3kmBand: "under_13",
      pullUpsBand: "16_plus",
      pushUpsBand: "61_plus",
      readiness: "ready",
    },
  });
  const opposing = structuredAssessmentFit(structuredRole, {
    rolesInterested: ["medical"],
    rolesAvoided: ["too_physical"],
    environment: "office",
    exitsPreference: "rare",
    leadership: "prefer_team",
    stress: "low",
    motivations: ["career"],
    technicalDetails: { level: "none", areas: ["data_ai"] },
    combatDetails: {
      run3kmBand: "over_15",
      pullUpsBand: "0_to_5",
      pushUpsBand: "0_to_30",
      readiness: "needs_improvement",
    },
  });
  assert.ok(matching.fit > opposing.fit, `${matching.fit} should exceed ${opposing.fit}`);

  const unknownRole = normalizeRoleV3({
    roleTitle: "מסלול ללא מידע תפעולי",
    category: "כללי",
    combat: false,
    preferenceTags: ["music"],
  });
  const unknown = structuredAssessmentFit(unknownRole, {
    environment: "field",
    exitsPreference: "hamshushim",
  });
  assert.equal(unknown.components.environment, null);
  assert.equal(unknown.components.exits, null);
});
