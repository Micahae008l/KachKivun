import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAssessmentCompletion } from "../validators/assessments.js";
import { YOM_HAMEAH_KEYS } from "../utils/yomHameahKeys.js";
import Assessment from "../models/Assessment.js";

function validBody(overrides = {}) {
  return {
    schemaVersion: 1,
    clientDraftId: "draft_12345678",
    answers: {
      serviceLifeCycle: "pre",
      preferredName: "נועה",
      gender: "female",
      daparScore: 70,
      medicalProfile: 82,
      draftDate: "2027-03-15",
      yomHameah: Object.fromEntries(YOM_HAMEAH_KEYS.map((key) => [key, 3])),
      yomHameahSource: "self",
      combatPreference: "SupportHQ",
      focus: "Research",
      physicalActivityLevel: "Medium",
      rolesInterested: ["medical"],
      rolesAvoided: [],
      basePreference: "no_preference",
      environment: "mixed",
      leadership: "open",
      stress: "moderate",
      motivations: ["contribution"],
      combatDetails: {
        run3kmBand: "",
        pullUpsBand: "",
        pushUpsBand: "",
        readiness: "",
      },
      technicalDetails: {
        level: "",
        areas: [],
      },
      extraNote: "",
      ...overrides,
    },
  };
}

test("server derives inactive adaptive branches and drops stale hidden answers", () => {
  const request = { body: validBody() };
  assert.deepEqual(validateAssessmentCompletion(request), { ok: true });
  assert.deepEqual(request.body.branches, {
    wantsCombat: false,
    wantsTechnical: false,
  });
  assert.equal(request.body.answers.combatDetails, null);
  assert.equal(request.body.answers.technicalDetails, null);
});

test("combat branch derived from interests requires all combat detail fields", () => {
  const request = {
    body: validBody({
      rolesInterested: ["combat"],
      combatDetails: {
        run3kmBand: "under_13",
        pullUpsBand: "16_plus",
        pushUpsBand: "",
        readiness: "ready",
      },
    }),
  };
  const result = validateAssessmentCompletion(request);
  assert.equal(result.ok, false);
  assert.match(result.error, /pushUpsBand/i);
});

test("technical branch derived from focus validates level and exclusive areas", () => {
  const missing = {
    body: validBody({
      focus: "Tech",
      technicalDetails: { level: "", areas: [] },
    }),
  };
  assert.equal(validateAssessmentCompletion(missing).ok, false);

  const conflicting = {
    body: validBody({
      focus: "Tech",
      technicalDetails: {
        level: "intermediate",
        areas: ["programming", "undecided"],
      },
    }),
  };
  const result = validateAssessmentCompletion(conflicting);
  assert.equal(result.ok, false);
  assert.match(result.error, /cannot combine undecided/i);
});

test("valid derived combat and technical branches are persisted server-side", () => {
  const request = {
    body: validBody({
      combatPreference: "Mixed",
      focus: "Tech",
      rolesInterested: ["combat", "cyber"],
      combatDetails: {
        run3kmBand: "unknown",
        pullUpsBand: "6_to_15",
        pushUpsBand: "31_to_60",
        readiness: "wants_to_improve",
      },
      technicalDetails: {
        level: "advanced",
        areas: ["programming", "data_ai"],
      },
    }),
  };
  assert.deepEqual(validateAssessmentCompletion(request), { ok: true });
  assert.deepEqual(request.body.branches, {
    wantsCombat: true,
    wantsTechnical: true,
  });
});

test("client cannot supply or override derived branch flags", () => {
  const request = {
    body: {
      ...validBody(),
      branches: { wantsCombat: false, wantsTechnical: false },
    },
  };
  const result = validateAssessmentCompletion(request);
  assert.equal(result.ok, false);
  assert.match(result.error, /Unknown body field: branches/);
});

test("explicit unknown thresholds and מא״ה source are valid and neutralized", () => {
  const request = {
    body: validBody({
      daparScore: "unknown",
      medicalProfile: "unknown",
      yomHameahSource: "unknown",
      yomHameah: { hostile: 5 },
    }),
  };
  request.body.schemaVersion = 2;

  assert.deepEqual(validateAssessmentCompletion(request), { ok: true });
  assert.equal(request.body.answers.daparScore, "unknown");
  assert.equal(request.body.answers.medicalProfile, "unknown");
  assert.equal(request.body.answers.yomHameahSource, "unknown");
  assert.deepEqual(
    Object.keys(request.body.answers.yomHameah).sort(),
    [...YOM_HAMEAH_KEYS].sort(),
  );
  assert.ok(
    YOM_HAMEAH_KEYS.every((key) => request.body.answers.yomHameah[key] === 3),
  );
});

test("Assessment schema stores explicit unknown markers without numeric casting", async () => {
  const request = {
    body: validBody({
      daparScore: "unknown",
      medicalProfile: "unknown",
      yomHameahSource: "unknown",
    }),
  };
  request.body.schemaVersion = 2;
  assert.deepEqual(validateAssessmentCompletion(request), { ok: true });

  const assessment = new Assessment({
    userId: "507f1f77bcf86cd799439011",
    ...request.body,
    completedAt: new Date(),
  });
  await assessment.validate();
  assert.equal(assessment.answers.daparScore, "unknown");
  assert.equal(assessment.answers.medicalProfile, "unknown");
});

test("empty unknown-capable fields remain unanswered and are rejected", () => {
  for (const overrides of [
    { daparScore: null },
    { medicalProfile: null },
    { yomHameahSource: "" },
  ]) {
    const request = { body: validBody(overrides) };
    assert.equal(validateAssessmentCompletion(request).ok, false);
  }
});

test("self or official מא״ה still requires eleven valid scores", () => {
  for (const source of ["self", "official"]) {
    const request = {
      body: validBody({
        yomHameahSource: source,
        yomHameah: Object.fromEntries(
          YOM_HAMEAH_KEYS.slice(1).map((key) => [key, 3]),
        ),
      }),
    };
    assert.equal(validateAssessmentCompletion(request).ok, false);
  }
});

test("focusExtra is optional, deduped against the main focus, and enum-checked", () => {
  const legacy = { body: validBody() };
  assert.deepEqual(validateAssessmentCompletion(legacy), { ok: true });
  assert.deepEqual(legacy.body.answers.focusExtra, []);

  const multi = { body: validBody({ focusExtra: ["Medical", "Research"] }) };
  assert.deepEqual(validateAssessmentCompletion(multi), { ok: true });
  assert.deepEqual(multi.body.answers.focusExtra, ["Medical"]);

  const bad = validateAssessmentCompletion({ body: validBody({ focusExtra: ["Cooking"] }) });
  assert.equal(bad.ok, false);
});
