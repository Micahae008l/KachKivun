import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("full-report and report-history APIs are not mounted and have no client callers", () => {
  const index = read("server/index.js");
  const aiRoutes = read("server/routes/ai.js");
  const clientApi = read("src/lib/api.ts");

  assert.equal(index.includes('from "./routes/reports'), false);
  assert.equal(index.includes("/api/reports"), false);
  assert.match(index, /app\.use\("\/api\/ai", aiRoutes\)/);
  assert.match(aiRoutes, /match-roles/);
  assert.equal(aiRoutes.includes("full-report"), false);
  assert.equal(aiRoutes.includes("report-pdf"), false);
  assert.equal(clientApi.includes("/api/ai/full-report"), false);
  assert.equal(clientApi.includes("/api/ai/report-pdf"), false);
  assert.equal(clientApi.includes("/api/reports"), false);
  assert.equal(clientApi.includes("generateFullReport"), false);
});

test("legacy /report URLs redirect to the AI counselor", () => {
  const report = read("src/routes/report.tsx");
  const reportId = read("src/routes/report.$reportId.tsx");
  assert.match(report, /redirect\(\{ to: "\/ai-counselor", replace: true \}\)/);
  assert.match(reportId, /redirect\(\{ to: "\/ai-counselor", replace: true \}\)/);
});

test("adaptive assessment keeps OTP last and versioned draft migration", () => {
  const flow = read("src/features/assessment/flow.ts");
  const draft = read("src/features/assessment/draft.ts");
  const postSignup = read("src/routes/post-signup.tsx");

  assert.match(flow, /steps\.push\("scores", "yom", "checkpoint", "motivation", "identity", "review"\)/);
  assert.match(flow, /if \(includeAuth\) steps\.push\("otp"\)/);
  assert.match(draft, /ASSESSMENT_DRAFT_VERSION = 3/);
  assert.match(draft, /LEGACY_SIGNUP_DRAFT_KEY = "kk_signup_draft_v1"/);
  assert.match(draft, /preferredName: source\.username/);
  assert.match(draft, /answers\.yomHameahSource = ""/);
  assert.match(postSignup, /PostSignupAssessmentPage/);
  assert.match(postSignup, /personalizedFunnelV2 \? "adaptive" : "legacy"/);
});

test("production rollout keeps charging off until explicit launch gates", () => {
  const render = read("render.yaml");
  const envExample = read("server/.env.example");
  assert.match(render, /key: PAYWALL_ENABLED[\s\S]*value: "false"/);
  assert.match(render, /key: GROW_CALLBACK_AUTH_CONFIRMED[\s\S]*value: "false"/);
  assert.match(render, /key: GROW_DOMAIN_REVIEW_APPROVED[\s\S]*value: "false"/);
  assert.match(render, /key: ISRAELI_LEGAL_REVIEW_CONFIRMED[\s\S]*value: "false"/);
  assert.match(envExample, /PAYWALL_ENABLED=false/);
  assert.match(envExample, /PERSONALIZED_FUNNEL_V2=true/);
});
