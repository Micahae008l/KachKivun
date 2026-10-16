import { YOM_HAMEAH_KEYS } from "../utils/yomHameahKeys.js";
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
  admissionChance,
} from "../utils/roleScoring.js";
import { normalizeRoleV3, getIdfRoleCatalogV3 } from "../utils/roleCatalogV3.js";
import { preFilterRoles } from "../utils/rolePreFilter.js";

const flatYom = Object.fromEntries(
  YOM_HAMEAH_KEYS.map((k) => [k, 3])
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
      basePreference: "no_preference",
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
    basePreference: "closed",
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

test("all known structured fields score while unknown environment and base type stay neutral", () => {
  const structuredRole = normalizeRoleV3({
    roleTitle: "מסלול משולב",
    category: "מבצעי",
    combat: true,
    preferenceTags: ["combat", "coding", "leadership"],
    environment: "field",
    closedBase: true,
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
    basePreference: "closed",
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
    basePreference: "open",
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
    basePreference: "closed",
  });
  assert.equal(unknown.components.environment, null);
  assert.equal(unknown.components.base, null);
});

test("clearing a medical floor is pass/fail: headroom above it earns nothing extra", () => {
  const at = (medicalFloor) =>
    scoreRole(normalizeRoleV3({ ...combatRole, medicalFloor, enrichment: { status: "reviewed" } }), {
      ...techProfile,
      medicalProfile: 97,
      combatPreference: "FieldCombat",
    }).scoreBreakdown.eligibility;
  assert.equal(at(64), at(82));
});

test("profile-97 field-combat male: the brigades outrank combat medic", () => {
  const roles = getIdfRoleCatalogV3().roles;
  const find = (title) => roles.find((r) => r.roleTitle === title);
  for (const daparScore of [60, 80]) {
    const profile = {
      daparScore, medicalProfile: 97, gender: "male", combatPreference: "FieldCombat",
      focus: "Physical", physicalActivityLevel: "High", yom: flatYom, yomSource: "official",
      assessmentSignals: { rolesInterested: ["combat"], environment: "field" },
    };
    const medic = scoreRole(find("חובש/ת קרבי/ת"), profile).basePercent;
    assert.ok(scoreRole(find("לוחם בגולני"), profile).basePercent > medic, `דפ"ר ${daparScore}`);
    assert.ok(scoreRole(find("לוחם בגבעתי"), profile).basePercent > medic, `דפ"ר ${daparScore}`);
  }
});

test("admission chance: elite never gains from a low floor, and 90 is never 'on the edge'", () => {
  const elite = { roleTitle: "מסלול תלפיות", category: "עילית", combat: false, competitiveness: "very_high", daparFloor: 90 };
  const atMax = admissionChance(elite, { gender: "female", medicalProfile: 97, daparScore: 90 });
  assert.equal(atMax.level, "low");
  assert.ok(!atMax.reason.includes("על הסף"));
  const plain = { ...elite, competitiveness: "medium" };
  assert.equal(admissionChance(plain, { gender: "female", medicalProfile: 97, daparScore: 90 }).level, "medium");
  // Elite combat selection is a גיבוש far above the floor: a big margin does not help.
  const sayeret = { ...elite, roleTitle: "לוחם שלדג", combat: true, daparFloor: 50 };
  const far = admissionChance(sayeret, { gender: "female", medicalProfile: 97, daparScore: 90 });
  assert.equal(far.level, "low");
  assert.ok(!far.reason.includes("גבוה ב"));
  // A cognitive non-combat track (גאמ"א floor 60): a high דפ"ר does lift the chance.
  const cognitive = admissionChance({ ...elite, daparFloor: 60 }, { gender: "female", medicalProfile: 97, daparScore: 90 });
  assert.equal(cognitive.level, "medium");
  assert.ok(cognitive.reason.includes("גבוה ב"));
});

test("admission chance: weak fitness is the first reason on elite combat", () => {
  const sayeret = { roleTitle: "לוחם סיירת מטכ״ל", category: "לחימה עילית", combat: true, competitiveness: "very_high", daparFloor: 50, combatFitnessDemand: 4 };
  const profile = {
    gender: "male", medicalProfile: 97, daparScore: 80,
    assessmentSignals: { combatDetails: { run3kmBand: "over_15", pullUpsBand: "6_to_15" } },
  };
  const chance = admissionChance(sayeret, profile);
  assert.equal(chance.level, "low");
  assert.ok(chance.reason.startsWith("הכושר הנוכחי שלכם רחוק מהנדרש במיון"));
  // Top bands are what an elite גיבוש looks for: the badge lifts to medium and says why.
  const fit = { ...profile, assessmentSignals: { combatDetails: { run3kmBand: "under_13", pullUpsBand: "16_plus" } } };
  const strong = admissionChance(sayeret, fit);
  assert.equal(strong.level, "medium");
  assert.ok(strong.reason.startsWith("הכושר שמדדתם ברמה הגבוהה שהמיון בודק"));
  // Pilots and paramedics are very competitive, but the screening is not a fitness גיבוש.
  const pilot = { ...sayeret, roleTitle: "טייס", combatFitnessDemand: 3 };
  assert.ok(!admissionChance(pilot, profile).reason.includes("כושר"));
});

test("admission chance: quota reason comes first, and the 80 + 10 sentence only for computer-cluster men", () => {
  const male = { gender: "male", medicalProfile: 97, daparScore: 75 };
  const female = { ...male, gender: "female" };
  const programmer = { roleTitle: "תוכניתן/ית", category: "מקצועות המחשב", combat: false, competitiveness: "very_high", daparFloor: 70 };
  const intel = { roleTitle: "מסלול נץ", category: "מודיעין / מבצעים", combat: false, competitiveness: "medium", daparFloor: null };
  const storekeeper = { roleTitle: "טכנאי/ת אלקטרוניקה", category: "טכנולוגיה ואחזקה", combat: false, competitiveness: "medium", daparFloor: null };

  const prog = admissionChance(programmer, male).reason;
  assert.ok(prog.startsWith("לבעלי פרופיל קרבי המכסות"), prog);
  assert.ok(prog.includes("10 יח״ל"));
  assert.ok(!admissionChance(programmer, female).reason.includes("יח״ל"));
  const nets = admissionChance(intel, male).reason;
  assert.ok(nets.includes("המכסות") && !nets.includes("יח״ל"), nets);
  assert.ok(!admissionChance(storekeeper, male).reason.includes("המכסות"));
});

test("profile notices carry no em dash", () => {
  for (const yomSource of ["self", "unknown", "official"]) {
    for (const gender of ["male", "female"]) {
      for (const medicalProfile of [45, 72, 97, "unknown"]) {
        assert.ok(!buildProfileNotice({ yomSource, gender, medicalProfile, daparScore: 70 }).includes(String.fromCharCode(0x2014)));
      }
    }
  }
});

test("owner-confirmed catalog facts gate exactly what was confirmed", () => {
  const roles = getIdfRoleCatalogV3().roles;
  const find = (title) => roles.find((r) => r.roleTitle === title);
  const boy = (medicalProfile) => ({ gender: "male", medicalProfile, daparScore: 60, yom: flatYom, yomSource: "official" });
  // דובר צה"ל: closed to a profile-97 boy; 72 and 82 are unconfirmed, so no gate.
  const photographer = find('צלם/ת ביחידת דובר צה"ל');
  assert.deepEqual(scoreRole(photographer, boy(97)).hardFailReasons, ["פתוח לגברים רק עד פרופיל 82, ובפרופיל 97 מיועדים ללוחמה"]);
  assert.ok(scoreRole(photographer, boy(82)).eligible);
  // No gender rule nobody confirmed; combat-collection keeps its field dimensions.
  assert.equal(find("מאמנת סימולטור").genderEligibility, "all");
  assert.ok(find("לוחם איסוף קרבי").keyDimensions.includes("frameworkBehavior"));
});

test("admission chance: rear roles are low for a combat-designated boy, and the quota never reads high", () => {
  const rear = { roleTitle: "מש\"ק/ית לוגיסטיקה", category: "לוגיסטיקה", combat: false, competitiveness: "low", daparFloor: 30, medicalFloor: 45 };
  const boy = { gender: "male", medicalProfile: 97, daparScore: 80 };
  const chance = admissionChance(rear, boy);
  assert.equal(chance.level, "low");
  assert.equal(chance.reason, "בנים עם פרופיל קרבי מיועדים ללוחמה, והסיכוי שלהם להשתבץ בתפקידי עורף נמוך");
  assert.equal(admissionChance(rear, { ...boy, gender: "female" }).level, "high");
  assert.equal(admissionChance(rear, { ...boy, medicalProfile: 64 }).level, "high");
  // An easy tech role with a big margin was "high" with "easy to get into" next to "quotas are cut".
  const easyTech = { roleTitle: "טכנאי/ת מחשבים", category: "תקשוב", combat: false, competitiveness: "low", daparFloor: 40, medicalFloor: 64 };
  const quota = admissionChance(easyTech, boy);
  assert.equal(quota.level, "medium");
  assert.ok(quota.reason.startsWith("לבעלי פרופיל קרבי המכסות") && !quota.reason.includes("שקל יחסית"), quota.reason);
  assert.equal(admissionChance(easyTech, { ...boy, gender: "female" }).level, "high");
});

test("admission chance: weak fitness also counts on combat roles with a גיבוש, not on screenings that are no fitness test", () => {
  const weak = { gender: "male", medicalProfile: 97, daparScore: 70, assessmentSignals: { combatDetails: { run3kmBand: "over_15", pullUpsBand: "0_to_5" } } };
  const paratroopers = { roleTitle: "לוחם בצנחנים", category: "לחימה", combat: true, competitiveness: "high", combatFitnessDemand: 4, requirements: ["גיבוש צנחנים (אפריל/אוגוסט/דצמבר) או שבוע ראיונות"] };
  assert.ok(admissionChance(paratroopers, weak).reason.startsWith("הכושר הנוכחי שלכם רחוק מהנדרש במיון"));
  assert.ok(!admissionChance({ ...paratroopers, requirements: [] }, weak).reason.includes("כושר"), "no גיבוש, no fitness penalty");
  const pilot = { roleTitle: "טייס", category: "אוויר", combat: true, competitiveness: "very_high", combatFitnessDemand: 3, requirements: ["גיבוש טיס 5 ימים"] };
  assert.ok(!admissionChance(pilot, weak).reason.includes("כושר"));
});

test("a combat interest under a non-combat direction lifts combat roles only", () => {
  const profile = { ...techProfile, medicalProfile: 97, gender: "male", yomSource: "official" };
  const ticked = { ...profile, assessmentSignals: { rolesInterested: ["cyber", "combat"] } };
  const unticked = { ...profile, assessmentSignals: { rolesInterested: ["cyber"] } };
  const combatCtx = (p) => scoreRole(combatRole, p).subscores.prefFit;
  assert.ok(combatCtx(ticked) > combatCtx(unticked));
  assert.equal(scoreRole(techRole, ticked).subscores.prefFit, scoreRole(techRole, unticked).subscores.prefFit);
  // FieldCombat already scores combat at full; the floor never lowers it.
  const field = { ...ticked, combatPreference: "FieldCombat" };
  assert.equal(combatCtx(field), scoreRole(combatRole, { ...field, assessmentSignals: {} }).subscores.prefFit);
});

test("round 3: badges for rear caps, unknown דפ\"ר and מיון לוחמות; cleared floors stay off the prompt", async () => {
  const { admissionChance, rolesForAi } = await import("../utils/roleScoring.js");
  // A role capped for men below this boy's profile is rear for him, by its own data.
  const dover = { roleTitle: "צלם/ת ביחידת דובר צה\"ל", category: "דוברות", combat: false, competitiveness: "medium", maleMedicalMax: 82 };
  assert.equal(admissionChance(dover, { gender: "male", medicalProfile: 97, daparScore: 70 }).level, "low");
  assert.notEqual(admissionChance(dover, { gender: "female", medicalProfile: 97, daparScore: 70 }).level, "low");
  // Unknown דפ"ר is not a pass: never "high" on a role with a known floor.
  const easy = { roleTitle: "מש\"ק", category: "מנהלה", combat: false, competitiveness: "low", daparFloor: 60 };
  const unknown = admissionChance(easy, { gender: "female", medicalProfile: 64, daparScore: "unknown" });
  assert.equal(unknown.level, "medium");
  assert.ok(unknown.reason.includes("לתפקיד נדרש דפ״ר 60"));
  // "נשים דרך מיון לוחמות" screens women on fitness, and says nothing about a boy.
  const ad = { roleTitle: "לוחם הגנה אווירית", category: "לחימה", combat: true, competitiveness: "medium", daparFloor: 30, combatFitnessDemand: 4, requirements: ["נשים דרך מיון לוחמות"] };
  const weak = { assessmentSignals: { combatDetails: { run3kmBand: "over_15", pullUpsBand: "0_to_5" } }, medicalProfile: 82, daparScore: 80 };
  assert.ok(admissionChance(ad, { ...weak, gender: "female" }).reason.includes("כושר"));
  assert.ok(!admissionChance(ad, { ...weak, gender: "male" }).reason.includes("כושר"));

  const roles = [
    { roleTitle: "לוחם יהל״ם", category: "לחימה", combat: true, requirements: ["פרופיל 82 ומעלה", "גיבוש 4-5 ימים", "נשים במסלול ייעודי"], avoidanceSignals: ["office_only"] },
  ];
  const [entry] = rolesForAi(roles, { gender: "male", medicalProfile: 97, daparScore: 80, assessmentSignals: { rolesAvoided: ["office_only"], environment: "office" } });
  assert.deepEqual(entry.promptRequirements, ["גיבוש 4-5 ימים"]);
  assert.deepEqual(entry.requirements, ["פרופיל 82 ומעלה", "גיבוש 4-5 ימים"]);
  assert.deepEqual(entry.clashes, [], "chose an office environment: the office is not a clash");
  const [atBar] = rolesForAi(roles, { gender: "male", medicalProfile: 82, daparScore: 80 });
  assert.ok(atBar.promptRequirements.includes("פרופיל 82 ומעלה"), "a floor the candidate sits right at stays");
});

test("round 3: MedicalInstruction ranks medicine and teaching above other desk roles", async () => {
  const { normalizeRoleV3 } = await import("../utils/roleCatalogV3.js");
  const profile = { combatPreference: "MedicalInstruction", focus: "Medical", physicalActivityLevel: "Medium", medicalProfile: 64, daparScore: 60, gender: "female" };
  const medic = scoreRole(normalizeRoleV3({ roleTitle: "מדריך/ת רפואה דחופה", combat: false, interestAreas: ["medical"], preferenceTags: ["medicine"] }), profile);
  const desk = scoreRole(normalizeRoleV3({ roleTitle: "מש\"ק/ית תובלה", combat: false, interestAreas: ["logistics"], preferenceTags: ["logistics"] }), profile);
  assert.ok(medic.basePercent > desk.basePercent, `${medic.basePercent} > ${desk.basePercent}`);
});

test("owner answers 2026-10-16: rear low, intelligence better, computer cluster strict, low-placement role low", async () => {
  const { admissionChance } = await import("../utils/roleScoring.js");
  const boy = { gender: "male", medicalProfile: 97, daparScore: 70 };
  const rear = { roleTitle: "ספק/ית", category: "לוגיסטיקה", combat: false, competitiveness: "medium" };
  assert.equal(admissionChance(rear, boy).level, "low");
  assert.ok(admissionChance(rear, boy).reason.includes("נמוך"));
  assert.notEqual(admissionChance(rear, { ...boy, gender: "female" }).level, "low");
  const intel = { roleTitle: "חוקר/ת מודיעין אוויר", category: "מודיעין / אוויר", combat: false, competitiveness: "high" };
  assert.equal(admissionChance(intel, boy).level, "medium");
  const medic = { roleTitle: "חובש/ת קדמי/ת", category: "רפואה", combat: false, competitiveness: "high", daparFloor: 50, requirements: ["סיכויי שיבוץ נמוכים"] };
  const m = admissionChance(medic, { gender: "female", medicalProfile: 97, daparScore: 90 });
  assert.equal(m.level, "low");
  assert.ok(m.reason.startsWith("סיכויי השיבוץ בתפקיד נמוכים"));
});
