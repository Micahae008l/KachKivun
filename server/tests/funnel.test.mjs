import test from "node:test";
import assert from "node:assert/strict";
import { FUNNEL_STEPS, israelDay, parseFunnelStep } from "../utils/funnel.js";

test("funnel accepts only known step names and nothing else", () => {
  assert.equal(parseFunnelStep({ step: "home" }), "home");
  assert.equal(parseFunnelStep({ step: "otp" }), "otp");
  assert.equal(parseFunnelStep({ step: "nope" }), null);
  assert.equal(parseFunnelStep({ step: "home", email: "a@b.c" }), null);
  assert.equal(parseFunnelStep({ step: ["home"] }), null);
  assert.equal(parseFunnelStep(null), null);
  assert.equal(FUNNEL_STEPS[0], "home");
});

test("days are counted in Israel time", () => {
  // 22:30 UTC on Oct 14 is already Oct 15 in Israel (UTC+3 in October).
  assert.equal(israelDay(new Date("2026-10-14T22:30:00Z")), "2026-10-15");
});
