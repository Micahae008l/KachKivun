import { test } from "node:test";
import assert from "node:assert/strict";
import { RETURN_SESSION_TTL_MS, returnSessionDenial } from "../services/payments/paymentService.js";
import { refreshCookieOptions } from "../utils/refreshTokens.js";

const now = new Date("2026-10-11T12:00:00.000Z");
const startedMinutesAgo = (minutes) => new Date(now.getTime() - minutes * 60_000);

test("the buyer's own recent checkout may restore the login once", () => {
  assert.equal(returnSessionDenial({ checkoutStartedAt: startedMinutesAgo(10) }, now), null);
});

test("a parent's shared checkout never restores the child's login", () => {
  const order = { shareTokenHash: "a".repeat(64), checkoutStartedAt: startedMinutesAgo(1) };
  assert.equal(returnSessionDenial(order, now), "shared_checkout");
});

test("the return token restores a login only once and only for a few hours", () => {
  assert.equal(
    returnSessionDenial(
      { checkoutStartedAt: startedMinutesAgo(5), returnSessionIssuedAt: now },
      now,
    ),
    "already_used",
  );
  const late = new Date(now.getTime() - RETURN_SESSION_TTL_MS - 1);
  assert.equal(returnSessionDenial({ checkoutStartedAt: late }, now), "expired");
  assert.equal(returnSessionDenial({ checkoutStartedAt: null }, now), "expired");
  assert.equal(returnSessionDenial(null, now), "not_found");
});

test("the refresh cookie is Lax, httpOnly and scoped to /api/auth", () => {
  const options = refreshCookieOptions();
  assert.equal(options.sameSite, "lax");
  assert.equal(options.httpOnly, true);
  assert.equal(options.path, "/api/auth");
});
