import crypto from "crypto";
import mongoose from "mongoose";
import AiUsageLog from "../models/AiUsageLog.js";
import { verifyEmailChannel } from "./email.js";

function trimEnv(name) {
  return String(process.env[name] || "").trim();
}

/** True when the request carries HEALTH_CHECK_TOKEN (compared in constant time). */
export function hasHealthToken(req) {
  const expected = trimEnv("HEALTH_CHECK_TOKEN");
  const given = String(req.get("x-health-token") || "");
  if (!expected || given.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function check(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    return { name, ...result, ms: Date.now() - started };
  } catch (err) {
    return { name, ok: false, detail: err?.message || String(err), ms: Date.now() - started };
  }
}

async function checkDatabase() {
  if (mongoose.connection.readyState !== 1) return { ok: false, detail: "not connected" };
  await mongoose.connection.db.admin().ping();

  return { ok: true, detail: "ping ok" };
}

/** Lists models: proves the key is valid without spending tokens. */
async function checkOpenAI() {
  const key = trimEnv("OPENAI_API_KEY");
  if (!key) return { ok: false, detail: "OPENAI_API_KEY not set" };
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(8000),
  });
  if (res.ok) return { ok: true, detail: "key accepted" };
  const body = await res.json().catch(() => ({}));

  return { ok: false, detail: `HTTP ${res.status} ${body?.error?.code || body?.error?.message || ""}`.trim() };
}

/**
 * A valid key can still fail (credit used up, rate limit): judge by the site's own
 * latest real OpenAI request in the last day, which the AI routes already log.
 */
async function checkOpenAIRecent() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last = await AiUsageLog.findOne({ status: { $in: ["success", "api_error"] }, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .select("status errorMessage endpoint createdAt")
    .lean();
  if (!last) return { ok: true, detail: "no AI requests in the last 24h" };
  const ago = `${Math.round((Date.now() - last.createdAt.getTime()) / 60000)} min ago`;

  return last.status === "success"
    ? { ok: true, detail: `last real request succeeded ${ago}` }
    : { ok: false, detail: `last real request FAILED ${ago} (${last.endpoint}): ${last.errorMessage || "unknown error"}` };
}

function checkPayments() {
  const provider = trimEnv("PAYMENTS_PROVIDER") || "mock";
  if (provider === "grow") {
    const missing = ["GROW_PAGE_CODE", "GROW_USER_ID", "GROW_API_KEY"].filter((k) => !trimEnv(k));
    return missing.length
      ? { ok: false, detail: `grow: missing ${missing.join(", ")}` }
      : { ok: true, detail: `grow (${trimEnv("GROW_ENV") || "test"})` };
  }

  return { ok: true, detail: `${provider} (no real charges)` };
}

/** Everything the site needs to serve a signed-in user: DB, AI, email, payments config. */
export async function runDeepHealth() {
  const checks = await Promise.all([
    check("database", checkDatabase),
    check("openai", checkOpenAI),
    check("openai-live", checkOpenAIRecent),
    check("email", verifyEmailChannel),
    check("payments", async () => checkPayments()),
  ]);

  return {
    status: checks.every((c) => c.ok) ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks,
  };
}
