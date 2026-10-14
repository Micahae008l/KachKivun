import { test } from "node:test";
import assert from "node:assert/strict";
import { isRetryableAiError } from "../controllers/aiController.js";

test("only transient AI errors are retried", () => {
  for (const status of [408, 409, 429, 500, 502, 503, 529]) assert.equal(isRetryableAiError({ status }), true, String(status));
  assert.equal(isRetryableAiError(new Error("fetch failed")), true, "network error, no status");
  for (const status of [400, 401, 403, 404]) assert.equal(isRetryableAiError({ status }), false, String(status));
});
