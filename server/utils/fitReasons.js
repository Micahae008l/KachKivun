import { getIdfRoleCatalogV3 } from "./roleCatalogV3.js";
import { YOM_HAMEAH_LABELS_HE } from "./yomHameahKeys.js";

const INTEREST_HE = {
  cyber: "סייבר",
  combat: "לחימה",
  intelligence: "מודיעין",
  technology_engineering: "טכנולוגיה והנדסה",
  medical: "רפואה",
  air_force: "חיל האוויר",
  navy: "חיל הים",
  instruction_education: "הדרכה וחינוך",
  logistics: "לוגיסטיקה",
};
const AREA_HE = {
  programming: "תכנות",
  cybersecurity: "אבטחת מידע",
  networks: "רשתות",
  data_ai: "דאטה ו־AI",
  hardware_electronics: "אלקטרוניקה",
};
const MOTIVATION_HE = {
  contribution: "הרצון לתרום",
  challenge: "הרצון באתגר",
  career: "מקצוע להמשך החיים",
  friends_experience: "החוויה והחברים",
  personal_growth: "הרצון לצמוח",
};

let byTitle = null;
function catalogRole(title) {
  if (!byTitle)
    byTitle = new Map((getIdfRoleCatalogV3()?.roles || []).map((r) => [r.roleTitle, r]));
  return byTitle.get(title) ?? null;
}

const has = (list, value) => Array.isArray(list) && list.includes(value);

// Measured combat fitness bands (3 km run, pull-ups, push-ups).
const STRONG_BANDS = new Set(["under_13", "16_plus", "61_plus"]);
const WEAK_BANDS = new Set(["over_15", "0_to_5", "0_to_30"]);

// The catalog's interestAreas come from every tag (a paramedic has "fitness", so it is also
// "combat"). For a reason shown to the user only the role's main field counts.
const FIELD_WORDS = [
  ["cyber", /סייבר/],
  ["medical", /רפוא/],
  ["intelligence", /מודיעין/],
  ["air_force", /אוויר/],
  ["navy", /חיל הים|(^|\s)ימי/],
  ["instruction_education", /הדרכה|חינוך|הוראה/],
  ["logistics", /לוגיסטיקה|תובלה/],
  ["technology_engineering", /טכנולוג|הנדסה|מחשב|תקשוב|תוכנה|אלקטרוניקה|דאטה/],
  ["combat", /לחימה|חי״ר|שריון|קומנדו|סיירת/],
];
const FIRST_TAG_FIELD = {
  cyber: "cyber",
  medicine: "medical",
  emergency: "medical",
  intelligence: "intelligence",
  aviation: "air_force",
  drones: "air_force",
  sea: "navy",
  teaching: "instruction_education",
  instruction: "instruction_education",
  logistics: "logistics",
  coding: "technology_engineering",
  software: "technology_engineering",
  electronics: "technology_engineering",
  combat: "combat",
};

/** Main fields: in each part of the category the earliest field word wins, plus the first tag. */
export function mainFields(c) {
  const fields = new Set();
  for (const part of String(c.category || "").split("/")) {
    let best = null;
    for (const [field, re] of FIELD_WORDS) {
      const at = part.search(re);
      if (at >= 0 && (best === null || at < best[1])) best = [field, at];
    }
    if (best) fields.add(best[0]);
  }
  const first = FIRST_TAG_FIELD[c.preferenceTags?.[0]];
  if (first) fields.add(first);
  return fields;
}

/**
 * Up to two personal reasons a role fits this user, each true for both sides: the user said it
 * (interest, tech background, fitness, wanting to lead, motivation) and the role has it in the
 * catalog. A strong מא״ה score in one of the role's key dimensions comes last, not first.
 * Built from the profile snapshot saved with the result; none of it can name the role.
 */
export function fitReasonsFor(role, snapshot) {
  const c = catalogRole(role?.roleTitle);
  if (!c || !snapshot) return [];
  const s = snapshot.assessmentSignals || {};
  const out = [];
  const add = (reason) => {
    if (reason && !out.includes(reason)) out.push(reason);
  };

  const fields = mainFields(c);
  const interest = (s.rolesInterested || []).find((i) => fields.has(i) && INTEREST_HE[i]);
  if (interest) add(`העניין שלכם ב${INTEREST_HE[interest]}`);

  const area = (s.technicalDetails?.areas || []).find(
    (a) => has(c.technicalAreas, a) && AREA_HE[a],
  );
  if (area) add(`הרקע שלכם ב${AREA_HE[area]}`);
  else if (
    ["advanced", "expert"].includes(s.technicalDetails?.level) &&
    (c.techIntensity ?? 0) >= 4
  ) {
    add("הרמה הטכנולוגית הגבוהה שלכם");
  }

  // physicalActivityLevel is a preference, not ability: only the measured bands can claim fitness.
  const bands = Object.values(s.combatDetails || {});
  const measuredFit =
    bands.some((b) => STRONG_BANDS.has(b)) && !bands.some((b) => WEAK_BANDS.has(b));
  if (measuredFit && (c.physicalDemand ?? 0) >= 4) add("הכושר הגבוה שלכם");
  else if (c.combat && s.combatDetails?.readiness === "ready") add("המוכנות שלכם למסלול קרבי");

  if (s.leadership === "want_lead" && (c.leadershipDemand ?? 0) >= 4) add("הרצון שלכם לפקד");

  const motivation = (s.motivations || []).find(
    (m) => has(c.motivationSignals, m) && MOTIVATION_HE[m],
  );
  if (motivation) add(MOTIVATION_HE[motivation]);

  if (out.length < 2 && snapshot.yomSource !== "unknown" && snapshot.yom) {
    const best = (c.keyDimensions || [])
      .map((k) => [k, Number(snapshot.yom[k])])
      .filter(([k, v]) => v >= 4 && YOM_HAMEAH_LABELS_HE[k])
      .sort((a, b) => b[1] - a[1])[0];
    if (best) add(`${YOM_HAMEAH_LABELS_HE[best[0]]} ${best[1]}/5 במא״ה`);
  }
  return out.slice(0, 2);
}
