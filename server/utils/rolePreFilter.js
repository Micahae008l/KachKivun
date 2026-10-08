/**
 * Pre-filters the 302-role catalog down to ~30-50 best candidates
 * based on hard profile constraints, so the AI reasons over a focused set.
 */

const FOCUS_TO_TAGS = {
  Tech: ["coding", "software", "cyber", "networks", "it", "data", "ai", "electronics", "hardware", "devops", "qa"],
  Physical: ["combat", "fitness", "fieldwork", "rescue", "driving", "construction", "mechanics"],
  Research: ["intelligence", "research", "data", "maps", "visual-analysis", "math", "physics", "attention-to-detail"],
  Medical: ["medicine", "emergency", "dentistry", "lab", "biology", "chemistry", "helping-people"],
};

const COMBAT_PREF_WANTS_COMBAT = new Set(["Kravi", "FieldCombat", "Mixed"]);
const COMBAT_PREF_NO_COMBAT = new Set(["Jobnik", "SupportHQ", "TechTrack", "MedicalInstruction"]);

/**
 * @param {object[]} roles  - Full catalog roles array
 * @param {object} stats    - { daparScore, medicalProfile }
 * @param {object} prefs    - { combatPreference, focus, physicalActivityLevel }
 * @param {object} yom      - Migrated 12-key yom hameah object
 * @returns {object[]}      - Filtered + scored roles (top ~40)
 */
export function preFilterRoles(roles, stats, prefs, yom) {
  if (!roles?.length) return roles;

  const { daparScore, medicalProfile } = stats;
  const combat = prefs?.combatPreference;
  const focus = prefs?.focus;
  const physical = prefs?.physicalActivityLevel;
  const hasDapar = typeof daparScore === "number" && Number.isFinite(daparScore);
  const hasMedical =
    typeof medicalProfile === "number" && Number.isFinite(medicalProfile);

  const focusTags = new Set(FOCUS_TO_TAGS[focus] || []);
  const wantsCombat = COMBAT_PREF_WANTS_COMBAT.has(combat);
  const noCombat = COMBAT_PREF_NO_COMBAT.has(combat);

  const scored = [];

  for (const role of roles) {
    let score = 0;
    let eligible = true;

    // Hard medical filter: unenriched combat = profile 82+ (line combat / combat corps)
    if (hasMedical && role.combat && medicalProfile < 82) {
      eligible = false;
    }

    if (!eligible) continue;

    // Combat preference alignment
    if (role.combat && wantsCombat) score += 12;
    if (role.combat && noCombat) score -= 20;
    if (!role.combat && noCombat) score += 8;
    if (!role.combat && wantsCombat) score -= 5;

    // Focus tag matching
    const tags = role.preferenceTags || [];
    let tagHits = 0;
    for (const t of tags) {
      if (focusTags.has(t)) tagHits++;
    }
    score += tagHits * 6;

    // DAPAR alignment
    const highDapar = hasDapar && daparScore >= 65;
    const techTags = tags.some(t => ["coding", "software", "cyber", "ai", "data", "intelligence", "research"].includes(t));
    if (highDapar && techTags) score += 8;
    if (highDapar && role.selective) score += 4;
    if (hasDapar && !highDapar && techTags && role.selective) score -= 8;

    // Physical activity alignment
    if (physical === "High" && role.combat) score += 5;
    if (physical === "Low" && role.combat) score -= 8;
    if (physical === "Low" && !role.combat) score += 3;

    // Yom Hameah dimension alignment (if available)
    if (yom) {
      // Technical roles benefit from high technical scores
      if (techTags && yom.technicalActivation >= 4) score += 4;
      if (techTags && yom.dataProcessing >= 4) score += 3;

      // Command/leadership roles
      if (tags.includes("leadership") && yom.command >= 4) score += 5;
      if (tags.includes("leadership") && yom.command <= 2) score -= 5;

      // Teaching roles
      if (tags.includes("teaching") && yom.instruction >= 4) score += 5;
      if (tags.includes("teaching") && yom.instruction <= 2) score -= 4;

      // People-facing roles
      const peopleTags = tags.some(t => ["helping-people", "welfare", "psychology", "hr"].includes(t));
      if (peopleTags && yom.interpersonalCare >= 4) score += 4;
      if (peopleTags && yom.interpersonalCare <= 2) score -= 3;

      // Attention-intensive roles
      if (tags.includes("attention-to-detail") && yom.diligencePersistence >= 4) score += 3;

      // Management roles
      if (tags.some(t => ["operations", "war-room", "logistics", "admin"].includes(t)) && yom.managementOrganization >= 4) score += 4;

      // Field/spatial roles
      if (tags.includes("fieldwork") && yom.spatialPerception >= 4) score += 3;

      // High diligence benefits selective/long-course roles
      if (role.selective && yom.diligencePersistence >= 4) score += 3;
      if (role.selective && yom.diligencePersistence <= 2) score -= 3;

      // Discipline for sensitive environments
      if (tags.some(t => ["intelligence", "cyber"].includes(t)) && yom.frameworkBehavior >= 4) score += 3;
    }

    // Validation quality bonus
    if (role.validationLevel === "official_public_validated") score += 2;
    if (role.validationLevel === "official_family_validated") score += 1;

    scored.push({ ...role, _score: score });
  }

  // Sort by score descending, take top 40
  scored.sort((a, b) => b._score - a._score);
  const topN = Math.min(40, scored.length);
  return scored.slice(0, topN);
}
