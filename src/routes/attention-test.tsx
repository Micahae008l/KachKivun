import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Share2, Sparkles } from "lucide-react";

const URL = "https://kachkivun.com/attention-test";
const TITLE = "מבחן קשב לצו ראשון: תרגול חינם של העיגול הירוק | קח כיוון";
const DESCRIPTION =
  "תרגול למבחן הקשב: צורות בצבעים מופיעות במרווחים לא קבועים, ולוחצים רק על עיגול ירוק. בסוף מקבלים ציון מ־1 עד 5, זמן תגובה וכמה פעמים לחצתם בטעות.";

export const Route = createFileRoute("/attention-test")({
  component: AttentionTestPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

type Shape = "circle" | "square" | "triangle";
/** `gapMs` is the dark screen after this shape; it varies, so the next one cannot be timed. */
type Stimulus = { shape: Shape; color: string; target: boolean; gapMs: number };
type Result = {
  hits: number;
  targets: number;
  falseTaps: number;
  distractors: number;
  avgMs: number | null;
  /** 1 to 5, the scale the army reports on. */
  grade: number;
};
type Phase = "intro" | "countdown" | "running" | "done";

const GREEN = "#4ade80";
const OTHER_COLORS = ["#f87171", "#60a5fa", "#facc15"];
const SHAPES: Shape[] = ["circle", "square", "triangle"];
const TRIALS = 40;
const TARGET_SHARE = 0.26;
/** A tap still counts for a shape this long after it disappears. */
const GRACE_MS = 250;

/** The last third is faster, the way attention tests get harder as you tire. */
const showMs = (index: number) => (index < TRIALS * 0.66 ? 800 : 650);

/**
 * The dark screen between shapes is deliberately uneven: usually short, sometimes a second or
 * two, and now and then long enough that attention drifts before the next shape.
 */
function randomGap() {
  const roll = Math.random();
  const between = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
  if (roll < 0.62) return between(300, 900);
  if (roll < 0.9) return between(1200, 2300);
  return between(2800, 4200);
}

/**
 * Targets are green circles. Most distractors share one feature with the target (a green
 * square, a red circle), because those are the ones that tempt a wrong tap.
 */
function buildSequence(): Stimulus[] {
  const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
  const sequence: Stimulus[] = [];
  let lastWasTarget = false;
  for (let i = 0; i < TRIALS; i++) {
    const target: boolean = !lastWasTarget && Math.random() < TARGET_SHARE * 1.25;
    if (target) {
      sequence.push({ shape: "circle", color: GREEN, target: true, gapMs: randomGap() });
    } else {
      const kind = Math.random();
      sequence.push(
        kind < 0.35
          ? {
              shape: pick(["square", "triangle"] as Shape[]),
              color: GREEN,
              target: false,
              gapMs: randomGap(),
            }
          : kind < 0.7
            ? { shape: "circle", color: pick(OTHER_COLORS), target: false, gapMs: randomGap() }
            : { shape: pick(SHAPES), color: pick(OTHER_COLORS), target: false, gapMs: randomGap() },
      );
    }
    lastWasTarget = target;
  }
  return sequence;
}

function gradeFor(accuracy: number) {
  if (accuracy >= 0.9) return 5;
  if (accuracy >= 0.75) return 4;
  if (accuracy >= 0.55) return 3;
  if (accuracy >= 0.35) return 2;
  return 1;
}

const GRADE_LABEL: Record<number, string> = {
  5: "קשב חד. כמעט לא פספסתם ולא לחצתם בטעות.",
  4: "ממוקדים. כמה החלקות, בעיקר אחרי מסך כהה ארוך.",
  3: "סביר. הקשב נדד בחלק מהזמן.",
  2: "הקשב ברח לא מעט. ההמתנות הארוכות הן המקום שבו זה קורה.",
  1: "הפעם זה לא הלך. שווה לנסות שוב אחרי הפסקה.",
};

function ShapeSvg({ stimulus }: { stimulus: Stimulus }) {
  return (
    <svg viewBox="0 0 100 100" className="h-40 w-40 sm:h-48 sm:w-48" aria-hidden>
      {stimulus.shape === "circle" ? (
        <circle cx="50" cy="50" r="42" fill={stimulus.color} />
      ) : stimulus.shape === "square" ? (
        <rect x="10" y="10" width="80" height="80" fill={stimulus.color} />
      ) : (
        <polygon points="50,8 94,90 6,90" fill={stimulus.color} />
      )}
    </svg>
  );
}

function AttentionTestPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(3);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState<Stimulus | null>(null);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Trial bookkeeping lives in refs: taps must read the current trial without waiting for a render.
  const sequence = useRef<Stimulus[]>([]);
  const current = useRef(-1);
  const shownAt = useRef(0);
  const answered = useRef(false);
  // One wrong tap per dark screen is enough; mashing the screen should not count ten times.
  const tappedDark = useRef(false);
  const tally = useRef({ hits: 0, falseTaps: 0, times: [] as number[] });
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const finish = useCallback(() => {
    const targets = sequence.current.filter((s) => s.target).length;
    const distractors = sequence.current.length - targets;
    const { hits, falseTaps, times } = tally.current;
    const hitRate = targets ? hits / targets : 0;
    // Every non-target shape and every dark screen is a chance to tap by mistake.
    const chances = distractors + sequence.current.length;
    const falseRate = chances ? falseTaps / chances : 0;
    setResult({
      hits,
      targets,
      falseTaps,
      distractors,
      avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
      grade: gradeFor(hitRate - falseRate),
    });
    setVisible(null);
    setPhase("done");
  }, []);

  const runTrial = useCallback(
    (i: number) => {
      if (i >= sequence.current.length) return finish();
      current.current = i;
      answered.current = false;
      tappedDark.current = false;
      shownAt.current = performance.now();
      setIndex(i);
      setVisible(sequence.current[i]);
      timers.current.push(
        window.setTimeout(() => {
          setVisible(null);
          timers.current.push(window.setTimeout(() => runTrial(i + 1), sequence.current[i].gapMs));
        }, showMs(i)),
      );
    },
    [finish],
  );

  const start = useCallback(() => {
    clearTimers();
    sequence.current = buildSequence();
    tally.current = { hits: 0, falseTaps: 0, times: [] };
    current.current = -1;
    setResult(null);
    setCount(3);
    setPhase("countdown");
    [2, 1].forEach((n, step) =>
      timers.current.push(window.setTimeout(() => setCount(n), (step + 1) * 700)),
    );
    timers.current.push(
      window.setTimeout(() => {
        setPhase("running");
        runTrial(0);
      }, 2100),
    );
  }, [runTrial]);

  const tap = useCallback(() => {
    if (phase !== "running" || current.current < 0) return;
    const stimulus = sequence.current[current.current];
    const sinceShown = performance.now() - shownAt.current;
    if (sinceShown <= showMs(current.current) + GRACE_MS) {
      if (answered.current) return;
      answered.current = true;
      if (stimulus.target) {
        tally.current.hits += 1;
        tally.current.times.push(sinceShown);
        setFlash("good");
      } else {
        tally.current.falseTaps += 1;
        setFlash("bad");
      }
    } else {
      // A tap on the dark screen: nothing was there to tap.
      if (tappedDark.current) return;
      tappedDark.current = true;
      tally.current.falseTaps += 1;
      setFlash("bad");
    }
    timers.current.push(window.setTimeout(() => setFlash(null), 180));
  }, [phase]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.code !== "Space" || phase !== "running") return;
      event.preventDefault();
      tap();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, tap]);

  async function share() {
    if (!result) return;
    const text = `קיבלתי ${result.grade} מתוך 5 במבחן הקשב של קח כיוון. נראה אתכם עוקפים אותי:`;
    try {
      if (navigator.share) await navigator.share({ text, url: URL });
      else {
        await navigator.clipboard.writeText(`${text} ${URL}`);
        toast.success("הועתק. אפשר להדביק לחברים.");
      }
    } catch {
      // The share sheet was dismissed; nothing to do.
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-right sm:px-6 sm:py-12" dir="rtl">
      <header>
        <p className="font-mono text-xs tracking-widest text-primary uppercase">תרגול חינם</p>
        <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
          מבחן הקשב: לוחצים רק על עיגול ירוק
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-[1.8] text-dust">
          בצו הראשון יש מבחן קשב ממוחשב: צורות בצבעים שונים מופיעות אחת אחרי השנייה, ולוחצים רק על
          אחת מהן, במרווחים לא קבועים. כאן מתרגלים אותו בדקה וחצי, עם ציון מ־1 עד 5.
        </p>
      </header>

      <section
        className={`mt-6 border bg-card transition-colors duration-150 ${
          flash === "good"
            ? "border-primary"
            : flash === "bad"
              ? "border-destructive"
              : "border-iron/30"
        }`}
        aria-live="polite"
      >
        {phase === "running" ? (
          <div className="h-1 bg-iron/25">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${((index + 1) / TRIALS) * 100}%` }}
            />
          </div>
        ) : null}

        {phase === "intro" ? (
          <div className="flex flex-col items-center gap-5 p-6 text-center sm:p-10">
            <ShapeSvg stimulus={{ shape: "circle", color: GREEN, target: true, gapMs: 0 }} />
            <ul className="space-y-1.5 text-sm leading-6 text-foreground">
              <li>עיגול ירוק: לוחצים.</li>
              <li>כל דבר אחר, גם ריבוע ירוק וגם עיגול אדום: לא נוגעים.</li>
              <li>המרווחים לא קבועים: לפעמים המסך נשאר כהה כמה שניות. על מסך ריק לא לוחצים.</li>
              <li>40 צורות, בערך דקה וחצי.</li>
            </ul>
            <button
              type="button"
              onClick={start}
              className="inline-flex min-h-12 items-center rounded-md bg-primary px-8 text-base font-black text-primary-foreground transition hover:brightness-110 active:scale-[0.97]"
            >
              מתחילים
            </button>
            <p className="text-xs text-dust">במחשב אפשר ללחוץ גם על מקש הרווח.</p>
          </div>
        ) : null}

        {phase === "countdown" ? (
          <div className="flex h-80 items-center justify-center">
            <span className="font-mono text-8xl font-black tabular-nums text-primary">{count}</span>
          </div>
        ) : null}

        {phase === "running" ? (
          <button
            type="button"
            onPointerDown={tap}
            className="flex h-80 w-full touch-manipulation select-none items-center justify-center"
            aria-label="לחצו כשמופיע עיגול ירוק"
          >
            {visible ? <ShapeSvg stimulus={visible} /> : null}
          </button>
        ) : null}

        {phase === "done" && result ? (
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <p className="font-mono text-7xl font-black tabular-nums leading-none text-primary">
                {result.grade}
                <span className="text-3xl text-dust">/5</span>
              </p>
              <p className="max-w-sm pb-1 text-base font-bold leading-snug text-foreground">
                {GRADE_LABEL[result.grade]}
              </p>
            </div>
            <dl className="mt-6 grid grid-cols-3 divide-x divide-x-reverse divide-iron/25 border border-iron/25 text-center">
              <div className="p-3">
                <dt className="text-[11px] text-dust">עיגולים ירוקים שתפסתם</dt>
                <dd className="mt-1 font-mono text-xl font-black text-foreground">
                  {result.hits}/{result.targets}
                </dd>
              </div>
              <div className="p-3">
                <dt className="text-[11px] text-dust">לחיצות בטעות</dt>
                <dd className="mt-1 font-mono text-xl font-black text-foreground">
                  {result.falseTaps}
                </dd>
              </div>
              <div className="p-3">
                <dt className="text-[11px] text-dust">זמן תגובה ממוצע</dt>
                <dd className="mt-1 font-mono text-xl font-black text-foreground" dir="ltr">
                  {result.avgMs != null ? `${result.avgMs}ms` : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void share()}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110 active:scale-[0.97]"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                אתגרו חברים
              </button>
              <button
                type="button"
                onClick={start}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/60 px-5 text-sm font-bold text-primary transition hover:bg-primary/10 active:scale-[0.97]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                עוד סיבוב
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {phase === "done" ? (
        <aside className="mt-6 border border-primary/40 bg-primary/10 p-5 sm:p-6">
          <h2 className="text-lg font-black text-foreground">קשב הוא רק נתון אחד</h2>
          <p className="mt-2 text-sm leading-6 text-dust">
            שאלון אישי אחד מצליב את הדפ״ר, הפרופיל, ציוני המא״ה ומה שחשוב לכם מול יותר מ־300
            תפקידים, ומחזיר 5 התאמות עם הסבר. מתחילים בחינם.
          </p>
          <Link
            to="/post-signup"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            בדקו התאמה בחינם
          </Link>
        </aside>
      ) : null}

      <section className="mt-10 space-y-4 text-base leading-[1.85] text-foreground/85">
        <h2 className="text-2xl font-black text-foreground">מה המבחן הזה בודק</h2>
        <p>
          הוא לא בודק ידע. הוא בודק שני דברים: אם אתם שמים לב לכל מה שצריך לאורך זמן, ואם אתם
          מצליחים לא ללחוץ כשלא צריך. לכן יש כאן שני סוגי טעויות, פספוס של עיגול ירוק ולחיצה על משהו
          אחר או על מסך ריק, והציון יורד על שניהם. החלק הקשה הוא ההמתנה: כשהמסך נשאר כהה כמה שניות
          הראש נודד, והצורה הבאה תופסת אתכם לא מוכנים.
        </p>
        <h2 className="pt-2 text-2xl font-black text-foreground">איך להשתפר</h2>
        <ul className="space-y-2 pr-5">
          <li className="list-disc marker:text-primary/70">
            לישון. עייפות פוגעת בקשב יותר מבכל מבחן אחר בצו הראשון.
          </li>
          <li className="list-disc marker:text-primary/70">
            לא למהר. לחיצה מהירה על ריבוע ירוק עולה יותר מלחיצה איטית על עיגול ירוק.
          </li>
          <li className="list-disc marker:text-primary/70">
            לשים את הטלפון במצב שקט ולשבת בחדר בלי מסך אחר.
          </li>
        </ul>
        <p className="border-r-2 border-primary bg-primary/5 p-4 text-sm leading-7">
          זה תרגול ולא המבחן הרשמי. הוא בנוי לפי תיאור של מי שעבר את המבחן, והציון כאן אינו ציון
          צבאי ואינו מנבא את מדד הקשב שתקבלו, גם אם הוא על אותו סולם של 1 עד 5. כל מה שקורה בצו
          הראשון, במדריך{" "}
          <Link
            to="/blog/$slug"
            params={{ slug: "צו-ראשון" }}
            className="font-semibold text-primary underline underline-offset-4"
          >
            צו ראשון
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
