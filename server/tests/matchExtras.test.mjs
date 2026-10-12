import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildQuestionnairePlan,
  buildWhatIf,
  fullExtras,
  redactExtras,
} from "../utils/matchExtras.js";

const role = (roleTitle, extra = {}) => ({
  roleTitle,
  category: "בדיקה",
  combat: false,
  preferenceTags: [],
  signals: [],
  keyDimensions: [],
  enrichment: { status: "reviewed" },
  ...extra,
});

const catalog = [
  role("פתוח לכולם"),
  role("דורש דפר 60", { daparFloor: 60 }),
  role("דורש דפר 70", { daparFloor: 70 }),
  role("דורש פרופיל 64", { medicalFloor: 64 }),
  role("סף לא מאומת", { daparFloor: 80, enrichment: { status: "ai_draft" } }),
  ...Array.from({ length: 8 }, (_, i) => role(`גיבוי ${i + 1}`)),
];

const profile = {
  daparScore: 50,
  medicalProfile: 45,
  gender: "female",
  combatPreference: "Jobnik",
  focus: "Tech",
  physicalActivityLevel: "Medium",
  yom: null,
  yomSource: "unknown",
};

test("what-if lists roles a verified floor blocks today, per step", () => {
  const scenarios = buildWhatIf(catalog, profile);
  const byKey = Object.fromEntries(scenarios.map((s) => [s.key, s]));

  assert.deepEqual(Object.keys(byKey), ["dapar+10", "dapar+20", "profile-64"]);
  assert.deepEqual(
    byKey["dapar+10"].opened.map((r) => r.roleTitle),
    ["דורש דפר 60"],
  );
  assert.deepEqual(byKey["dapar+20"].opened.map((r) => r.roleTitle).sort(), [
    "דורש דפר 60",
    "דורש דפר 70",
  ]);
  assert.deepEqual(
    byKey["profile-64"].opened.map((r) => r.roleTitle),
    ["דורש פרופיל 64"],
  );
  // An unverified floor never hard-blocks, so it is never reported as "opened".
  for (const s of scenarios) {
    assert.ok(!s.opened.some((r) => r.roleTitle === "סף לא מאומת"));
  }
});

test("what-if offers no step past the top of each scale or for unknown values", () => {
  assert.deepEqual(buildWhatIf(catalog, { ...profile, daparScore: 90, medicalProfile: 97 }), []);
  assert.deepEqual(
    buildWhatIf(catalog, { ...profile, daparScore: "unknown", medicalProfile: "unknown" }),
    [],
  );
});

test("plan rates the five matches 5/5/4/4/3 and adds distinct eligible backups at 3", () => {
  const matched = [3, 1, 2, 5, 4].map((rank) => ({
    rank,
    roleTitle: `גיבוי ${rank}`,
    admissionChance: rank === 1 ? { level: "low" } : null,
    serviceLengthLabel: rank === 2 ? "32 חודשים" : "",
  }));
  const plan = buildQuestionnairePlan(matched, catalog, profile);

  assert.deepEqual(
    plan.slice(0, 5).map((e) => [e.rank, e.rating, e.source]),
    [
      [1, 5, "match"],
      [2, 5, "match"],
      [3, 4, "match"],
      [4, 4, "match"],
      [5, 3, "match"],
    ],
  );
  const backups = plan.slice(5);
  assert.equal(backups.length, 5);
  assert.ok(backups.every((e) => e.rating === 3 && e.source === "backup"));
  assert.equal(new Set(plan.map((e) => e.roleTitle)).size, plan.length);
  // Backups must be roles the profile is eligible for.
  assert.ok(
    !backups.some((e) => ["דורש דפר 60", "דורש דפר 70", "דורש פרופיל 64"].includes(e.roleTitle)),
  );
  assert.ok(plan[0].notes.some((n) => n.includes("סיכוי הקבלה נמוך")));
  assert.ok(plan[1].notes.some((n) => n.includes("32 חודשים")));
});

test("free view keeps places 4-5 and backups, and withholds the names of places 1-3", () => {
  const matched = [1, 2, 3, 4, 5].map((rank) => ({ rank, roleTitle: `גיבוי ${rank}` }));
  const plan = buildQuestionnairePlan(matched, catalog, profile);
  const whatIf = buildWhatIf(catalog, profile);
  const free = redactExtras(plan, whatIf, 3);

  assert.deepEqual(
    free.plan.slice(0, 3).map((e) => [e.locked, e.rank, e.rating, e.roleTitle]),
    [
      [true, 1, 5, undefined],
      [true, 2, 5, undefined],
      [true, 3, 4, undefined],
    ],
  );
  assert.deepEqual(
    free.plan.slice(3, 5).map((e) => e.roleTitle),
    ["גיבוי 4", "גיבוי 5"],
  );
  assert.equal(free.plan.length, plan.length);
  const text = JSON.stringify(free);
  for (const hidden of ["גיבוי 1", "גיבוי 2", "גיבוי 3"]) {
    assert.ok(!text.includes(`"${hidden}"`), `${hidden} leaked`);
  }

  const twenty = free.whatIf.find((s) => s.key === "dapar+20");
  assert.equal(twenty.openedCount, 2);
  assert.ok(twenty.opened.length <= 2);
  assert.deepEqual(twenty.enteringTopFive, []);
  assert.equal(typeof twenty.enteringCount, "number");
});

test("paid view withholds nothing", () => {
  const matched = [1, 2, 3, 4, 5].map((rank) => ({ rank, roleTitle: `גיבוי ${rank}` }));
  const plan = buildQuestionnairePlan(matched, catalog, profile);
  const whatIf = buildWhatIf(catalog, profile);
  const paid = fullExtras(plan, whatIf);
  assert.deepEqual(paid.plan, plan);
  assert.equal(paid.whatIf[0].enteringCount, whatIf[0].enteringTopFive.length);
});
