import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET ||= "test-secret-gibush";
const { authenticateToken } = await import("../middleware/auth.js");
const { createGibushContentHandler } = await import("../controllers/gibushController.js");

const ACCESS = {
  locked: { paywallEnabled: true, topTwoUnlocked: false },
  paid: { paywallEnabled: true, topTwoUnlocked: true },
};

let server;
let base;
before(async () => {
  const app = express();
  // The user id picks the mocked access, standing in for the entitlement lookup.
  const handler = createGibushContentHandler({ getAccess: async (userId) => ACCESS[userId] });
  app.get("/api/gibush/content", authenticateToken, handler);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api/gibush/content`;
});
after(() => server.close());

const tokenFor = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: "HS256" });

test("gibush content: 401 when logged out", async () => {
  const res = await fetch(base);
  assert.equal(res.status, 401);
});

test("gibush content: 403 with a code when not unlocked, and no content", async () => {
  const res = await fetch(base, { headers: { Authorization: `Bearer ${tokenFor("locked")}` } });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.code, "GIBUSH_LOCKED");
  assert.equal(body.day, undefined);
});

test("gibush content: 200 with the content when unlocked", async () => {
  const res = await fetch(base, { headers: { Authorization: `Bearer ${tokenFor("paid")}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.day.stages.length > 10);
  assert.ok(body.ladders.female.length > 0);
});
