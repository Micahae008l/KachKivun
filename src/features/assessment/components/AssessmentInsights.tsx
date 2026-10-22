import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { animate, m, useInView, useReducedMotion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import {
  PROFILE_RUNGS,
  commitmentRows,
  daparDoors,
  dimensionRows,
  formatMonth,
  isCombatDesignatedMale,
  monthsUntil,
  nextSteps,
  wantsTech,
} from "../insights";
import type { AssessmentAnswers } from "../types";
import { YomRadar } from "./YomRadar";

const EASE = [0.22, 1, 0.36, 1] as const;
const num = (v: number | "unknown" | null) => (typeof v === "number" ? v : null);

// ---------- motion primitives ----------

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce) {
      el.textContent = String(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: EASE,
      onUpdate: (v) => (el.textContent = String(Math.round(v))),
    });
    return () => controls.stop();
  }, [inView, reduce, value]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {reduce ? value : 0}
    </span>
  );
}

/** Bar that grows to `pct` when scrolled into view. */
function Grow({ pct, delay = 0, className }: { pct: number; delay?: number; className: string }) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduce ? false : { width: 0 }}
      whileInView={{ width: `${pct}%` }}
      viewport={{ once: true }}
      style={reduce ? { width: `${pct}%` } : undefined}
      transition={{ duration: 0.9, delay, ease: EASE }}
    />
  );
}

function Card({
  kicker,
  title,
  children,
  className = "",
}: {
  kicker: string;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden border border-iron/25 bg-gradient-to-b from-card to-background/40 p-5 sm:p-7 ${className}`}
    >
      <p className="font-mono text-[11px] tracking-wide text-primary">{kicker}</p>
      <h3 className="mt-2 text-lg font-black leading-snug text-foreground sm:text-xl">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// ---------- 2. headline numbers ----------

export function ProfileHeadline({ answers }: { answers: AssessmentAnswers }) {
  const dapar = num(answers.daparScore);
  const medical = num(answers.medicalProfile);
  const doors = daparDoors(answers);
  const total = doors.reduce((s, d) => s + d.items.length, 0);
  const open =
    dapar == null
      ? 0
      : doors.filter((d) => dapar >= d.dapar).reduce((s, d) => s + d.items.length, 0);
  const rung = medical == null ? null : PROFILE_RUNGS.find((r) => medical >= r.profile);

  const tiles = [
    {
      label: "דפ״ר",
      value: dapar,
      note:
        dapar == null
          ? "לא ידוע עדיין"
          : total
            ? `${open} מתוך ${total} השערים שבחרתם פתוחים`
            : "מעל הממוצע הוא 50",
    },
    { label: "פרופיל", value: medical, note: rung ? rung.opens : "לא ידוע עדיין" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {tiles.map((t, i) => (
        <Reveal key={t.label} delay={0.08 * i}>
          <div className="h-full border border-iron/25 bg-card/70 p-4 sm:p-5">
            <p className="text-xs text-dust">{t.label}</p>
            <p className="mt-1 font-mono text-4xl font-black leading-none text-primary">
              {t.value == null ? "—" : <CountUp value={t.value} />}
            </p>
            <p className="mt-2 text-xs leading-5 text-foreground/80">{t.note}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// ---------- 3. דפ"ר doors ----------

const DAPAR_MIN = 10;
const DAPAR_MAX = 90;
const daparPct = (value: number) => ((value - DAPAR_MIN) / (DAPAR_MAX - DAPAR_MIN)) * 100;

export function DaparDoorsCard({ answers }: { answers: AssessmentAnswers }) {
  const reduce = useReducedMotion();
  const dapar = num(answers.daparScore);
  const medical = num(answers.medicalProfile);
  const doors = daparDoors(answers);
  if (!doors.length) return null;
  const combatMale = isCombatDesignatedMale(answers) && wantsTech(answers);
  const openCount = dapar == null ? 0 : doors.filter((door) => dapar >= door.dapar).length;

  return (
    <Card
      kicker="השערים לפי דפ״ר"
      title={
        dapar == null
          ? "אלה השערים בכיוונים שבחרתם"
          : `עם דפ״ר ${dapar}, זה מה שנפתח בכיוונים שבחרתם`
      }
    >
      {combatMale ? (
        <div className="mb-5 border-r-2 border-amber-400 bg-amber-400/10 p-3 text-sm leading-6 text-foreground">
          <strong>פרופיל {medical} = ייעוד ללוחמה.</strong> לטכנולוגיה מגיעים רק דרך מיונים שמקבלים
          פרופיל קרבי, והמכסות שם מצומצמות.
        </div>
      ) : null}

      {/* One 10 to 90 scale: where you stand, and the score each door needs. */}
      <div className="px-2 pt-8" dir="ltr" aria-hidden>
        <div className="relative h-2 rounded-full bg-primary/15">
          {dapar != null ? (
            <m.div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              initial={reduce ? false : { width: 0 }}
              whileInView={{ width: `${daparPct(dapar)}%` }}
              viewport={{ once: true }}
              style={reduce ? { width: `${daparPct(dapar)}%` } : undefined}
              transition={{ duration: 0.9, ease: EASE }}
            />
          ) : null}
          {doors.map((door) => (
            <span
              key={door.dapar}
              className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card ${
                dapar != null && dapar >= door.dapar ? "bg-primary" : "bg-iron/70"
              }`}
              style={{ left: `${daparPct(door.dapar)}%` }}
            />
          ))}
          {dapar != null ? (
            <span
              className="absolute -top-8 -translate-x-1/2 whitespace-nowrap rounded-sm bg-foreground px-2 py-0.5 text-[11px] font-black text-background"
              style={{ left: `${Math.min(90, Math.max(10, daparPct(dapar)))}%` }}
              dir="rtl"
            >
              אתם · {dapar}
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 flex justify-between font-mono text-[11px] text-dust">
          <span>10</span>
          <span>50</span>
          <span>90</span>
        </div>
      </div>

      {dapar != null ? (
        <p className="mt-5 text-sm text-dust">
          <strong className="text-base font-black text-foreground">{openCount}</strong> מתוך{" "}
          {doors.length} השערים בכיוונים שלכם פתוחים
        </p>
      ) : null}

      <ul className="mt-3 divide-y divide-iron/15 border border-iron/20">
        {doors.map((door, i) => {
          const open = dapar != null && dapar >= door.dapar;
          const gap = dapar == null ? null : door.dapar - dapar;
          return (
            <m.li
              key={door.dapar}
              initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
              whileInView={{ opacity: 1, transform: "translateY(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.05 * i, ease: EASE }}
              className={`flex items-start gap-3 p-3.5 ${open ? "bg-primary/[0.07]" : ""}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-black ${
                  open ? "bg-primary text-primary-foreground" : "bg-iron/20 text-dust"
                }`}
              >
                {door.dapar}
              </span>
              {/* Tag under the names, so long role names get the full row width. */}
              <div className="min-w-0 flex-1 pt-1.5">
                <ul className="space-y-0.5 text-sm leading-6">
                  {door.items.map((item) => (
                    <li key={item} className={open ? "text-foreground" : "text-dust"}>
                      {item}
                    </li>
                  ))}
                </ul>
                <span
                  className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    open ? "bg-primary/15 text-primary" : "bg-iron/20 text-dust"
                  }`}
                >
                  {open ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : (
                    <Lock className="h-3 w-3" aria-hidden />
                  )}
                  {open ? "פתוח לכם" : gap == null ? "לא ידוע" : `חסרות ${gap} נק׳`}
                </span>
              </div>
            </m.li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-5 text-dust">
        דפ״ר הוא רק השער. מעבר לו יש מיונים, ראיון וסיווג ביטחוני. מבחן חוזר אפשרי רק למי שיש לו 70
        ומטה.
      </p>
    </Card>
  );
}

// ---------- 5. מא"ה strengths ----------

export function StrengthsCard({ answers }: { answers: AssessmentAnswers }) {
  const source = answers.yomHameahSource;
  if (source !== "official" && source !== "self") return null;
  const { rows, flat } = dimensionRows(answers);
  const top = rows.filter((r) => r.top);
  return (
    <Card
      kicker={source === "official" ? "מא״ה · ציונים רשמיים" : "מא״ה · הערכה עצמית"}
      title={flat ? "כל הממדים שלכם באותה רמה" : "המפה של החוזקות שלכם"}
    >
      <div className="grid items-center gap-5 md:grid-cols-[1.1fr_1fr]">
        <YomRadar answers={answers} />
        {top.length ? (
          <ul className="space-y-2">
            {top.map((r, i) => (
              <Reveal key={r.key} delay={0.4 + 0.12 * i}>
                <li className="flex items-center gap-3 border border-primary/35 bg-primary/10 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary font-mono text-base font-black text-primary-foreground">
                    {r.score}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-foreground">{r.label}</span>
                    <span className="block text-xs text-dust">פותח: {r.opens}</span>
                  </span>
                </li>
              </Reveal>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-dust">
            אין ממד שבולט מעל השאר, אז ההתאמה תישען יותר על מה שסימנתם.
          </p>
        )}
      </div>
    </Card>
  );
}

// ---------- 6. commitment timeline ----------

export function CommitmentCard({ answers }: { answers: AssessmentAnswers }) {
  const rows = commitmentRows(answers);
  if (!rows.length) return null;
  const max = Math.max(36, ...rows.map((r) => r.mandatory + r.keva));
  const draft = new Date(answers.draftDate);
  return (
    <Card kicker="כמה זמן זה באמת" title={`מגיוס ב-${formatMonth(draft)}: מתי משתחררים בכל מסלול`}>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-dust">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-primary" aria-hidden />
          שירות חובה
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-primary/40" aria-hidden />
          שירות קבע
        </span>
      </div>
      <ul className="space-y-4">
        {rows.map((r, i) => (
          <li key={r.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-bold text-foreground">{r.label}</span>
              <span className="font-mono text-xs tabular-nums text-dust">
                שחרור {formatMonth(r.release)}
                {r.keva ? ` · סוף קבע ${formatMonth(r.end)}` : ""}
              </span>
            </div>
            {/* Mandatory then career service, split by a 2px gap; rounded only at the far end. */}
            <div className="mt-2 flex h-2.5 gap-[2px]" aria-hidden>
              <Grow
                pct={(r.mandatory / max) * 100}
                delay={0.08 * i}
                className={`h-full bg-primary ${r.keva ? "" : "rounded-e-[4px]"}`}
              />
              {r.keva ? (
                <Grow
                  pct={(r.keva / max) * 100}
                  delay={0.08 * i + 0.45}
                  className="h-full rounded-e-[4px] bg-primary/40"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-5 text-dust">
        חובה: 32 חודשים לגברים ולתפקידי ״דין אישה כדין גבר״.
      </p>
    </Card>
  );
}

// ---------- 7. next steps (review step) ----------

export function NextStepsCard({ answers }: { answers: AssessmentAnswers }) {
  const reduce = useReducedMotion();
  const steps = useMemo(() => nextSteps(answers), [answers]);
  const draft = new Date(answers.draftDate);
  const months = Number.isNaN(draft.getTime()) ? 0 : Math.max(0, monthsUntil(draft));
  return (
    <Card
      kicker="הצעדים הבאים"
      title={months > 0 ? `${months} חודשים לגיוס. מה עושים עכשיו` : "מה עושים עכשיו"}
    >
      <ol className="space-y-2.5">
        {steps.map((step, i) => (
          <m.li
            key={step}
            initial={reduce ? false : { opacity: 0, transform: "translateY(8px)" }}
            whileInView={{ opacity: 1, transform: "translateY(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.06 * i, ease: EASE }}
            className="flex items-start gap-3 border border-iron/25 bg-background/40 px-3 py-2.5"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="text-sm leading-6 text-foreground">{step}</span>
          </m.li>
        ))}
      </ol>
    </Card>
  );
}
