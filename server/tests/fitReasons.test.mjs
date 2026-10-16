import { test } from "node:test";
import assert from "node:assert/strict";
import { fitReasonsFor } from "../utils/fitReasons.js";

const golani = { roleTitle: "לוחם בגולני" };
const snapshot = (combatDetails) => ({
  physicalActivityLevel: "High",
  yomSource: "unknown",
  assessmentSignals: { rolesInterested: [], motivations: [], combatDetails },
});

test("a High activity preference with weak measured bands claims no fitness", () => {
  const weak = { run3kmBand: "over_15", pullUpsBand: "0_to_5", readiness: "needs_improvement" };
  assert.ok(!fitReasonsFor(golani, snapshot(weak)).includes("הכושר הגבוה שלכם"));
  assert.ok(!fitReasonsFor(golani, snapshot(null)).includes("הכושר הגבוה שלכם"));
});

test("strong measured bands claim fitness; a weak band alongside them does not", () => {
  const strong = { run3kmBand: "under_13", pullUpsBand: "16_plus" };
  assert.ok(fitReasonsFor(golani, snapshot(strong)).includes("הכושר הגבוה שלכם"));
  const mixed = { run3kmBand: "under_13", pullUpsBand: "0_to_5", readiness: "ready" };
  assert.deepEqual(fitReasonsFor(golani, snapshot(mixed)), ["המוכנות שלכם למסלול קרבי"]);
});
