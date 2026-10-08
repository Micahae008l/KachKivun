import test, { mock } from "node:test";
import assert from "node:assert/strict";
import RefreshToken from "../models/RefreshToken.js";
import SecurityEvent from "../models/SecurityEvent.js";
import { handleRefreshTokenReuse } from "../controllers/authController.js";

const req = { method: "POST", originalUrl: "/api/auth/refresh", get: () => "", headers: {}, ip: "1.2.3.4" };

function stubToken(doc) {
  mock.method(SecurityEvent, "create", async () => ({}));
  mock.method(RefreshToken, "findOne", () => ({ select: async () => doc }));
  return mock.method(RefreshToken, "updateMany", async () => ({ modifiedCount: 2 }));
}

test("a rotated token reused after the grace window revokes every session", async (t) => {
  t.after(() => mock.restoreAll());
  const now = Date.now();
  const updateMany = stubToken({ userId: "507f1f77bcf86cd799439011", revokedAt: new Date(now - 60_000), replacedByTokenHash: "h2" });
  assert.equal(await handleRefreshTokenReuse("h1", req, now), true);
  assert.equal(updateMany.mock.callCount(), 1);
  assert.deepEqual(updateMany.mock.calls[0].arguments[0], { userId: "507f1f77bcf86cd799439011", revokedAt: null });
});

test("two tabs refreshing at once (inside the grace window) is not treated as theft", async (t) => {
  t.after(() => mock.restoreAll());
  const now = Date.now();
  const updateMany = stubToken({ userId: "507f1f77bcf86cd799439011", revokedAt: new Date(now - 5_000), replacedByTokenHash: "h2" });
  assert.equal(await handleRefreshTokenReuse("h1", req, now), false);
  assert.equal(updateMany.mock.callCount(), 0);
});

test("an unknown or logged-out token is not treated as theft", async (t) => {
  t.after(() => mock.restoreAll());
  const updateMany = stubToken(null);
  assert.equal(await handleRefreshTokenReuse("nope", req), false);
  stubToken({ userId: "507f1f77bcf86cd799439011", revokedAt: new Date(0), replacedByTokenHash: null });
  assert.equal(await handleRefreshTokenReuse("logged-out", req), false);
  assert.equal(updateMany.mock.callCount(), 0);
});
