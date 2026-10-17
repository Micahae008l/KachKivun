import {
  ladderFor,
  stageFor,
  type Gender,
  type GibushContent,
  type Level,
  type Stage,
  type Track,
} from "./types.ts";

/** Stage id to chosen option index. */
export type Answers = Record<string, number>;

export type Gap = { stage: Stage; yours: string; deficit: number };
export type PlanBlock = { range: string; title: string; items: string[] };

/**
 * cut: did not reach the first screening level at all.
 * stopped: reached a level, and `next` names the one they stopped short of.
 * top: reached the top of the ladder.
 */
export type Outcome = {
  status: "cut" | "stopped" | "top";
  clock: string;
  place: string;
  reason: string;
  next?: string;
};

export type GibushResult = {
  ratings: { key: string; label: string; value: number }[];
  overall: number;
  ladder: Level[];
  level: number;
  outcome: Outcome;
  gaps: Gap[];
  weeks: number;
  plan: PlanBlock[];
};

export function scoreOf(stage: Stage, answers: Answers): number {
  const i = answers[stage.id];
  return i == null ? 0 : (stage.options[i]?.score ?? 0);
}

/** 0 to 3 averaged onto a card scale of 40 to 99, so nobody gets a humiliating single digit. */
const toCard = (avg: number) => Math.round(40 + (59 * avg) / 3);

/** Running readiness 0 to 100 over the stages answered so far. */
export function readiness(stages: Stage[], answers: Answers): number {
  const done = stages.filter((s) => answers[s.id] != null);
  if (!done.length) return 0;
  return Math.round(
    (done.reduce((sum, s) => sum + scoreOf(s, answers), 0) / (done.length * 3)) * 100,
  );
}

/** Candidates still in after the stage at `index` (inclusive). */
export function candidatesLeft(start: number, stages: Stage[], index: number): number {
  return start - stages.slice(0, index + 1).reduce((sum, s) => sum + s.drop, 0);
}

function meets(level: Level, stages: Stage[], answers: Answers, overall: number) {
  return (
    overall >= level.minOverall &&
    stages.every((s) => scoreOf(s, answers) >= (level.need[s.id] ?? 0))
  );
}

export function evaluate(
  content: GibushContent,
  track: Track,
  gender: Gender,
  answers: Answers,
): GibushResult {
  const def = content.tracks[track];
  const stages = def.stages.map((s) => stageFor(s, gender));

  const ratings = def.ratings.map(({ key, label }) => {
    const own = stages.filter((s) => s.rating === key);
    const avg = own.reduce((sum, s) => sum + scoreOf(s, answers), 0) / Math.max(1, own.length);
    return { key, label, value: toCard(avg) };
  });
  const overall = Math.round(
    ratings.reduce((sum, r, i) => sum + r.value * def.ratings[i].weight, 0),
  );

  const ladder = ladderFor(content, track, gender);
  let level = 0;
  ladder.forEach((l, i) => {
    if (meets(l, stages, answers, overall)) level = i;
  });

  const last = stages[stages.length - 1];
  let outcome: Outcome;
  if (level === ladder.length - 1) {
    outcome = {
      status: "top",
      clock: last.clock,
      place: def.passTitle,
      reason: "עמדתם בכל הספים של היום. מכאן מחליטים הצוות והראיון.",
    };
  } else {
    const next = ladder[level + 1];
    // The first moment of the day, in clock order, that falls under the next level's bar.
    const stop = stages.find((s) => scoreOf(s, answers) < (next.need[s.id] ?? 0));
    outcome = {
      status: level === 0 ? "cut" : "stopped",
      next: next.name,
      clock: stop?.clock ?? last.clock,
      place: stop?.place ?? "סיכום המגבשים",
      reason: stop
        ? (stop.cutReason ?? `כאן המספרים שלכם עוד מתחת לרף של ${next.name}.`)
        : "עמדתם בכל ספי הכושר, אבל לא בלטתם באף אחד מהם. המגבשים מחפשים מי שנותן יותר כשקשה.",
    };
  }

  const gaps = stages
    .filter((s) => s.bar && scoreOf(s, answers) < s.bar.score)
    .map((s) => ({
      stage: s,
      yours: s.options[answers[s.id]]?.label ?? "לא ענית",
      deficit: (s.bar?.score ?? 0) - scoreOf(s, answers),
    }))
    .sort((a, b) => b.deficit - a.deficit);

  const weeksStage = stages.find((s) => s.id === "weeks");
  const weeks = (weeksStage && weeksStage.options[answers.weeks]?.weeks) || 4;

  return { ratings, overall, ladder, level, outcome, gaps, weeks, plan: buildPlan(weeks, gaps) };
}

/** Base volume first, then intensity in screening conditions, then a lighter last week. */
export function buildPlan(weeks: number, gaps: Gap[]): PlanBlock[] {
  const drills = gaps.slice(0, 3).map((g) => g.stage.bar!.drill);
  if (!drills.length) {
    drills.push([
      "לשמור על 4 אימונים בשבוע, בלי להוסיף עומס",
      "אימון אחד בשבוע בתנאי גיבוש מלאים, עם צוות",
    ]);
  }
  const taper = {
    title: "הורדת עומס",
    items: [
      "שני אימונים קצרים בקצב הגיבוש, לא יותר",
      "שינה, אוכל ומים. לא מנסים שיא חדש בשבוע האחרון",
    ],
  };
  if (weeks <= 2) return [{ range: "השבוע", ...taper }];

  const base = Math.ceil((weeks - 1) / 2);
  const blocks: PlanBlock[] = [
    { range: span(1, base), title: "בסיס ונפח", items: drills.map((d) => d[0]) },
  ];
  if (weeks - 1 > base) {
    blocks.push({
      range: span(base + 1, weeks - 1),
      title: "עצימות ותנאי גיבוש",
      items: drills.map((d) => d[1]),
    });
  }
  blocks.push({ range: `שבוע ${weeks}`, ...taper });
  return blocks;
}

const span = (a: number, b: number) => (a === b ? `שבוע ${a}` : `שבועות ${a} עד ${b}`);
