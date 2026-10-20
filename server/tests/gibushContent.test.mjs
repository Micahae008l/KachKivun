import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

const { default: gibushRoutes } = await import("../routes/gibush.js");

let server;
let base;
before(async () => {
  const app = express();
  app.use("/api/gibush", gibushRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api/gibush/content`;
});
after(() => server.close());

test("gibush content: free for everyone, no login needed", async () => {
  const res = await fetch(base);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.day.stages.length > 10);
  assert.ok(body.ladders.male.length > 0);
  assert.ok(body.ladders.female.length > 0);
});

test("gibush content: every moment has options and a known rating", async () => {
  const body = await (await fetch(base)).json();
  // "prep" moments (time left, training habits) feed the ladder and the plan, not a card stat.
  const ratings = new Set([...body.day.ratings.map((r) => r.key), "prep"]);
  for (const s of body.day.stages) {
    assert.ok(s.options.length >= 2, s.id);
    assert.ok(ratings.has(s.rating), `${s.id} -> ${s.rating}`);
  }
});
