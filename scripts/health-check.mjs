#!/usr/bin/env node
// Checks kachkivun.com and everything behind it, then reports to Slack.
// Run by .github/workflows/daily-health.yml.
//
//   MODE=report  full report, always posted (the morning run)
//   MODE=watch   posted only when something breaks or recovers (the hourly run)
//
// Env: SITE, API, HEALTH_CHECK_TOKEN, SLACK_WEBHOOK_URL, SLACK_USER_ID (who to ping;
// without it the message pings @here), STATE_FILE, RUN_URL. DRY_RUN=1 prints the
// Slack payload instead of posting it.

import fs from "node:fs";
import tls from "node:tls";

const SITE = process.env.SITE || "https://kachkivun.com";
const API = process.env.API || "https://api.kachkivun.com";
const MODE = process.env.MODE === "watch" ? "watch" : "report";
const STATE_FILE = process.env.STATE_FILE || ".health-state.json";
const RUN_URL = process.env.RUN_URL || "";
const TOKEN = (process.env.HEALTH_CHECK_TOKEN || "").trim();
const WEBHOOK = (process.env.SLACK_WEBHOOK_URL || "").trim();
const USER_ID = (process.env.SLACK_USER_ID || "").trim();

const GREEN = "#2EB67D";
const RED = "#E01E5A";

/** How each check reads in Slack, in display order. */
const LABELS = {
  site: "🌐 Website",
  api: "⚙️ API server",
  database: "🗄️ Database",
  "ai-key": "🔑 AI key",
  "ai-live": "🤖 AI requests",
  deep: "🩺 Deep check",
  email: "✉️ Login emails",
  payments: "💳 Payments",
  ssl: "🔒 SSL certificates",
};

async function timed(fn) {
  const started = Date.now();
  try {
    return { ...(await fn()), ms: Date.now() - started };
  } catch (err) {
    return { ok: false, detail: err?.cause?.code || err?.message || String(err), ms: Date.now() - started };
  }
}

async function httpCheck(url, tries = 1) {
  let last;
  for (let i = 0; i < tries; i++) {
    last = await timed(async () => {
      const res = await fetch(url, {
        headers: { "user-agent": "KachKivunHealthCheck/1.0 (+github-actions)" },
        signal: AbortSignal.timeout(30_000),
        redirect: "follow",
      });
      if (res.ok) return { ok: true, detail: "up" };
      // Cloudflare bot protection challenges datacenter IPs such as GitHub's runners. That is
      // Cloudflare answering, not the site failing; say so instead of crying "down".
      if (res.status === 403 && res.headers.get("cf-mitigated") === "challenge") {
        return { ok: true, detail: "up (Cloudflare challenged the checker; allow it in Cloudflare to test the page itself)" };
      }
      return { ok: false, detail: `HTTP ${res.status}` };
    });
    if (last.ok) break;
    if (i + 1 < tries) await new Promise((r) => setTimeout(r, 20_000));
  }

  return { ...last, detail: last.ok ? `up · ${last.ms} ms` : last.detail };
}

function certDaysLeft(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 15_000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000));
    });
    socket.on("error", reject);
    socket.on("timeout", () => socket.destroy(new Error(`timeout reading ${host} certificate`)));
  });
}

async function sslCheck() {
  return timed(async () => {
    const hosts = [new URL(SITE).hostname, new URL(API).hostname];
    const days = await Promise.all(hosts.map(certDaysLeft));
    const min = Math.min(...days);
    return { ok: min > 14, detail: min > 14 ? `valid · renews in ${min}+ days` : `expires in ${min} days` };
  });
}

async function deepChecks() {
  if (!TOKEN) return [{ name: "deep", ok: false, detail: "HEALTH_CHECK_TOKEN not set, deep checks skipped" }];
  const res = await timed(async () => {
    const r = await fetch(`${API}/api/health/deep`, {
      headers: { "x-health-token": TOKEN },
      signal: AbortSignal.timeout(60_000),
    });
    const body = await r.json().catch(() => null);
    if (!body?.checks) return { ok: false, detail: `no report (HTTP ${r.status}): is HEALTH_CHECK_TOKEN set in server/.env on the API server, matching the GitHub secret?` };
    return { ok: true, checks: body.checks };
  });

  return res.checks ?? [{ name: "deep", ok: false, detail: res.detail }];
}

async function runChecks() {
  const [site, api, deep, ssl] = await Promise.all([httpCheck(SITE), httpCheck(`${API}/api/health`, 2), deepChecks(), sslCheck()]);
  const all = [{ name: "site", ...site }, { name: "api", ...api }, ...deep, { name: "ssl", ...ssl }];
  const order = Object.keys(LABELS);

  return all.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
}

async function dailyStats() {
  if (!TOKEN) return { error: "HEALTH_CHECK_TOKEN not set" };
  try {
    const r = await fetch(`${API}/api/stats/daily`, { headers: { "x-health-token": TOKEN }, signal: AbortSignal.timeout(30_000) });
    return r.ok ? await r.json() : { error: `HTTP ${r.status}` };
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { failing: [], since: null };
  }
}

const label = (name) => LABELS[name] || name;
const israelTime = (d = new Date()) =>
  d.toLocaleString("en-GB", { timeZone: "Asia/Jerusalem", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function buttons() {
  const button = (text, url, style) => ({ type: "button", text: { type: "plain_text", text, emoji: true }, url, ...(style ? { style } : {}) });
  return {
    type: "actions",
    elements: [
      button("Open site", SITE),
      button("AWS", "https://console.aws.amazon.com/ec2/home"),
      button("Claude usage", "https://platform.claude.com/usage"),
      ...(RUN_URL ? [button("Run log", RUN_URL)] : []),
    ],
  };
}

const SPARKS = "▁▂▃▄▅▆▇█";
const sparkline = (values) => {
  const max = Math.max(...values, 1);
  return values.map((v) => SPARKS[Math.round((v / max) * 7)]).join("");
};
const num = (n) => Number(n || 0).toLocaleString("en-US");

/** The morning card's "last 24 hours" section, from /api/stats/daily. */
function statsBlocks(stats) {
  if (!stats) return [];
  if (stats.error) return [{ type: "context", elements: [{ type: "mrkdwn", text: `📈 Stats unavailable: ${stats.error}` }] }];
  const { users, activity, ai } = stats;
  const statuses = Object.entries(users.newByStatus || {}).map(([k, n]) => `${k} ${n}`).join(" · ");
  const stat = (title, value, sub) => ({ type: "mrkdwn", text: `*${title}*\n${value}${sub ? `  _${sub}_` : ""}` });

  return [
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: "*📈  Last 24 hours*" } },
    {
      type: "section",
      fields: [
        stat("👋 New users", `*+${num(users.new24h)}*`, `${num(users.total)} total`),
        stat("🔥 Active users", `*${num(users.active24h)}*`, "signed in"),
        stat("🎯 AI matches", `*${num(activity.matches24h)}*`),
        stat("📄 Reports", `*${num(activity.reports24h)}*`),
        stat("⭐ Reviews", `*${num(activity.reviews24h)}* new`, activity.pendingReviews ? `${activity.pendingReviews} waiting for approval` : ""),
        stat("💸 AI cost", `*$${Number(ai.costUsd24h).toFixed(2)}*`, `${num(ai.calls24h)} calls`),
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Signups, last 7 days: \`${sparkline(users.signupsPerDay)}\` ${num(users.new7d)} total · Matches: \`${sparkline(activity.matchesPerDay)}\`${statuses ? ` · New today: ${statuses}` : ""}`,
        },
      ],
    },
  ];
}

function field(check) {
  return { type: "mrkdwn", text: `*${check.ok ? "✅" : "❌"}  ${label(check.name)}*\n${check.detail}` };
}

/** Slack allows 10 fields per section. */
function fieldSections(checks) {
  const sections = [];
  for (let i = 0; i < checks.length; i += 10) sections.push({ type: "section", fields: checks.slice(i, i + 10).map(field) });

  return sections;
}

function message(kind, checks, prev, stats) {
  const ping = USER_ID ? `<@${USER_ID}>` : "<!here>";
  const failing = checks.filter((c) => !c.ok);
  const when = israelTime();

  if (kind === "report") {
    const good = failing.length === 0;
    const title = good ? "☀️  Good morning: KachKivun is healthy" : `🚨  KachKivun needs attention: ${failing.length} problem${failing.length > 1 ? "s" : ""}`;
    return {
      text: `${ping} ${good ? `All ${checks.length} checks passed ☀️` : `${failing.map((c) => label(c.name)).join(", ")} failing 🚨`}${
        stats?.users ? ` · 👋 +${num(stats.users.new24h)} new users · 🎯 ${num(stats.activity.matches24h)} matches` : ""
      }`,
      attachments: [
        {
          color: good ? GREEN : RED,
          blocks: [
            { type: "header", text: { type: "plain_text", text: title, emoji: true } },
            { type: "context", elements: [{ type: "mrkdwn", text: `Morning report · ${when} Israel · ${checks.length - failing.length}/${checks.length} checks passing` }] },
            ...statsBlocks(stats),
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: "*🩺  Health*" } },
            ...fieldSections([...failing, ...checks.filter((c) => c.ok)]),
            buttons(),
          ],
        },
      ],
    };
  }

  if (kind === "down") {
    const since = prev.since ? israelTime(new Date(prev.since)) : when;
    return {
      text: `${ping} 🚨 KachKivun: ${failing.map((c) => label(c.name)).join(", ")} just broke`,
      attachments: [
        {
          color: RED,
          blocks: [
            { type: "header", text: { type: "plain_text", text: `🚨  Something just broke on KachKivun`, emoji: true } },
            ...failing.map((c) => ({ type: "section", text: { type: "mrkdwn", text: `*❌  ${label(c.name)}*\n\`\`\`${c.detail}\`\`\`` } })),
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: `Detected ${since} Israel · ${checks.length - failing.length} other checks OK · I'll post again when it recovers` }],
            },
            buttons(),
          ],
        },
      ],
    };
  }

  const downFor = prev.since ? Math.round((Date.now() - new Date(prev.since).getTime()) / 60_000) : null;
  return {
    text: `${ping} ✅ KachKivun recovered: everything is working again`,
    attachments: [
      {
        color: GREEN,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "✅  KachKivun recovered", emoji: true } },
          {
            type: "section",
            text: { type: "mrkdwn", text: `All ${checks.length} checks pass again.\nWas failing: *${prev.failing.map(label).join(", ")}*` },
          },
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: `Back at ${when} Israel${downFor !== null ? ` · down for about ${downFor < 90 ? `${downFor} min` : `${Math.round(downFor / 60)} h`}` : ""}` }],
          },
          buttons(),
        ],
      },
    ],
  };
}

async function main() {
  const checks = await runChecks();
  const failing = checks.filter((c) => !c.ok).map((c) => c.name).sort();
  const prev = readState();
  const changed = failing.join(",") !== (prev.failing || []).join(",");

  for (const c of checks) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`);

  let kind = null;
  if (MODE === "report") kind = "report";
  else if (failing.length && changed) kind = "down";
  else if (!failing.length && prev.failing?.length) kind = "recovered";

  const since = failing.length ? (prev.failing?.length && prev.since ? prev.since : new Date().toISOString()) : null;
  fs.writeFileSync(STATE_FILE, JSON.stringify({ failing, since }));

  if (!kind) return console.log("No change since the last run; nothing posted.");
  const stats = kind === "report" ? await dailyStats() : null;
  const payload = message(kind, checks, { ...prev, since: prev.since || since }, stats);
  if (process.env.DRY_RUN === "1" || !WEBHOOK) return console.log(JSON.stringify(payload, null, 2));

  const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  console.log(`Slack: ${res.status} ${await res.text()}`);
  if (!res.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
