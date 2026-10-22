import { useMemo } from "react";
import { m, useReducedMotion } from "framer-motion";
import { Mountain, RefreshCw, Star } from "lucide-react";
import { ShareButtons } from "@/components/ShareButtons";
import { QuizCta } from "@/components/QuizCta";
import {
  BENCHMARK_NOTE,
  SHARE_LEVELS,
  SHARE_URL,
  type Gender,
  type GibushContent,
  type Level,
} from "./types";
import { evaluate, type Answers } from "./scoring";

export { SHARE_URL };
const ease = [0.16, 1, 0.3, 1] as const;

export function Result({
  content,
  gender,
  answers,
  name,
  draftDate,
  onRestart,
}: {
  content: GibushContent;
  gender: Gender;
  answers: Answers;
  name?: string;
  draftDate?: string;
  onRestart: () => void;
}) {
  const r = useMemo(() => evaluate(content, gender, answers), [content, gender, answers]);
  const reduce = useReducedMotion();
  const current = r.ladder[r.level];
  const shareIndex = SHARE_LEVELS.indexOf(current.name);
  const { status, next, place } = r.outcome;
  // The level reached comes first; "נחתכתם" only when no screening level was reached at all.
  // Where the climb stopped, as its own line under the headline.
  const stoppedAt = status === "stopped" ? `לרמת ${next} נעצרתם ב${place}` : "";
  const draftLabel = draftDate
    ? new Date(draftDate).toLocaleDateString("he-IL", { month: "long", year: "numeric" })
    : undefined;
  const reveal = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease },
        };

  return (
    <div className="space-y-14 sm:space-y-20">
      {/* How the day ended, with the card beside it */}
      {/* Phones: text, card, then sharing. Desktop: the card beside both. */}
      <m.header
        {...reveal(0)}
        className="grid items-center gap-8 md:grid-cols-[1fr_auto] md:gap-x-16 md:gap-y-8"
      >
        <div className="min-w-0 md:col-start-1">
          <p className="font-mono text-sm text-sand">{content.day.title}</p>
          {status === "cut" ? (
            <h1 className="mt-4 text-3xl font-black leading-[1.15] text-foreground sm:text-5xl">
              נחתכתם ב{place}
            </h1>
          ) : (
            <RankReveal name={current.name} units={r.units} animate={!reduce} />
          )}
          {stoppedAt ? (
            <p className="mt-3 text-xl font-bold text-rust sm:text-2xl">{stoppedAt}</p>
          ) : null}
          <p className="mt-5 max-w-xl text-base leading-7 text-dust sm:text-lg sm:leading-8">
            {r.outcome.reason}
          </p>
          <p className="mt-3 max-w-xl text-base leading-7 text-foreground/90">
            {status === "cut" ? `${r.ladder[0].units}: פתוחים לכם גם בלי גיבוש. ` : ""}
            {status === "top"
              ? "זה בדיוק השלב שבו שומרים על מה שבניתם ולא מתרסקים בשבוע האחרון."
              : `זו תמונת מצב של היום, לא גזר דין. יש לכם ${r.weeks === 1 ? "שבוע" : `${r.weeks} שבועות`}, והתוכנית למטה בנויה בדיוק עליהם.`}
          </p>
        </div>
        <div className="md:col-start-2 md:row-span-2 md:row-start-1">
          <FighterCard
            overall={r.overall}
            levelName={current.name}
            ratings={r.ratings}
            name={name}
            draftLabel={draftLabel}
          />
        </div>
        <div className="space-y-3 md:col-start-1 md:self-start">
          <p className="text-sm font-bold text-foreground">שתפו את הכרטיס</p>
          <ShareButtons
            text={`קיבלתי ${r.overall} בכרטיס הלוחם של קח כיוון. כמה אתם מקבלים?`}
            url={shareIndex < 0 ? SHARE_URL : `${SHARE_URL}?s=${r.overall}&u=${shareIndex}`}
          />
          <p className="text-sm text-dust">בקישור רואים רק את הציון והרמה, בלי שם ובלי תשובות.</p>
        </div>
      </m.header>

      {/* The ladder */}
      <m.section {...reveal(0.15)} aria-labelledby="ladder-h">
        <SectionTitle id="ladder-h">עד איפה הגעתם בסולם</SectionTitle>
        <p className="mt-2 max-w-2xl text-base leading-7 text-dust">
          כל עמודה היא רמה. הצבועות כבר בידיים שלכם. לטיס ולחובלים יש דרך משלהם לשתי הרמות העליונות:
          חשיבה, תכנון וצוות במקום סחיבה.
        </p>
        <LadderBars ladder={r.ladder} level={r.level} />
      </m.section>

      {/* Gaps */}
      <m.section {...reveal(0.25)} aria-labelledby="gaps-h">
        <SectionTitle id="gaps-h">מה חסר לשלב הבא</SectionTitle>
        {r.gaps.length ? (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {r.gaps.map((g) => (
              <li key={g.stage.id} className="border border-iron/30 bg-card p-5">
                <p className="text-lg font-black text-foreground">
                  {g.stage.bar?.topic ?? g.stage.place}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="border-t-2 border-rust bg-rust/10 p-3">
                    <p className="text-sm text-dust">שלכם היום</p>
                    <p className="mt-1 text-base font-bold text-foreground">{g.yours}</p>
                  </div>
                  <div className="border-t-2 border-primary bg-primary/10 p-3">
                    <p className="text-sm text-dust">
                      {g.stage.bar ? "הרף המקובל" : "מה שהמגבשים מחפשים"}
                    </p>
                    <p className="mt-1 text-base font-bold text-primary">{g.target}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 max-w-2xl border-t-2 border-primary bg-primary/10 p-5 text-base leading-7 text-foreground">
            אין פער בולט במספרים. מה שנשאר הוא להחזיק את הרמה ולהגיע רעננים.
          </p>
        )}
      </m.section>

      {/* Plan */}
      <m.section {...reveal(0.35)} aria-labelledby="plan-h">
        <SectionTitle id="plan-h">
          {r.weeks === 1 ? "התוכנית לשבוע שנשאר" : `התוכנית ל־${r.weeks} השבועות שנשארו`}
        </SectionTitle>
        <ol className="mt-6 grid gap-3 lg:grid-cols-3">
          {r.plan.map((b, i) => {
            const tone = PLAN_TONES[i % PLAN_TONES.length];
            return (
              <li key={b.range} className={`border-t-2 bg-card p-5 ${tone.border}`}>
                <p className={`font-mono text-sm ${tone.text}`}>{b.range}</p>
                <p className="mt-2 text-xl font-black text-foreground">{b.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {b.items.map((it) => (
                    <li key={it} className="flex gap-2.5 text-base leading-7 text-foreground/90">
                      <span
                        className={`mt-3 h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`}
                        aria-hidden
                      />
                      {it}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </m.section>

      <QuizCta title="מעבר לגיבוש: איזה תפקיד בצה״ל הכי מתאים לכם?" />

      <footer className="flex flex-col-reverse items-start gap-5 border-t border-iron/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-6 text-dust">{BENCHMARK_NOTE}</p>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-iron/40 px-4 text-sm font-bold text-foreground transition hover:border-primary/50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          לעבור את היום מחדש
        </button>
      </footer>
    </div>
  );
}

const PLAN_TONES = [
  { border: "border-steel", text: "text-steel", dot: "bg-steel" },
  { border: "border-sand", text: "text-sand", dot: "bg-sand" },
  { border: "border-rust", text: "text-rust", dot: "bg-rust" },
] as const;

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-balance text-3xl font-black leading-tight text-foreground sm:text-4xl"
    >
      {children}
    </h2>
  );
}

const CARD_CLIP = "polygon(12% 0, 88% 0, 100% 7%, 100% 93%, 50% 100%, 0 93%, 0 7%)";

/**
 * Rank badges for the levels few reach. A plain "3 of 5" made units like שייטת 13 look average,
 * so the top units carry their own title instead of a count.
 */
export const LEVEL_BADGE: Record<string, string> = {
  "קומנדו ומיוחדות": "יחידה מיוחדת",
  "סיירות עילית": "עילית",
};

/** The level as a game rank: the name large, and a badge when it is one few reach. */
function RankReveal({ name, units, animate }: { name: string; units: string; animate: boolean }) {
  const badge = LEVEL_BADGE[name];
  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-dust">הדרגה שלכם</p>
      <m.h1
        initial={animate ? { opacity: 0, scale: 0.92 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease }}
        className="mt-2 origin-right text-4xl font-black leading-none text-foreground sm:text-6xl"
      >
        {name}
      </m.h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-foreground/90">{units}</p>
      {badge ? (
        <m.p
          initial={animate ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45, ease }}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <span className="inline-flex items-center gap-1.5 border border-sand/50 bg-sand/10 px-3 py-1 text-sm font-black text-sand">
            <Star className="h-4 w-4 fill-current" aria-hidden />
            {badge}
          </span>
          <span className="text-base font-bold text-foreground">
            {badge === "עילית"
              ? "מעטים מאוד מגיעים לרמה הזאת."
              : "רוב המועמדים לא מגיעים לרמה הזאת."}
          </span>
        </m.p>
      ) : null}
    </div>
  );
}

/** FIFA-proportioned card (5:7). `locked` hides every number for the teasers. */
export function FighterCard({
  overall,
  levelName,
  locked = false,
  ratings,
  name,
  draftLabel,
}: {
  overall: number | null;
  levelName: string;
  locked?: boolean;
  ratings: { key: string; label: string; value: number | null }[];
  name?: string;
  draftLabel?: string;
}) {
  const show = (v: number | null) => (locked || v == null ? "??" : String(v));
  const half = Math.ceil(ratings.length / 2);
  return (
    <div
      className="mx-auto w-[17.5rem] shrink-0"
      style={{
        filter: "drop-shadow(0 18px 28px color-mix(in oklch, var(--primary) 30%, transparent))",
      }}
    >
      <div
        className="relative flex aspect-[5/7] flex-col px-5 pb-9 pt-7 text-foreground"
        style={{
          clipPath: CARD_CLIP,
          background:
            "radial-gradient(120% 70% at 50% 0%, color-mix(in oklch, var(--primary) 28%, transparent), transparent 70%), linear-gradient(160deg, color-mix(in oklch, var(--primary) 14%, var(--card)), var(--card) 60%)",
        }}
        aria-label={locked ? "כרטיס לוחם נעול" : `כרטיס לוחם: ${overall}, ${levelName}`}
      >
        <TopoBg />
        {/* The outline follows the clipped shape; a CSS border stops at the cut corners. */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon
            points="12,0 88,0 100,7 100,93 50,100 0,93 0,7"
            fill="none"
            stroke="var(--primary)"
            strokeOpacity={0.55}
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="relative flex min-h-0 flex-1 gap-1">
          <div className="flex w-[5.5rem] shrink-0 flex-col items-center text-center">
            <p className="font-mono text-[3.5rem] font-black leading-none" dir="ltr">
              {show(overall)}
            </p>
            <p className="mt-1 text-sm font-black leading-tight text-primary">
              {locked ? "רמה נעולה" : levelName}
            </p>
            <span className="my-2 h-px w-10 bg-primary/40" aria-hidden />
            <Mountain className="h-6 w-6 text-primary" aria-hidden />
            <p className="mt-1 text-xs font-bold text-dust">גיבוש</p>
          </div>
          <svg
            viewBox="0 0 100 110"
            className="min-w-0 flex-1 self-end text-primary opacity-30"
            aria-hidden
          >
            <circle cx="50" cy="38" r="21" fill="currentColor" />
            <path d="M6 110c0-27 19-44 44-44s44 17 44 44z" fill="currentColor" />
          </svg>
        </div>
        <div className="relative border-b border-primary/30 pb-1 text-center">
          <p className="truncate text-2xl font-black leading-tight">{name || "לוחם/ת"}</p>
          {draftLabel ? <p className="text-xs text-dust">גיוס: {draftLabel}</p> : null}
        </div>
        <dl className="relative mt-2 grid grid-flow-col grid-cols-2 grid-rows-3 gap-y-0.5">
          {ratings.map((x, i) => (
            <div
              key={x.key}
              className={`flex items-baseline gap-1.5 ${i >= half ? "border-s border-primary/30 ps-2.5" : "pe-2.5"}`}
            >
              <dt className="order-2 truncate text-sm text-dust">{x.label}</dt>
              <dd
                className={`order-1 w-7 shrink-0 font-mono text-lg font-black ${locked ? "blur-[3px]" : ""}`}
                dir="ltr"
              >
                {show(x.value)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="relative mt-1.5 text-center font-mono text-xs tracking-widest text-dust">
          kachkivun.com
        </p>
      </div>
    </div>
  );
}

function TopoBg() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
      viewBox="0 0 280 400"
      aria-hidden
    >
      {contours(210, 70, 6, 34).map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--primary)" strokeWidth="0.7" />
      ))}
    </svg>
  );
}

/** Wobbly closed rings around a peak, the look of a topographic map. */
function contours(cx: number, cy: number, rings: number, step: number) {
  return Array.from({ length: rings }, (_, k) => {
    const pts = Array.from({ length: 49 }, (_, j) => {
      const t = (j / 48) * Math.PI * 2;
      const r = step * (k + 1) * (1 + 0.09 * Math.sin(3 * t + k) + 0.05 * Math.sin(5 * t + 2 * k));
      return `${(cx + r * Math.cos(t) * 1.25).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`;
    });
    return `M${pts.join("L")}Z`;
  });
}

/** The ladder as rising columns, easiest at the start (right in RTL). Reached ones are filled. */
function LadderBars({ ladder, level }: { ladder: Level[]; level: number }) {
  const n = ladder.length;
  return (
    <ol
      className="mt-14 flex h-72 items-end gap-1.5 sm:h-80 sm:gap-3"
      aria-label={`הסולם: ${ladder.map((l) => l.name).join(", ")}. אתם ב${ladder[level].name}.`}
    >
      {ladder.map((l, i) => {
        const reached = i <= level;
        const here = i === level;
        const height = 34 + (66 * i) / Math.max(1, n - 1);
        return (
          <li
            key={l.name}
            style={{ height: `${height}%` }}
            className={`relative flex min-w-0 flex-1 flex-col justify-end p-2 sm:p-3 ${
              reached ? "border-t-[3px] border-primary bg-primary/15" : "bg-iron/15"
            } ${here ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
          >
            {here ? (
              <span className="absolute inset-x-0 -top-10 mx-auto w-fit whitespace-nowrap bg-primary px-2 py-1 text-xs font-black text-primary-foreground">
                אתם כאן
              </span>
            ) : null}
            <span
              className={`text-xs font-black leading-tight sm:text-base ${reached ? "text-foreground" : "text-dust"}`}
            >
              {l.name}
            </span>
            <span className="mt-1 hidden text-sm leading-snug text-dust sm:block">
              {l.screening}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
