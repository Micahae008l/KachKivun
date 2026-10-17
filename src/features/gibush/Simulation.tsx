import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Users } from "lucide-react";
import { progressBarProps } from "@/lib/a11y";
import { stageFor, type Gender, type GibushContent, type Stage, type Track } from "./types";
import { candidatesLeft, readiness, type Answers } from "./scoring";

const LETTERS = ["א", "ב", "ג", "ד"];
const ease = [0.16, 1, 0.3, 1] as const;

/** The screening day, one moment at a time. The clock, the counter and the meter move with it. */
export function Simulation({
  content,
  track,
  gender,
  onDone,
  onExit,
}: {
  content: GibushContent;
  track: Track;
  gender: Gender;
  onDone: (answers: Answers) => void;
  onExit: () => void;
}) {
  const { title } = content.tracks[track];
  const stages = useMemo(
    () => content.tracks[track].stages.map((s) => stageFor(s, gender)),
    [content, track, gender],
  );
  const start = content.startCandidates;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const reduce = useReducedMotion();
  const advancing = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stage = stages[step];
  const left = step === 0 ? start : candidatesLeft(start, stages, step - 1);
  const meter = readiness(stages, answers);

  // Keyboard and screen reader users land on the new moment, not the old button.
  useEffect(() => {
    if (step > 0) headingRef.current?.focus({ preventScroll: true });
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

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_13rem]">
      <section aria-label={title} className="min-w-0">
        {/* HUD: clock, who is still in, readiness */}
        <div className="border border-iron/30 bg-card/90 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] tracking-wide text-dust">{title}</p>
              <p
                className="font-mono text-4xl font-black leading-none text-foreground sm:text-5xl"
                dir="ltr"
              >
                {stage.clock}
              </p>
            </div>
            <div className="text-left" aria-live="polite">
              <p className="flex items-center justify-end gap-1.5 text-[11px] text-dust">
                <Users className="h-3.5 w-3.5" aria-hidden />
                נשארו
              </p>
              <p className="font-mono text-2xl font-black leading-none text-primary" dir="ltr">
                <motion.span
                  key={left}
                  initial={reduce ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-block"
                >
                  {left}
                </motion.span>
                <span className="text-sm text-dust">/{start}</span>
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="shrink-0 text-[11px] text-dust">מוכנות</span>
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15"
              {...progressBarProps(meter, "מוכנות")}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${meter}%` }}
              />
            </div>
            <span className="w-9 shrink-0 font-mono text-xs text-foreground" dir="ltr">
              {meter}%
            </span>
          </div>
          {/* Mobile timeline: one tick per moment */}
          <div className="mt-3 flex gap-1 lg:hidden" aria-hidden>
            {stages.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 flex-1 rounded-full ${i < step ? "bg-primary/70" : i === step ? "bg-primary" : "bg-iron/30"}`}
              />
            ))}
          </div>
        </div>

        {/* Enter-only: an exit animation can strand the screen blank on fast taps. */}
        <motion.div
          key={stage.id}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.32, ease }}
          className="mt-4"
        >
          <Moment
            stage={stage}
            step={step}
            total={stages.length}
            selected={answers[stage.id]}
            onChoose={choose}
            headingRef={headingRef}
          />
        </motion.div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === 0 ? onExit() : setStep(step - 1))}
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-dust transition hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
            {step === 0 ? "חזרה לבחירת מסלול" : "רגע אחורה"}
          </button>
          <span className="font-mono text-xs text-dust" dir="ltr">
            {step + 1}/{stages.length}
          </span>
        </div>
      </section>

      {/* Desktop timeline */}
      <aside aria-hidden className="hidden lg:block">
        <ol className="relative space-y-0 border-s border-iron/30 ps-4">
          {stages.map((s, i) => (
            <li key={s.id} className="relative py-1.5">
              <span
                className={`absolute -start-[1.3rem] top-3 h-2 w-2 rounded-full ${
                  i < step
                    ? "bg-primary/70"
                    : i === step
                      ? "bg-primary ring-4 ring-primary/20"
                      : "bg-iron/40"
                }`}
              />
              <span
                className={`font-mono text-xs ${i === step ? "text-primary" : i < step ? "text-foreground/70" : "text-dust/60"}`}
                dir="ltr"
              >
                {s.clock}
              </span>
              <span
                className={`ms-2 text-xs ${i === step ? "font-bold text-foreground" : "text-dust/70"}`}
              >
                {s.place}
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

/** One moment of the day. Also rendered, blurred and inert, in the locked teaser. */
export function Moment({
  stage,
  step,
  total,
  selected,
  onChoose,
  headingRef,
}: {
  stage: Pick<Stage, "clock" | "place" | "scene" | "question" | "options">;
  step: number;
  total: number;
  selected?: number;
  onChoose?: (index: number) => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="border border-iron/30 bg-card p-4 sm:p-6">
      <p className="font-mono text-[11px] tracking-wide text-primary">
        <span dir="ltr">{stage.clock}</span> · {stage.place}
        <span className="sr-only">
          {" "}
          רגע {step + 1} מתוך {total}
        </span>
      </p>
      <p className="mt-3 text-sm leading-6 text-dust">{stage.scene}</p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 text-xl font-black leading-snug text-foreground outline-none sm:text-2xl"
      >
        {stage.question}
      </h2>
      <div className="mt-5 grid gap-2 sm:grid-cols-2" role="group" aria-label={stage.question}>
        {stage.options.map((o, i) => {
          const on = selected === i;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onChoose?.(i)}
              aria-pressed={on}
              className={`flex min-h-12 items-center gap-3 border px-3 py-2.5 text-right text-sm font-semibold transition active:scale-[0.99] ${
                on
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-iron/40 bg-background/40 text-foreground hover:border-primary/60"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center font-mono text-xs ${
                  on ? "bg-primary text-primary-foreground" : "border border-iron/50 text-dust"
                }`}
                aria-hidden
              >
                {LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
