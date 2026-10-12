import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { deleteUserData } from "../utils/deleteAccount.js";

const fake = (log, name, deletedCount = 1) => ({
  deleteMany: async (filter) => (log.push([name, "many", filter]), { deletedCount }),
  deleteOne: async (filter) => (log.push([name, "one", filter]), { deletedCount }),
});

test("deletes every personal collection by user id, then the user last", async () => {
  const log = [];
  const collections = {
    Assessment: fake(log, "Assessment", 2),
    Preferences: fake(log, "Preferences"),
  };
  const deleted = await deleteUserData("u1", "a@b.co", {
    collections,
    OtpModel: fake(log, "EmailOtp"),
    UserModel: fake(log, "User"),
  });

  assert.deepEqual(deleted, { Assessment: 2, Preferences: 1, EmailOtp: 1, User: 1 });
  assert.deepEqual(log.at(-1), ["User", "one", { _id: "u1" }]);
  assert.deepEqual(log.find(([name]) => name === "EmailOtp")[2], { email: "a@b.co" });
  assert.ok(
    log
      .filter(([, kind]) => kind === "many" && log)
      .every(([, , f]) => f.userId === "u1" || f.email),
  );
});

test("every model that stores a userId is either deleted or deliberately kept", () => {
  const source = fs.readFileSync(new URL("../utils/deleteAccount.js", import.meta.url), "utf8");
  // Kept on purpose: the privacy policy allows transaction and security records to remain.
  const kept = new Set(["PaymentOrder", "SecurityEvent", "User"]);
  const dir = new URL("../models/", import.meta.url);
  for (const file of fs.readdirSync(dir)) {
    const name = file.replace(/\.js$/, "");
    const model = fs.readFileSync(new URL(file, dir), "utf8");
    if (!/\buserId\b/.test(model) || kept.has(name)) continue;
    assert.ok(
      source.includes(`../models/${name}.js`),
      `${name} holds user data but is not deleted`,
    );
  }
});
