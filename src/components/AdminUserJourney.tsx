import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, CreditCard, Loader2, Sparkles, UserPlus } from "lucide-react";
import { AssessmentCheckpoint } from "@/features/assessment/components/AssessmentCheckpoint";
import { normalizeAssessmentAnswers } from "@/features/assessment/draft";
import {
  getAdminUserJourney,
  type AdminJourneyStage,
  type AdminSignupFunnel,
  type PaymentOrderDto,
} from "@/lib/api";

export const STAGE_LABEL: Record<AdminJourneyStage, string> = {
  signed_up: "נרשם בלבד",
  assessed: "סיים הערכה",
  results: "קיבל תוצאות",
  checkout: "התחיל תשלום",
  paid: "שילם",
};

const STAGE_STYLE: Record<AdminJourneyStage, string> = {
  signed_up: "bg-iron/20 text-dust",
  assessed: "bg-iron/30 text-foreground",
  results: "bg-primary/10 text-primary",
  checkout: "bg-amber-500/15 text-amber-200",
  paid: "bg-primary text-primary-foreground",
};

const ORDER_STATUS: Record<PaymentOrderDto["status"], string> = {
  created: "נוצרה",
  pending: "ממתין לתשלום",
  processing: "בתהליך",
  paid: "שולם",
  failed: "נכשל",
  expired: "פג תוקף",
  refund_requested: "ביקש החזר",
  refunded: "זוכה",
};

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "-";
const shekels = (minor: number) =>
  `₪${(minor / 100).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

export function StageBadge({ stage }: { stage: AdminJourneyStage }) {
  return (
    <span
      className={`whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-bold ${STAGE_STYLE[stage]}`}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

/** Signed up -> assessed -> results -> started payment -> paid, with the share of sign-ups at each step. */
export function SignupFunnel({ funnel }: { funnel: AdminSignupFunnel }) {
  const steps: [string, number][] = [
    ["נרשמו", funnel.signedUp],
    ["סיימו הערכה", funnel.assessed],
    ["קיבלו תוצאות", funnel.results],
    ["התחילו תשלום", funnel.checkout],
    ["שילמו", funnel.paid],
  ];
  const base = Math.max(1, funnel.signedUp);
  return (
    <ol className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="משפך משתמשים">
      {steps.map(([label, value], i) => {
        const pct = Math.round((value / base) * 100);
        const prev = i ? steps[i - 1][1] : null;
        return (
          <li key={label} className="border border-iron/25 bg-background/40 p-3 text-right">
            <p className="text-[11px] text-dust">{label}</p>
            <p className="mt-1 text-2xl font-black text-foreground">{value}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-dust">
              {pct}% מהנרשמים
              {prev ? ` · ${Math.round((value / Math.max(1, prev)) * 100)}% מהשלב הקודם` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** Everything one user did, loaded when the admin opens their row. */
export function AdminUserJourney({ userId }: { userId: string }) {
  const [showAllRuns, setShowAllRuns] = useState(false);
  const query = useQuery({
    queryKey: ["admin-user-journey", userId],
    queryFn: () => getAdminUserJourney(userId),
    staleTime: 30_000,
  });

  if (query.isPending) {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-dust">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> טוען את המסע של המשתמש…
      </p>
    );
  }
  if (query.isError) {
    return <p className="py-4 text-sm text-destructive">{(query.error as Error).message}</p>;
  }

  const { user, assessment, runs, personalAnswer, orders, entitlement } = query.data;
  const answers = assessment ? normalizeAssessmentAnswers(assessment.answers) : null;
  const visibleRuns = showAllRuns ? runs : runs.slice(0, 1);
  const timeline: [typeof UserPlus, string, string][] = [
    [UserPlus, "נרשם", when(user.createdAt)],
    [CheckCircle2, "סיים הערכה", assessment ? when(assessment.completedAt) : "עוד לא"],
    [Sparkles, `קיבל תוצאות (${runs.length} ריצות)`, runs[0] ? when(runs[0].createdAt) : "עוד לא"],
    [
      CreditCard,
      entitlement || orders.some((o) => o.status === "paid")
        ? "שילם"
        : orders.length
          ? "התחיל תשלום, לא שילם"
          : "לא ניסה לשלם",
      orders[0] ? when(orders[0].paidAt ?? orders[0].createdAt) : "-",
    ],
  ];

  return (
    <div className="space-y-5 py-4 text-right" dir="rtl">
      <ol className="grid gap-2 sm:grid-cols-4">
        {timeline.map(([Icon, label, at]) => (
          <li
            key={label}
            className="flex items-start gap-2 border border-iron/20 bg-background/40 p-3"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-xs font-bold text-foreground">{label}</p>
              <p className="text-[11px] text-dust">{at}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-dust">
        {user.phone ? `נייד ${user.phone} · ` : ""}כניסה אחרונה {when(user.lastSeenAt)}
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-black text-foreground">מה בחר בהערכה</h3>
          {answers ? (
            <>
              <p className="mb-2 text-[11px] text-dust">
                {answers.gender === "female"
                  ? "נקבה"
                  : answers.gender === "male"
                    ? "זכר"
                    : "מין לא צוין"}{" "}
                · גיוס {answers.draftDate || "-"} · מא״ה{" "}
                {answers.yomHameahSource === "official"
                  ? "רשמי"
                  : answers.yomHameahSource === "self"
                    ? "הערכה עצמית"
                    : "לא ידוע"}
              </p>
              <AssessmentCheckpoint answers={answers} variant="review" showNextSteps={false} />
            </>
          ) : (
            <p className="text-sm text-dust">עוד לא סיים את ההערכה.</p>
          )}
        </section>

        <section className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-black text-foreground">התפקידים שקיבל</h3>
            {runs.length ? (
              <div className="space-y-3">
                {visibleRuns.map((run, i) => (
                  <div key={run.id} className="border border-iron/25 bg-card/60 p-3">
                    <p className="mb-2 text-[11px] text-dust">
                      {i === 0 ? "ריצה אחרונה" : "ריצה קודמת"} · {when(run.createdAt)}
                    </p>
                    <ol className="space-y-1">
                      {[...run.roles]
                        .sort((a, b) => a.rank - b.rank)
                        .map((role) => (
                          <li
                            key={role.rank}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0">
                              <span
                                className={`font-mono text-xs ${role.rank <= 3 ? "text-primary" : "text-dust"}`}
                              >
                                {role.rank}.
                              </span>{" "}
                              <span className="text-foreground">{role.roleTitle || "-"}</span>
                              {role.rank <= 3 ? (
                                <span className="mr-1.5 text-[10px] text-dust">(בתשלום)</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-mono text-xs text-dust">
                              {role.matchPercentage != null ? `${role.matchPercentage}%` : ""}
                            </span>
                          </li>
                        ))}
                    </ol>
                  </div>
                ))}
                {runs.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllRuns((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    {showAllRuns ? "הסתרת ריצות קודמות" : `עוד ${runs.length - 1} ריצות`}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition ${showAllRuns ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                ) : null}
                {personalAnswer ? (
                  <div className="border-r-2 border-primary bg-primary/5 p-3">
                    <p className="text-[11px] font-bold text-primary">
                      התשובה של ה־AI לבקשה האישית
                    </p>
                    <p className="mt-1 text-sm leading-6 text-foreground whitespace-pre-line">
                      {personalAnswer}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-dust">עוד לא קיבל תוצאות.</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-black text-foreground">תשלומים</h3>
            {entitlement ? (
              <p className="mb-2 text-xs text-primary">
                גישה פתוחה ({entitlement.status === "grandfathered" ? "הוענקה" : "נרכשה"}) מ־
                {when(entitlement.since)}
              </p>
            ) : null}
            {orders.length ? (
              <ul className="divide-y divide-iron/15 border border-iron/20">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs"
                  >
                    <span
                      className={
                        order.status === "paid" ? "font-bold text-primary" : "text-foreground"
                      }
                    >
                      {ORDER_STATUS[order.status] ?? order.status} · {shekels(order.amountMinor)}
                    </span>
                    <span className="text-dust">
                      {when(order.createdAt)}
                      {order.claimCode ? ` · קוד ${order.claimCode}` : ""}
                      {order.payerEmail ? ` · ${order.payerEmail}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-dust">לא התחיל תשלום.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
