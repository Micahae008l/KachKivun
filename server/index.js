import "./env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiRoutes from "./routes/ai.js";
import adminRoutes from "./routes/admin.js";
import rolesRoutes from "./routes/roles.js";
import assessmentsRoutes from "./routes/assessments.js";
import paymentRoutes from "./routes/payments.js";
import paymentWebhookRoutes from "./routes/paymentWebhooks.js";
import { isEmailConfigured, isResendConfigured } from "./utils/email.js";
import { hasHealthToken, runDeepHealth } from "./utils/deepHealth.js";
import { getDailyStats } from "./utils/dailyStats.js";
import { corsOptions } from "./utils/corsOptions.js";
import { SITE_NAME_EN, SITE_NAME_HE } from "./utils/brand.js";
import { apiLimiter, growWebhookLimiter } from "./middleware/rateLimit.js";
import { requireEnv, requireProductionEnv } from "./utils/requireEnv.js";
import { rejectOversizedUrl, jsonErrorHandler } from "./middleware/rejectMalformed.js";
import { ipBlockGuard, refreshBlockedIpCache } from "./middleware/ipBlock.js";
import { suspiciousPathGuard, apiNotFoundHandler } from "./middleware/securityGuards.js";
import { hostAllowlist } from "./middleware/hostAllowlist.js";

const app = express();
const JSON_BODY_LIMIT = "256kb";
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL?.trim() || "http://localhost:8080/";

// Middleware
app.set("trust proxy", 1);
app.use(
  helmet({
    // JSON API consumed cross-origin by the SPA — same-origin CORP would break fetch.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // HTML responses are rare (root hint page only); CSP belongs on the static host.
    contentSecurityPolicy: false,
  }),
);
app.use(hostAllowlist);
app.use(rejectOversizedUrl);
app.use(ipBlockGuard);
app.use(suspiciousPathGuard);
app.use(cors(corsOptions()));
app.use("/api/payments/webhooks/grow", growWebhookLimiter, paymentWebhookRoutes);
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use("/api", apiLimiter);

// Root — this process is the JSON API only; the UI is Vite (default :8080)
app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"/><title>${SITE_NAME_HE} API</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:40rem">
  <h1>${SITE_NAME_HE} (${SITE_NAME_EN}) API</h1>
  <p>This port serves <strong>REST only</strong> under <code>/api</code>.</p>
  <p>Open the app: <a href="${FRONTEND_URL}"><strong>${FRONTEND_URL}</strong></a></p>
  <p>Try <a href="/api/health"><code>GET /api/health</code></a></p>
</body></html>`);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/assessments", assessmentsRoutes);
app.use("/api/payments", paymentRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Deep check for the daily monitor (.github/workflows/daily-health.yml): needs the
// x-health-token header; without HEALTH_CHECK_TOKEN set it is a plain 404.
app.get("/api/health/deep", async (req, res, next) => {
  if (!hasHealthToken(req)) return next();
  const report = await runDeepHealth();
  res.status(report.status === "ok" ? 200 : 503).json(report);
});

// Business numbers for the morning Slack report: counts only, same token as above.
app.get("/api/stats/daily", async (req, res, next) => {
  if (!hasHealthToken(req)) return next();
  try {
    res.json(await getDailyStats());
  } catch (err) {
    next(err);
  }
});

// Unknown /api paths — logged as probes (scanners enumerate endpoints in bulk)
app.use("/api", apiNotFoundHandler);

app.use(jsonErrorHandler);

// Start server
async function start() {
  requireEnv(["JWT_SECRET"]);
  requireProductionEnv();
  await connectDB();
  await refreshBlockedIpCache();
  app.listen(PORT, () => {
    console.log(`API:  http://localhost:${PORT}  (GET / shows hints)`);
    console.log(`App:  http://localhost:8080/  (npm run dev in repo root)`);
    if (isEmailConfigured()) {
      console.log(
        `[email] ${isResendConfigured() ? "Resend" : "SMTP"} מוגדר — קודי OTP יישלחו באימייל.`,
      );
    } else {
      console.warn(
        "[email] אין ערוץ שליחה (RESEND_API_KEY או SMTP_HOST/SMTP_USER/SMTP_PASS ב־server/.env). קודי OTP לא יישלחו במייל; בפיתוח הקוד מודפס ללוג השרת בלבד.",
      );
    }
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
