import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHARE_LEVELS, type GibushContent, type Track } from "./types.ts";
import { evaluate, type Answers } from "./scoring.ts";

// The content lives on the server (paid users only); the test reads the same file the API serves.
const content: GibushContent = JSON.parse(
  readFileSync(new URL("../../../server/data/gibush-content.json", import.meta.url), "utf8"),
);

/** Pick, per stage, the option whose score is closest to the wanted one. */
function answersAt(track: Track, pick: (id: string) => number): Answers {
  const answers: Answers = {};
  for (const s of content.tracks[track].stages) {
    const want = pick(s.id);
    let best = 0;
    s.options.forEach((o, i) => {
      if (Math.abs(o.score - want) < Math.abs(s.options[best].score - want)) best = i;
    });
    answers[s.id] = best;
  }
  return answers;
}

test("a strong athlete reaches the top combat level", () => {
  const r = evaluate(
    content,
    "combat",
    "male",
    answersAt("combat", () => 3),
  );
  assert.equal(r.level, r.ladder.length - 1);
  assert.equal(r.outcome.status, "top");
  assert.equal(r.gaps.length, 0);
  assert.ok(r.overall >= 95);
});

test("a weak candidate is cut at the first run, with that reason", () => {
  const r = evaluate(
    content,
    "combat",
    "male",
    answersAt("combat", () => 0),
  );
  assert.equal(r.level, 0);
  assert.equal(r.outcome.status, "cut");
  assert.equal(r.outcome.clock, "06:10");
  const run2k = content.tracks.combat.stages.find((s) => s.id === "run2k")!;
  assert.equal(r.outcome.reason, run2k.cutReason);
});

test("a fast runner who cannot carry is cut at the sandbags", () => {
  const r = evaluate(
    content,
    "combat",
    "male",
    answersAt("combat", (id) => (id === "sandbag" ? 0 : 3)),
  );
  assert.equal(r.outcome.status, "cut");
  assert.equal(r.outcome.clock, "08:00");
  assert.equal(r.gaps[0].stage.id, "sandbag");
});

test("a slow 3 km keeps צנחנים but stops before קומנדו", () => {
  const r = evaluate(
    content,
    "combat",
    "male",
    answersAt("combat", (id) => (id === "run3k" ? 1 : 3)),
  );
  assert.equal(r.ladder[r.level].name, "צנחנים");
  assert.equal(r.outcome.status, "stopped");
  assert.equal(r.outcome.next, "קומנדו");
  assert.equal(r.outcome.place, "ריצת 3 ק״מ");
});

test("the pilot track scores on thinking, not running", () => {
  const thinking = new Set([
    "planning",
    "logic",
    "debrief",
    "memorize",
    "mapMemory",
    "playground",
    "debate",
  ]);
  const thinker = evaluate(
    content,
    "pilot",
    "male",
    answersAt("pilot", (id) => (thinking.has(id) ? 3 : id === "run1k" ? 2 : 1)),
  );
  const runner = evaluate(
    content,
    "pilot",
    "male",
    answersAt("pilot", (id) => (thinking.has(id) ? 0 : 3)),
  );
  assert.ok(thinker.overall > runner.overall, `${thinker.overall} vs ${runner.overall}`);
  assert.ok(thinker.level > runner.level);
});

test("girls never get a male-only level, and never see the men's numbers", () => {
  const maleOnly = /גולני|גבעתי|נח״ל|כפיר|צנחנים|מגלן|אגוז|דובדבן|שייטת|מטכ״ל|שלדג/;
  const strong = evaluate(
    content,
    "combat",
    "female",
    answersAt("combat", () => 3),
  );
  assert.equal(strong.ladder[strong.level].name, "669");
  for (const l of strong.ladder) assert.doesNotMatch(`${l.name} ${l.units}`, maleOnly);

  const weak = evaluate(
    content,
    "combat",
    "female",
    answersAt("combat", () => 0),
  );
  assert.equal(weak.outcome.status, "cut");
  const shown = [weak.outcome.reason, ...weak.gaps.map((g) => g.stage.bar!.label)].join(" ");
  assert.doesNotMatch(shown, /\d+:\d\d|ק״ג/);
});

test("every ladder name can be shared", () => {
  const names = new Set(SHARE_LEVELS.map((l) => l.name));
  for (const ladder of Object.values(content.ladders))
    for (const l of ladder) assert.ok(names.has(l.name), l.name);
});
