/**
 * Shapes of the gibush content. The content itself (moments, bars, ladders, plan text) is
 * served by GET /api/gibush/content to unlocked users only, so it never ships in the bundle.
 */

export type Track = "combat" | "pilot";
export type Gender = "male" | "female";

/** score: 0 (far from the bar) to 3 (at or past it). */
export type Option = { label: string; score: number; weeks?: number };

export type Stage = {
  id: string;
  clock: string;
  place: string;
  scene: string;
  question: string;
  options: Option[];
  rating: string;
  /** Candidates who leave around this moment, for the live counter. */
  drop: number;
  /** Commonly cited bar, the score that meets it, and what to train: [base block, sharp block]. */
  bar?: { label: string; score: number; drill: [string, string]; topic?: string };
  cutReason?: string;
  /** Women's wording and bar: relative, never the men's numbers. */
  female?: {
    scene?: string;
    question?: string;
    cutReason?: string;
    barLabel?: string;
    barScore?: number;
  };
};

export type Level = {
  name: string;
  units: string;
  screening: string;
  /** Minimum option score per stage id. */
  need: Record<string, number>;
  minOverall: number;
};

export type TrackContent = {
  title: string;
  subtitle: string;
  passTitle: string;
  stages: Stage[];
  ratings: { key: string; label: string; weight: number }[];
};

export type GibushContent = {
  startCandidates: number;
  tracks: Record<Track, TrackContent>;
  ladders: { combatMale: Level[]; combatFemale: Level[]; pilot: Level[] };
};

export function ladderFor(content: GibushContent, track: Track, gender: Gender): Level[] {
  if (track === "pilot") return content.ladders.pilot;
  return gender === "female" ? content.ladders.combatFemale : content.ladders.combatMale;
}

/** A stage as a given candidate sees it: women get their own wording and bar. */
export function stageFor(stage: Stage, gender: Gender): Stage {
  const f = gender === "female" ? stage.female : undefined;
  if (!f) return stage;
  return {
    ...stage,
    scene: f.scene ?? stage.scene,
    question: f.question ?? stage.question,
    cutReason: f.cutReason ?? stage.cutReason,
    bar: stage.bar && {
      ...stage.bar,
      label: f.barLabel ?? stage.bar.label,
      score: f.barScore ?? stage.bar.score,
    },
  };
}

/**
 * Level names for shared links (`?u=` is an index here). Public on purpose: a shared card shows
 * only a score and a level name. Must list every ladder name in the server content.
 */
export const SHARE_LEVELS: { track: Track; name: string }[] = [
  ...["גדודים", "צנחנים", "קומנדו", "שייטת 13", "גיבוש אחוד"].map((name) => ({
    track: "combat" as const,
    name,
  })),
  ...["חי״ר גבולות", "מג״ב ושריון", "עוקץ ויהל״ם", "669"].map((name) => ({
    track: "combat" as const,
    name,
  })),
  ...["התחלה", "סינון", "הימים הראשונים", "בולטים בצוות", "מוכנות מלאה"].map((name) => ({
    track: "pilot" as const,
    name,
  })),
];

export const TRACK_CARD_LABEL: Record<Track, string> = { combat: "קרבי", pilot: "טיס וחובלים" };

/** For cards drawn without content (teasers): labels only, numbers hidden. */
export const RATING_LABELS: Record<Track, { key: string; label: string }[]> = {
  combat: ["ריצה", "כוח", "סחיבה", "ראש", "צוות", "הכנה"].map((label, i) => ({
    key: String(i),
    label,
  })),
  pilot: ["חשיבה", "צוות", "קור רוח", "זיכרון", "כושר בסיסי", "הכנה"].map((label, i) => ({
    key: String(i),
    label,
  })),
};

export const BENCHMARK_NOTE =
  "המספרים לפי ניסיון של מועמדים, לא נתון רשמי. בגיבוש האמיתי שוקלים גם התנהגות בצוות וראיון.";
