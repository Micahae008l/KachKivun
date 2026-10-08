import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Ban,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { AdminSkeleton } from "@/components/skeletons/PageSkeletons";
import {
  ApiError,
  blockIpRequest,
  unblockIpRequest,
  type SecurityEventType,
  type SecuritySeverity,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  adminMeQueryOptions,
  blockedIpsQueryOptions,
  securityEventsQueryOptions,
  securityOverviewQueryOptions,
  sessionQueryOptions,
} from "@/lib/queries";

export const Route = createFileRoute("/admin_/security")({
  component: SecurityPage,
});

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};

// One minute · frequent enough for monitoring without eating the API rate-limit budget.
const AUTO_REFRESH_MS = 60_000;

// Palette validated for the dark surface (CVD-safe pair, dataviz six checks).
const CHART_TOTAL = "#7d9c55";
const CHART_SEVERE = "#b0514c";

const TYPE_LABELS: Record<SecurityEventType, string> = {
  rate_limit_api: "חריגת קצב API",
  rate_limit_auth: "חריגת קצב כניסה",
  otp_failed: "קוד OTP שגוי",
  otp_locked: "נעילת OTP (ברוט־פורס)",
  invalid_token: "טוקן לא תקין / מזויף",
  admin_denied: "ניסיון גישה לניהול",
  oversized_url: "כתובת חריגה באורכה",
  payload_too_large: "גוף בקשה גדול מדי",
  invalid_json: "JSON שבור",
  suspicious_path: "סריקת פגיעויות",
  not_found_probe: "בדיקת נתיבים (404)",
  blocked_ip_hit: "בקשה מ־IP חסום",
  refresh_token_reuse: "שימוש חוזר בטוקן התחברות (גניבה אפשרית)",
};

const SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
  critical: "קריטית",
};

const SEVERITY_ORDER: SecuritySeverity[] = ["critical", "high", "medium", "low"];

function typeLabel(type: string) {
  return TYPE_LABELS[type as SecurityEventType] ?? type;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("he-IL");
}

function formatHour(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

/**
 * recharts' ResponsiveContainer fails to measure under React 19 · observe the
 * width ourselves. Callback ref, because the container mounts only after the
 * overview data arrives.
 */
function useContainerWidth() {
  const [width, setWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    roRef.current = ro;
  }, []);
  return { ref, width };
}

function SeverityBadge({ severity }: { severity: SecuritySeverity }) {
  const styles: Record<SecuritySeverity, string> = {
    low: "bg-iron/20 text-dust",
    medium: "bg-[#daa24f]/15 text-[#daa24f]",
    high: "bg-[#e2726b]/15 text-[#e2726b]",
    critical: "bg-destructive/25 text-[#f0a29b]",
  };
  return (
    <span className={`rounded-sm px-2 py-0.5 text-[11px] font-semibold ${styles[severity]}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function SecurityPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);

  const [typeFilter, setTypeFilter] = useState<SecurityEventType | "">("");
  const [severityFilter, setSeverityFilter] = useState<SecuritySeverity | "">("");
  const [ipFilter, setIpFilter] = useState("");
  const [debouncedIp, setDebouncedIp] = useState("");
  const [page, setPage] = useState(0);

  const [blockIpInput, setBlockIpInput] = useState("");
  const [blockReasonInput, setBlockReasonInput] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedIp(ipFilter.trim()), 300);
    return () => clearTimeout(t);
  }, [ipFilter]);

  useEffect(() => {
    setPage(0);
  }, [typeFilter, severityFilter, debouncedIp]);

  const token = mounted ? getToken() : null;

  useEffect(() => {
    if (mounted && !token) {
      navigate({ to: "/post-signup" });
    }
  }, [mounted, token, navigate]);

  const session = useQuery({
    ...sessionQueryOptions(!!token),
    enabled: mounted && !!token,
    retry: 1,
  });

  const adminMe = useQuery({
    ...adminMeQueryOptions(token),
    enabled: mounted && !!token && session.data?.role === "admin",
    retry: false,
  });

  useEffect(() => {
    if (session.isSuccess && session.data.role !== "admin") {
      toast.error("אין הרשאת מנהל. התחברו עם חשבון מנהל מורשה.");
      navigate({ to: "/dashboard" });
    }
  }, [session.isSuccess, session.data?.role, navigate]);

  useEffect(() => {
    if (adminMe.isError && adminMe.error instanceof ApiError && adminMe.error.status === 403) {
      toast.error("אין הרשאת מנהל");
      navigate({ to: "/dashboard" });
    }
  }, [adminMe.isError, adminMe.error, navigate]);

  const overview = useQuery({
    ...securityOverviewQueryOptions(token),
    enabled: mounted && !!token && adminMe.isSuccess,
    refetchInterval: AUTO_REFRESH_MS,
  });

  const PAGE_SIZE = 25;
  const eventsQuery = useQuery({
    ...securityEventsQueryOptions(token, {
      type: typeFilter,
      severity: severityFilter,
      ip: debouncedIp,
      limit: PAGE_SIZE,
      skip: page * PAGE_SIZE,
    }),
    enabled: mounted && !!token && adminMe.isSuccess,
    refetchInterval: AUTO_REFRESH_MS,
  });

  const blockedIps = useQuery({
    ...blockedIpsQueryOptions(token),
    enabled: mounted && !!token && adminMe.isSuccess,
  });

  function invalidateSecurity() {
    void queryClient.invalidateQueries({ queryKey: ["admin-security-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-security-events"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-blocked-ips"] });
  }

  const blockMutation = useMutation({
    mutationFn: ({ ip, reason }: { ip: string; reason?: string }) => blockIpRequest(ip, reason),
    onSuccess: (data) => {
      toast.success(`נחסם: ${data.blockedIp.ip}`);
      setBlockIpInput("");
      setBlockReasonInput("");
      invalidateSecurity();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => unblockIpRequest(id),
    onSuccess: (data) => {
      toast.success(`החסימה הוסרה: ${data.ip}`);
      invalidateSecurity();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ov = overview.data;

  const severeCount7d = useMemo(() => {
    if (!ov) return 0;
    return ov.bySeverity
      .filter((s) => s.severity === "high" || s.severity === "critical")
      .reduce((sum, s) => sum + s.count, 0);
  }, [ov]);

  const authAttackCount7d = useMemo(() => {
    if (!ov) return 0;
    const authTypes = new Set(["otp_failed", "otp_locked", "rate_limit_auth"]);
    return ov.byType.filter((t) => authTypes.has(t.type)).reduce((sum, t) => sum + t.count, 0);
  }, [ov]);

  const timelineData = useMemo(
    () =>
      (ov?.timeline ?? []).map((b) => ({
        hour: formatHour(b.hour),
        "סה״כ אירועים": b.count,
        "אירועים חמורים": b.severe,
      })),
    [ov],
  );

  const blockedIpByAddress = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of blockedIps.data?.blockedIps ?? []) map.set(b.ip, b.id);
    return map;
  }, [blockedIps.data]);

  const { ref: chartRef, width: chartWidth } = useContainerWidth();

  const busy =
    (session.isPending && !session.data) ||
    (session.data?.role === "admin" &&
      ((adminMe.isPending && !adminMe.data) ||
        (adminMe.isSuccess && overview.isPending && !overview.data)));

  const totalPages = eventsQuery.data
    ? Math.max(1, Math.ceil(eventsQuery.data.total / PAGE_SIZE))
    : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 topo-lines">
      {!mounted || !token ? (
        <p className="text-center text-dust">מעבירים להתחברות…</p>
      ) : session.isError ? (
        <div className="mx-auto max-w-md border border-iron/30 bg-card p-8 text-center">
          <p className="text-destructive">
            {session.error instanceof Error ? session.error.message : "שגיאה"}
          </p>
        </div>
      ) : session.data?.role !== "admin" ? (
        <p className="text-center text-dust">מעבירים לדשבורד…</p>
      ) : busy ? (
        <AdminSkeleton />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
          <motion.div
            variants={fadeUp}
            className="flex flex-col-reverse gap-4 border-b border-iron/30 pb-6 sm:flex-row sm:items-end sm:justify-between"
          >
            <div className="text-right">
              <p className="mb-2 font-mono text-xs tracking-widest text-dust uppercase">
                ניטור התקפות ומודרציית שרת
              </p>
              <h1 className="text-2xl font-black sm:text-4xl">מרכז אבטחה</h1>
              <p className="mt-2 flex items-center justify-end gap-2 text-sm text-dust">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                מתעדכן אוטומטית כל דקה
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  void overview.refetch();
                  void eventsQuery.refetch();
                  void blockedIps.refetch();
                }}
                className="inline-flex items-center gap-2 rounded-md border border-iron/40 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                רענון
              </button>
              <Link
                to="/admin"
                className="rounded-md border border-iron/40 bg-card px-3 py-1.5 text-xs font-medium text-dust transition hover:text-foreground"
              >
                פאנל מנהל
              </Link>
              <Link
                to="/dashboard"
                className="rounded-md border border-iron/40 bg-card px-3 py-1.5 text-xs font-medium text-dust transition hover:text-foreground"
              >
                חזרה לדשבורד
              </Link>
            </div>
          </motion.div>

          {overview.isError ? (
            <div className="border border-destructive/40 bg-card p-6 text-center text-destructive">
              {overview.error instanceof Error ? overview.error.message : "שגיאה"}
            </div>
          ) : ov ? (
            <>
              <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  icon={Activity}
                  label="אירועים ב־24 שעות"
                  value={String(ov.totals.last24h)}
                  hint={`${ov.totals.last7d} בשבוע האחרון`}
                />
                <MetricCard
                  icon={ShieldAlert}
                  label="אירועים חמורים"
                  value={String(severeCount7d)}
                  hint="חומרה גבוהה/קריטית · 7 ימים"
                />
                <MetricCard
                  icon={KeyRound}
                  label="תקיפות כניסה"
                  value={String(authAttackCount7d)}
                  hint="OTP שגוי, נעילות וחריגות קצב · 7 ימים"
                />
                <MetricCard
                  icon={Ban}
                  label="כתובות IP חסומות"
                  value={String(ov.blockedIpCount)}
                  hint={`${ov.totals.allTime} אירועים סה״כ`}
                />
              </motion.div>

              <motion.div variants={fadeUp} className="border border-iron/30 bg-card p-5 sm:p-6">
                <p className="mb-4 font-mono text-xs tracking-widest text-dust uppercase">
                  אירועי אבטחה · 48 שעות אחרונות
                </p>
                <div dir="ltr" ref={chartRef} className="h-64 w-full">
                  {chartWidth > 0 && (
                    <AreaChart
                      width={chartWidth}
                      height={256}
                      data={timelineData}
                      margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="secTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_TOTAL} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={CHART_TOTAL} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="secSevere" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_SEVERE} stopOpacity={0.32} />
                          <stop offset="100%" stopColor={CHART_SEVERE} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--iron)" strokeOpacity={0.25} vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: "var(--dust)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--iron)", strokeOpacity: 0.4 }}
                        minTickGap={28}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "var(--dust)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={46}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--iron)",
                          borderRadius: 6,
                          fontSize: 12,
                          direction: "rtl",
                        }}
                        labelStyle={{ color: "var(--dust)" }}
                        cursor={{
                          stroke: "var(--dust)",
                          strokeOpacity: 0.4,
                          strokeDasharray: "3 3",
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12, direction: "rtl" }}
                        iconType="plainline"
                        iconSize={14}
                      />
                      <Area
                        type="monotone"
                        dataKey="סה״כ אירועים"
                        stroke={CHART_TOTAL}
                        strokeWidth={2}
                        fill="url(#secTotal)"
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="אירועים חמורים"
                        stroke={CHART_SEVERE}
                        strokeWidth={2}
                        fill="url(#secSevere)"
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  )}
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-2">
                <div className="border border-iron/30 bg-card p-5 sm:p-6">
                  <p className="mb-4 font-mono text-xs tracking-widest text-dust uppercase">
                    סוגי אירועים · 7 ימים
                  </p>
                  {ov.byType.length === 0 ? (
                    <EmptyState text="אין אירועי אבטחה בשבוע האחרון. זה טוב." />
                  ) : (
                    <ul className="space-y-2.5">
                      {ov.byType.map((t) => {
                        const max = ov.byType[0]?.count || 1;
                        return (
                          <li key={t.type} className="text-sm">
                            <div className="mb-1 flex items-baseline justify-between gap-3">
                              <span className="font-mono text-xs tabular-nums text-dust">
                                {t.count}
                              </span>
                              <span className="text-foreground">{typeLabel(t.type)}</span>
                            </div>
                            <div dir="ltr" className="h-1.5 w-full rounded-full bg-iron/20">
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: `${Math.max(4, Math.round((t.count / max) * 100))}%`,
                                  background: CHART_TOTAL,
                                }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="border border-iron/30 bg-card p-5 sm:p-6">
                  <p className="mb-4 font-mono text-xs tracking-widest text-dust uppercase">
                    כתובות IP מובילות · 7 ימים
                  </p>
                  {ov.topIps.length === 0 ? (
                    <EmptyState text="אין כתובות IP עם אירועים בשבוע האחרון." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[26rem] text-right text-sm">
                        <thead>
                          <tr className="border-b border-iron/20 text-xs text-dust">
                            <th className="py-2 pl-3 font-medium">IP</th>
                            <th className="py-2 pl-3 font-medium">אירועים</th>
                            <th className="py-2 pl-3 font-medium">חמורים</th>
                            <th className="py-2 pl-3 font-medium">נראה לאחרונה</th>
                            <th className="py-2 font-medium">פעולה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ov.topIps.map((row) => {
                            const blockedId = blockedIpByAddress.get(row.ip);
                            const isBlocked = row.blocked || !!blockedId;
                            return (
                              <tr key={row.ip} className="border-b border-iron/10">
                                <td className="py-2.5 pl-3">
                                  <span dir="ltr" className="font-mono text-xs">
                                    {row.ip}
                                  </span>
                                </td>
                                <td className="py-2.5 pl-3 font-mono text-xs tabular-nums">
                                  {row.count}
                                </td>
                                <td className="py-2.5 pl-3 font-mono text-xs tabular-nums">
                                  {row.severe > 0 ? (
                                    <span className="text-[#e2726b]">{row.severe}</span>
                                  ) : (
                                    "0"
                                  )}
                                </td>
                                <td className="py-2.5 pl-3 text-xs text-dust">
                                  {formatDate(row.lastAt)}
                                </td>
                                <td className="py-2.5">
                                  {isBlocked ? (
                                    blockedId ? (
                                      <button
                                        type="button"
                                        disabled={unblockMutation.isPending}
                                        onClick={() => unblockMutation.mutate(blockedId)}
                                        className="inline-flex items-center gap-1 rounded border border-iron/30 px-2 py-1 text-[11px] text-dust transition hover:text-foreground disabled:opacity-40"
                                      >
                                        <ShieldCheck className="h-3 w-3" />
                                        הסר חסימה
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-dust">חסום</span>
                                    )
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={blockMutation.isPending}
                                      onClick={() =>
                                        blockMutation.mutate({
                                          ip: row.ip,
                                          reason: "נחסם מדשבורד האבטחה (IP מוביל)",
                                        })
                                      }
                                      className="inline-flex items-center gap-1 rounded border border-destructive/30 px-2 py-1 text-[11px] text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
                                    >
                                      <ShieldX className="h-3 w-3" />
                                      חסום
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          ) : null}

          <motion.div variants={fadeUp} className="border border-iron/30 bg-card p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="font-mono text-xs tracking-widest text-dust uppercase">יומן אירועים</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as SecurityEventType | "")}
                  className="rounded-md border border-iron/30 bg-background px-2 py-1.5 text-xs text-foreground outline-none transition focus:border-primary/50"
                >
                  <option value="">כל הסוגים</option>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as SecuritySeverity | "")}
                  className="rounded-md border border-iron/30 bg-background px-2 py-1.5 text-xs text-foreground outline-none transition focus:border-primary/50"
                >
                  <option value="">כל הרמות</option>
                  {SEVERITY_ORDER.map((s) => (
                    <option key={s} value={s}>
                      חומרה {SEVERITY_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  dir="ltr"
                  value={ipFilter}
                  onChange={(e) => setIpFilter(e.target.value)}
                  placeholder="סינון לפי IP…"
                  className="w-36 rounded-md border border-iron/30 bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none transition focus:border-primary/50"
                />
              </div>
            </div>

            {eventsQuery.isError ? (
              <p className="text-sm text-destructive">
                {eventsQuery.error instanceof Error ? eventsQuery.error.message : "שגיאה"}
              </p>
            ) : (eventsQuery.data?.events.length ?? 0) === 0 ? (
              <EmptyState text="אין אירועים תואמים. אירועים חדשים יופיעו כאן אוטומטית." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[46rem] text-right text-sm">
                    <thead>
                      <tr className="border-b border-iron/20 text-xs text-dust">
                        <th className="py-2 pl-3 font-medium">זמן</th>
                        <th className="py-2 pl-3 font-medium">סוג</th>
                        <th className="py-2 pl-3 font-medium">חומרה</th>
                        <th className="py-2 pl-3 font-medium">IP</th>
                        <th className="py-2 pl-3 font-medium">נתיב</th>
                        <th className="py-2 font-medium">פרטים</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(eventsQuery.data?.events ?? []).map((e) => (
                        <tr key={e.id} className="border-b border-iron/10 align-top">
                          <td className="whitespace-nowrap py-2.5 pl-3 text-xs text-dust">
                            {formatDate(e.createdAt)}
                          </td>
                          <td className="py-2.5 pl-3">{typeLabel(e.type)}</td>
                          <td className="py-2.5 pl-3">
                            <SeverityBadge severity={e.severity} />
                          </td>
                          <td className="py-2.5 pl-3">
                            <button
                              type="button"
                              dir="ltr"
                              onClick={() => setIpFilter(e.ip)}
                              className="font-mono text-xs text-dust transition hover:text-foreground"
                              title="סינון לפי כתובת זו"
                            >
                              {e.ip || "-"}
                            </button>
                          </td>
                          <td className="max-w-[14rem] py-2.5 pl-3">
                            <span dir="ltr" className="block truncate font-mono text-xs text-dust">
                              {e.method ? `${e.method} ` : ""}
                              {e.path || "-"}
                            </span>
                          </td>
                          <td className="max-w-[16rem] py-2.5">
                            <span className="block truncate text-xs text-dust">
                              {[e.email, e.message].filter(Boolean).join(" · ") || "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-dust">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="rounded border border-iron/30 px-2.5 py-1 transition hover:text-foreground disabled:opacity-40"
                    >
                      הקודם
                    </button>
                    <button
                      type="button"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded border border-iron/30 px-2.5 py-1 transition hover:text-foreground disabled:opacity-40"
                    >
                      הבא
                    </button>
                  </div>
                  <span className="font-mono tabular-nums">
                    עמוד {page + 1} מתוך {totalPages} · {eventsQuery.data?.total ?? 0} אירועים
                  </span>
                </div>
              </>
            )}
          </motion.div>

          <motion.div variants={fadeUp} className="border border-iron/30 bg-card p-5 sm:p-6">
            <p className="mb-4 font-mono text-xs tracking-widest text-dust uppercase">
              חסימת כתובות IP
            </p>
            <form
              className="mb-5 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const ip = blockIpInput.trim();
                if (!ip) {
                  toast.error("נא להזין כתובת IP");
                  return;
                }
                blockMutation.mutate({ ip, reason: blockReasonInput.trim() });
              }}
            >
              <input
                type="text"
                dir="ltr"
                value={blockIpInput}
                onChange={(e) => setBlockIpInput(e.target.value)}
                placeholder="203.0.113.7"
                className="w-44 rounded-md border border-iron/30 bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition focus:border-primary/50"
              />
              <input
                type="text"
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="סיבה (אופציונלי)"
                className="min-w-40 flex-1 rounded-md border border-iron/30 bg-background px-3 py-2 text-xs text-foreground outline-none transition focus:border-primary/50"
              />
              <button
                type="submit"
                disabled={blockMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <Ban className="h-3.5 w-3.5" />
                חסום IP
              </button>
            </form>

            {blockedIps.isError ? (
              <p className="text-sm text-destructive">
                {blockedIps.error instanceof Error ? blockedIps.error.message : "שגיאה"}
              </p>
            ) : (blockedIps.data?.blockedIps.length ?? 0) === 0 ? (
              <EmptyState text="אין כתובות חסומות. אפשר לחסום ידנית או מתוך טבלת ה־IP המובילים." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-right text-sm">
                  <thead>
                    <tr className="border-b border-iron/20 text-xs text-dust">
                      <th className="py-2 pl-3 font-medium">IP</th>
                      <th className="py-2 pl-3 font-medium">סיבה</th>
                      <th className="py-2 pl-3 font-medium">נחסם ע״י</th>
                      <th className="py-2 pl-3 font-medium">בקשות שנחסמו</th>
                      <th className="py-2 pl-3 font-medium">תאריך</th>
                      <th className="py-2 font-medium">פעולה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(blockedIps.data?.blockedIps ?? []).map((b) => (
                      <tr key={b.id} className="border-b border-iron/10">
                        <td className="py-2.5 pl-3">
                          <span dir="ltr" className="font-mono text-xs">
                            {b.ip}
                          </span>
                        </td>
                        <td className="max-w-[14rem] py-2.5 pl-3">
                          <span className="block truncate text-xs text-dust">
                            {b.reason || "-"}
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 font-mono text-xs text-dust">
                          {b.blockedBy || "-"}
                        </td>
                        <td className="py-2.5 pl-3 font-mono text-xs tabular-nums">{b.hitCount}</td>
                        <td className="py-2.5 pl-3 text-xs text-dust">{formatDate(b.createdAt)}</td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            disabled={unblockMutation.isPending}
                            onClick={() => unblockMutation.mutate(b.id)}
                            className="inline-flex items-center gap-1 rounded border border-iron/30 px-2 py-1 text-[11px] text-dust transition hover:text-foreground disabled:opacity-40"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            הסר חסימה
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border border-iron/30 bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-dust uppercase">{label}</span>
        <Icon className="h-4 w-4 text-primary/80" />
      </div>
      <p className="font-mono text-2xl font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-dust">{hint}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-4 text-sm text-dust">{text}</p>;
}
