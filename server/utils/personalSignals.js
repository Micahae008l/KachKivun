/**
 * The personal signup answers (what matters, strengths, preferred setting, languages).
 * Optional: profiles without them stay complete, match as before and keep their cache.
 * The Hebrew labels are what the AI sees.
 */
export const MOTIVATIONS = {
  Impact: "השפעה ומשמעות",
  Profession: "מקצוע שיעזור אחרי הצבא",
  Challenge: "אתגר ולהוכיח את עצמי",
  NearHome: "שירות קרוב לבית",
  Team: "צוות וחברים טובים",
};

export const STRENGTHS = {
  Tech: "טכנולוגיה ומחשבים",
  People: "עבודה עם אנשים והדרכה",
  HandsOn: "עבודת ידיים וטכניקה",
  Analysis: "ניתוח, חשיבה ומספרים",
  Sport: "ספורט וכושר",
};

export const ENVIRONMENTS = {
  Field: "שטח",
  Base: "בסיס / משרד",
  Sea: "ים",
  Air: "אוויר",
  Any: "לא משנה",
};

export const LANGUAGES = {
  English: "אנגלית",
  Arabic: "ערבית",
  Russian: "רוסית",
  French: "צרפתית",
  Amharic: "אמהרית",
  Spanish: "ספרדית",
  Other: "שפה נוספת",
  HebrewOnly: "עברית בלבד",
};

/** The answers a profile gave, or null when it gave none (so old profiles hash as before). */
export function personalSignalsOf(preferences) {
  const p = {
    motivation: preferences?.motivation || "",
    strengths: preferences?.strengths || "",
    environment: preferences?.environment || "",
    languages: Array.isArray(preferences?.languages) ? [...preferences.languages].sort() : [],
  };

  return p.motivation || p.strengths || p.environment || p.languages.length ? p : null;
}

/** Prompt lines for the AI, in Hebrew; empty when there are no answers. */
export function personalSignalsPromptLines(personal) {
  if (!personal) return "";
  const lines = [
    personal.motivation && `- מה הכי חשוב לו/ה בשירות: ${MOTIVATIONS[personal.motivation]}`,
    personal.strengths && `- במה הוא/היא הכי חזק/ה (לדבריו/ה): ${STRENGTHS[personal.strengths]}`,
    personal.environment && `- סביבה מועדפת: ${ENVIRONMENTS[personal.environment]}`,
    personal.languages.length && `- שפות: ${personal.languages.map((l) => LANGUAGES[l]).join(", ")}`,
  ].filter(Boolean);

  return `\n${lines.join("\n")}\n- השתמש באותות האישיים האלה ב-adjustment ובהסבר רק כשהם באמת מתאימים לתפקיד (למשל שפה לתפקידי מודיעין, ים לחיל הים). לעולם אל תעקוף בגללם את סף הדפ"ר או הפרופיל הרפואי.`;
}
