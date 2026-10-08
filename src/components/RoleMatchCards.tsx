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
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
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
  Shield,
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
                  className="animate-progress h-full bg-primary"
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

function MatchRing({
  percentage,
  size = 84,
  delayMs = 0,
}: {
  percentage: number;
  size?: number;
  delayMs?: number;
}) {
  const gradientId = useId();
  const value = Math.min(100, Math.max(0, Math.round(percentage)));
  const big = size > 90;
  const stroke = big ? 9 : 7;
  const radius = (size - stroke) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--primary)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-iron/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="animate-ring drop-shadow-[0_0_6px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
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
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        role="img"
        aria-label={ARIA.matchPct(value)}
      >
        <span
          className={`font-mono font-black leading-none tabular-nums text-foreground ${big ? "text-3xl" : "text-2xl"}`}
          dir="ltr"
        >
          {value}
          <span className={`font-bold text-primary ${big ? "text-base" : "text-sm"}`}>%</span>
        </span>
        <span className="mt-1 text-[11px] font-semibold text-dust">התאמה</span>
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

function LockedRoleCard({ role, delayMs }: { role: LockedRoleMatch; delayMs: number }) {
  const headingId = useId();
  const featured = role.rank === 1;
  return (
    <article
      className={`animate-slide-up relative h-full overflow-hidden p-6 text-right ${
        featured
          ? "animate-top-glow border border-primary/60 bg-primary/5"
          : "border border-iron/30 bg-card"
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
      dir="rtl"
      aria-labelledby={headingId}
    >
      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0">
          <RankBadge rank={role.rank} featured={featured} />
          <h3
            id={headingId}
            className="mt-3 flex items-center gap-2 text-base font-black text-foreground"
          >
            {featured ? "ההתאמה הכי חזקה שלכם" : "התאמה חזקה עוד יותר"}
          </h3>
          <p className="mt-1 text-xs text-dust">
            {featured ? "התפקיד שהכי מתאים לכל מה שסיפרתם" : "מעל שלוש ההתאמות שראיתם"}
          </p>
          <div className="mt-3 space-y-2 opacity-50" aria-hidden>
            <div className="h-4 w-40 rounded-sm bg-iron/30 blur-[3px]" />
            <div className="h-3 w-56 max-w-full rounded-sm bg-iron/20 blur-[3px]" />
            <div className="h-3 w-32 rounded-sm bg-iron/20 blur-[3px]" />
          </div>
        </div>
        <MatchRing percentage={role.matchPercentage} size={featured ? 108 : 84} delayMs={delayMs} />
      </div>
    </article>
  );
}

const CHANCE_STYLE = {
  high: "border-primary/50 bg-primary/15 text-primary",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  low: "border-destructive/45 bg-destructive/10 text-red-200",
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
          <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
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
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
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
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
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
  const why = role.description || role.summary;

  return (
    <article
      className={`animate-slide-up overflow-hidden bg-card text-right ${
        featured ? "animate-top-glow border border-primary/60" : "border border-iron/30"
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
              {role.category ? (
                <p className="mt-1 text-xs text-dust">
                  {role.category}
                  {role.combat ? " · קרבי" : ""}
                </p>
              ) : null}
            </div>
            <MatchRing
              percentage={role.matchPercentage}
              size={featured ? 108 : 84}
              delayMs={delayMs}
            />
          </header>

          <section aria-labelledby={`${detailsId}-why`} className="border-r-2 border-primary pr-4">
            <h4 id={`${detailsId}-why`} className="text-sm font-black text-primary">
              למה זה מתאים לכם
            </h4>
            {role.summary && role.description ? (
              <p className="mt-1.5 text-base font-bold leading-7 text-foreground">{role.summary}</p>
            ) : null}
            <p
              className={`mt-1.5 max-w-prose text-[15px] leading-7 text-foreground/85 ${readMore ? "" : "line-clamp-3"}`}
            >
              {why || "לא סופק הסבר להתאמה זו."}
            </p>
            {why.length > 180 && !readMore ? (
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
                      <Icon className="h-3 w-3 shrink-0 text-primary/80" aria-hidden />
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
                  if (!expanded && role.rank >= 3 && role.rank <= 5) {
                    trackEvent("free_role_expanded", { rank: role.rank as 3 | 4 | 5 });
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
                    <CircleHelp className="h-4 w-4 text-primary" aria-hidden />
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

function PaywallCta({ offer }: { offer: PaymentOffer | null | undefined }) {
  useEffect(() => {
    if (offer?.enabled) trackEvent("paywall_viewed");
  }, [offer?.enabled]);

  if (!offer?.enabled) {
    return (
      <aside className="border border-iron/35 bg-card p-6 text-center sm:p-8" dir="rtl">
        <Lock className="mx-auto h-6 w-6 text-dust" aria-hidden />
        <h3 className="mt-3 text-lg font-black text-foreground">
          לא ניתן לפתוח את שתי ההתאמות כרגע
        </h3>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-dust">
          הקופה אינה זמינה, ולכן לא מוצג כאן מחיר או קישור חיוב.
        </p>
      </aside>
    );
  }

  const price = formatPaymentPrice(offer.product);

  return (
    <aside
      className="border border-primary/45 bg-primary/10 p-6 text-center sm:p-8"
      aria-labelledby="top-two-paywall-heading"
      dir="rtl"
    >
      <Lock className="mx-auto h-6 w-6 text-primary" aria-hidden />
      <h3 id="top-two-paywall-heading" className="mt-3 text-lg font-black text-foreground">
        רוצים לראות את מקומות 2 ו־1?
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-dust">
        תשלום חד־פעמי של {price}, כולל מע״מ ככל שחל. נפתח לצמיתות בחשבון, גם בחישובים הבאים. בלי
        מנוי.
      </p>
      <Link
        to="/checkout"
        className="mt-5 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-black text-primary-foreground transition hover:brightness-110"
      >
        פתיחת מקומות 2 ו־1 ב־{price} פעם אחת, ללא מנוי
      </Link>
    </aside>
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

  const current = ordered[Math.min(index, ordered.length - 1)];
  const nextRole = ordered[index + 1];

  function go(target: number) {
    const clamped = Math.max(0, Math.min(ordered.length - 1, target));
    if (clamped === index) return;
    setDir(clamped > index ? 1 : -1);
    setIndex(clamped);
    sectionRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }

  const renderCard = (role: RoleMatch) =>
    role.kind === "role" ? (
      <UnlockedRoleCard
        role={role}
        photo={photos.get(role.rank) ?? null}
        delayMs={0}
        onMoreInfo={() => setInfoSlug(roleInsightSlug(role.roleTitle))}
      />
    ) : (
      <LockedRoleCard role={role} delayMs={0} />
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
        {ordered.map((role, i) => (
          <button
            key={`${role.kind}-${role.rank}`}
            type="button"
            onClick={() => go(i)}
            aria-current={i === index ? "step" : undefined}
            aria-label={`מקום ${role.rank}`}
            className={`flex h-11 w-11 items-center justify-center rounded-full border font-mono text-sm font-bold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.94] ${
              i === index
                ? "border-primary bg-primary text-primary-foreground"
                : i < index
                  ? "border-primary/40 text-primary"
                  : "border-iron/30 text-dust"
            }`}
          >
            {role.rank}
          </button>
        ))}
      </nav>

      {/* One match at a time, 5 to 1. Swipe right or press "next" to move toward place 1. */}
      <div className="-mx-1 overflow-x-clip px-1 py-1">
        <motion.div
          key={`${current.kind}-${current.rank}`}
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
          {renderCard(current)}
          {/* The payment shows the moment the person reaches a locked place (2 or 1). */}
          {current.kind === "locked" ? <PaywallCta offer={offer} /> : null}
        </motion.div>
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
        {nextRole ? (
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110 active:scale-[0.97]"
          >
            למקום {nextRole.rank}
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-dust">
        ההתאמה אינה אישור זכאות או הבטחת שיבוץ. תנאי הסף, המיונים והנתונים העדכניים נקבעים רק על ידי
        צה״ל ויש לאמת אותם בערוצים הרשמיים.
      </p>
      <RoleInsightSheet slug={infoSlug} onClose={closeInfo} />
    </section>
  );
}
