import { SITE_NAME_HE } from "./brand.js";

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listItems(items) {
  if (!items?.length) return "";
  return `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

/** Standalone HTML report (Hebrew RTL) — used for HTML fallback and mirrors client print layout. */
export function buildReportHtml(report, userName) {
  const date = new Date().toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const rolesHtml = (report.roles || [])
    .map((r, i) => {
      const meta = [r.serviceLength ? `יציאות: ${esc(r.serviceLength)}` : "", r.location ? esc(r.location) : ""]
        .filter(Boolean)
        .join(" · ");
      return `
      <article class="role-card">
        <header class="role-head">
          <span class="role-rank">${String(i + 1).padStart(2, "0")}</span>
          <h3>${esc(r.roleTitle)}</h3>
          <span class="role-pct">${r.matchPercentage ?? 0}%</span>
        </header>
        ${meta ? `<p class="role-meta">${meta}</p>` : ""}
        ${r.summary ? `<p class="role-summary">${esc(r.summary)}</p>` : ""}
        ${r.description ? `<p class="role-desc">${esc(r.description)}</p>` : ""}
        ${r.fitReason ? `<p class="role-fit">✓ ${esc(r.fitReason)}</p>` : ""}
        ${r.riskNote ? `<p class="role-risk">⚠ ${esc(r.riskNote)}</p>` : ""}
      </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${esc(SITE_NAME_HE)} | דוח</title>
  <style>
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; margin: 24px; color: #1a1a1a; line-height: 1.5; }
    h1 { color: #6b7c52; font-size: 24px; }
    h2 { color: #6b7c52; font-size: 13px; margin-top: 20px; }
    .direction { background: #f4f6ef; border: 1px solid #b8c4a4; padding: 12px; border-radius: 6px; }
    .role-card { border: 1px solid #d8ddd0; padding: 10px; margin: 8px 0; border-radius: 6px; }
    .role-pct { float: left; background: #e2e8d4; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
    ul { padding-right: 20px; }
    .footer { margin-top: 24px; font-size: 11px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <h1>${esc(SITE_NAME_HE)}</h1>
  <p>דוח כיוון אישי · ${esc(userName)} · ${esc(date)}</p>
  <div class="direction">
    <strong>הכיוון: ${esc(report.direction)}</strong>
    <p>${esc(report.directionExplanation)}</p>
  </div>
  <h2>חוזקות</h2>${listItems(report.strengths)}
  <h2>לשיפור</h2>${listItems(report.weaknesses)}
  <h2>טיפים</h2>${listItems(report.improvementTips)}
  <h2>ראיונות</h2>${listItems(report.interviewTips)}
  ${report.rolesTheyAskedAbout ? `<h2>תפקידים שציינתם</h2><p>${esc(report.rolesTheyAskedAbout)}</p>` : ""}
  ${report.fearResponse ? `<h2>חששות</h2><p>${esc(report.fearResponse)}</p>` : ""}
  <h2>10 תפקידים</h2>${rolesHtml}
  ${report.parentSummary ? `<h2>להורים</h2><p>${esc(report.parentSummary)}</p>` : ""}
  <p class="footer">אינו המלצה רשמית של צה״ל.</p>
</body>
</html>`;
}
