import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, Loader2, MessageSquareQuote, TrendingUp, Users, Wallet } from "lucide-react";
import {
  MOTIVATION_OPTIONS,
  ROLE_AVOIDANCE_OPTIONS,
  ROLE_INTEREST_OPTIONS,
  YOM_SOURCE_OPTIONS,
} from "@/features/assessment/options";
import { COMBAT_PREFERENCE_OPTIONS, FOCUS_PREFERENCE_OPTIONS } from "@/lib/profile-preference-data";
import { getAdminInsights, type AdminInsights as Insights } from "@/lib/api";
import { SignupFunnel } from "@/components/AdminUserJourney";

// One accent for "the thing that matters", a quiet step of it for context (no rainbow).
const ACCENT = "var(--primary)";
const QUIET = "color-mix(in oklch, var(--primary) 35%, transparent)";
const GRID = "color-mix(in oklch, var(--foreground) 10%, transparent)";
const AXIS = { fill: "var(--dust, #9aa1ab)", fontSize: 11 };

const labelOf =
  (options: readonly { value: string; label?: string; title?: string }[]) => (value: string) =>
    options.find((o) => o.value === value)?.label ??
    options.find((o) => o.value === value)?.title ??
    value;
const LABELS = {
  interests: labelOf(ROLE_INTEREST_OPTIONS),
  motivations: labelOf(MOTIVATION_OPTIONS),
  avoided: labelOf(ROLE_AVOIDANCE_OPTIONS),
  direction: labelOf(COMBAT_PREFERENCE_OPTIONS),
  focus: labelOf(FOCUS_PREFERENCE_OPTIONS),
  yomSource: labelOf(YOM_SOURCE_OPTIONS),
  gender: (v: string) => (v === "male" ? "זכר" : v === "female" ? "נקבה" : v),
  plain: (v: string) => (v === "unknown" ? "לא יודע/ת" : v),
};
const ORDER_STATUS: Record<string, string> = {
  paid: "שולם",
  pending: "ממתין",
  processing: "בתהליך",
  created: "נוצר",
  expired: "פג תוקף (לא שילם)",
  failed: "נכשל",
  refund_requested: "ביקש החזר",
  refunded: "זוכה",
};

const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
};
const ils = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");

function Panel({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 border border-iron/30 bg-card p-4 text-right sm:p-5 ${className}`}>
      <h3 className="text-sm font-black text-foreground">{title}</h3>
      {note ? <p className="mt-0.5 text-[11px] text-dust">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="min-w-0 border border-iron/30 bg-card p-4 text-right">
      <p className="flex items-center gap-1.5 text-xs text-dust">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-black text-foreground sm:text-3xl">{value}</p>
      <p className="mt-1 truncate text-[11px] text-dust">{sub}</p>
    </div>
  );
}

/** Horizontal bars for one answer question, with the count and share printed at each bar. */
function Breakdown({
  rows,
  label,
  total,
}: {
  rows: { value: string; count: number }[];
  label: (v: string) => string;
  total: number;
}) {
  if (!rows.length) return <p className="text-xs text-dust">אין עדיין נתונים.</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.slice(0, 8).map((r, i) => (
        <li key={r.value}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span
              className={`truncate ${i === 0 ? "font-bold text-foreground" : "text-foreground/85"}`}
            >
              {label(r.value)}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-dust">
              {r.count} · {pct(r.count, total)}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-e-[4px]"
              style={{ width: `${(r.count / max) * 100}%`, background: i === 0 ? ACCENT : QUIET }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="border border-iron/40 bg-background/95 px-3 py-2 text-right text-xs shadow-lg"
      dir="rtl"
    >
      <p className="mb-1 font-bold text-foreground">{label ? shortDate(label) : ""}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-dust">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}:{" "}
          <span className="font-mono text-foreground">{money ? ils(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function AdminInsights() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const query = useQuery({
    queryKey: ["admin-insights", days],
    queryFn: () => getAdminInsights(days),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  if (query.isPending) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-dust">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> טוען תובנות…
      </p>
    );
  }
  if (query.isError || !query.data) {
    return <p className="py-6 text-sm text-destructive">לא הצלחנו לטעון תובנות.</p>;
  }

  const d: Insights = query.data;
  const assessedTotal = d.allTime.funnel.assessed || 1;
  const profitIls = d.allTime.revenueIls - d.allTime.aiCostUsd * 3.7;

  return (
    <div className={`space-y-4 ${query.isFetching ? "opacity-70" : ""}`} dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
          <TrendingUp className="h-5 w-5 text-primary" aria-hidden />
          תובנות
        </h2>
        <div className="flex gap-1" role="group" aria-label="טווח זמן">
          {([7, 30, 90] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDays(n)}
              aria-pressed={days === n}
              className={`min-h-9 rounded-md border px-3 text-xs font-bold transition ${
                days === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-iron/40 text-dust hover:text-foreground"
              }`}
            >
              {n} ימים
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Banknote}
          label={`הכנסות (${days} ימים)`}
          value={ils(d.period.revenueIls)}
          sub={`סה״כ מאז ההשקה ${ils(d.allTime.revenueIls)}`}
        />
        <Kpi
          icon={Wallet}
          label="משלמים"
          value={String(d.allTime.funnel.paid)}
          sub={`${pct(d.allTime.funnel.paid, d.allTime.funnel.results)} ממי שקיבל תוצאות`}
        />
        <Kpi
          icon={Users}
          label={`נרשמו (${days} ימים)`}
          value={String(d.period.signups)}
          sub={`${d.period.assessments} סיימו הערכה בתקופה`}
        />
        <Kpi
          icon={TrendingUp}
          label="רווח אחרי AI"
          value={ils(Math.round(profitIls))}
          sub={`עלות AI $${d.allTime.aiCostUsd} · ${d.allTime.runsPerUser} ריצות למשתמש`}
        />
      </div>

      <SignupFunnel funnel={d.allTime.funnel} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="פעילות יומית" note="נרשמו, קיבלו תוצאות ושילמו, לפי יום">
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                />
                <YAxis
                  allowDecimals={false}
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="signups"
                  name="נרשמו"
                  stroke={QUIET}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="runs"
                  name="קיבלו תוצאות"
                  stroke="var(--foreground)"
                  strokeOpacity={0.55}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="paid"
                  name="שילמו"
                  stroke={ACCENT}
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="הכנסות ליום" note={`₪ לפי יום התשלום · ${d.period.paid} תשלומים בתקופה`}>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.series} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTooltip money />} cursor={{ fill: GRID }} />
                <Bar
                  isAnimationActive={false}
                  dataKey="revenueIls"
                  name="הכנסות"
                  fill={ACCENT}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="מה מעניין אותם" note="תחומי עניין שסימנו (אפשר כמה)">
          <Breakdown rows={d.answers.interests} label={LABELS.interests} total={assessedTotal} />
        </Panel>
        <Panel title="מה מניע אותם" note="מה חשוב להם בשירות">
          <Breakdown
            rows={d.answers.motivations}
            label={LABELS.motivations}
            total={assessedTotal}
          />
        </Panel>
        <Panel title="ממה הם רוצים להימנע">
          <Breakdown rows={d.answers.avoided} label={LABELS.avoided} total={assessedTotal} />
        </Panel>
        <Panel title="כיוון שירות">
          <Breakdown rows={d.answers.direction} label={LABELS.direction} total={assessedTotal} />
        </Panel>
        <Panel title="מיקוד מקצועי">
          <Breakdown rows={d.answers.focus} label={LABELS.focus} total={assessedTotal} />
        </Panel>
        <Panel title="ציוני מא״ה" note="רשמיים, הערכה עצמית או לא ידועים">
          <Breakdown rows={d.answers.yomSource} label={LABELS.yomSource} total={assessedTotal} />
        </Panel>
        <Panel title="התפלגות דפ״ר">
          <Breakdown
            rows={[...d.answers.dapar].sort(
              (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0),
            )}
            label={LABELS.plain}
            total={assessedTotal}
          />
        </Panel>
        <Panel title="התפלגות פרופיל רפואי">
          <Breakdown
            rows={[...d.answers.medical].sort(
              (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0),
            )}
            label={LABELS.plain}
            total={assessedTotal}
          />
        </Panel>
        <Panel title="מין">
          <Breakdown rows={d.answers.gender} label={LABELS.gender} total={assessedTotal} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="התפקיד במקום 1" note="מה ה־AI ממליץ הכי הרבה כהתאמה החזקה">
          <Breakdown
            rows={d.topPicks.map((r) => ({ value: r.roleTitle, count: r.count }))}
            label={(v) => v}
            total={d.allTime.funnel.results || 1}
          />
        </Panel>
        <Panel title="מופיע הכי הרבה בחמישייה">
          <Breakdown
            rows={d.topAppearances.map((r) => ({ value: r.roleTitle, count: r.count }))}
            label={(v) => v}
            total={d.allTime.funnel.results || 1}
          />
        </Panel>
        <Panel title="מצב הזמנות תשלום" note="כמה התחילו לשלם ולא סיימו">
          <Breakdown
            rows={d.orderStatuses
              .map((r) => ({ value: r.status, count: r.count }))
              .sort((a, b) => b.count - a.count)}
            label={(v) => ORDER_STATUS[v] ?? v}
            total={d.orderStatuses.reduce((s, r) => s + r.count, 0) || 1}
          />
        </Panel>
      </div>

      <Panel title="מה ביקשו מהיועץ" note="15 הבקשות האישיות האחרונות">
        {d.notes.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {d.notes.map((n, i) => (
              <li
                key={`${n.at}-${i}`}
                className="flex gap-2 border border-iron/20 bg-background/40 p-3"
              >
                <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm leading-6 text-foreground">{n.note}</p>
                  <p className="mt-1 text-[11px] text-dust">
                    {n.name ? `${n.name} · ` : ""}
                    {new Date(n.at).toLocaleDateString("he-IL")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-dust">אין עדיין בקשות.</p>
        )}
      </Panel>
    </div>
  );
}
