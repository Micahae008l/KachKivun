import test from "node:test";
import assert from "node:assert/strict";
import { isRateLimitExempt } from "../middleware/rateLimit.js";

const req = (method, originalUrl) => ({ method, originalUrl, path: originalUrl.replace(/^\/api/, "") });

test("public role reads never count against the shared API rate limit", () => {
  assert.equal(isRateLimitExempt(req("GET", "/api/roles")), true);
  assert.equal(isRateLimitExempt(req("GET", "/api/roles?q=x")), true);
  assert.equal(isRateLimitExempt(req("GET", "/api/roles/%D7%A9")), true);
  assert.equal(isRateLimitExempt(req("GET", "/api/health")), true);
});

test("everything else stays limited", () => {
  assert.equal(isRateLimitExempt(req("POST", "/api/roles/x/reviews")), false);
  assert.equal(isRateLimitExempt(req("GET", "/api/rolesx")), false);
  assert.equal(isRateLimitExempt(req("GET", "/api/dashboard")), false);
  assert.equal(isRateLimitExempt(req("POST", "/api/auth/verify-otp")), false);
});
