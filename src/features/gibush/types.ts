/**
 * Shapes of the gibush content. The content itself (moments, bars, ladders, plan text) is
 * served by GET /api/gibush/content to unlocked users only, so it never ships in the bundle.
 */

export type Gender = "male" | "female";

/** score: 0 (far from the bar) to 3 (at or past it). why: the reason the day stops on this answer. */
export type Option = { label: string; score: number; weeks?: number; why?: string };

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
  /** Judgment moment: the answers are not a scale, so they are shown in a fixed shuffled order. */
  shuffle?: boolean;
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
  /** A second way into the level: flight and navy courses screen on thinking, not on carrying. */
  alt?: { units: string; need: Record<string, number>; minOverall: number };
};

export type DayContent = {
  title: string;
  subtitle: string;
  passTitle: string;
  stages: Stage[];
  ratings: { key: string; label: string; weight: number }[];
};

export type GibushContent = {
  startCandidates: number;
  day: DayContent;
  ladders: Record<Gender, Level[]>;
};

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
 * Level names for shared links (`?u=` is an index here, so only append). Public on purpose: a
 * shared card shows only a score and a level. Must list every ladder name (a test checks).
 */
export const SHARE_LEVELS = [
  "קו ראשון",
  "חטיבות החי״ר",
  "סיירות חטיבתיות",
  "קומנדו ומיוחדות",
  "סיירות עילית",
  "מג״ב ושריון",
];

/** For cards drawn without content (teasers): labels only, numbers hidden. */
export const RATING_LABELS = ["ריצה", "כוח", "סחיבה", "ראש", "צוות", "חשיבה"].map((label, i) => ({
  key: String(i),
  label,
}));

export const BENCHMARK_NOTE =
  "המספרים לפי ניסיון של מועמדים, לא נתון רשמי. בגיבוש האמיתי שוקלים גם התנהגות בצוות וראיון.";
