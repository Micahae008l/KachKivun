// Writes src/content/blog/role-thresholds.json: the roles whose minimum דפ"ר / profile were
// checked against the official role page, so blog posts list them without retyping numbers.
// Also writes role-calculator.json: every catalog role, for the public calculator.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listRoleInsights } from "../server/utils/roleInsights.js";
import { getIdfRoleCatalogV3 } from "../server/utils/roleCatalogV3.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roles = listRoleInsights()
  .filter((r) => r.daparFloor != null || r.medicalFloor != null)
  .map((r) => ({
    title: r.roleTitle,
    category: r.category,
    combat: r.combat,
    dapar: r.daparFloor,
    profile: r.medicalFloor,
  }))
  .sort((a, b) => a.title.localeCompare(b.title, "he"));

fs.writeFileSync(
  path.join(root, "src", "content", "blog", "role-thresholds.json"),
  `${JSON.stringify(roles, null, 2)}\n`,
);
console.log(`role-thresholds.json: ${roles.length} roles`);

// The calculator needs every role, not only those with a verified floor: a role with no
// published floor is open to everyone, and leaving it out would undercount what is open.
const COMBAT_MEDICAL_MIN = 64;
const trusted = (role) =>
  role.enrichment?.status === "reviewed" || role.enrichment?.status === "verified";
const all = (getIdfRoleCatalogV3()?.roles || [])
  .map((role) => {
    const verified = trusted(role) && (role.daparFloor != null || role.medicalFloor != null);
    return {
      title: role.roleTitle,
      category: role.category || "",
      combat: Boolean(role.combat),
      dapar: verified ? (role.daparFloor ?? null) : null,
      // Combat roles without a verified floor still need the general combat minimum.
      profile: verified ? (role.medicalFloor ?? null) : role.combat ? COMBAT_MEDICAL_MIN : null,
      verified,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, "he"));

fs.writeFileSync(
  path.join(root, "src", "content", "blog", "role-calculator.json"),
  `${JSON.stringify(all)}\n`,
);
console.log(
  `role-calculator.json: ${all.length} roles, ${all.filter((r) => r.verified).length} verified`,
);
