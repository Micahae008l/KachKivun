import { stageFor, type Gender, type GibushContent, type Level, type Stage } from "./types.ts";

/** Stage id to chosen option index. */
export type Answers = Record<string, number>;

/** target: the bar for measured moments, the answer the screeners look for on judgment ones. */
export type Gap = { stage: Stage; yours: string; target: string; deficit: number };
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
  /** The units the level opens: the flight or navy course when it was reached that way. */
  units: string;
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

/** Candidates still in after the stage at `index` (inclusive). */
export function candidatesLeft(start: number, stages: Stage[], index: number): number {
  return start - stages.slice(0, index + 1).reduce((sum, s) => sum + s.drop, 0);
}

type Route = { units: string; need: Record<string, number>; minOverall: number };

/** The ways into a level: its main bar, and the flight/navy one when it has it. */
const routes = (l: Level): Route[] => (l.alt ? [l, l.alt] : [l]);

export function evaluate(content: GibushContent, gender: Gender, answers: Answers): GibushResult {
  const def = content.day;
  const stages = def.stages.map((s) => stageFor(s, gender));

  const ratings = def.ratings.map(({ key, label }) => {
    const own = stages.filter((s) => s.rating === key);
    const avg = own.reduce((sum, s) => sum + scoreOf(s, answers), 0) / Math.max(1, own.length);
    return { key, label, value: toCard(avg) };
  });
  const overall = Math.round(
    ratings.reduce((sum, r, i) => sum + r.value * def.ratings[i].weight, 0),
  );

  const unmet = (r: Route) => stages.filter((s) => scoreOf(s, answers) < (r.need[s.id] ?? 0));
  const meets = (r: Route) => overall >= r.minOverall && unmet(r).length === 0;

  const ladder = content.ladders[gender];
  let level = 0;
  ladder.forEach((l, i) => {
    if (routes(l).some(meets)) level = i;
  });
  const via = routes(ladder[level]).find(meets) ?? ladder[level];
  const units = via.units;

  const last = stages[stages.length - 1];
  // Toward the next level, the way that is closer: the main bar or the flight/navy one.
  const next = ladder[level + 1];
  const toward = next
    ? routes(next).reduce((a, b) => (unmet(b).length < unmet(a).length ? b : a))
    : undefined;
  let outcome: Outcome;
  if (level === ladder.length - 1) {
    outcome = {
      status: "top",
      clock: last.clock,
      place: def.passTitle,
      reason:
        via === ladder[level]
          ? "עמדתם בכל הספים של היום. מכאן מחליטים הצוות והראיון."
          : `עמדתם בספים של ${units}. לשאר היחידות ברמה הזאת צריך גם את הכושר והסחיבה שלמטה.`,
    };
  } else {
    // The first moment of the day, in clock order, that falls under the next level's bar.
    const stop = unmet(toward!)[0];
    outcome = {
      status: level === 0 ? "cut" : "stopped",
      next: next.name,
      clock: stop?.clock ?? last.clock,
      place: stop?.place ?? "סיכום המגבשים",
      // The chosen answer's own reason first: a stage-wide reason can describe a different answer.
      reason: stop
        ? (stop.options[answers[stop.id]]?.why ??
          stop.cutReason ??
          `כאן המספרים שלכם עוד מתחת לרף של ${next.name}.`)
        : "עמדתם בכל ספי הכושר, אבל לא בלטתם באף אחד מהם. המגבשים מחפשים מי שנותן יותר כשקשה.",
    };
  }

  // Measured moments against their bar; judgment moments (no bar) against the next level's need,
  // so a day that stopped on one never reads "no gap".
  const gaps = stages
    .map((s) => {
      const need = s.bar ? s.bar.score : (toward?.need[s.id] ?? 0);
      const best = s.options.reduce((a, o) => (o.score > a.score ? o : a), s.options[0]);
      return {
        stage: s,
        yours: s.options[answers[s.id]]?.label ?? "לא ענית",
        target: s.bar?.label ?? best.label,
        deficit: need - scoreOf(s, answers),
      };
    })
    .filter((g) => g.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit);

  const weeksStage = stages.find((s) => s.id === "weeks");
  const weeks = (weeksStage && weeksStage.options[answers.weeks]?.weeks) || 4;

  return {
    ratings,
    overall,
    ladder,
    level,
    units,
    outcome,
    gaps,
    weeks,
    plan: buildPlan(weeks, gaps),
  };
}

/** Base volume first, then intensity in screening conditions, then a lighter last week. */
export function buildPlan(weeks: number, gaps: Gap[]): PlanBlock[] {
  const drills = gaps
    .filter((g) => g.stage.bar)
    .slice(0, 3)
    .map((g) => g.stage.bar!.drill);
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

/** Display order of a moment's answers: shuffled for judgment moments, the same on every visit. */
export function answerOrder(stage: Pick<Stage, "id" | "shuffle" | "options">): number[] {
  const order = stage.options.map((_, i) => i);
  if (!stage.shuffle) return order;
  let h = [...stage.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (let i = order.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = (h >>> 16) % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
