import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAiProfileMissing } from "../utils/profileAiReady.js";
import { YOM_HAMEAH_12_KEYS } from "../utils/yomHameah12Keys.js";

const neutralYom = Object.fromEntries(
  YOM_HAMEAH_12_KEYS.map((key) => [key, 3]),
);

const completePreferences = {
  combatPreference: "SupportHQ",
  focus: "Research",
  physicalActivityLevel: "Medium",
  yomHameahSource: "unknown",
};

const baseStats = {
  daparScore: null,
  medicalProfile: null,
  draftDate: new Date("2027-03-15T00:00:00.000Z"),
  yomHameah: neutralYom,
};

test("a completed assessment with explicit unknown markers is AI-ready", () => {
  const result = computeAiProfileMissing(baseStats, completePreferences, {
    answers: {
      daparScore: "unknown",
      medicalProfile: "unknown",
      yomHameahSource: "unknown",
    },
  });
  assert.deepEqual(result, { ready: true, missing: [] });
});

test("legacy missing values without explicit assessment markers remain incomplete", () => {
  const result = computeAiProfileMissing(baseStats, completePreferences, null);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, [
    "daparScore",
    "medicalProfile",
    "yomHameahSource",
  ]);
});

test("stored numeric records with a known מא״ה source remain compatible", () => {
  const result = computeAiProfileMissing(
    {
      ...baseStats,
      daparScore: 70,
      medicalProfile: 82,
    },
    {
      ...completePreferences,
      yomHameahSource: "official",
    },
  );
  assert.deepEqual(result, { ready: true, missing: [] });
});

test("an unknown source marker still requires neutral scores to be persisted", () => {
  const result = computeAiProfileMissing(
    { ...baseStats, yomHameah: null },
    completePreferences,
    {
      answers: {
        daparScore: "unknown",
        medicalProfile: "unknown",
        yomHameahSource: "unknown",
      },
    },
  );
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, ["yomHameah"]);
});
