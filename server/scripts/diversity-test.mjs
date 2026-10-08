/**
 * How diverse are the top-5 results across different users? No API calls.
 *   node scripts/diversity-test.mjs            # 300 seeded synthetic users
 *   node scripts/diversity-test.mjs --n 1000
 * Prints distinct roles reached, concentration, and the most repeated roles.
 */
import "../env.js";
import { getIdfRoleCatalogV3 } from "../utils/roleCatalogV3.js";
import { rankRolesV3, normalizeAssessmentSignals } from "../utils/roleScoring.js";
import { YOM_HAMEAH_KEYS } from "../utils/yomHameahKeys.js";

const n = Number(process.argv[process.argv.indexOf("--n") + 1]) || 300;
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const some = (arr, k) => [...arr].sort(() => rnd() - 0.5).slice(0, k);

const DIRECTIONS = ["FieldCombat", "SupportHQ", "TechTrack", "MedicalInstruction", "Mixed"];
const FOCUS = ["Tech", "Physical", "Research", "Medical"];
const INTERESTS = ["cyber", "combat", "intelligence", "technology_engineering", "medical", "air_force", "navy", "instruction_education", "logistics"];

function syntheticProfile() {
  const gender = pick(["male", "female"]);
  const direction = pick(DIRECTIONS);
  const yom = Object.fromEntries(YOM_HAMEAH_KEYS.map((k) => [k, 1 + Math.floor(rnd() * 5)]));
  return {
    daparScore: pick([30, 40, 50, 60, 70, 80, 90]),
    medicalProfile: pick([45, 64, 72, 82, 97]),
    gender,
    combatPreference: direction,
    focus: pick(FOCUS),
    physicalActivityLevel: pick(["Low", "Medium", "High"]),
    yom,
    yomSource: "official",
    assessmentSignals: normalizeAssessmentSignals({
      rolesInterested: some(INTERESTS, 1 + Math.floor(rnd() * 3)),
      rolesAvoided: [],
      exitsPreference: "no_preference",
      environment: pick(["office", "field", "mixed", "no_preference"]),
      leadership: pick(["want_lead", "open", "prefer_team"]),
      stress: pick(["high", "moderate", "low"]),
      motivations: some(["contribution", "challenge", "career", "friends_experience", "personal_growth"], 2),
      technicalDetails: null,
      combatDetails: null,
    }),
  };
}

const roles = getIdfRoleCatalogV3().roles;
const freq = new Map();
const top1 = new Map();
let enrichedHits = 0;
for (let i = 0; i < n; i++) {
  const top = rankRolesV3(roles, syntheticProfile(), { limit: 5 });
  top.forEach((r, idx) => {
    freq.set(r.roleTitle, (freq.get(r.roleTitle) || 0) + 1);
    if (idx === 0) top1.set(r.roleTitle, (top1.get(r.roleTitle) || 0) + 1);
    if (r.enrichment?.status === "reviewed" || r.enrichment?.status === "verified") enrichedHits++;
  });
}
const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
const slots = n * 5;
const top10Share = sorted.slice(0, 10).reduce((s, [, c]) => s + c, 0) / slots;
console.log(`users ${n} · catalog ${roles.length} · distinct roles in any top-5: ${freq.size} · distinct #1: ${top1.size}`);
console.log(`top-10 roles take ${(top10Share * 100).toFixed(0)}% of all slots · reviewed/verified roles take ${((enrichedHits / slots) * 100).toFixed(0)}%`);
console.log("\nmost repeated (role · share of users who see it):");
sorted.slice(0, 15).forEach(([t, c]) => console.log(`  ${String(Math.round((c / n) * 100)).padStart(3)}%  ${t}`));
