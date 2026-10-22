import { TONES, matchTone, roleField } from "@/lib/tones";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "@tanstack/react-router";
import { m, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gauge,
  CircleHelp,
  Clock3,
  Cpu,
  Heart,
  ListChecks,
  Lock,
  MapPin,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Waves,
} from "lucide-react";
import { IdfPhotoCredit } from "@/components/IdfPhotoCredit";
import { RoleInsightSheet } from "@/components/RoleInsightSheet";
import {
  roleInsightSlug,
  type LockedRoleMatch,
  type PaymentOffer,
  type RoleMatch,
  type UnlockedRoleMatch,
} from "@/lib/api";
import { pickRolePhoto, type IdfPhoto } from "@/lib/idf-photo-catalog";
import { ARIA, progressBarProps } from "@/lib/a11y";
import { trackEvent } from "@/lib/analytics";
import { formatPaymentPrice } from "@/lib/payment-offer";
import { SaleTag } from "@/components/SaleTag";

function tagIcon(tag: string) {
  const normalized = tag.toLowerCase();
  if (/קרב|שטח|לוחם/.test(normalized)) return Shield;
  if (/טכנ|מחשב|סייבר|מערכות/.test(normalized)) return Cpu;
  if (/משרד|משא|מנהל/.test(normalized)) return Briefcase;
  if (/ים|חיל הים/.test(normalized)) return Waves;
  if (/אנוש|טיפול|רפוא|פסיכ/.test(normalized)) return Heart;
  if (/צוות|ליווי|הדרכה/.test(normalized)) return Users;
  if (/מיקום|נהיגה/.test(normalized)) return MapPin;
  return Sparkles;
}

const SCORE_FACTOR_LABELS: Record<keyof NonNullable<UnlockedRoleMatch["scoreBreakdown"]>, string> =
  {
    preference: "העדפות שירות",
    focus: "מיקוד מקצועי",
    yom: "מדדי מא״ה",
    eligibility: "מרווח זכאות",
    catalogQuality: "איכות נתוני המאגר",
    structuredAssessment: "השאלון המובנה",
  };

function ScoreBreakdownPanel({
  breakdown,
}: {
  breakdown: NonNullable<UnlockedRoleMatch["scoreBreakdown"]>;
}) {
  return (
    <section aria-label="פירוט גורמי הציון הדטרמיניסטי">
      <h4 className="text-sm font-bold text-foreground">פירוט גורמי הציון הדטרמיניסטי</h4>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {Object.entries(SCORE_FACTOR_LABELS).map(([key, label]) => {
          const value = Math.max(
            0,
            Math.min(100, Math.round(breakdown[key as keyof typeof breakdown])),
          );
          return (
            <li key={key}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-dust">{label}</span>
                <strong className="font-mono tabular-nums text-foreground">{value}%</strong>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-iron/20"
                {...progressBarProps(value, `${label}: ${value}%`)}
              >
                <div
                  className={`animate-progress h-full ${TONES[matchTone(value)].dot}`}
                  style={{ width: `${value}%` }}
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The match % as a meter: a same-hue track, the value arc, and the number in the middle.
 * Type scales with the ring so nothing collides at small sizes; no CSS filters (they drew a dark box).
 */
function MatchRing({
  percentage,
  size = 84,
  delayMs = 0,
}: {
  percentage: number;
  size?: number;
  delayMs?: number;
}) {
  const value = Math.min(100, Math.max(0, Math.round(percentage)));
  const tone = TONES[matchTone(value)];
  const stroke = size >= 100 ? 8 : size >= 80 ? 6 : 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const showLabel = size >= 80;
  const numberPx = Math.round(size * (showLabel ? 0.27 : 0.3));

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ARIA.matchPct(value)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={tone.stroke}
          strokeOpacity={0.15}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="animate-ring"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={
            {
              "--ring-from": circumference,
              animationDelay: `${delayMs + 150}ms`,
            } as CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span
          className="font-black leading-none text-foreground"
          style={{ fontSize: numberPx }}
          dir="ltr"
        >
          {value}
          <span
            className={`font-bold ${tone.text}`}
            style={{ fontSize: Math.round(numberPx * 0.5) }}
          >
            %
          </span>
        </span>
        {showLabel ? (
          <span className="mt-1 text-[10px] font-semibold leading-none text-dust">התאמה</span>
        ) : null}
      </div>
    </div>
  );
}

function RankBadge({ rank, featured }: { rank: number; featured: boolean }) {
  if (featured) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-black text-primary-foreground">
        <Trophy className="h-3.5 w-3.5" aria-hidden />
        מקום 1 · הכי מתאים לכם
      </p>
    );
  }
  return <p className="font-mono text-xs font-bold text-primary">מקום {rank}</p>;
}

const CHANCE_STYLE = {
  high: "border-primary/50 bg-primary/15 text-primary",
  medium: "border-sand/40 bg-sand/10 text-sand",
  low: "border-rust/45 bg-rust/10 text-rust",
  unknown: "border-iron/30 bg-secondary/60 text-dust",
} as const;

function KeyFacts({ role }: { role: UnlockedRoleMatch }) {
  const chance = role.admissionChance;
  const hasFacts =
    role.requirements.length > 0 ||
    role.locations.length > 0 ||
    Boolean(role.serviceLengthLabel) ||
    Boolean(chance);
  if (!hasFacts) {
    return (
      <p className="text-xs text-dust">
        אין עדיין נתונים רשמיים על דרישות ומיקום לתפקיד הזה במאגר.
      </p>
    );
  }
  return (
    <section
      aria-label="נתוני מפתח על התפקיד"
      className="grid gap-3 rounded-sm border border-iron/25 bg-background/40 p-4 text-sm"
    >
      {chance ? (
        <div className="flex items-start gap-2.5">
          <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-sand" aria-hidden />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-dust">הערכת סיכוי קבלה</h4>
            <p
              className={`mt-1.5 inline-block border px-2 py-0.5 text-xs font-bold ${CHANCE_STYLE[chance.level]}`}
            >
              {chance.label}
            </p>
            {chance.reason ? (
              <p className="mt-1 text-xs leading-5 text-dust">{chance.reason}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {role.requirements.length ? (
        <div className="flex items-start gap-2.5">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-steel" aria-hidden />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-dust">דרישות ותנאים</h4>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {role.requirements.map((requirement) => (
                <li
                  key={requirement}
                  className="border border-iron/30 bg-secondary/60 px-2 py-0.5 text-xs font-semibold text-foreground"
                >
                  {requirement}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {role.serviceLengthLabel ? (
        <div className="flex items-start gap-2.5">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-rust" aria-hidden />
          <div>
            <h4 className="text-xs font-bold text-dust">משך שירות</h4>
            <p className="mt-0.5 text-foreground">{role.serviceLengthLabel}</p>
          </div>
        </div>
      ) : null}
      {role.locations.length ? (
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div>
            <h4 className="text-xs font-bold text-dust">איפה משרתים</h4>
            <p className="mt-0.5 text-foreground">{role.locations.join(" · ")}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function UnlockedRoleCard({
  role,
  photo,
  delayMs,
  onMoreInfo,
}: {
  role: UnlockedRoleMatch;
  photo: IdfPhoto | null;
  delayMs: number;
  onMoreInfo: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const headingId = useId();
  const detailsId = useId();
  const featured = role.rank === 1;
  // Each card wears its field's color: combat rust, tech and cyber steel, intel sand.
  const field = roleField(role);
  const ft = TONES[field.tone];
  // The summary is usually the explanation's first sentence; show it once, not twice.
  const repeats = Boolean(role.summary && role.description?.startsWith(role.summary));
  const rest = repeats ? role.description.slice(role.summary.length).trim() : "";
  const showSummary = Boolean(role.summary && role.description) && (!repeats || Boolean(rest));
  const why = repeats && rest ? rest : role.description || role.summary;
  // null until measured; true when more than about two lines sit behind the 3-line clamp.
  const [clampWorthIt, setClampWorthIt] = useState<boolean | null>(null);
  const whyRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = whyRef.current;
    if (!el) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 28;
    setClampWorthIt(el.scrollHeight - el.clientHeight > lineHeight * 1.5);
  }, [why]);

  return (
    <article
      className={`animate-slide-up overflow-hidden bg-card text-right ${
        featured
          ? "animate-top-glow border border-primary/60"
          : `border border-iron/30 border-t-2 ${ft.top}`
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
      dir="rtl"
      aria-labelledby={headingId}
    >
      <div
        className={
          photo ? `grid ${featured ? "md:grid-cols-[240px_1fr]" : "md:grid-cols-[180px_1fr]"}` : ""
        }
      >
        {photo ? (
          <div className={`relative overflow-hidden ${featured ? "min-h-52" : "min-h-40"}`}>
            <img
              src={photo.src}
              srcSet={photo.srcSet}
              sizes="(min-width: 768px) 240px, 100vw"
              alt={photo.alt}
              className="h-full w-full object-cover opacity-75"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/65 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent px-3 pb-2 pt-9">
              <IdfPhotoCredit photo={photo} />
            </div>
          </div>
        ) : null}

        <div className="space-y-5 p-5 sm:p-7">
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <RankBadge rank={role.rank} featured={featured} />
              <h3
                id={headingId}
                className={`mt-2 font-black text-foreground ${featured ? "text-2xl sm:text-3xl" : "text-xl"}`}
              >
                {role.roleTitle}
              </h3>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-dust">
                <span
                  className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-bold ${ft.soft} ${ft.bg} ${ft.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${ft.dot}`} aria-hidden />
                  {field.label}
                </span>
                {role.category && role.category !== field.label ? role.category : null}
                {role.combat && field.key !== "combat" ? " · קרבי" : null}
              </p>
            </div>
            <MatchRing
              percentage={role.matchPercentage}
              size={featured ? 108 : 84}
              delayMs={delayMs}
            />
          </header>

          <section aria-labelledby={`${detailsId}-why`} className={`border-r-2 pr-4 ${ft.border}`}>
            <h4 id={`${detailsId}-why`} className={`text-sm font-black ${ft.text}`}>
              למה זה מתאים לכם
            </h4>
            {showSummary ? (
              <p className="mt-1.5 text-base font-bold leading-7 text-foreground">{role.summary}</p>
            ) : null}
            <p
              ref={whyRef}
              className={`mt-1.5 max-w-prose text-[15px] leading-7 text-foreground/85 ${readMore || clampWorthIt === false ? "" : "line-clamp-3"}`}
            >
              {why || "לא סופק הסבר להתאמה זו."}
            </p>
            {clampWorthIt && !readMore ? (
              <button
                type="button"
                onClick={() => setReadMore(true)}
                className="mt-1 text-sm font-semibold text-primary hover:underline"
              >
                קראו עוד
              </button>
            ) : null}
            {role.tags.length ? (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="מה בפרופיל שלכם תומך בהתאמה">
                {role.tags.map((tag) => {
                  const Icon = tagIcon(tag);
                  return (
                    <li
                      key={tag}
                      className="inline-flex items-center gap-1.5 border border-iron/25 bg-secondary/60 px-2.5 py-1 text-[11px] text-dust"
                    >
                      <Icon className={`h-3 w-3 shrink-0 ${ft.text}`} aria-hidden />
                      {tag}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          <KeyFacts role={role} />

          <div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onMoreInfo}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary/15 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/25"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                עוד על התפקיד
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!expanded && role.rank >= 4 && role.rank <= 5) {
                    trackEvent("free_role_expanded", { rank: role.rank as 4 | 5 });
                  }
                  setExpanded((value) => !value);
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-iron/35 px-4 py-2 text-sm font-semibold text-dust transition-colors hover:text-foreground"
                aria-expanded={expanded}
                aria-controls={detailsId}
              >
                {expanded ? "הסתרה" : "פירוט הציון"}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>

            {expanded ? (
              <div
                id={detailsId}
                className="animate-fade-in mt-4 space-y-5 border-t border-iron/20 pt-5"
              >
                {role.scoreBreakdown ? (
                  <ScoreBreakdownPanel breakdown={role.scoreBreakdown} />
                ) : null}

                <section aria-labelledby={`${detailsId}-questions`}>
                  <div className="mb-2 flex items-center gap-2">
                    <CircleHelp className="h-4 w-4 text-steel" aria-hidden />
                    <h4 id={`${detailsId}-questions`} className="text-sm font-bold text-foreground">
                      שאלות לשאול את מיטב (1111) על התפקיד
                    </h4>
                  </div>
                  {role.nextStepPrompts.length ? (
                    <ul className="space-y-2">
                      {role.nextStepPrompts.map((prompt) => (
                        <li
                          key={prompt}
                          className="border border-iron/25 bg-background/35 px-3 py-2 text-sm leading-6 text-dust"
                        >
                          {prompt}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-dust">לא סופקו שאלות המשך לתפקיד זה.</p>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

// Only what the unlocked cards and MatchExtras really show.
const VAULT_PERKS = [
  "אילו 3 תפקידים מתאימים לכם הכי הרבה, ולמה דווקא הם",
  "סיכוי קבלה, דרישות, משך שירות ואיפה משרתים",
  "שאלות מוכנות לשאול את מיטב (1111) על כל תפקיד",
  "תוכנית לשאלון ההעדפות: מה לדרג 5, 4 ו־3",
  "מה עוד היה נפתח לכם עם דפ״ר או פרופיל גבוה יותר",
  "נשאר פתוח בחשבון, גם בכל סבב התאמות חדש",
];

/** "מקומות 3, 2 ו־1" for the given ranks, highest number first. */
function placesLabel(ranks: number[]) {
  const sorted = [...ranks].sort((a, b) => b - a);
  if (sorted.length === 1) return `מקום ${sorted[0]}`;
  return `מקומות ${sorted.slice(0, -1).join(", ")} ו־${sorted[sorted.length - 1]}`;
}

const COUNT_WORD: Record<number, string> = { 2: "שתי", 3: "שלוש", 4: "ארבע" };
const LOCKED_TITLE: Record<number, string> = {
  1: "הכי חזקה שלכם",
  2: "חזקה עוד יותר",
  3: "חזקה מאוד",
};

/** The locked top places together on one slide, with the offer inside it: the payoff of the 5-to-1 climb. */
function TopPlacesVault({
  locked,
  bestFreeMatch,
  offer,
}: {
  locked: LockedRoleMatch[];
  bestFreeMatch: number | null;
  offer: PaymentOffer | null | undefined;
}) {
  const headingId = useId();
  useEffect(() => {
    if (offer?.enabled) trackEvent("paywall_viewed");
  }, [offer?.enabled]);
  const top = locked.find((role) => role.rank === 1);
  const lift = top && bestFreeMatch != null ? top.matchPercentage - bestFreeMatch : 0;
  const price = offer?.enabled ? formatPaymentPrice(offer.product) : null;
  // "כ־₪5 לתפקיד": the real price split over the locked places, rounded to the agora.
  const perRole =
    offer?.enabled && locked.length > 1
      ? formatPaymentPrice({
          ...offer.product,
          amountMinor: Math.round(offer.product.amountMinor / locked.length),
        })
      : null;
  const places = placesLabel(locked.map((role) => role.rank));
  const title =
    locked.length > 1
      ? `${COUNT_WORD[locked.length] ?? locked.length} ההתאמות הכי חזקות שלכם מחכות כאן`
      : "ההתאמה הכי חזקה שלכם מחכה כאן";

  return (
    <article className="vault-border rounded-xl p-[2px]" aria-labelledby={headingId} dir="rtl">
      <div className="rounded-[10px] bg-card p-5 text-right sm:p-7">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-sand">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {places}
        </p>
        <h3 id={headingId} className="mt-2 text-2xl leading-tight font-black text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-dust">
          {lift > 0
            ? `ההתאמה במקום 1 גבוהה ב־${lift}% מהטובה ביותר שראיתם עד עכשיו.`
            : "התפקידים שהכי מתאימים לכל מה שסיפרתם."}
        </p>

        <ul className="mt-5 space-y-3">
          {[...locked]
            .sort((a, b) => b.rank - a.rank)
            .map((role, i) => {
              const featured = role.rank === 1;
              return (
                <li
                  key={role.rank}
                  className={`animate-slide-up flex items-center gap-4 rounded-lg border p-4 ${
                    featured
                      ? "animate-top-glow border-sand/60 bg-sand/10"
                      : "border-iron/30 bg-background/40"
                  }`}
                  style={{ animationDelay: `${120 + i * 140}ms` }}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-lg font-black ${
                      featured ? "bg-sand text-background" : "bg-sand/15 text-sand"
                    }`}
                  >
                    {role.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-black text-foreground">
                      <Lock className="h-3.5 w-3.5 text-sand" aria-hidden />
                      {LOCKED_TITLE[role.rank] ?? "התאמה חזקה"}
                    </p>
                    <div
                      className="mt-2 h-3.5 w-36 max-w-full rounded-sm bg-iron/40 opacity-60 blur-[3px]"
                      aria-hidden
                    />
                    {role.field ||
                    role.admissionChance ||
                    role.because?.length ||
                    role.combat != null ? (
                      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-dust">
                        {role.because?.length ? (
                          <span className="basis-full">
                            מתאים לכם בזכות:{" "}
                            <strong className="text-primary">{role.because.join(" · ")}</strong>
                          </span>
                        ) : null}
                        {role.field ? (
                          <span>
                            תחום: <strong className="text-foreground">{role.field}</strong>
                          </span>
                        ) : null}
                        {role.combat != null ? (
                          <span className="text-foreground">
                            {role.combat ? "קרבי" : "לא קרבי"}
                          </span>
                        ) : null}
                        {role.admissionChance ? (
                          <span className="text-foreground">{role.admissionChance.label}</span>
                        ) : null}
                      </p>
                    ) : (
                      <div
                        className="mt-1.5 h-2.5 w-52 max-w-full rounded-sm bg-iron/25 opacity-60 blur-[3px]"
                        aria-hidden
                      />
                    )}
                  </div>
                  <MatchRing
                    percentage={role.matchPercentage}
                    size={featured ? 80 : 72}
                    delayMs={200 + i * 140}
                  />
                </li>
              );
            })}
        </ul>

        <section className="mt-5 rounded-lg border border-sand/30 bg-sand/5 p-4">
          <h4 className="flex items-center gap-1.5 text-sm font-black text-foreground">
            <ListChecks className="h-4 w-4 text-sand" aria-hidden />
            למה זה חשוב לשאלון ההעדפות
          </h4>
          <p className="mt-1.5 text-sm leading-6 text-dust">
            לפי אתר מתגייסים, בלי מספיק תפקידים בדירוג גבוה אי אפשר להתחשב בשאלון.{" "}
            {locked.length > 1
              ? "אלה המועמדים הכי חזקים לדירוג הגבוה שלכם."
              : "זה המועמד הכי חזק לדירוג הגבוה שלכם."}
          </p>
        </section>

        {price ? (
          <>
            <h4 className="mt-5 text-sm font-black text-foreground">מה נפתח לכם</h4>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {VAULT_PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-sm leading-6 text-foreground">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-sand" aria-hidden />
                  {perk}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-4 border-t border-iron/25 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-foreground">{price}</span>
                  <span className="text-sm text-dust">תשלום חד־פעמי · בלי מנוי</span>
                </p>
                {perRole ? (
                  <p className="mt-1 text-xs text-dust">
                    כ־<span dir="ltr">{perRole}</span> לתפקיד
                  </p>
                ) : null}
                {offer?.enabled ? <SaleTag product={offer.product} className="mt-2" /> : null}
              </div>
              <Link
                to="/checkout"
                className="cta-shine inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-black text-primary-foreground transition hover:brightness-110 active:scale-[0.97]"
              >
                <Lock className="h-4 w-4" aria-hidden />
                פתחו את {places}
              </Link>
            </div>
            <ul className="mt-4 grid gap-2 text-xs leading-5 text-dust sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-steel" aria-hidden />
                תשלום מאובטח בעמוד של Grow. פרטי האשראי לא עוברים אלינו.
              </li>
              <li className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sand" aria-hidden />
                הפתיחה אוטומטית, בדרך כלל תוך דקה מאישור התשלום.
              </li>
              <li className="flex items-start gap-2">
                <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rust" aria-hidden />
                <span>
                  אפשר לבקש ביטול והחזר דרך{" "}
                  <Link to="/cancellation" className="font-semibold text-primary hover:underline">
                    עמוד הביטול
                  </Link>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-steel" aria-hidden />
                מתחת לגיל 18? בקופה אפשר לשלוח להורה קישור תשלום.
              </li>
            </ul>
            <p className="mt-3 text-xs leading-5 text-dust/80">
              המחיר כולל מע״מ ככל שחל.{" "}
              <Link
                to="/payment/return"
                search={{ interrupted: false }}
                className="font-semibold text-primary hover:underline"
              >
                כבר שילמתם?
              </Link>
            </p>
          </>
        ) : (
          <p className="mt-5 border-t border-iron/25 pt-4 text-sm leading-6 text-dust">
            הקופה אינה זמינה כרגע, ולכן לא מוצג כאן מחיר או קישור חיוב.
          </p>
        )}
      </div>
    </article>
  );
}

export function RoleMatchCards({
  roles,
  offer,
}: {
  roles: RoleMatch[];
  offer?: PaymentOffer | null;
}) {
  const topRolesTracked = useRef(false);
  const [infoSlug, setInfoSlug] = useState<string | undefined>(undefined);
  const closeInfo = useCallback(() => setInfoSlug(undefined), []);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const ordered = useMemo(() => [...roles].sort((left, right) => right.rank - left.rank), [roles]);
  const photos = useMemo(() => {
    const used = new Set<string>();
    return new Map(
      ordered
        .filter((role): role is UnlockedRoleMatch => role.kind === "role")
        .map((role) => [role.rank, pickRolePhoto(role.tags, role.roleTitle, role.rank, used)]),
    );
  }, [ordered]);

  // A new set of results (a fresh run or one picked from history) starts again at place 5.
  useEffect(() => setIndex(0), [roles]);

  useEffect(() => {
    if (
      !topRolesTracked.current &&
      ordered.some((role) => role.kind === "role" && (role.rank === 1 || role.rank === 2))
    ) {
      topRolesTracked.current = true;
      trackEvent("unlocked_top_roles_viewed");
    }
  }, [ordered]);

  if (!ordered.length) return null;

  // Free places one at a time; whatever is still locked (3, 2 and 1) shares the last slide.
  const locked = ordered.filter((role): role is LockedRoleMatch => role.kind === "locked");
  const slides: (UnlockedRoleMatch | "vault")[] = [
    ...ordered.filter((role): role is UnlockedRoleMatch => role.kind === "role"),
    ...(locked.length ? (["vault"] as const) : []),
  ];
  const bestFreeMatch = ordered.reduce<number | null>(
    (best, role) => (role.kind === "role" ? Math.max(best ?? 0, role.matchPercentage) : best),
    null,
  );
  const lockedRanks = locked.map((role) => role.rank).sort((a, b) => b - a);
  const lockedLabel = placesLabel(lockedRanks);
  const slideKey = (slide: UnlockedRoleMatch | "vault") =>
    slide === "vault" ? "vault" : `role-${slide.rank}`;
  const current = slides[Math.min(index, slides.length - 1)];
  const nextSlide = slides[index + 1];

  function go(target: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, target));
    if (clamped === index) return;
    setDir(clamped > index ? 1 : -1);
    setIndex(clamped);
    sectionRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }

  const renderSlide = (slide: UnlockedRoleMatch | "vault") =>
    slide === "vault" ? (
      <TopPlacesVault locked={locked} bestFreeMatch={bestFreeMatch} offer={offer} />
    ) : (
      <UnlockedRoleCard
        role={slide}
        photo={photos.get(slide.rank) ?? null}
        delayMs={0}
        onMoreInfo={() => setInfoSlug(roleInsightSlug(slide.roleTitle))}
      />
    );

  return (
    <section
      ref={sectionRef}
      className="scroll-mt-20 space-y-4"
      aria-labelledby="role-match-results-heading"
      dir="rtl"
    >
      <h2 id="role-match-results-heading" className="sr-only">
        חמש ההתאמות שלכם
      </h2>

      <nav aria-label="מעבר בין ההתאמות" className="flex items-center justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slideKey(slide)}
            type="button"
            onClick={() => go(i)}
            aria-current={i === index ? "step" : undefined}
            aria-label={slide === "vault" ? lockedLabel : `מקום ${slide.rank}`}
            className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-3 font-mono text-sm font-bold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.94] ${
              i === index
                ? "border-primary bg-primary text-primary-foreground"
                : i < index
                  ? "border-primary/40 text-primary"
                  : "border-iron/30 text-dust"
            }`}
          >
            {slide === "vault" ? (
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden />
                {lockedRanks.join("·")}
              </>
            ) : (
              slide.rank
            )}
          </button>
        ))}
      </nav>

      {/* One match at a time, 5 to 1. Swipe right or press "next" to move toward place 1. */}
      <div className="-mx-1 overflow-x-clip px-1 py-1">
        <m.div
          key={slideKey(current)}
          initial={
            reduce ? false : { opacity: 0, transform: `translateX(${dir > 0 ? -40 : 40}px)` }
          }
          animate={{ opacity: 1, transform: "translateX(0px)" }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.offset.x > 70) go(index + 1);
            else if (info.offset.x < -70) go(index - 1);
          }}
          className="space-y-4"
        >
          {renderSlide(current)}
        </m.div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-iron/35 px-4 text-sm font-semibold text-dust transition-colors hover:text-foreground disabled:invisible"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          הקודם
        </button>
        {nextSlide ? (
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110 active:scale-[0.97]"
          >
            {nextSlide === "vault" ? <Lock className="h-3.5 w-3.5" aria-hidden /> : null}
            {nextSlide === "vault" ? `ל${lockedLabel}` : `למקום ${nextSlide.rank}`}
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-dust">
        קח כיוון הוא כלי עזר לא רשמי ואינו קשור לצה״ל. ההתאמה אינה אישור זכאות או הבטחת שיבוץ. תנאי
        הסף, המיונים והנתונים העדכניים נקבעים רק על ידי צה״ל ויש לאמת אותם בערוצים הרשמיים.
      </p>
      <RoleInsightSheet slug={infoSlug} onClose={closeInfo} />
    </section>
  );
}
