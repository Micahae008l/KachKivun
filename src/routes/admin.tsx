import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Users,
  Shield,
  ShieldAlert,
  Sparkles,
  DollarSign,
  Search,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSkeleton, AdminUsersTableSkeleton } from "@/components/skeletons/PageSkeletons";
import {
  AdminUserJourney,
  SourceBadge,
  STAGE_LABEL,
  StageBadge,
  sourceLabel,
} from "@/components/AdminUserJourney";
import { AdminInsights } from "@/components/AdminInsights";
import {
  ApiError,
  deleteAdminUser,
  listAdminRoleReviews,
  moderateRoleReview,
  updateAdminUserRole,
  updateAdminUserTokenCap,
  type AdminJourneyStage,
  type AdminUserRow,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  adminMeQueryOptions,
  adminOverviewQueryOptions,
  adminUsersQueryOptions,
  sessionQueryOptions,
} from "@/lib/queries";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
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

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

function formatTokens(n: number) {
  return new Intl.NumberFormat("he-IL").format(n);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("he-IL");
}

function statusHebrew(status: string) {
  if (status === "Active Duty") return "בשירות";
  if (status === "Discharged") return "אחרי שירות";
  return "לפני גיוס";
}

type AdminTab = "overview" | "users" | "ai" | "reviews";
const TABS: { id: AdminTab; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "סקירה", icon: Sparkles },
  { id: "users", label: "משתמשים", icon: Users },
  { id: "ai", label: "AI ועלויות", icon: DollarSign },
  { id: "reviews", label: "ביקורות", icon: MessageSquare },
];
const PAGE = 50;

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5 w-10 shrink-0 text-[11px] font-bold text-dust">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-iron/30 text-dust hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending",
  );
  const [tab, setTab] = useState<AdminTab>("overview");
  const [stageFilter, setStageFilter] = useState<AdminJourneyStage | "all">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [shown, setShown] = useState(PAGE);

  // The open tab lives in the URL hash, so a refresh or a shared link opens the same view.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as AdminTab;
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash);
  }, []);
  function openTab(next: AdminTab) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }
  useEffect(() => setShown(PAGE), [stageFilter, sourceFilter, debouncedQ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

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
    ...adminOverviewQueryOptions(token),
    enabled: mounted && !!token && adminMe.isSuccess,
  });

  const usersQuery = useQuery({
    ...adminUsersQueryOptions(token, debouncedQ),
    enabled: mounted && !!token && adminMe.isSuccess,
  });
  const usersLoading = usersQuery.isPending && !usersQuery.data;

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "user" | "admin" }) =>
      updateAdminUserRole(id, role),
    onSuccess: () => {
      toast.success("תפקיד עודכן");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tokenCapMutation = useMutation({
    mutationFn: ({ id, tokenCap }: { id: string; tokenCap: number | null }) =>
      updateAdminUserTokenCap(id, tokenCap),
    onSuccess: () => {
      toast.success("מכסת טוקנים עודכנה");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminUser(id),
    onSuccess: () => {
      toast.success("משתמש נמחק");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewsQuery = useQuery({
    queryKey: ["admin-role-reviews", reviewStatus],
    queryFn: () => listAdminRoleReviews(reviewStatus),
    enabled: mounted && !!token && adminMe.isSuccess,
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      moderateRoleReview(id, action),
    onSuccess: (res) => {
      toast.success(res.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-role-reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["role-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const me = adminMe.data;
  const ov = overview.data;

  const allUsers = usersQuery.data?.users ?? [];
  const sourceOf = (u: AdminUserRow) => u.source?.source ?? "unknown";
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of allUsers)
      if (u.journey) counts[u.journey.stage] = (counts[u.journey.stage] ?? 0) + 1;
    return counts;
  }, [allUsers]);
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of allUsers) counts.set(sourceOf(u), (counts.get(sourceOf(u)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allUsers]);
  const filteredUsers = allUsers.filter(
    (u) =>
      (stageFilter === "all" || u.journey?.stage === stageFilter) &&
      (sourceFilter === "all" || sourceOf(u) === sourceFilter),
  );

  const busy =
    (session.isPending && !session.data) ||
    (session.data?.role === "admin" &&
      ((adminMe.isPending && !adminMe.data) ||
        (adminMe.isSuccess && overview.isPending && !overview.data)));

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
              <p className="mb-2 font-mono text-xs tracking-wide text-dust uppercase">
                ניהול מערכת
              </p>
              <h1 className="text-2xl font-black sm:text-4xl">פאנל מנהל</h1>
              <p className="mt-2 text-sm text-dust">
                {me?.preferredName?.trim() || me?.email} · גישה מלאה למשתמשים ועלויות AI
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  void overview.refetch();
                  void usersQuery.refetch();
                }}
                className="inline-flex items-center gap-2 rounded-md border border-iron/40 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                רענון
              </button>
              <Link
                to="/admin/security"
                className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-card px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                מרכז אבטחה
              </Link>
              <Link
                to="/dashboard"
                className="rounded-md border border-iron/40 bg-card px-3 py-1.5 text-xs font-medium text-dust transition hover:text-foreground"
              >
                חזרה לדשבורד
              </Link>
            </div>
          </motion.div>

          <motion.nav
            variants={fadeUp}
            aria-label="אזורי הפאנל"
            className="sticky top-0 z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-iron/30 bg-background/95 px-4 py-2 backdrop-blur-sm sm:mx-0 sm:px-0"
          >
            {TABS.map((t) => {
              const badge =
                t.id === "users"
                  ? usersQuery.data?.total
                  : t.id === "reviews"
                    ? reviewsQuery.data?.pendingCount || undefined
                    : undefined;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTab(t.id)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-bold transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-dust hover:bg-iron/15 hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" aria-hidden />
                  {t.label}
                  {badge ? (
                    <span
                      className={`rounded-sm px-1.5 font-mono text-[11px] ${
                        active ? "bg-primary-foreground/20" : "bg-iron/25 text-foreground"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </motion.nav>

          {tab === "overview" ? (
            <motion.div variants={fadeUp}>
              <AdminInsights />
            </motion.div>
          ) : null}

          {tab !== "ai" ? null : overview.isError ? (
            <div className="border border-destructive/40 bg-card p-6 text-center text-destructive">
              {overview.error instanceof Error ? overview.error.message : "שגיאה"}
            </div>
          ) : ov ? (
            <>
              <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  icon={Users}
                  label="משתמשים"
                  value={String(ov.users.total)}
                  hint={`${ov.users.admins} מנהלים`}
                />
                <MetricCard
                  icon={Sparkles}
                  label="קריאות AI"
                  value={String(ov.openai.totalCalls)}
                  hint={`${ov.openai.successCalls} הצליחו`}
                />
                <MetricCard
                  icon={DollarSign}
                  label="עלות משוערת"
                  value={formatUsd(ov.openai.estimatedCostUsd)}
                  hint="סה״כ כל המשתמשים"
                />
                <MetricCard
                  icon={Shield}
                  label="טוקנים"
                  value={formatTokens(ov.openai.totalTokens)}
                  hint={`קלט ${formatTokens(ov.openai.promptTokens)} · פלט ${formatTokens(ov.openai.completionTokens)}`}
                />
              </motion.div>

              <motion.div variants={fadeUp} className="border border-iron/30 bg-card p-5 sm:p-6">
                <p className="mb-4 font-mono text-xs tracking-wide text-dust uppercase">
                  פעילות AI אחרונה
                </p>
                {ov.recentUsage.length === 0 ? (
                  <p className="text-sm text-dust">
                    אין רישומי שימוש עדיין. עלויות יופיעו אחרי קריאות ליועץ AI.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-right text-sm">
                      <thead>
                        <tr className="border-b border-iron/20 text-xs text-dust">
                          <th className="py-2 pl-4 font-medium">אימייל</th>
                          <th className="py-2 pl-4 font-medium">מודל</th>
                          <th className="py-2 pl-4 font-medium">טוקנים</th>
                          <th className="py-2 pl-4 font-medium">עלות</th>
                          <th className="py-2 font-medium">סטטוס</th>
                          <th className="py-2 font-medium">תאריך</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ov.recentUsage.map((row, i) => (
                          <tr key={`${row.createdAt}-${i}`} className="border-b border-iron/10">
                            <td className="py-2.5 pl-4 font-mono text-xs">
                              {row.userEmail || "-"}
                            </td>
                            <td className="py-2.5 pl-4 text-dust">{row.model || "-"}</td>
                            <td className="py-2.5 pl-4 font-mono tabular-nums">
                              {row.totalTokens}
                            </td>
                            <td className="py-2.5 pl-4 font-mono tabular-nums">
                              {formatUsd(Number(row.estimatedCostUsd) || 0)}
                            </td>
                            <td className="py-2.5 pl-4 text-dust">{row.status}</td>
                            <td className="py-2.5 text-dust">{formatDate(row.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-4 text-[11px] text-dust/70">{ov.openai.pricing.note}</p>
              </motion.div>
            </>
          ) : null}

          {tab === "users" ? (
            <motion.div variants={fadeUp} className="border border-iron/30 bg-card p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono text-xs tracking-wide text-dust uppercase">ניהול משתמשים</p>
                <div className="relative max-w-md flex-1">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dust" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="חיפוש לפי אימייל או שם…"
                    className="w-full rounded-md border border-iron/30 bg-background py-2 pr-10 pl-3 text-sm text-foreground outline-none transition focus:border-primary/50"
                  />
                </div>
              </div>

              {usersLoading ? (
                <AdminUsersTableSkeleton />
              ) : usersQuery.isError ? (
                <p className="text-sm text-destructive">
                  {usersQuery.error instanceof Error ? usersQuery.error.message : "שגיאה"}
                </p>
              ) : (
                <>
                  <div className="mb-4 space-y-2">
                    <FilterRow label="שלב">
                      <FilterChip
                        active={stageFilter === "all"}
                        onClick={() => setStageFilter("all")}
                      >
                        הכל · {allUsers.length}
                      </FilterChip>
                      {(Object.keys(STAGE_LABEL) as AdminJourneyStage[]).map((stage) => (
                        <FilterChip
                          key={stage}
                          active={stageFilter === stage}
                          onClick={() => setStageFilter(stage)}
                        >
                          {STAGE_LABEL[stage]} · {stageCounts[stage] ?? 0}
                        </FilterChip>
                      ))}
                    </FilterRow>
                    <FilterRow label="מקור">
                      <FilterChip
                        active={sourceFilter === "all"}
                        onClick={() => setSourceFilter("all")}
                      >
                        הכל
                      </FilterChip>
                      {sourceCounts.map(([source, count]) => (
                        <FilterChip
                          key={source}
                          active={sourceFilter === source}
                          onClick={() => setSourceFilter(source)}
                        >
                          {sourceLabel(source)} · {count}
                        </FilterChip>
                      ))}
                    </FilterRow>
                  </div>
                  <p className="mb-3 text-xs text-dust">
                    {filteredUsers.length} מתוך {usersQuery.data?.total ?? 0} משתמשים
                    {debouncedQ ? ` · חיפוש: "${debouncedQ}"` : ""}
                    {(usersQuery.data?.total ?? 0) > allUsers.length
                      ? ` · מוצגים ${allUsers.length} האחרונים; חפשו כדי למצוא ותיקים יותר`
                      : ""}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[56rem] text-right text-sm">
                      <thead>
                        <tr className="border-b border-iron/20 text-xs text-dust">
                          <th className="w-8 py-2" aria-label="פירוט" />
                          <th className="py-2 pl-3 font-medium">אימייל</th>
                          <th className="py-2 pl-3 font-medium">שלב</th>
                          <th className="py-2 pl-3 font-medium">מקור</th>
                          <th className="py-2 pl-3 font-medium">נרשם</th>
                          <th className="py-2 pl-3 font-medium">שם</th>
                          <th className="py-2 pl-3 font-medium">מין</th>
                          <th className="py-2 pl-3 font-medium">סטטוס</th>
                          <th className="py-2 pl-3 font-medium">תפקיד</th>
                          <th className="py-2 pl-3 font-medium">AI</th>
                          <th className="py-2 pl-3 font-medium">טוקנים</th>
                          <th className="py-2 pl-3 font-medium">עלות</th>
                          <th className="py-2 font-medium">פעולות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.slice(0, shown).map((u) => (
                          <UserRow
                            key={u.id}
                            user={u}
                            currentAdminId={me?.userId}
                            defaultTokenCap={usersQuery.data?.defaults?.tokenCap ?? null}
                            onRole={(role) => roleMutation.mutate({ id: u.id, role })}
                            onTokenCap={(tokenCap) =>
                              tokenCapMutation.mutate({ id: u.id, tokenCap })
                            }
                            onDelete={() => setDeleteTarget(u)}
                            rolePending={roleMutation.isPending}
                            tokenCapPending={tokenCapMutation.isPending}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredUsers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-dust">אין משתמשים במסנן הזה.</p>
                  ) : null}
                  {filteredUsers.length > shown ? (
                    <button
                      type="button"
                      onClick={() => setShown((n) => n + PAGE)}
                      className="mt-4 w-full rounded-md border border-iron/30 py-2.5 text-sm font-bold text-dust transition hover:border-primary/40 hover:text-foreground"
                    >
                      הצגת עוד {Math.min(PAGE, filteredUsers.length - shown)} (נשארו{" "}
                      {filteredUsers.length - shown})
                    </button>
                  ) : null}
                </>
              )}
            </motion.div>
          ) : null}

          {tab === "reviews" ? (
            <motion.div
              variants={fadeUp}
              className="border border-iron/30 bg-card p-5 sm:p-6"
              dir="rtl"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs tracking-wide text-dust uppercase">
                    ביקורות תפקידים
                  </p>
                  <h2 className="mt-1 flex items-center gap-2 text-base font-bold text-foreground">
                    <MessageSquare className="h-4 w-4 text-primary" aria-hidden />
                    תור לאישור
                    {reviewsQuery.data?.pendingCount ? (
                      <span className="rounded-sm bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">
                        {reviewsQuery.data.pendingCount} ממתינות
                      </span>
                    ) : null}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["pending", "approved", "rejected", "all"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReviewStatus(s)}
                      className={`rounded-sm border px-2.5 py-1 text-[11px] transition ${
                        reviewStatus === s
                          ? "border-primary/50 bg-primary/15 text-foreground"
                          : "border-iron/30 text-dust hover:border-primary/30"
                      }`}
                    >
                      {s === "pending"
                        ? "ממתינות"
                        : s === "approved"
                          ? "מאושרות"
                          : s === "rejected"
                            ? "נדחו"
                            : "הכל"}
                    </button>
                  ))}
                </div>
              </div>

              {reviewsQuery.isLoading ? (
                <p className="text-sm text-dust">טוען ביקורות…</p>
              ) : (reviewsQuery.data?.reviews.length ?? 0) === 0 ? (
                <p className="text-sm text-dust">אין ביקורות במסנן הזה.</p>
              ) : (
                <ul className="space-y-3">
                  {reviewsQuery.data?.reviews.map((r) => (
                    <li
                      key={r.id}
                      className="border border-iron/20 bg-background/40 p-4 text-right"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{r.roleTitle}</p>
                          <p className="mt-0.5 text-[11px] text-dust">
                            {r.displayName}
                            {r.userEmail ? ` · ${r.userEmail}` : ""}
                            {r.rating ? ` · ${r.rating}/5` : ""}
                            {r.servedInRole ? " · שירת בתפקיד" : ""}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-dust">{r.status}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-dust">{r.body}</p>
                      {r.status === "pending" ? (
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={moderateMutation.isPending}
                            onClick={() => moderateMutation.mutate({ id: r.id, action: "reject" })}
                            className="rounded-md border border-iron/40 px-3 py-1.5 text-xs text-dust transition hover:border-destructive/40 hover:text-destructive"
                          >
                            דחו
                          </button>
                          <button
                            type="button"
                            disabled={moderateMutation.isPending}
                            onClick={() => moderateMutation.mutate({ id: r.id, action: "approve" })}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                          >
                            אשרו ופרסמו
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          ) : null}
        </motion.div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md border border-iron/40 bg-card p-6 text-right shadow-lg">
            <div className="mb-4 flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h2 className="text-lg font-bold">מחיקת משתמש</h2>
            </div>
            <p className="text-sm text-dust">
              למחוק לצמיתות את{" "}
              <span className="font-mono text-foreground">{deleteTarget.email}</span>? יימחקו גם
              הפרופיל, ההעדפות ורישומי השימוש ב-AI.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-iron/40 px-4 py-2 text-sm text-dust transition hover:text-foreground"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                מחק
              </button>
            </div>
          </div>
        </div>
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
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border border-iron/30 bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-wide text-dust uppercase">{label}</span>
        <Icon className="h-4 w-4 text-primary/80" />
      </div>
      <p className="font-mono text-2xl font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-dust">{hint}</p>
    </div>
  );
}

function tokenCapLabel(user: AdminUserRow, defaultTokenCap: number | null) {
  if (user.role === "admin") return "ללא הגבלה (מנהל)";
  const { used, cap, unlimited } = user.aiTokens;
  if (unlimited) return `${formatTokens(used)} · ללא הגבלה`;
  return `${formatTokens(used)} / ${formatTokens(cap ?? 0)}`;
}

function UserRow({
  user,
  currentAdminId,
  defaultTokenCap,
  onRole,
  onTokenCap,
  onDelete,
  rolePending,
  tokenCapPending,
}: {
  user: AdminUserRow;
  currentAdminId?: string;
  defaultTokenCap: number | null;
  onRole: (role: "user" | "admin") => void;
  onTokenCap: (tokenCap: number | null) => void;
  onDelete: () => void;
  rolePending: boolean;
  tokenCapPending: boolean;
}) {
  const isSelf = currentAdminId === user.id;
  const [open, setOpen] = useState(false);
  const [capInput, setCapInput] = useState(user.tokenCap != null ? String(user.tokenCap) : "");

  useEffect(() => {
    setCapInput(user.tokenCap != null ? String(user.tokenCap) : "");
  }, [user.tokenCap]);

  function saveTokenCap() {
    const trimmed = capInput.trim();
    if (!trimmed) {
      onTokenCap(null);
      return;
    }
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("מכסה חייבת להיות מספר שלם ולא שלילי");
      return;
    }
    onTokenCap(n);
  }

  return (
    <>
      <tr className={`border-b border-iron/10 ${open ? "bg-primary/[0.04]" : ""}`}>
        <td className="py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "הסתרת המסע של המשתמש" : "הצגת המסע של המשתמש"}
            className="flex h-8 w-8 items-center justify-center rounded border border-iron/30 text-dust transition hover:text-foreground"
          >
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </td>
        <td className="py-3 pl-3 font-mono text-xs">{user.email}</td>
        <td className="py-3 pl-3">
          {user.journey ? <StageBadge stage={user.journey.stage} /> : "-"}
        </td>
        <td className="py-3 pl-3">
          <SourceBadge
            source={user.source?.source ?? "unknown"}
            estimated={user.source?.estimated}
          />
        </td>
        <td className="py-3 pl-3 font-mono text-[11px] text-dust">{formatDate(user.createdAt)}</td>
        <td className="py-3 pl-3">{user.preferredName || "-"}</td>
        <td className="py-3 pl-3 text-dust">
          {user.gender === "male" ? "בן" : user.gender === "female" ? "בת" : "-"}
        </td>
        <td className="py-3 pl-3 text-dust">{statusHebrew(user.status)}</td>
        <td className="py-3 pl-3">
          <span
            className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${
              user.role === "admin" ? "bg-primary/20 text-primary" : "bg-iron/20 text-dust"
            }`}
          >
            {user.role === "admin" ? "מנהל" : "משתמש"}
          </span>
        </td>
        <td className="py-3 pl-3 text-dust">
          {user.aiReady ? <span className="text-olive">מוכן</span> : <span>חסר פרופיל</span>}
          <span className="mr-2 font-mono text-[10px] tabular-nums">
            ({user.aiUsage.callCount})
          </span>
        </td>
        <td className="py-3 pl-3">
          <p className="font-mono text-[11px] tabular-nums text-dust">
            {tokenCapLabel(user, defaultTokenCap)}
          </p>
          {user.role !== "admin" ? (
            <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1">
              <input
                type="number"
                min={0}
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                placeholder={
                  defaultTokenCap != null
                    ? `ברירת מחדל ${formatTokens(defaultTokenCap)}`
                    : "ללא הגבלה"
                }
                className="w-24 rounded border border-iron/30 bg-background px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:border-primary/50"
                title="ריק = ברירת מחדל מהשרת"
              />
              <button
                type="button"
                disabled={tokenCapPending}
                onClick={saveTokenCap}
                className="rounded border border-iron/30 px-2 py-1 text-[10px] text-dust transition hover:text-foreground disabled:opacity-40"
              >
                שמור
              </button>
            </div>
          ) : null}
        </td>
        <td className="py-3 pl-3 font-mono text-xs tabular-nums">
          {formatUsd(user.aiUsage.estimatedCostUsd)}
        </td>
        <td className="py-3">
          <div className="flex flex-wrap items-center justify-end gap-1">
            {user.role === "admin" ? (
              <button
                type="button"
                disabled={rolePending || isSelf}
                onClick={() => onRole("user")}
                className="rounded border border-iron/30 px-2 py-1 text-[11px] text-dust transition hover:text-foreground disabled:opacity-40"
                title={isSelf ? "לא ניתן להוריד את עצמך" : undefined}
              >
                הורד למשתמש
              </button>
            ) : (
              <button
                type="button"
                disabled={rolePending}
                onClick={() => onRole("admin")}
                className="rounded border border-primary/30 px-2 py-1 text-[11px] text-primary transition hover:bg-primary/10 disabled:opacity-40"
              >
                הפוך למנהל
              </button>
            )}
            <button
              type="button"
              disabled={isSelf}
              onClick={onDelete}
              className="rounded border border-destructive/30 p-1 text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
              title={isSelf ? "לא ניתן למחוק את עצמך" : "מחק משתמש"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-iron/20 bg-background/40">
          <td colSpan={13} className="px-3">
            <AdminUserJourney userId={user.id} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
