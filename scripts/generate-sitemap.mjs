// Writes public/sitemap.xml at build time: the public pages plus one URL per role,
// read from the same catalog the API serves (server/utils/roleInsights.js).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listRoleInsights } from "../server/utils/roleInsights.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://kachkivun.com";
const STATIC = [
  ["/", "weekly", "1.0"],
  ["/role-insights", "weekly", "0.9"],
  ["/about", "monthly", "0.7"],
  ["/contact", "yearly", "0.4"],
  ["/privacy", "yearly", "0.3"],
  ["/terms", "yearly", "0.3"],
  ["/accessibility", "yearly", "0.3"],
  ["/cancellation", "yearly", "0.3"],
];

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const url = (loc, changefreq, priority) =>
  `  <url><loc>${escape(loc)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;

const roles = listRoleInsights();
const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...STATIC.map(([p, f, pr]) => url(`${SITE}${p}`, f, pr)),
  ...roles.map((r) => url(`${SITE}/roles/${encodeURIComponent(r.slug)}`, "monthly", "0.6")),
  "</urlset>",
  "",
];
fs.writeFileSync(path.join(root, "public", "sitemap.xml"), lines.join("\n"));
console.log(`sitemap.xml: ${STATIC.length} pages + ${roles.length} roles`);
