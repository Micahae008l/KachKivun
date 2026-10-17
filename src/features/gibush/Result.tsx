import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flag, RefreshCw } from "lucide-react";
import { ShareButtons } from "@/components/ShareButtons";
import {
  BENCHMARK_NOTE,
  SHARE_LEVELS,
  TRACK_CARD_LABEL,
  type Gender,
  type GibushContent,
  type Level,
  type Track,
} from "./types";
import { evaluate, type Answers } from "./scoring";

export const SHARE_URL = "https://kachkivun.com/gibush";
const ease = [0.16, 1, 0.3, 1] as const;

export function Result({
  content,
  track,
  gender,
  answers,
  name,
  draftDate,
  onRestart,
}: {
  content: GibushContent;
  track: Track;
  gender: Gender;
  answers: Answers;
  name?: string;
  draftDate?: string;
  onRestart: () => void;
}) {
  const r = useMemo(
    () => evaluate(content, track, gender, answers),
    [content, track, gender, answers],
  );
  const reduce = useReducedMotion();
  const current = r.ladder[r.level];
  const shareIndex = SHARE_LEVELS.findIndex((x) => x.track === track && x.name === current.name);
  const { status, next, clock, place } = r.outcome;
  // The level reached comes first; "נחתכתם" only when no screening level was reached at all.
  const headline =
    status === "top"
      ? `הגעתם לרמת ${current.name}`
      : status === "stopped"
        ? `הגעתם לרמת ${current.name}. לרמת ${next} נעצרתם ב${place}`
        : `נחתכתם ב־${clock}, ב${place}`;
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
    <div className="space-y-10">
      {/* How the day ended */}
      <motion.header {...reveal(0)} className="border-b border-iron/30 pb-6">
        <p className="font-mono text-xs tracking-wide text-primary">
          {content.tracks[track].title} · סוף היום
        </p>
        <p
          className="mt-3 text-right font-mono text-5xl font-black leading-none text-foreground"
          dir="ltr"
        >
          {r.outcome.clock}
        </p>
        <h1 className="mt-3 text-2xl font-black leading-tight text-foreground sm:text-3xl">
          {headline}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-dust">{r.outcome.reason}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground">
          {status === "cut" && track === "combat"
            ? `${r.ladder[0].units}: פתוחים לכם גם בלי גיבוש. `
            : ""}
          {status === "top"
            ? "זה בדיוק השלב שבו שומרים על מה שבניתם ולא מתרסקים בשבוע האחרון."
            : `זו תמונת מצב של היום, לא גזר דין. יש לכם ${r.weeks === 1 ? "שבוע" : `${r.weeks} שבועות`}, והתוכנית למטה בנויה בדיוק עליהם.`}
        </p>
      </motion.header>

      {/* Card + share */}
      <motion.section {...reveal(0.1)} className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
        <FighterCard
          overall={r.overall}
          levelName={current.name}
          trackLabel={TRACK_CARD_LABEL[track]}
          ratings={r.ratings}
          name={name}
          draftLabel={draftLabel}
        />
        <div className="space-y-4">
          <h2 className="text-lg font-black text-foreground">כרטיס הלוחם שלכם</h2>
          <p className="text-sm leading-6 text-dust">
            {current.units}. {current.screening}. בקישור ששולחים רואים רק את הציון והרמה, בלי שם
            ובלי תשובות.
          </p>
          <ShareButtons
            text={`קיבלתי ${r.overall} בכרטיס הלוחם של קח כיוון. כמה אתם מקבלים?`}
            url={shareIndex < 0 ? SHARE_URL : `${SHARE_URL}?s=${r.overall}&u=${shareIndex}`}
          />
        </div>
      </motion.section>

      {/* Route */}
      <motion.section {...reveal(0.2)} aria-labelledby="route-h">
        <h2 id="route-h" className="text-lg font-black text-foreground">
          {track === "pilot" ? "סולם המוכנות" : "המסלול למעלה"}
        </h2>
        <p className="mt-1 text-sm text-dust">
          {track === "pilot"
            ? "בגיבוש טיס וחובלים הכושר הוא רק סף. מה שמטפס כאן הוא חשיבה, צוות וקור רוח."
            : "כל נקודה היא רמת גיבוש. קו מלא עד איפה שאתם היום, מקווקו מה שנשאר."}
        </p>
        <RouteMap ladder={r.ladder} level={r.level} />
      </motion.section>

      {/* Gaps and plan */}
      <motion.section {...reveal(0.3)} className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-black text-foreground">איפה הפער</h2>
          {r.gaps.length ? (
            <ul className="mt-3 divide-y divide-iron/20 border-y border-iron/20">
              {r.gaps.map((g) => (
                <li key={g.stage.id} className="py-3">
                  <p className="text-sm font-bold text-foreground">
                    {g.stage.bar?.topic ?? g.stage.place}
                  </p>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                    <dt className="text-dust">שלכם</dt>
                    <dd className="text-foreground">{g.yours}</dd>
                    <dt className="text-dust">הרף המקובל</dt>
                    <dd className="font-semibold text-primary">{g.stage.bar?.label}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-dust">
              אין פער בולט במספרים. מה שנשאר הוא להחזיק את הרמה ולהגיע רעננים.
            </p>
          )}
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground">
            תוכנית ל־{r.weeks === 1 ? "שבוע" : `${r.weeks} שבועות`}
          </h2>
          <ol className="mt-3 space-y-3">
            {r.plan.map((b) => (
              <li key={b.range} className="border border-iron/30 bg-card p-4">
                <p className="font-mono text-[11px] tracking-wide text-primary">{b.range}</p>
                <p className="mt-1 text-sm font-black text-foreground">{b.title}</p>
                <ul className="mt-2 space-y-1.5">
                  {b.items.map((it) => (
                    <li key={it} className="flex gap-2 text-sm leading-6 text-foreground/90">
                      <span
                        className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                      {it}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </motion.section>

      <footer className="space-y-4 border-t border-iron/30 pt-5">
        <p className="text-xs leading-5 text-dust">{BENCHMARK_NOTE}</p>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex min-h-11 items-center gap-2 border border-iron/40 px-4 text-sm font-bold text-foreground transition hover:border-primary/50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          לעבור את היום מחדש
        </button>
      </footer>
    </div>
  );
}

/** FIFA-style card. `silhouette` hides every number for the locked teaser. */
export function FighterCard({
  overall,
  levelName,
  trackLabel,
  ratings,
  name,
  draftLabel,
  silhouette = false,
}: {
  overall: number | null;
  levelName: string;
  trackLabel: string;
  ratings: { key: string; label: string; value: number | null }[];
  name?: string;
  draftLabel?: string;
  silhouette?: boolean;
}) {
  const hidden = (v: number | null) => (silhouette || v == null ? "??" : String(v));
  return (
    <div
      className="relative mx-auto w-[17.5rem] shrink-0 overflow-hidden border border-primary/40 p-5 text-foreground shadow-[0_20px_60px_-25px] shadow-primary/40"
      style={{
        clipPath: "polygon(12% 0, 88% 0, 100% 7%, 100% 93%, 50% 100%, 0 93%, 0 7%)",
        background:
          "radial-gradient(120% 70% at 50% 0%, color-mix(in oklch, var(--primary) 28%, transparent), transparent 70%), linear-gradient(160deg, color-mix(in oklch, var(--primary) 14%, var(--card)), var(--card) 60%)",
      }}
      aria-label={silhouette ? "כרטיס לוחם נעול" : `כרטיס לוחם: ${overall}, ${levelName}`}
    >
      <TopoBg />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="font-mono text-6xl font-black leading-none" dir="ltr">
            {hidden(overall)}
          </p>
          <p className="mt-1 text-xs font-bold text-primary">
            {silhouette ? "רמה נעולה" : levelName}
          </p>
        </div>
        <span className="border border-primary/40 px-2 py-0.5 font-mono text-[10px] text-dust">
          {trackLabel}
        </span>
      </div>
      <div className="relative mt-6 border-b border-primary/25 pb-3 text-center">
        <p className="truncate text-xl font-black">{name || "לוחם/ת"}</p>
        {draftLabel ? (
          <p className="mt-0.5 font-mono text-[11px] text-dust">גיוס: {draftLabel}</p>
        ) : null}
      </div>
      <dl className="relative mt-3 grid grid-cols-2 gap-x-5 gap-y-2">
        {ratings.map((x) => (
          <div key={x.key} className="flex items-baseline justify-between gap-2">
            <dt className="truncate text-xs text-dust">{x.label}</dt>
            <dd
              className={`font-mono text-lg font-black ${silhouette ? "blur-[3px]" : ""}`}
              dir="ltr"
            >
              {hidden(x.value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="relative mt-5 pb-3 text-center font-mono text-[10px] tracking-widest text-dust">
        kachkivun.com
      </p>
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

/** The ladder as a climb: checkpoints bottom to top, solid to the reached level, dashed beyond. */
export function RouteMap({ ladder, level }: { ladder: Level[]; level: number }) {
  const n = ladder.length;
  const H = 96 * n + 40;
  const pts = ladder.map((_, i) => ({
    x: i % 2 ? 210 : 150,
    y: H - 40 - (i * (H - 90)) / Math.max(1, n - 1),
  }));
  const pathOf = (from: number, to: number) =>
    pts
      .slice(from, to + 1)
      .map((p, i, a) => {
        if (!i) return `M${p.x},${p.y}`;
        const prev = a[i - 1];
        const my = (prev.y + p.y) / 2;
        return `C${prev.x},${my} ${p.x},${my} ${p.x},${p.y}`;
      })
      .join(" ");

  return (
    <svg
      viewBox={`0 0 360 ${H}`}
      direction="ltr"
      className="mt-4 w-full max-w-xl border border-iron/30 bg-card"
      role="img"
      aria-label={`המסלול: ${ladder.map((l) => l.name).join(", ")}. אתם ב${ladder[level].name}.`}
    >
      {contours(180, 50, 9, 28).map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="var(--iron)"
          strokeOpacity={0.55}
          strokeWidth="0.8"
        />
      ))}
      {level < n - 1 ? (
        <path
          d={pathOf(level, n - 1)}
          fill="none"
          stroke="var(--dust)"
          strokeWidth="2"
          strokeDasharray="5 6"
          strokeOpacity={0.6}
        />
      ) : null}
      {level > 0 ? (
        <path
          d={pathOf(0, level)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : null}
      {pts.map((p, i) => {
        const left = i % 2 === 0;
        const reached = i <= level;
        const tx = left ? p.x - 16 : p.x + 16;
        return (
          <g key={i}>
            {i === level ? (
              <circle cx={p.x} cy={p.y} r="13" fill="var(--primary)" opacity="0.18" />
            ) : null}
            <circle
              cx={p.x}
              cy={p.y}
              r="6"
              fill={reached ? "var(--primary)" : "var(--card)"}
              stroke={reached ? "var(--primary)" : "var(--dust)"}
              strokeWidth="2"
            />
            <text
              x={tx}
              y={p.y - 2}
              textAnchor={left ? "end" : "start"}
              fontSize="13"
              fontWeight="800"
              fill={reached ? "var(--foreground)" : "var(--dust)"}
            >
              {ladder[i].name}
            </text>
            <text
              x={tx}
              y={p.y + 14}
              textAnchor={left ? "end" : "start"}
              fontSize="10.5"
              fill="var(--dust)"
            >
              {ladder[i].screening}
            </text>
            {i === level ? (
              <text
                x={tx}
                y={p.y - 19}
                textAnchor={left ? "end" : "start"}
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--primary)"
              >
                אתם כאן
              </text>
            ) : null}
          </g>
        );
      })}
      <g transform={`translate(${pts[n - 1].x - 6}, ${pts[n - 1].y - 40})`} aria-hidden>
        <Flag width="14" height="14" color="var(--primary)" />
      </g>
    </svg>
  );
}
