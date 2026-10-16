import { rankRolesV3, scoreRole, isFlatYom } from "./roleScoring.js";
import { textForGender } from "./genderText.js";

/**
 * Paid extras computed from the same deterministic scoring as the match itself:
 * a ranking plan for the preferences questionnaire and a "what would change" simulation.
 * No AI call, so both are free to recompute on every view.
 */

const MEDICAL_STEPS = [21, 45, 64, 72, 82, 97];
const BACKUP_COUNT = 5;
const OPENED_PREVIEW = 6;

const numeric = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const trusted = (role) =>
  role?.enrichment?.status === "reviewed" || role?.enrichment?.status === "verified";

/** 5 for the top two, 4 for the next two, 3 for the rest: the questionnaire rewards many 3+. */
function ratingForRank(rank) {
  if (rank <= 2) return 5;
  if (rank <= 4) return 4;
  return 3;
}

function planNotes(role, catalogRole, profile) {
  const notes = [];
  const competitive =
    catalogRole?.selective ||
    catalogRole?.competitiveness === "high" ||
    catalogRole?.competitiveness === "very_high";
  if (competitive) notes.push("יש מיון לתפקיד. דירוג גבוה הוא בקשה לזימון למיון, לא שיבוץ.");
  if (role.admissionChance?.level === "low") {
    notes.push("סיכוי הקבלה נמוך. דרגו גבוה, אבל אל תבנו רק עליו.");
  }
  const dapar = numeric(profile.daparScore);
  const floor = numeric(catalogRole?.daparFloor);
  if (dapar != null && floor != null && trusted(catalogRole) && dapar - floor < 10) {
    notes.push(`הדפ״ר שלכם על הסף של התפקיד (${floor}).`);
  }
  // Backups and older saved roles carry the catalog label for both genders.
  const length = textForGender(role.serviceLengthLabel || catalogRole?.serviceLengthLabel || "", profile.gender);
  if (length) notes.push(`משך שירות: ${length}.`);
  return notes;
}

function planEntry(role, catalogRole, profile, { rank, source }) {
  return {
    roleTitle: role.roleTitle,
    rank,
    rating: source === "backup" ? 3 : ratingForRank(rank),
    source,
    category: role.category || catalogRole?.category || "",
    combat: Boolean(role.combat ?? catalogRole?.combat),
    daparFloor: trusted(catalogRole) ? numeric(catalogRole?.daparFloor) : null,
    medicalFloor: trusted(catalogRole) ? numeric(catalogRole?.medicalFloor) : null,
    notes: planNotes(role, catalogRole, profile),
  };
}

/**
 * The five matches rated 5/4/3 by rank, plus the next-best eligible roles as backups at 3,
 * so the questionnaire has enough targets rated 3 and above to be taken into account.
 */
export function buildQuestionnairePlan(matchedRoles, catalogRoles, profile) {
  const byTitle = new Map((catalogRoles || []).map((role) => [role.roleTitle, role]));
  const matches = [...(matchedRoles || [])]
    .sort((a, b) => (a.rank || 0) - (b.rank || 0))
    .slice(0, 5)
    .map((role, index) =>
      planEntry(role, byTitle.get(role.roleTitle), profile, {
        rank: role.rank || index + 1,
        source: "match",
      }),
    );
  const taken = new Set(matches.map((entry) => entry.roleTitle));
  const backups = rankRolesV3(catalogRoles || [], profile, { limit: 5 + BACKUP_COUNT * 2 })
    .filter((role) => !taken.has(role.roleTitle))
    .slice(0, BACKUP_COUNT)
    .map((role, index) =>
      planEntry(role, role, profile, { rank: matches.length + index + 1, source: "backup" }),
    );
  return [...matches, ...backups];
}

function scenarioList(profile) {
  const scenarios = [];
  const dapar = numeric(profile.daparScore);
  if (dapar != null) {
    for (const step of [10, 20]) {
      if (dapar + step <= 90) {
        scenarios.push({
          key: `dapar+${step}`,
          metric: "dapar",
          from: dapar,
          to: dapar + step,
          profile: { ...profile, daparScore: dapar + step },
        });
      }
    }
  }
  const medical = numeric(profile.medicalProfile);
  if (medical != null) {
    const next = MEDICAL_STEPS.find((step) => step > medical);
    if (next != null) {
      scenarios.push({
        key: `profile-${next}`,
        metric: "profile",
        from: medical,
        to: next,
        profile: { ...profile, medicalProfile: next },
      });
    }
  }
  return scenarios;
}

function eligibleScores(catalogRoles, profile) {
  const context = { ...profile, yomFlat: isFlatYom(profile.yom) };
  const scores = new Map();
  for (const role of catalogRoles || []) {
    const score = scoreRole(role, context);
    if (score.eligible) scores.set(role.roleTitle, { role, base01: score.base01 });
  }
  return scores;
}

/**
 * For one step up in דפ"ר or medical profile: which roles become eligible, and which roles
 * would enter the top five. Roles count as "opened" only where a verified floor blocks them today.
 */
export function buildWhatIf(catalogRoles, profile) {
  const baseline = eligibleScores(catalogRoles, profile);
  const baselineTop = new Set(
    rankRolesV3(catalogRoles || [], profile, { limit: 5 }).map((role) => role.roleTitle),
  );

  return scenarioList(profile).map((scenario) => {
    const after = eligibleScores(catalogRoles, scenario.profile);
    const opened = [...after.values()]
      .filter(({ role }) => !baseline.has(role.roleTitle))
      .sort(
        (a, b) => b.base01 - a.base01 || a.role.roleTitle.localeCompare(b.role.roleTitle, "he"),
      );
    const entering = rankRolesV3(catalogRoles || [], scenario.profile, { limit: 5 })
      .map((role) => role.roleTitle)
      .filter((title) => !baselineTop.has(title));
    return {
      key: scenario.key,
      metric: scenario.metric,
      from: scenario.from,
      to: scenario.to,
      openedCount: opened.length,
      opened: opened.slice(0, OPENED_PREVIEW).map(({ role }) => ({
        roleTitle: role.roleTitle,
        category: role.category || "",
        combat: Boolean(role.combat),
        daparFloor: numeric(role.daparFloor),
        medicalFloor: numeric(role.medicalFloor),
      })),
      enteringTopFive: entering,
    };
  });
}

const FREE_OPENED_PREVIEW = 2;

/**
 * What a user without the unlock gets: full detail for the free places and the backups, and
 * the paid places kept in position with their rating but no name. In the simulation the
 * counts stay, two opened roles are named, and the rest is withheld.
 */
export function redactExtras(plan, whatIf, lockedTopRanks) {
  return {
    plan: plan.map((entry) =>
      entry.source === "match" && entry.rank <= lockedTopRanks
        ? { locked: true, rank: entry.rank, rating: entry.rating, source: entry.source }
        : entry,
    ),
    whatIf: whatIf.map((scenario) => ({
      ...scenario,
      opened: scenario.opened.slice(0, FREE_OPENED_PREVIEW),
      enteringTopFive: [],
      enteringCount: scenario.enteringTopFive.length,
    })),
  };
}

/** The same shape for a user with the unlock: nothing withheld. */
export function fullExtras(plan, whatIf) {
  return {
    plan,
    whatIf: whatIf.map((scenario) => ({
      ...scenario,
      enteringCount: scenario.enteringTopFive.length,
    })),
  };
}
