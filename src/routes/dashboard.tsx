import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Compass,
  Lock,
  Mountain,
  PencilLine,
  Sparkles,
  Target,
} from "lucide-react";
import { DashboardAccountPreferences } from "@/components/DashboardAccountPreferences";
import { DashboardSkeleton } from "@/components/skeletons/PageSkeletons";
import { YomRadar } from "@/features/assessment/components/YomRadar";
import { normalizeAssessmentAnswers } from "@/features/assessment/draft";
import { dimensionRows, nextSteps } from "@/features/assessment/insights";
import { migrateLegacyYomHameah, YOM_HAMEAH_KEYS } from "@/lib/yom-hameah";
import { progressBarProps } from "@/lib/a11y";
import {
  getLatestAssessment,
  getMatchHistory,
  getPaymentOffer,
  listMatchHistory,
  type RoleMatch,
} from "@/lib/api";
import { dashboardQueryOptions } from "@/lib/queries";
import { getToken } from "@/lib/auth";
import { formatPaymentPrice } from "@/lib/payment-offer";
import { AI_PROFILE_MISSING_LABELS } from "@/lib/profile-preference-data";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "דשבורד | קח כיוון" },
      {
        name: "description",
        content: "דשבורד אישי: ההתאמות שלכם, הנתונים, מפת החוזקות וספירה לאחור לגיוס.",
      },
    ],
  }),
});

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

function useCountdown(target: Date | null, windowStart: Date | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!target || Number.isNaN(target.getTime())) return { days: 0, towardPct: 0 };
  const diff = Math.max(0, target.getTime() - now.getTime());
  const days = Math.ceil(diff / 86_400_000);
  const fallbackStart = new Date(now.getTime() - 365 * 86_400_000);
  const start = windowStart && !Number.isNaN(windowStart.getTime()) ? windowStart : fallbackStart;
  const total = target.getTime() - start.getTime();
  const towardPct =
    total <= 0
      ? 100
      : Math.min(100, Math.max(0, Math.round(((now.getTime() - start.getTime()) / total) * 100)));
  return { days, towardPct };
}

function statusHebrew(status: string) {
  if (status === "Active Duty") return "בשירות פעיל";
  if (status === "Discharged") return "אחרי שירות";
  return "לפני גיוס";
}

function yomSummary(yom: unknown) {
  const m = migrateLegacyYomHameah(yom);
  if (!m) return { label: "-", pct: 0 };
  const sum = YOM_HAMEAH_KEYS.reduce((acc, k) => acc + m[k], 0);
  const avg = sum / YOM_HAMEAH_KEYS.length;
  return { label: avg.toFixed(1), pct: Math.min(100, Math.round((avg / 5) * 100)) };
}

function displayName(email: string) {
  const local = email.split("@")[0] ?? "";
  return local.length > 16 ? `${local.slice(0, 14)}…` : local;
}

function Card({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon: typeof Target;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={fadeUp}
      className={`min-w-0 border border-iron/30 bg-card p-4 text-right sm:p-6 ${className}`}
    >
      <h2 className="mb-4 flex items-center gap-2 text-base font-black text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const token = mounted ? getToken() : null;

  useEffect(() => {
    if (mounted && !getToken()) navigate({ to: "/post-signup" });
  }, [mounted, navigate]);

  const { data, isPending, isError, error, refetch } = useQuery({
    ...dashboardQueryOptions(token),
    enabled: mounted && !!token,
  });
  const historyQuery = useQuery({
    queryKey: ["match-history"],
    queryFn: listMatchHistory,
    enabled: mounted && !!token,
    staleTime: 60_000,
  });
  const latestRunId = historyQuery.data?.generations?.[0]?.id;
  const latestRunQuery = useQuery({
    queryKey: ["match-history", latestRunId],
    queryFn: () => getMatchHistory(latestRunId as string),
    enabled: Boolean(latestRunId),
    staleTime: 60_000,
  });
  const assessmentQuery = useQuery({
    queryKey: ["assessment", "latest"],
    queryFn: getLatestAssessment,
    enabled: mounted && !!token,
    staleTime: 60_000,
  });
  const offerQuery = useQuery({
    queryKey: ["payment-offer"],
    queryFn: getPaymentOffer,
    enabled: mounted,
    staleTime: 60_000,
  });

  const countdownTarget = useMemo(() => {
    const status = data?.user?.status;
    const raw =
      status === "Active Duty"
        ? data?.stats?.dischargeDate
        : status === "Pre-Draft"
          ? data?.stats?.draftDate
          : null;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [data?.user?.status, data?.stats?.draftDate, data?.stats?.dischargeDate]);
  const profileStart = useMemo(() => {
    const d = data?.user?.createdAt ? new Date(data.user.createdAt) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  }, [data?.user?.createdAt]);
  const { days, towardPct } = useCountdown(countdownTarget, profileStart);

  const answers = useMemo(
    () =>
      assessmentQuery.data?.assessment
        ? normalizeAssessmentAnswers(assessmentQuery.data.assessment.answers)
        : null,
    [assessmentQuery.data],
  );

  if (!mounted || !token) {
    return <p className="py-16 text-center text-dust">{mounted ? "מעבירים להתחברות…" : "…"}</p>;
  }
  if (isPending && !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <DashboardSkeleton />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" dir="rtl">
        <p className="text-destructive">{error instanceof Error ? error.message : "שגיאה"}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 min-h-11 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          נסו שוב
        </button>
        <Link
          to="/post-signup"
          hash="login"
          className="mt-3 block text-sm text-primary hover:underline"
        >
          התחברות מחדש
        </Link>
      </div>
    );
  }

  const name = data.user.preferredName?.trim() || displayName(data.user.email) || "";
  const yom = yomSummary(data.stats?.yomHameah ?? undefined);
  const dapar = data.stats?.daparScore;
  const medical = data.stats?.medicalProfile;
  const showStrengths =
    answers && (answers.yomHameahSource === "official" || answers.yomHameahSource === "self");
  const missingLabels =
    data.aiProfileMissing?.map((k) => AI_PROFILE_MISSING_LABELS[k] ?? k).filter(Boolean) ?? [];

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-10"
      dir="rtl"
    >
      <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-dust">הדשבורד שלך</p>
          <h1 className="mt-1 truncate text-2xl font-black text-foreground sm:text-3xl">
            שלום
            {name ? (
              <>
                , <span className="text-primary">{name}</span>
              </>
            ) : null}
          </h1>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-olive/30 bg-olive/10 px-3 py-1 text-xs font-semibold text-olive-foreground">
          <span className="h-2 w-2 rounded-full bg-olive" aria-hidden />
          {statusHebrew(data.user.status)}
        </span>
      </motion.header>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <ResultsCard
            aiReady={Boolean(data.aiReady)}
            missingLabels={missingLabels}
            roles={latestRunQuery.data?.generation?.roles ?? null}
            loading={historyQuery.isPending || (Boolean(latestRunId) && latestRunQuery.isPending)}
            unlocked={
              latestRunQuery.data?.access?.topTwoUnlocked ??
              historyQuery.data?.access?.topTwoUnlocked ??
              false
            }
            priceLabel={
              offerQuery.data?.enabled ? formatPaymentPrice(offerQuery.data.product) : null
            }
          />
          <GibushLink
            open={Boolean(
              historyQuery.data?.access &&
              (!historyQuery.data.access.paywallEnabled || historyQuery.data.access.topTwoUnlocked),
            )}
          />
          {answers ? <NextStepsCard steps={nextSteps(answers)} /> : null}
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-5">
          {countdownTarget ? (
            <Card
              title={data.user.status === "Active Duty" ? "עד השחרור" : "עד הגיוס"}
              icon={Calendar}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-5xl font-black leading-none text-foreground">
                  {days}
                </span>
                <span className="text-base font-semibold text-dust">ימים</span>
              </div>
              <div className="mt-4">
                <Meter value={towardPct} label="התקדמות לקראת הגיוס" />
                <p className="mt-2 text-xs text-dust">
                  {countdownTarget.toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </Card>
          ) : null}

          <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat
              label='דפ"ר'
              value={dapar != null ? String(dapar) : "-"}
              pct={dapar != null ? Math.round(((dapar - 10) / 80) * 100) : 0}
              note="מתוך 90"
            />
            <Stat
              label="פרופיל"
              value={medical != null ? String(medical) : "-"}
              pct={medical != null ? Math.round(((medical - 21) / 76) * 100) : 0}
              note="מתוך 97"
            />
            <Stat label="מא״ה" value={yom.label} pct={yom.pct} note="ממוצע מ־5" />
          </motion.div>

          {showStrengths && answers ? <StrengthsCard answers={answers} /> : null}
        </div>
      </div>

      <motion.nav
        variants={fadeUp}
        aria-label="פעולות מהירות"
        className="grid gap-2 sm:grid-cols-3"
      >
        <QuickLink to="/post-signup" hash="edit" icon={PencilLine} label="עדכון ההערכה" />
        <QuickLink to="/role-insights" icon={Compass} label="כל התפקידים בצה״ל" />
        <QuickLink to="/ai-counselor" icon={Sparkles} label="התוצאות המלאות" />
      </motion.nav>

      <motion.div variants={fadeUp}>
        <DashboardAccountPreferences data={data} />
      </motion.div>
    </motion.div>
  );
}

function ResultsCard({
  aiReady,
  missingLabels,
  roles,
  loading,
  unlocked,
  priceLabel,
}: {
  aiReady: boolean;
  missingLabels: string[];
  roles: RoleMatch[] | null;
  loading: boolean;
  unlocked: boolean;
  priceLabel: string | null;
}) {
  if (!aiReady) {
    return (
      <Card title="ההתאמות שלך" icon={Target}>
        <p className="text-sm leading-6 text-dust">
          חסרים עוד כמה פרטים כדי לבנות את 5 ההתאמות שלכם
          {missingLabels.length ? `: ${missingLabels.join(", ")}` : "."}
        </p>
        <Link
          to="/post-signup"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground sm:w-auto"
        >
          השלמת ההערכה
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      </Card>
    );
  }
  if (loading) {
    return (
      <Card title="ההתאמות שלך" icon={Target}>
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-md bg-iron/15" />
          ))}
        </div>
      </Card>
    );
  }
  if (!roles?.length) {
    return (
      <Card title="ההתאמות שלך" icon={Target}>
        <p className="text-sm leading-6 text-dust">
          הפרופיל מוכן. נשאר רק לבנות את 5 ההתאמות שלכם.
        </p>
        <Link
          to="/ai-counselor"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground sm:w-auto"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          קבלו את ההתאמות
        </Link>
      </Card>
    );
  }

  const ordered = [...roles].sort((a, b) => a.rank - b.rank);
  const lockedCount = ordered.filter((r) => r.kind === "locked").length;

  return (
    <Card title="ההתאמות שלך" icon={Target}>
      <ol className="space-y-2">
        {ordered.map((role) => {
          const locked = role.kind === "locked";
          return (
            <li key={role.rank}>
              <Link
                to="/ai-counselor"
                className={`flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 transition hover:border-primary/50 ${
                  locked ? "border-primary/25 bg-primary/[0.06]" : "border-iron/25 bg-background/40"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-black ${
                    role.rank === 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {role.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                  {locked ? (
                    <span className="inline-flex items-center gap-1.5 text-dust">
                      <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
                      נעול
                    </span>
                  ) : (
                    role.roleTitle
                  )}
                </span>
                <span className="shrink-0 font-mono text-sm font-bold text-foreground" dir="ltr">
                  {role.matchPercentage}%
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {lockedCount && !unlocked && priceLabel ? (
        <Link
          to="/checkout"
          className="cta-shine mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-center text-sm font-black text-primary-foreground transition hover:brightness-110"
        >
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          פתיחת {lockedCount === 3 ? "שלוש" : lockedCount} ההתאמות החזקות ב־{priceLabel}
        </Link>
      ) : (
        <Link
          to="/ai-counselor"
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-primary/50 px-4 text-sm font-bold text-primary transition hover:bg-primary/10"
        >
          לכל ההסברים והפרטים
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </Card>
  );
}

function StrengthsCard({ answers }: { answers: ReturnType<typeof normalizeAssessmentAnswers> }) {
  const { rows, flat } = dimensionRows(answers);
  const top = rows.filter((r) => r.top);
  return (
    <Card title="מפת החוזקות שלך" icon={Sparkles}>
      <div className="mx-auto w-full max-w-[19rem]">
        <YomRadar answers={answers} />
      </div>
      {top.length && !flat ? (
        <ul className="mt-4 space-y-2">
          {top.map((r) => (
            <li
              key={r.key}
              className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/10 p-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary font-mono text-sm font-black text-primary-foreground">
                {r.score}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-foreground">{r.label}</span>
                <span className="block truncate text-xs text-dust">פותח: {r.opens}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function NextStepsCard({ steps }: { steps: string[] }) {
  return (
    <Card title="מה עושים עכשיו" icon={CheckCircle2}>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li
            key={step}
            className="flex items-start gap-3 rounded-md border border-iron/25 bg-background/40 px-3 py-2.5"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
              {i + 1}
            </span>
            <span className="text-sm leading-6 text-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** The paid gibush simulation, right under the results it is sold with. */
function GibushLink({ open }: { open: boolean }) {
  return (
    <Link
      to="/gibush"
      className="group flex min-h-16 items-center gap-3 border border-primary/30 bg-primary/[0.05] px-4 py-3 transition hover:border-primary/60"
    >
      <Mountain className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-foreground">מוכנות לגיבוש</span>
        <span className="block text-xs leading-5 text-dust">
          סימולציה של יום הגיבוש, כרטיס לוחם ותוכנית אימון
        </span>
      </span>
      {open ? (
        <ChevronLeft
          className="h-4 w-4 shrink-0 text-dust transition group-hover:text-primary"
          aria-hidden
        />
      ) : (
        <Lock className="h-4 w-4 shrink-0 text-primary" aria-label="בתשלום" />
      )}
    </Link>
  );
}

function QuickLink({
  to,
  hash,
  icon: Icon,
  label,
}: {
  to: "/post-signup" | "/role-insights" | "/ai-counselor";
  hash?: string;
  icon: typeof Target;
  label: string;
}) {
  return (
    <Link
      to={to}
      hash={hash}
      className="flex min-h-12 items-center justify-between gap-3 border border-iron/30 bg-card px-4 text-sm font-bold text-foreground transition hover:border-primary/40"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {label}
      </span>
      <ChevronLeft className="h-4 w-4 text-dust" aria-hidden />
    </Link>
  );
}

function Meter({ value, label }: { value: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-primary/15"
      {...progressBarProps(clamped, label)}
    >
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.85, ease }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  pct,
  note,
}: {
  label: string;
  value: string;
  pct: number;
  note: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border border-iron/30 bg-card p-3 text-right sm:p-4">
      <p className="truncate text-xs text-dust">{label}</p>
      <p className="font-mono text-2xl font-black leading-none text-foreground sm:text-3xl">
        {value}
      </p>
      <Meter value={pct} label={`${label}: ${value}`} />
      <p className="truncate text-[11px] text-dust">{note}</p>
    </div>
  );
}
