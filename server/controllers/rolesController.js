import { sendServerError } from "../utils/httpError.js";
import {
  getRoleInsightBySlug,
  getRoleInsightByTitle,
  listRoleInsights,
} from "../utils/roleInsights.js";

// The catalog only changes on deploy; let Cloudflare and browsers reuse it for a few minutes.
const ROLE_CACHE = "public, max-age=300";

/** Public catalog for role-insights UI — no auth required. */
export function listRoles(req, res) {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const category = String(req.query.category || "").trim();
    const combat = req.query.combat;
    let roles = listRoleInsights();

    if (category) {
      roles = roles.filter((r) => r.category === category);
    }
    if (combat === "true" || combat === "1") {
      roles = roles.filter((r) => r.combat);
    } else if (combat === "false" || combat === "0") {
      roles = roles.filter((r) => !r.combat);
    }
    if (q) {
      roles = roles.filter((r) => {
        const hay = `${r.roleTitle} ${r.category} ${r.signals.join(" ")} ${r.tagsHe.join(" ")} ${r.about}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const categories = [...new Set(listRoleInsights().map((r) => r.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "he")
    );

    res.set("Cache-Control", ROLE_CACHE);
    res.json({
      count: roles.length,
      total: listRoleInsights().length,
      categories,
      roles: roles.map((r) => ({
        slug: r.slug,
        roleTitle: r.roleTitle,
        category: r.category,
        combat: r.combat,
        selective: r.selective,
        signals: r.signals.slice(0, 4),
        tagsHe: r.tagsHe.slice(0, 6),
        summary: r.about.split(/\n\n/)[0] || r.about.slice(0, 180),
      })),
    });
  } catch (err) {
    return sendServerError(res, err, "[roles/list]");
  }
}

export function getRole(req, res) {
  try {
    const key = String(req.params.slugOrTitle || "").trim();
    if (!key) return res.status(400).json({ error: "חסר מזהה תפקיד" });

    const decoded = decodeURIComponent(key);
    const role =
      getRoleInsightBySlug(decoded) ||
      getRoleInsightByTitle(decoded) ||
      getRoleInsightBySlug(key) ||
      getRoleInsightByTitle(key);

    if (!role) {
      return res.status(404).json({ error: "התפקיד לא נמצא בקטלוג", code: "ROLE_NOT_FOUND" });
    }

    res.set("Cache-Control", ROLE_CACHE);
    res.json({ role });
  } catch (err) {
    return sendServerError(res, err, "[roles/get]");
  }
}
