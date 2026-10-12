// Writes src/content/blog/role-thresholds.json: the roles whose minimum דפ"ר / profile were
// checked against the official role page, so blog posts list them without retyping numbers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listRoleInsights } from "../server/utils/roleInsights.js";

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
