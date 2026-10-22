import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { stageFor, type Gender, type GibushContent, type Stage } from "./types";
import { answerOrder, candidatesLeft, type Answers } from "./scoring";
import { backdropFor, partOfDay, type GibushPhoto } from "./photos";

const LETTERS = ["א", "ב", "ג", "ד"];
const KEYS = [
  ["1", "א"],
  ["2", "ב"],
  ["3", "ג"],
  ["4", "ד"],
];
const ease = [0.16, 1, 0.3, 1] as const;

/** `bib`: the number on the chest, kept with the run so a reload shows the same one. */
export type RunState = { step: number; answers: Answers; bib?: number };

/** The screening day, one moment at a time. The light behind it and the questions below move with it. */
export function Simulation({
  content,
  gender,
  initial,
  onProgress,
  onDone,
  onExit,
}: {
  content: GibushContent;
  gender: Gender;
  initial?: RunState;
  onProgress: (run: RunState) => void;
  onDone: (answers: Answers) => void;
  onExit: () => void;
}) {
  const { title } = content.day;
  const stages = useMemo(
    () => content.day.stages.map((s) => stageFor(s, gender)),
    [content, gender],
  );
  const start = content.startCandidates;
  const [step, setStep] = useState(() => Math.min(initial?.step ?? 0, stages.length - 1));
  const [answers, setAnswers] = useState<Answers>(initial?.answers ?? {});
  const [bib] = useState(() => initial?.bib ?? 1 + Math.floor(Math.random() * start));
  const reduce = useReducedMotion();
  const advancing = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stage = stages[step];
  const prev = stages[step - 1];
  const left = step === 0 ? start : candidatesLeft(start, stages, step - 1);
  const order = useMemo(() => answerOrder(stage), [stage]);
  // Morning, midday, afternoon: the run says where in the day you are instead of a clock.
  const parts = useMemo(() => {
    const out: { name: string; from: number; to: number }[] = [];
    stages.forEach((s, i) => {
      const name = partOfDay(s.clock);
      if (out[out.length - 1]?.name === name) out[out.length - 1].to = i + 1;
      else out.push({ name, from: i, to: i + 1 });
    });
    return out;
  }, [stages]);
  const photo = backdropFor(stage.clock);

  // Phones reload background tabs; the run picks up where it was.
  useEffect(() => onProgress({ step, answers, bib }), [step, answers, bib, onProgress]);

  // Focus mode: no site header or footer while the day runs.
  useEffect(() => {
    document.documentElement.dataset.run = "";
    return () => {
      delete document.documentElement.dataset.run;
    };
  }, []);

  // Each moment starts at the top, and keyboard and screen reader users land on it.
  useEffect(() => {
    if (step === 0) return;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function choose(index: number) {
    if (advancing.current) return;
    const next = { ...answers, [stage.id]: index };
    setAnswers(next);
    advancing.current = true;
    window.setTimeout(
      () => {
        advancing.current = false;
        if (step === stages.length - 1) onDone(next);
        else setStep(step + 1);
      },
      reduce ? 0 : 260,
    );
  }

  // The letters on the answers work as keys: 1 to 4, or א to ד.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const pos = KEYS.findIndex((k) => k.includes(e.key));
      if (pos >= 0 && pos < order.length) choose(order[pos]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="relative">
      <Backdrop photo={photo} />

      {/* A slim bar on top, the question alone in the middle, the day's questions along the
          bottom. The fighter card is the reward at the end, so it stays off screen. */}
      <div className="relative flex flex-col gap-5 lg:min-h-[calc(100dvh-5rem)] lg:gap-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 lg:gap-5">
            <Bib n={bib} />
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-sand lg:text-2xl">{stage.place}</p>
              <p className="text-sm text-sand-light lg:text-dust">{partOfDay(stage.clock)}</p>
            </div>
          </div>
          <Count left={left} start={start} prev={prev} />
        </header>

        {/* Enter-only: an exit animation can strand the screen blank on fast taps. */}
        <m.section
          key={stage.id}
          aria-label={title}
          className="min-w-0 lg:my-auto lg:w-full lg:max-w-[70rem] lg:self-center"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.32, ease }}
        >
          <Moment
            stage={stage}
            order={order}
            step={step}
            total={stages.length}
            selected={answers[stage.id]}
            onChoose={choose}
            headingRef={headingRef}
            big
            header={false}
          />
        </m.section>

        <footer className="space-y-3">
          <QuestionStrip
            stages={stages}
            parts={parts}
            step={step}
            answers={answers}
            onJump={setStep}
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => (step === 0 ? onExit() : setStep(step - 1))}
              className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-dust transition hover:text-foreground"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
              {step === 0 ? "חזרה למסך הפתיחה" : "רגע אחורה"}
            </button>
            <span className="hidden text-sm text-dust lg:inline">אפשר לענות גם במקשים 1 עד 4</span>
            {step > 0 ? (
              <button
                type="button"
                onClick={onExit}
                className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-dust transition hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
                יציאה
              </button>
            ) : null}
          </div>
          <p className="text-xs text-dust">{photo.caption}</p>
        </footer>
      </div>
    </div>
  );
}

/** The day's light behind the run: the whole screen on wide screens, a band across the top on phones. */
function Backdrop({ photo }: { photo: GibushPhoto }) {
  const reduce = useReducedMotion();
  const bg = (pct: number) => `color-mix(in oklch, var(--background) ${pct}%, transparent)`;
  return (
    <div
      className="pointer-events-none absolute -inset-x-4 -top-4 h-64 overflow-hidden sm:-inset-x-6 sm:-top-12 lg:fixed lg:inset-0 lg:h-auto"
      aria-hidden
    >
      <AnimatePresence initial={false}>
        <m.img
          key={photo.id}
          src={photo.src}
          srcSet={photo.srcSet}
          sizes="100vw"
          alt=""
          decoding="async"
          // Soft and dim: a sense of place behind the question, never a picture competing with it.
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-[2px] lg:blur-[5px]"
          style={{ objectPosition: photo.position }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.8 }}
        />
      </AnimatePresence>
      <div
        className="absolute inset-0 lg:hidden"
        style={{
          background: `linear-gradient(to top, var(--background) 4%, ${bg(60)} 55%, ${bg(40)})`,
        }}
      />
      <div
        className="absolute inset-0 hidden lg:block"
        style={{
          background: `radial-gradient(ellipse 55% 60% at 50% 50%, ${bg(90)}, ${bg(74)} 70%, ${bg(58)})`,
        }}
      />
    </div>
  );
}

/** The number on the chest, the way candidates wear it at a gibush. */
function Bib({ n }: { n: number }) {
  const pins = ["top-1 right-1", "top-1 left-1", "bottom-1 right-1", "bottom-1 left-1"];
  return (
    <div className="shrink-0">
      <span className="sr-only">המספר שלכם: {n}</span>
      <div
        className="relative flex h-[46px] w-[62px] -rotate-2 flex-col items-center justify-center bg-[oklch(0.90_0.015_85)] text-primary-foreground lg:h-[86px] lg:w-[120px] lg:justify-between lg:py-2"
        aria-hidden
      >
        {pins.map((p) => (
          <span
            key={p}
            className={`absolute h-1 w-1 rounded-full bg-background lg:h-1.5 lg:w-1.5 ${p}`}
          />
        ))}
        <span className="hidden text-xs font-bold lg:block">המספר שלכם</span>
        <span
          className="font-mono text-[26px] font-black leading-none tracking-tighter lg:text-[46px]"
          dir="ltr"
        >
          {n}
        </span>
      </div>
    </div>
  );
}

/** Who is still in, and who just left. */
function Count({ left, start, prev }: { left: number; start: number; prev?: Stage }) {
  const reduce = useReducedMotion();
  return (
    <div className="shrink-0 text-left">
      <p className="text-sm text-dust lg:text-[15px]" aria-live="polite">
        <span className="sr-only">מועמדים שנשארו: </span>
        <m.span
          key={left}
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block font-mono text-xl font-black text-primary lg:text-3xl"
          dir="ltr"
        >
          {left}
        </m.span>{" "}
        מתוך {start}
        <span className="hidden lg:inline"> נשארו</span>
      </p>
      {prev?.drop ? (
        <p className="text-xs text-dust lg:text-sm">
          <span className="font-bold text-rust">{prev.drop}</span> יצאו ב{prev.place}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The day's questions in order: the one you're on, the ones already answered (tap one to go back
 * to it), and the ones still ahead.
 */
function QuestionStrip({
  stages,
  parts,
  step,
  answers,
  onJump,
}: {
  stages: Stage[];
  parts: { name: string; from: number; to: number }[];
  step: number;
  answers: Answers;
  onJump: (index: number) => void;
}) {
  const cell = (i: number) => {
    const s = stages[i];
    const now = i === step;
    const done = answers[s.id] != null;
    return (
      <li key={s.id} className="min-w-0 flex-1">
        <button
          type="button"
          disabled={!now && !done}
          onClick={() => onJump(i)}
          aria-current={now ? "step" : undefined}
          aria-label={`רגע ${i + 1}: ${s.place}${done && !now ? ", נענה" : ""}`}
          title={s.place}
          className={`flex h-10 w-full items-center justify-center border font-mono text-sm transition lg:h-11 ${
            now
              ? "border-2 border-sand bg-sand/15 font-black text-foreground"
              : done
                ? "border-primary/40 bg-primary/10 text-primary hover:border-primary"
                : "cursor-default border-iron/25 text-dust/50"
          }`}
          dir="ltr"
        >
          {i + 1}
        </button>
      </li>
    );
  };
  return (
    <nav aria-label="השאלות של היום">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-bold text-sand">השאלות של היום</p>
        <p className="text-dust">
          אתם בשאלה <span className="font-bold text-foreground">{step + 1}</span> מתוך{" "}
          {stages.length}
        </p>
      </div>
      {/* Phones: all of them in two rows, so the current one is always in sight. */}
      <ol className="mt-2 grid grid-cols-10 gap-1.5 lg:hidden">{stages.map((_, i) => cell(i))}</ol>
      {/* Wide screens: one row, in the day's parts. */}
      <div className="mt-2 hidden gap-4 lg:flex">
        {parts.map((p) => (
          <div key={p.name} className="min-w-0" style={{ flexGrow: p.to - p.from, flexBasis: 0 }}>
            <p
              className={`mb-1.5 text-sm ${
                step >= p.from && step < p.to ? "font-bold text-foreground" : "text-dust"
              }`}
            >
              {p.name}
            </p>
            <ol className="flex gap-1.5">
              {Array.from({ length: p.to - p.from }, (_, j) => cell(p.from + j))}
            </ol>
          </div>
        ))}
      </div>
    </nav>
  );
}

/** One moment of the day. Also rendered, blurred and inert, in the locked teaser. */
export function Moment({
  stage,
  order,
  step,
  total,
  selected,
  onChoose,
  headingRef,
  big = false,
  header = true,
}: {
  stage: Pick<Stage, "place" | "scene" | "question" | "options">;
  /** Display order of the option indexes; the chosen index is always the original one. */
  order?: number[];
  step: number;
  total: number;
  selected?: number;
  onChoose?: (index: number) => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** The run itself: on wide screens no frame and larger type. The blurred teaser stays small. */
  big?: boolean;
  /** The moment's name on top. The run shows it in its own bar instead. */
  header?: boolean;
}) {
  const lg = (cls: string) => (big ? cls : "");
  const shown = order ?? stage.options.map((_, i) => i);
  return (
    <div
      className={`border border-iron/30 bg-card p-4 sm:p-8 ${lg("lg:border-0 lg:bg-transparent lg:p-0")}`}
    >
      {header ? (
        <p className="truncate text-lg font-black text-sand sm:text-xl">
          {stage.place}
          <span className="sr-only">
            {" "}
            רגע {step + 1} מתוך {total}
          </span>
        </p>
      ) : null}
      <p
        className={`text-sm leading-6 text-dust sm:text-lg sm:leading-8 ${header ? "mt-3 sm:mt-5" : ""} ${lg("lg:text-[22px] lg:leading-[1.8] lg:text-sand-light")}`}
      >
        {stage.scene}
      </p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className={`mt-2 text-xl font-black leading-snug text-foreground outline-none sm:mt-4 sm:text-4xl sm:leading-tight ${lg("lg:mt-3 lg:text-6xl lg:leading-[1.08]")}`}
      >
        {stage.question}
      </h2>
      <div
        className={`mt-4 grid gap-2 sm:mt-8 sm:grid-cols-2 sm:gap-3 ${lg("lg:mt-11 lg:gap-4")}`}
        role="group"
        aria-label={stage.question}
      >
        {shown.map((i, pos) => {
          const o = stage.options[i];
          const on = selected === i;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onChoose?.(i)}
              aria-pressed={on}
              className={`flex min-h-12 items-center gap-3 border px-3 py-2.5 text-right text-base font-bold leading-6 transition active:scale-[0.99] sm:min-h-16 sm:gap-4 sm:px-4 sm:py-4 sm:text-lg ${lg("lg:min-h-[84px] lg:px-6 lg:text-[22px]")} ${
                on
                  ? "border-primary bg-primary/15 text-foreground"
                  : `border-iron/40 bg-background/40 text-foreground hover:border-primary/60 ${lg("lg:border-iron/50 lg:bg-card/85")}`
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center font-mono text-xs sm:h-9 sm:w-9 sm:text-sm ${lg("lg:h-11 lg:w-11 lg:text-[15px]")} ${
                  on ? "bg-primary text-primary-foreground" : "border border-iron/50 text-dust"
                }`}
                aria-hidden
              >
                {LETTERS[pos]}
              </span>
              <span className="min-w-0 flex-1">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
