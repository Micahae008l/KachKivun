// Writes src/dev/demo-results.json: real engine output for a few sample profiles, so the
// results page can be opened locally at /demo with no login, database or AI call.
// Role text is the engine's built-in fallback copy, not AI-written copy.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getIdfRoleCatalogV3 } from "../server/utils/roleCatalogV3.js";
import { admissionChance, rankRolesV3 } from "../server/utils/roleScoring.js";
import { finalizeRolesV3 } from "../server/utils/roleRecommendationV3.js";
import { serializeRecommendationRoles } from "../server/utils/recommendationSerializer.js";
import {
  buildQuestionnairePlan,
  buildWhatIf,
  fullExtras,
  redactExtras,
} from "../server/utils/matchExtras.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yom = (overrides = {}) => ({
  technicalActivation: 3,
  spatialPerception: 3,
  dataProcessing: 3,
  teamwork: 3,
  command: 3,
  instruction: 3,
  interpersonalCare: 3,
  diligencePersistence: 3,
  managementOrganization: 3,
  frameworkBehavior: 3,
  maturity: 3,
  ...overrides,
});

// One sample user, answered the way a real applicant would.
const PERSONAS = [
  {
    id: "noa",
    label: "נועה, כיתה י״ב",
    profile: {
      daparScore: 70,
      medicalProfile: 64,
      gender: "female",
      combatPreference: "TechTrack",
      focus: "Tech",
      physicalActivityLevel: "Medium",
      yomSource: "official",
      yom: yom({
        technicalActivation: 5,
        dataProcessing: 4,
        teamwork: 4,
        diligencePersistence: 4,
        command: 2,
      }),
      assessmentSignals: {
        rolesInterested: ["cyber", "technology_engineering"],
        rolesAvoided: ["kitchen_maintenance", "guard_duty_nights"],
        environment: "office",
        leadership: "open",
        stress: "moderate",
        motivations: ["career", "challenge"],
        technicalDetails: { level: "intermediate", areas: ["programming"] },
        combatDetails: null,
      },
    },
  },
];

const catalog = getIdfRoleCatalogV3().roles;
const access = (unlocked) => ({ paywallEnabled: true, topTwoUnlocked: unlocked });

const personas = PERSONAS.map(({ id, label, profile }) => {
  const ranked = rankRolesV3(catalog, profile, { limit: 5 });
  const roles = finalizeRolesV3([], ranked, profile).map((role, index) => ({
    ...role,
    rank: index + 1,
    admissionChance: admissionChance(ranked[index], profile),
  }));
  const plan = buildQuestionnairePlan(roles, catalog, profile);
  const whatIf = buildWhatIf(catalog, profile);
  return {
    id,
    label,
    dapar: profile.daparScore,
    profile: profile.medicalProfile,
    paid: {
      roles: serializeRecommendationRoles({ roles }, access(true)),
      extras: { unlocked: true, ...fullExtras(plan, whatIf) },
    },
    unpaid: {
      roles: serializeRecommendationRoles({ roles }, access(false)),
      extras: { unlocked: false, ...redactExtras(plan, whatIf, 3) },
    },
  };
});

fs.writeFileSync(
  path.join(root, "src", "dev", "demo-results.json"),
  `${JSON.stringify({ personas }, null, 2)}\n`,
);
console.log(`demo-results.json: ${personas.length} personas`);
