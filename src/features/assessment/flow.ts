import { YOM_HAMEAH_KEYS } from "@/lib/yom-hameah";
import type { AssessmentAnswers, AssessmentStepId } from "./types";

const COMBAT_ROLE_IDS = new Set(["combat"]);
const TECHNICAL_ROLE_IDS = new Set(["cyber", "intelligence", "technology_engineering"]);

export type AssessmentBranches = {
  wantsCombat: boolean;
  wantsTechnical: boolean;
};

export function deriveAssessmentBranches(answers: AssessmentAnswers): AssessmentBranches {
  return {
    wantsCombat:
      answers.combatPreference === "FieldCombat" ||
      answers.combatPreference === "Mixed" ||
      answers.rolesInterested.some((role) => COMBAT_ROLE_IDS.has(role)),
    wantsTechnical:
      answers.combatPreference === "TechTrack" ||
      answers.focus === "Tech" ||
      answers.focusExtra.includes("Tech") ||
      answers.rolesInterested.some((role) => TECHNICAL_ROLE_IDS.has(role)),
  };
}

export function buildAssessmentFlow(
  answers: AssessmentAnswers,
  { includeAuth = true }: { includeAuth?: boolean } = {},
): AssessmentStepId[] {
  const branches = deriveAssessmentBranches(answers);
  const steps: AssessmentStepId[] = ["direction", "roles", "preferences", "environment", "style"];

  if (branches.wantsCombat) steps.push("combat");
  if (branches.wantsTechnical) steps.push("technical");

  steps.push("scores", "yom", "checkpoint", "motivation", "identity", "review");
  // Signed-out users enter their email on the review screen, so only the code step follows.
  if (includeAuth) steps.push("otp");
  return steps;
}

function isValidDraftDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateAssessmentStep(
  step: AssessmentStepId,
  answers: AssessmentAnswers,
): string | null {
  if (step === "direction" && !answers.combatPreference) {
    return "בחרו כיוון שירות לפני שממשיכים";
  }
  if (step === "roles") {
    if (answers.rolesInterested.length === 0) return "בחרו לפחות תחום אחד שמעניין אתכם";
    if (answers.rolesInterested.length > 5) return "אפשר לבחור עד חמישה תחומי עניין";
    if (answers.rolesAvoided.length > 6) return "אפשר לבחור עד שש העדפות הימנעות";
  }
  if (step === "preferences" && (!answers.focus || !answers.physicalActivityLevel)) {
    return "בחרו מיקוד ורמת פעילות לפני שממשיכים";
  }
  if (step === "environment" && (!answers.basePreference || !answers.environment)) {
    return "בחרו מערכת יציאות וסביבת עבודה";
  }
  if (step === "style" && (!answers.leadership || !answers.stress)) {
    return "ענו על שתי שאלות הסגנון";
  }
  if (step === "combat") {
    const details = answers.combatDetails;
    if (!details.run3kmBand || !details.pullUpsBand || !details.pushUpsBand || !details.readiness) {
      return "השלימו את ארבע הערכות הכושר; אפשר לבחור ״לא יודע/ת״";
    }
  }
  if (step === "technical") {
    if (!answers.technicalDetails.level || answers.technicalDetails.areas.length === 0) {
      return "בחרו רמת ניסיון ולפחות תחום טכנולוגי אחד";
    }
    if (answers.technicalDetails.areas.length > 4) return "אפשר לבחור עד ארבעה תחומים טכנולוגיים";
  }
  if (
    step === "scores" &&
    (!answers.gender || answers.daparScore === null || answers.medicalProfile === null)
  ) {
    return "השלימו מין, דפ״ר ופרופיל רפואי; אפשר לבחור ״לא יודע/ת״";
  }
  if (step === "yom" && !answers.yomHameahSource) {
    return "בחרו אם ציוני מא״ה רשמיים, הערכה עצמית או לא ידועים";
  }
  if (
    step === "yom" &&
    answers.yomHameahSource !== "unknown" &&
    !YOM_HAMEAH_KEYS.every((key) => {
      const score = answers.yomHameah[key];
      return Number.isInteger(score) && score >= 1 && score <= 5;
    })
  ) {
    return "כל ציוני מא״ה צריכים להיות בין 1 ל־5";
  }
  if (step === "motivation") {
    if (answers.motivations.length === 0) return "בחרו לפחות דבר אחד שחשוב לכם בשירות";
    if (answers.motivations.length > 4) return "אפשר לבחור עד ארבע מוטיבציות";
    if (answers.extraNote.trim().length > 400) return "הבקשה האישית יכולה להכיל עד 400 תווים";
  }
  if (step === "identity") {
    if (!answers.preferredName.trim()) return "כתבו איך לקרוא לכם";
    if (answers.preferredName.trim().length > 120) return "השם יכול להכיל עד 120 תווים";
    if (!isValidDraftDate(answers.draftDate)) return "בחרו תאריך גיוס תקין";
  }
  return null;
}

export function firstIncompleteAssessmentStep(answers: AssessmentAnswers): AssessmentStepId | null {
  const steps = buildAssessmentFlow(answers, { includeAuth: false });
  for (const step of steps) {
    if (step === "checkpoint") continue;
    if (validateAssessmentStep(step, answers)) return step;
  }
  return null;
}
