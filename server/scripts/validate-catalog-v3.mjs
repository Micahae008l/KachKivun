/**
 * Validate server/data/role-enrichment-v3.json against the base catalog.
 * Read-only, no cost.  node scripts/validate-catalog-v3.mjs
 * Exits non-zero on any error (use as a pre-merge gate). The #1 failure mode is
 * an override roleTitle that doesn't EXACTLY match a base-catalog title — it
 * would silently apply to nothing.
 */
import "../env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getIdfRoleCatalogParsed } from "../utils/idfRoleCatalog.js";
import { YOM_HAMEAH_KEYS } from "../utils/yomHameahKeys.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YOM = new Set(YOM_HAMEAH_KEYS);
const VALID_DAPAR = new Set([10, 20, 30, 40, 50, 60, 70, 80, 90, null]);
const VALID_MEDICAL = new Set([21, 45, 64, 72, 82, 97, null]);
const VALID_STATUS = new Set(["none", "ai_draft", "reviewed", "verified"]);

const baseTitles = new Set((getIdfRoleCatalogParsed()?.roles || []).map((r) => r.roleTitle));
const overrides = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/role-enrichment-v3.json"), "utf8")
).overrides;

const errors = [];
const warnings = [];
let count = 0;

for (const [title, o] of Object.entries(overrides)) {
  count++;
  if (!baseTitles.has(title)) errors.push(`roleTitle not in base catalog (will apply to nothing): "${title}"`);
  if (!VALID_DAPAR.has(o.daparFloor)) errors.push(`${title}: invalid daparFloor ${o.daparFloor}`);
  if (!VALID_MEDICAL.has(o.medicalFloor)) errors.push(`${title}: invalid medicalFloor ${o.medicalFloor}`);
  for (const d of o.keyDimensions || []) if (!YOM.has(d)) errors.push(`${title}: unknown keyDimension "${d}"`);
  if (o.enrichment && !VALID_STATUS.has(o.enrichment.status)) errors.push(`${title}: invalid enrichment.status`);
  if (o.dayToDay && (o.dayToDay.length < 30 || o.dayToDay.length > 300)) warnings.push(`${title}: dayToDay length ${o.dayToDay.length} (aim 40-220)`);
  if (o.enrichment?.status === "reviewed" && !o.enrichment?.source) warnings.push(`${title}: reviewed but no source URL`);
}

console.log(`validated ${count} enrichment overrides against ${baseTitles.size} base roles`);
if (warnings.length) { console.log(`\n${warnings.length} warnings:`); warnings.forEach((w) => console.log("  ⚠ " + w)); }
if (errors.length) {
  console.log(`\n${errors.length} ERRORS:`);
  errors.forEach((e) => console.log("  ✖ " + e));
  process.exit(1);
}
console.log("\n✓ all overrides valid");
