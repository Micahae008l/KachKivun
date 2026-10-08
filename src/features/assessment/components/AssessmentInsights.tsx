import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { Check, Lock, Sparkles } from "lucide-react";
import { COMBAT_PREFERENCE_OPTIONS, FOCUS_PREFERENCE_OPTIONS } from "@/lib/profile-preference-data";
import { BASE_OPTIONS, ENVIRONMENT_OPTIONS, LEADERSHIP_OPTIONS, ROLE_INTEREST_OPTIONS } from "../options";
import {
  HEBREW_MONTHS,
  PROFILE_RUNGS,
  commitmentRows,
  daparDoors,
  dimensionRows,
  draftRoadmap,
  formatMonth,
  isCombatDesignatedMale,
  monthsUntil,
  wantsCombat,
  wantsTech,
} from "../insights";
import type { AssessmentAnswers } from "../types";

const EASE = [0.22, 1, 0.36, 1] as const;
const num = (v: number | "unknown" | null) => (typeof v === "number" ? v : null);

// ---------- motion primitives ----------

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
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
    <motion.div
      className={className}
      initial={reduce ? false : { width: 0 }}
      whileInView={{ width: `${pct}%` }}
      viewport={{ once: true }}
      style={reduce ? { width: `${pct}%` } : undefined}
      transition={{ duration: 0.9, delay, ease: EASE }}
    />
  );
}

function Card({ kicker, title, children, className = "" }: { kicker: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`relative overflow-hidden border border-iron/25 bg-gradient-to-b from-card to-background/40 p-4 sm:p-6 ${className}`}>
      <p className="font-mono text-[10px] tracking-[0.25em] text-primary">{kicker}</p>
      <h3 className="mt-1.5 text-lg font-black leading-snug text-foreground sm:text-xl">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ---------- 1. what you told us ----------

function labelOf<T extends string>(options: readonly { value: T; label?: string; title?: string }[], value: T | "") {
  const o = options.find((x) => x.value === value);
  return o ? (o.label ?? o.title ?? "") : "";
}

export function AnswerEcho({ answers }: { answers: AssessmentAnswers }) {
  const reduce = useReducedMotion();
  const chips = [
    labelOf(COMBAT_PREFERENCE_OPTIONS, answers.combatPreference),
    labelOf(FOCUS_PREFERENCE_OPTIONS, answers.focus),
    ...answers.rolesInterested.filter((r) => r !== "undecided").map((r) => labelOf(ROLE_INTEREST_OPTIONS, r)),
    answers.basePreference && answers.basePreference !== "no_preference" ? labelOf(BASE_OPTIONS, answers.basePreference).split(":")[0] : "",
    answers.environment && answers.environment !== "no_preference" ? labelOf(ENVIRONMENT_OPTIONS, answers.environment) : "",
    answers.leadership ? labelOf(LEADERSHIP_OPTIONS, answers.leadership) : "",
  ].filter(Boolean);
  return (
    <div>
      <p className="text-xs text-dust">מה סימנתם עד עכשיו</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {chips.map((chip, i) => (
          <motion.li
            key={chip}
            initial={reduce ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i, duration: 0.35, ease: EASE }}
            className="border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground"
          >
            {chip}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 2. headline numbers ----------

export function ProfileHeadline({ answers }: { answers: AssessmentAnswers }) {
  const dapar = num(answers.daparScore);
  const medical = num(answers.medicalProfile);
  const doors = daparDoors(answers);
  const total = doors.reduce((s, d) => s + d.items.length, 0);
  const open = dapar == null ? 0 : doors.filter((d) => dapar >= d.dapar).reduce((s, d) => s + d.items.length, 0);
  const { rows, flat } = dimensionRows(answers);
  const rung = medical == null ? null : PROFILE_RUNGS.find((r) => medical >= r.profile);
  const yomKnown = answers.yomHameahSource === "official" || answers.yomHameahSource === "self";

  const tiles = [
    {
      label: "דפ״ר",
      value: dapar,
      note: dapar == null ? "לא ידוע עדיין" : total ? `${open} מתוך ${total} השערים שבחרתם פתוחים` : "מעל הממוצע הוא 50",
    },
    { label: "פרופיל", value: medical, note: rung ? rung.opens : "לא ידוע עדיין" },
    {
      label: "מא״ה הכי חזק",
      value: yomKnown && !flat ? rows[0].score : null,
      note: !yomKnown ? "לא הוזנו ציונים" : flat ? `כל הציונים ${rows[0].score}/5, לא מבדיל בין תפקידים` : rows[0].label,
      suffix: "/5",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((t, i) => (
        <Reveal key={t.label} delay={0.08 * i}>
          <div className="h-full border border-iron/25 bg-card/70 p-4">
            <p className="text-xs text-dust">{t.label}</p>
            <p className="mt-1 font-mono text-4xl font-black leading-none text-primary">
              {t.value == null ? "—" : <CountUp value={t.value} />}
              {t.value != null && t.suffix ? <span className="text-lg text-dust">{t.suffix}</span> : null}
            </p>
            <p className="mt-2 text-xs leading-5 text-foreground/80">{t.note}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// ---------- 3. דפ"ר doors ----------

export function DaparDoorsCard({ answers }: { answers: AssessmentAnswers }) {
  const reduce = useReducedMotion();
  const dapar = num(answers.daparScore);
  const medical = num(answers.medicalProfile);
  const doors = daparDoors(answers);
  if (!doors.length) return null;
  const combatMale = isCombatDesignatedMale(answers) && wantsTech(answers);

  return (
    <Card
      kicker="השערים לפי דפ״ר"
      title={dapar == null ? "אלה השערים בכיוונים שבחרתם" : `עם דפ״ר ${dapar}, זה מה שנפתח בכיוונים שבחרתם`}
    >
      {combatMale ? (
        <div className="mb-4 border-r-2 border-amber-400 bg-amber-400/10 p-3 text-sm leading-6 text-foreground">
          <strong>פרופיל {medical} = ייעוד ללוחמה.</strong> שאלון ההעדפות שלך יהיה גרסת יחידות השדה, בלי תפקידי עורף. לטכנולוגיה
          מגיעים רק דרך מיונים שמקבלים פרופיל קרבי, ומאז יוני 2024 המכסות שלהם ב-8200 ובתקשוב צומצמו.
        </div>
      ) : null}
      <ol className="space-y-1.5">
        {doors.map((door, i) => {
          const open = dapar != null && dapar >= door.dapar;
          const gap = dapar == null ? null : door.dapar - dapar;
          const fromBottom = doors.length - 1 - i;
          return (
            <li key={door.dapar} className="grid grid-cols-[2.75rem_6px_1fr] items-stretch gap-3">
              <span className={`pt-2 font-mono text-lg font-black tabular-nums ${open ? "text-primary" : "text-dust"}`}>{door.dapar}</span>
              <span className="relative overflow-hidden bg-iron/25">
                {open ? (
                  <motion.span
                    className="absolute inset-0 origin-bottom bg-primary"
                    initial={reduce ? false : { scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: 0.15 + fromBottom * 0.18, ease: EASE }}
                  />
                ) : null}
              </span>
              <motion.div
                initial={reduce ? false : { opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.15 + fromBottom * 0.18, ease: EASE }}
                className={`flex flex-wrap items-start justify-between gap-2 border p-2.5 ${
                  open ? "border-primary/35 bg-primary/10" : "border-iron/20 bg-card/40"
                }`}
              >
                <ul className="min-w-0 flex-1 space-y-0.5 text-sm">
                  {door.items.map((item) => (
                    <li key={item} className={open ? "text-foreground" : "text-dust"}>
                      {item}
                    </li>
                  ))}
                </ul>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-0.5 text-[11px] font-bold ${
                    open ? "bg-primary text-primary-foreground" : "bg-iron/25 text-dust"
                  }`}
                >
                  {open ? <Check className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
                  {open ? "פתוח" : gap == null ? "לא ידוע" : `חסרות ${gap} נק׳`}
                </span>
              </motion.div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] leading-5 text-dust">
        דפ״ר הוא רק השער. מעבר לו יש מיונים, ראיון וסיווג ביטחוני. מבחן חוזר אפשרי רק למי שיש לו 70 ומטה.
      </p>
    </Card>
  );
}

// ---------- 4. profile ladder ----------

export function ProfileLadderCard({ answers }: { answers: AssessmentAnswers }) {
  const reduce = useReducedMotion();
  const medical = num(answers.medicalProfile);
  if (medical == null) return null;
  const female = answers.gender === "female";
  const combat = wantsCombat(answers);
  const current = PROFILE_RUNGS.find((r) => medical >= r.profile)?.profile;
  return (
    <Card kicker="סולם הפרופיל" title={`פרופיל ${medical}: איפה זה שם אתכם`}>
      <ol className="space-y-1">
        {PROFILE_RUNGS.map((rung, i) => {
          const reached = medical >= rung.profile;
          const isCurrent = rung.profile === current;
          return (
            <motion.li
              key={rung.profile}
              initial={reduce ? false : { opacity: 0, x: 10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.06 * (PROFILE_RUNGS.length - i), ease: EASE }}
              className={`grid grid-cols-[2.75rem_1fr] items-center gap-3 border-r-2 px-2 py-1.5 text-sm ${
                isCurrent ? "border-primary bg-primary/15" : reached ? "border-primary/40" : "border-iron/25"
              }`}
            >
              <span className={`font-mono text-base font-black tabular-nums ${reached ? "text-primary" : "text-dust/60"}`}>{rung.profile}</span>
              <span className={reached ? "text-foreground" : "text-dust/60 line-through decoration-iron/50"}>
                {rung.opens}
                {isCurrent ? <span className="mr-2 text-[11px] font-bold text-primary">← אתם כאן</span> : null}
              </span>
            </motion.li>
          );
        })}
      </ol>
      {female && combat ? (
        <p className="mt-3 text-xs leading-5 text-foreground/80">
          לנשים לוחמה היא בחירה: מיון לוחמות בלי מבחן פיזי, 32 חודשים ומילואים. סגורים עדיין חי״ר מתמרן וקומנדו.
        </p>
      ) : null}
    </Card>
  );
}

// ---------- 5. מא"ה strengths ----------

export function StrengthsCard({ answers }: { answers: AssessmentAnswers }) {
  const reduce = useReducedMotion();
  const source = answers.yomHameahSource;
  if (source !== "official" && source !== "self") return null;
  const { rows, flat } = dimensionRows(answers);
  const top = rows.filter((r) => r.top);
  return (
    <Card
      kicker={source === "official" ? "מא״ה · ציונים רשמיים" : "מא״ה · הערכה עצמית"}
      title={flat ? `כל 11 הציונים שלכם ${rows[0].score}/5` : `החוזקות שלכם: ${top.map((r) => r.label).join(", ")}`}
    >
      {flat ? (
        <p className="mb-4 text-sm leading-6 text-foreground/80">
          ציונים זהים לא מבדילים בין תפקידים, אז ההתאמה תישען יותר על הספים ועל מה שסימנתם. זה בסדר גמור.
        </p>
      ) : top.length ? (
        <ul className="mb-4 flex flex-wrap gap-2">
          {top.map((r) => (
            <li key={r.key} className="inline-flex items-center gap-1.5 border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs text-foreground">
              <Sparkles className="h-3 w-3 text-primary" aria-hidden />
              {r.label} → {r.opens}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r, i) => (
          <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
            <span className={r.top ? "font-bold text-foreground" : "text-foreground/80"}>{r.label}</span>
            <span className="flex gap-1" aria-label={`${r.score} מתוך 5`}>
              {[1, 2, 3, 4, 5].map((cell) => (
                <motion.span
                  key={cell}
                  className={`h-3 w-3 sm:w-4 ${cell <= r.score ? (r.top ? "bg-primary" : "bg-primary/60") : "bg-iron/25"}`}
                  initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.25, delay: 0.03 * i + 0.05 * cell, ease: EASE }}
                />
              ))}
            </span>
          </li>
        ))}
      </ul>
      {source === "self" ? (
        <p className="mt-3 text-[11px] text-dust">הערכה עצמית משפיעה פחות מציונים רשמיים על הדירוג.</p>
      ) : null}
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
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-bold text-foreground">{r.label}</span>
              <span className="font-mono text-xs tabular-nums text-dust">
                שחרור {formatMonth(r.release)}
                {r.keva ? ` · סוף קבע ${formatMonth(r.end)}` : ""}
              </span>
            </div>
            <div className="mt-1.5 flex h-3 overflow-hidden bg-iron/20" aria-hidden>
              <Grow pct={(r.mandatory / max) * 100} delay={0.1 * i} className="h-full bg-primary" />
              {r.keva ? (
                <Grow
                  pct={(r.keva / max) * 100}
                  delay={0.1 * i + 0.5}
                  className="h-full bg-[repeating-linear-gradient(135deg,var(--primary)_0_4px,transparent_4px_8px)] opacity-70"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-4 text-[11px] text-dust">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 bg-primary" />חובה (32 חודשים לגברים ולתפקידי ״דין אישה כדין גבר״)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 bg-[repeating-linear-gradient(135deg,var(--primary)_0_3px,transparent_3px_6px)]" />קבע</span>
      </div>
    </Card>
  );
}

// ---------- 7. roadmap with real dates (review step) ----------

const inMonths = (n: number) => (n === 1 ? "בעוד חודש" : n === 2 ? "בעוד חודשיים" : `בעוד ${n} חודשים`);

export function DraftRoadmap({ answers }: { answers: AssessmentAnswers }) {
  const reduce = useReducedMotion();
  const items = useMemo(() => draftRoadmap(answers), [answers]);
  if (!items.length) return null;
  const draft = new Date(answers.draftDate);
  const months = Math.max(0, monthsUntil(draft));
  const firstUpcoming = items.findIndex((i) => i.status !== "past");
  return (
    <Card kicker="מפת הדרך שלכם" title={<><CountUp value={months} /> חודשים לגיוס. זה מה שקורה בדרך</>}>
      <ol className="relative space-y-3 border-r border-iron/30 pr-5">
        {items.map((item, i) => (
          <motion.li
            key={`${item.title}-${i}`}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.05 * i, ease: EASE }}
            className={`relative ${item.status === "past" ? "opacity-50" : ""}`}
          >
            {i === firstUpcoming && firstUpcoming > 0 ? (
              <span className="mb-3 -mr-5 flex items-center gap-2 font-mono text-[10px] tracking-widest text-amber-300">
                <span className="h-px flex-1 bg-amber-300/40" />היום<span className="h-px w-3 bg-amber-300/40" />
              </span>
            ) : null}
            <span
              className={`absolute -right-[25px] top-1 h-2.5 w-2.5 rounded-full border ${
                item.status === "now" ? "animate-pulse border-amber-300 bg-amber-300" : item.status === "past" ? "border-iron bg-iron" : "border-primary bg-background"
              }`}
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[11px] tabular-nums text-primary">
                {item.approx ? "בערך " : ""}
                {HEBREW_MONTHS[item.date.getMonth()]} {item.date.getFullYear()}
              </span>
              <span
                className={`text-[10px] font-bold ${item.status === "now" ? "text-amber-300" : item.status === "past" ? "text-dust" : "text-dust"}`}
              >
                {item.status === "now" ? "עכשיו" : item.status === "past" ? "עבר" : inMonths(monthsUntil(item.date))}
              </span>
            </div>
            <p className="text-sm font-bold text-foreground">{item.title}</p>
            <p className="text-xs leading-5 text-dust">{item.detail}</p>
          </motion.li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-dust">חלונות לפי הפרסומים הרשמיים; מועדים מדויקים מגיעים מהודעות מיטב.</p>
    </Card>
  );
}
