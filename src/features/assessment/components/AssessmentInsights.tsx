import { useMemo } from "react";
import { deriveInsights, draftRoadmap, type Insight } from "../insights";
import type { AssessmentAnswers } from "../types";

/** Personalized "did you know" cards shown at the checkpoint. Pure CSS bars, no chart lib. */
export function AssessmentInsights({ answers }: { answers: AssessmentAnswers }) {
  const insights = useMemo(() => deriveInsights(answers), [answers]);
  if (!insights.length) return null;
  return (
    <section className="space-y-4" aria-label="תובנות אישיות">
      <p className="font-mono text-[10px] tracking-widest text-primary uppercase">מה הנתונים שלכם אומרים</p>
      {insights.map((insight) => (
        <article key={insight.id} className="border border-primary/35 bg-primary/5 p-4 sm:p-5">
          <h3 className="text-base font-black text-foreground">{insight.title}</h3>
          <p className="mt-2 text-sm leading-6 text-dust">{insight.body}</p>
          <InsightChart insight={insight} />
        </article>
      ))}
      <p className="text-[11px] leading-5 text-dust">
        מבוסס על פרסומי אתר מתגייסים וחוק שירות ביטחון (יולי 2026). תנאי קבלה משתנים; אימות סופי מול מיטב.
      </p>
    </section>
  );
}

function InsightChart({ insight }: { insight: Insight }) {
  switch (insight.id) {
    case "combat-trap":
      return (
        <ul className="mt-4 space-y-2">
          {insight.routes.map((route) => (
            <li key={route.label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className={route.open ? "font-bold text-foreground" : "text-dust"}>{route.label}</span>
                  <span className="whitespace-nowrap font-mono tabular-nums text-dust">
                    {route.gate ? `דפ״ר ${route.gate}+` : "ללא מיון"}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-iron/20" aria-hidden>
                  <div
                    className={`h-full ${route.open ? "bg-primary" : "bg-iron/50"}`}
                    style={{ width: `${Math.max(8, (route.gate / 90) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-dust">{route.note}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                  route.open ? "bg-primary/20 text-primary" : "bg-iron/20 text-dust"
                }`}
              >
                {route.open ? "פתוח" : "סגור"}
              </span>
            </li>
          ))}
        </ul>
      );
    case "profile-ladder":
      return (
        <ol className="mt-4 space-y-1.5" dir="rtl">
          {insight.rungs.map((rung) => (
            <li
              key={rung.profile}
              className={`grid grid-cols-[3rem_1fr] items-start gap-3 border-r-2 pr-3 text-xs ${
                rung.current
                  ? "border-primary bg-primary/10 py-2"
                  : rung.reached
                    ? "border-primary/40"
                    : "border-iron/30 opacity-60"
              }`}
            >
              <span className={`font-mono text-sm tabular-nums ${rung.current ? "font-black text-primary" : "text-foreground"}`}>
                {rung.profile}
              </span>
              <span className={rung.reached ? "text-foreground" : "text-dust line-through decoration-iron/60"}>
                {rung.opens}
                {rung.current ? " · הפרופיל שלכם" : ""}
              </span>
            </li>
          ))}
        </ol>
      );
    case "women-combat":
      return (
        <ul className="mt-4 space-y-2">
          {insight.months.map((m) => (
            <li key={m.label} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground">{m.label}</span>
                <span className="font-mono tabular-nums text-dust">{m.value} חודשים</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-iron/20" aria-hidden>
                <div className="h-full bg-primary" style={{ width: `${(m.value / 36) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      );
    case "tech-commitments":
      return (
        <ul className="mt-4 space-y-2">
          {insight.bars.map((bar) => {
            const total = bar.mandatoryMonths + bar.kevaMonths;
            return (
              <li key={bar.label} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{bar.label}</span>
                  <span className="font-mono tabular-nums text-dust">
                    {bar.mandatoryMonths} חובה + {bar.kevaMonths} קבע = {(total / 12).toFixed(total % 12 ? 1 : 0)} שנים
                  </span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-iron/20" aria-hidden>
                  <div className="h-full bg-primary" style={{ width: `${(bar.mandatoryMonths / 112) * 100}%` }} />
                  <div className="h-full bg-primary/40" style={{ width: `${(bar.kevaMonths / 112) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      );
    default:
      return null;
  }
}

/** Dated windows between now and the draft; shown on the final review screen. */
export function DraftRoadmap({ answers }: { answers: AssessmentAnswers }) {
  const items = useMemo(() => draftRoadmap(answers.draftDate, answers), [answers]);
  if (!items.length) return null;
  return (
    <section className="space-y-3" aria-label="מפת הדרך עד הגיוס">
      <div>
        <p className="font-mono text-[10px] tracking-widest text-primary uppercase">מפת הדרך שלכם עד הגיוס</p>
        <p className="mt-1 text-xs leading-5 text-dust">
          חלונות המיונים שרלוונטיים לכיוונים שסימנתם, לפי הפרסומים הרשמיים. מועדים מדויקים נקבעים על ידי מיטב.
        </p>
      </div>
      <ol className="relative space-y-3 border-r border-iron/30 pr-4" dir="rtl">
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="relative">
            <span className="absolute -right-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-primary bg-background" aria-hidden />
            <p className="font-mono text-[10px] tabular-nums text-primary">{item.when}</p>
            <p className="text-sm font-bold text-foreground">{item.title}</p>
            <p className="text-xs leading-5 text-dust">{item.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
