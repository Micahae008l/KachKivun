/**
 * Offline A/B of the match prompt across models and engines, with ONE fixed profile.
 * No DB, no HTTP, no cache: runs the exact production prompts via llmClient.
 *
 *   node scripts/ab-match.mjs
 *   node scripts/ab-match.mjs --models gpt-4o,claude-haiku-5-5 --engines v2,v3 --profile scripts/fixtures/ab-profile.json
 *
 * v3: roles are chosen deterministically, so only the Hebrew copy differs per model.
 * v2: the model picks and ranks 5 out of a 15-role pool, so the roles themselves differ.
 */
import "../env.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chatJson } from "../utils/llmClient.js";
import { getIdfRoleCatalogV3 } from "../utils/roleCatalogV3.js";
import { buildCandidatePool, rankRolesV3, normalizeAssessmentSignals } from "../utils/roleScoring.js";
import { finalizeRolesV3 } from "../utils/roleRecommendationV3.js";
import {
  buildMatchUserPrompt,
  buildSystemPromptV2,
  buildSystemPromptV3,
  finalizeRolesV2,
  parsePersonalAnswer,
  parseRolesArray,
} from "../controllers/aiController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const [key, inline] = process.argv[i].replace(/^--/, "").split("=");
  args[key] = inline ?? (process.argv[i + 1]?.startsWith("--") ? true : process.argv[++i]);
}
const models = String(args.models || "gpt-4o,claude-haiku-5-5").split(",");
const engines = String(args.engines || "v3,v2").split(",");
const profilePath = path.resolve(__dirname, String(args.profile || "fixtures/ab-profile.json"));
const fixture = JSON.parse(fs.readFileSync(profilePath, "utf8"));

const assessmentSignals = normalizeAssessmentSignals(fixture.assessmentSignals);
const profileForMatch = {
  daparScore: fixture.daparScore,
  medicalProfile: fixture.medicalProfile,
  gender: fixture.gender,
  combatPreference: fixture.combatPreference,
  focus: fixture.focus,
  physicalActivityLevel: fixture.physicalActivityLevel,
  yom: fixture.yomHameah,
  yomSource: fixture.yomHameahSource,
  assessmentSignals,
  personalRequest: String(fixture.personalRequest || ""),
};
const preferences = {
  yomHameahSource: fixture.yomHameahSource,
  combatPreference: fixture.combatPreference,
  focus: fixture.focus,
  physicalActivityLevel: fixture.physicalActivityLevel,
};
const catalog = getIdfRoleCatalogV3();

console.log(`profile: דפ"ר ${fixture.daparScore} · פרופיל ${fixture.medicalProfile} · ${fixture.gender} · ${fixture.combatPreference}/${fixture.focus}`);

for (const engine of engines) {
  const pool =
    engine === "v3"
      ? rankRolesV3(catalog.roles, profileForMatch, { limit: 5 })
      : buildCandidatePool(catalog.roles, profileForMatch, { poolSize: 15 });
  const system = engine === "v3" ? buildSystemPromptV3(pool) : buildSystemPromptV2(pool);
  const user = buildMatchUserPrompt({
    engine,
    profileForMatch,
    preferences,
    yom: fixture.yomHameah,
    stats: {},
    assessmentSignals,
    filteredRoleCount: pool.length,
    personalRequest: profileForMatch.personalRequest,
  });

  console.log(`\n${"=".repeat(70)}\nengine ${engine} · pool ${pool.length}${engine === "v2" ? ": " + pool.map((r) => r.roleTitle).join(" | ") : ""}`);

  for (const model of models) {
    const startedAt = Date.now();
    try {
      const completion = await chatJson({ model, system, user, maxTokens: 8000, temperature: 0.1 });
      const raw = parseRolesArray(completion.content) || [];
      const personalAnswer = parsePersonalAnswer(completion.content);
      const roles = engine === "v3" ? finalizeRolesV3(raw, pool, profileForMatch) : finalizeRolesV2(raw, pool);
      console.log(`\n--- ${model} · ${Date.now() - startedAt}ms · ${completion.promptTokens}+${completion.completionTokens} tok · parsed ${raw.length}/5`);
      if (personalAnswer) console.log(`   [personalAnswer] ${personalAnswer}`);
      roles.forEach((role, index) => {
        console.log(`#${index + 1} ${role.matchPercentage}% ${role.roleTitle}`);
        console.log(`   ${role.summary}`);
        console.log(`   ${role.description}`);
        if (role.nextStepPrompts?.length) console.log(`   ? ${role.nextStepPrompts.join(" | ")}`);
      });
    } catch (error) {
      console.log(`\n--- ${model} FAILED: ${error.message}`);
    }
  }
}
