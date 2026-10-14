import test from "node:test";
import assert from "node:assert/strict";
import { parseConsentBody } from "../controllers/profileController.js";

test("marketing consent accepts only an explicit boolean and a known source", () => {
  assert.deepEqual(parseConsentBody({ granted: true, source: "signup" }), {
    granted: true,
    source: "signup",
  });
  assert.deepEqual(parseConsentBody({ granted: false, source: "dashboard" }), {
    granted: false,
    source: "dashboard",
  });
  // "Yes" must be a real true, never a truthy string or a missing field.
  assert.equal(parseConsentBody({ granted: "true", source: "signup" }), null);
  assert.equal(parseConsentBody({ source: "signup" }), null);
  assert.equal(parseConsentBody({ granted: true, source: "admin" }), null);
  assert.equal(parseConsentBody({ granted: true, source: "signup", at: "2020-01-01" }), null);
  assert.equal(parseConsentBody(null), null);
  assert.equal(parseConsentBody([true]), null);
});
