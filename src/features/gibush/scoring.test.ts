import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHARE_LEVELS, type GibushContent } from "./types.ts";
import { answerOrder, evaluate, type Answers } from "./scoring.ts";

// The content lives on the server (paid users only); the test reads the same file the API serves.
const content: GibushContent = JSON.parse(
  readFileSync(new URL("../../../server/data/gibush-content.json", import.meta.url), "utf8"),
);
const stages = content.day.stages;
const THINKING = new Set(["playground", "memorize", "planning", "logic", "debrief"]);

/** Pick, per stage, the option whose score is closest to the wanted one. */
function answersAt(pick: (id: string) => number): Answers {
  const answers: Answers = {};
  for (const s of stages) {
    const want = pick(s.id);
    let best = 0;
    s.options.forEach((o, i) => {
      if (Math.abs(o.score - want) < Math.abs(s.options[best].score - want)) best = i;
    });
    answers[s.id] = best;
  }
  return answers;
}

test("a strong athlete reaches the elite units", () => {
  const r = evaluate(
    content,
    "male",
    answersAt(() => 3),
  );
  assert.equal(r.ladder[r.level].name, "סיירות עילית");
  assert.equal(r.outcome.status, "top");
  assert.match(r.units, /שייטת 13/);
  assert.equal(r.gaps.length, 0);
  assert.ok(r.overall >= 95);
});

test("a weak candidate is cut at the first run, with that reason", () => {
  const r = evaluate(
    content,
    "male",
    answersAt(() => 0),
  );
  assert.equal(r.level, 0);
  assert.equal(r.outcome.status, "cut");
  assert.equal(r.outcome.clock, "06:10");
  assert.equal(r.outcome.reason, stages.find((s) => s.id === "run2k")!.cutReason);
});

test("a sharp thinker who cannot carry reaches flight, not the commando units", () => {
  const r = evaluate(
    content,
    "male",
    answersAt((id) => (THINKING.has(id) ? 3 : id === "sandbag" ? 0 : 1)),
  );
  assert.equal(r.ladder[r.level].name, "סיירות עילית");
  assert.match(r.units, /טיס/);
  assert.doesNotMatch(r.units, /שייטת|מטכ״ל/);
  assert.doesNotMatch(r.outcome.reason, /בכל הספים/);
  assert.ok(r.gaps.some((g) => g.stage.id === "sandbag"));
});

test("a slow 3 km keeps the infantry brigades but stops before the brigade recon units", () => {
  const r = evaluate(
    content,
    "male",
    answersAt((id) => (THINKING.has(id) ? 0 : id === "run3k" ? 1 : 3)),
  );
  assert.equal(r.ladder[r.level].name, "חטיבות החי״ר");
  assert.equal(r.outcome.status, "stopped");
  assert.equal(r.outcome.next, "סיירות חטיבתיות");
  assert.equal(r.outcome.place, "ריצת 3 ק״מ");
});

test("girls never get a male-only unit, and never see the men's numbers", () => {
  const maleOnly = /גולני|גבעתי|נח״ל|כפיר|צנחנים|מגלן|אגוז|דובדבן|שייטת|מטכ״ל|שלדג/;
  const strong = evaluate(
    content,
    "female",
    answersAt(() => 3),
  );
  assert.equal(strong.ladder[strong.level].name, "סיירות עילית");
  assert.match(strong.units, /669/);
  for (const l of strong.ladder)
    assert.doesNotMatch(`${l.name} ${l.units} ${l.alt?.units ?? ""}`, maleOnly);

  const weak = evaluate(
    content,
    "female",
    answersAt(() => 0),
  );
  assert.equal(weak.outcome.status, "cut");
  const shown = [weak.outcome.reason, ...weak.gaps.map((g) => g.target)].join(" ");
  assert.doesNotMatch(shown, /\d+:\d\d|ק״ג/);
});

test("a day that stops on a judgment moment explains that answer and shows it as a gap", () => {
  const keepPace = stages.find((s) => s.id === "keepPace")!;
  const watch = keepPace.options.findIndex((o) => o.label.startsWith("מסתכלים"));
  const answers = { ...answersAt((id) => (THINKING.has(id) ? 0 : 3)), keepPace: watch };
  const r = evaluate(content, "female", answers);
  assert.equal(r.outcome.status, "stopped");
  assert.equal(r.outcome.reason, keepPace.options[watch].why);
  assert.ok(r.gaps.some((g) => g.stage.id === "keepPace"));
});

test("every ladder name can be shared", () => {
  for (const ladder of Object.values(content.ladders))
    for (const l of ladder) assert.ok(SHARE_LEVELS.includes(l.name), l.name);
});

test("judgment answers are shuffled, the same way every time, and the best is not always first", () => {
  const judged = stages.filter((s) => s.shuffle);
  const bestAt = judged.map((s) => {
    const order = answerOrder(s);
    assert.deepEqual(
      [...order].sort(),
      s.options.map((_, i) => i),
    );
    assert.deepEqual(order, answerOrder(s));
    const max = Math.max(...s.options.map((o) => o.score));
    return order.findIndex((i) => s.options[i].score === max);
  });
  // Spread over the positions, so no single letter is the safe guess.
  for (let pos = 0; pos < 4; pos++)
    assert.ok(bestAt.filter((p) => p === pos).length <= judged.length / 2, bestAt.join(""));
  assert.ok(new Set(bestAt).size >= 3, bestAt.join(""));
});
