import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { progressBarProps } from "@/lib/a11y";
import { YOM_HAMEAH_KEYS, YOM_HAMEAH_LABELS_HE } from "@/lib/yom-hameah";
import {
  COMBAT_PREFERENCE_OPTIONS,
  ENVIRONMENT_OPTIONS,
  EXIT_OPTIONS,
  FITNESS_PREFERENCE_OPTIONS,
  FOCUS_PREFERENCE_OPTIONS,
  LEADERSHIP_OPTIONS,
  MOTIVATION_OPTIONS,
  ROLE_AVOIDANCE_OPTIONS,
  ROLE_INTEREST_OPTIONS,
  STRESS_OPTIONS,
} from "../options";
import { deriveAssessmentBranches } from "../flow";
import type { AssessmentAnswers } from "../types";
import { AssessmentInsights, DraftRoadmap } from "./AssessmentInsights";

type Props = {
  answers: AssessmentAnswers;
  className?: string;
  variant?: "profile" | "review";
};

function average(values: number[]): number {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function optionTitle<T extends string>(
  options: readonly { value: T; title: string }[],
  value: T | "",
): string {
  return options.find((option) => option.value === value)?.title ?? "לא נבחר";
}

function optionLabel<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T | "",
): string {
  return options.find((option) => option.value === value)?.label ?? "לא נבחר";
}

function thresholdLabel(value: number | "unknown" | null): string {
  return value === "unknown" ? "לא ידוע" : value == null ? "לא נבחר" : String(value);
}

export function AssessmentCheckpoint({ answers, className = "", variant = "profile" }: Props) {
  const radarData = useMemo(
    () => [
      {
        label: "טכני",
        value: average([
          answers.yomHameah.technicalActivation,
          answers.yomHameah.spatialPerception,
        ]),
      },
      {
        label: "מידע",
        value: answers.yomHameah.dataProcessing,
      },
      {
        label: "צוות",
        value: average([answers.yomHameah.teamwork, answers.yomHameah.interpersonalCare]),
      },
      {
        label: "פיקוד",
        value: average([answers.yomHameah.command, answers.yomHameah.frameworkBehavior]),
      },
      { label: "הדרכה", value: answers.yomHameah.instruction },
      {
        label: "ארגון",
        value: average([
          answers.yomHameah.diligencePersistence,
          answers.yomHameah.managementOrganization,
          answers.yomHameah.maturity,
        ]),
      },
    ],
    [answers.yomHameah],
  );

  const preferenceData = useMemo(() => {
    const fieldScore =
      answers.combatPreference === "FieldCombat"
        ? 5
        : answers.combatPreference === "Mixed"
          ? 4
          : answers.physicalActivityLevel === "High"
            ? 3
            : 2;
    const technicalScore =
      answers.combatPreference === "TechTrack" || answers.focus === "Tech"
        ? 5
        : answers.focus === "Research"
          ? 4
          : 2;
    const peopleScore =
      answers.focus === "Medical" ||
      answers.rolesInterested.includes("medical") ||
      answers.rolesInterested.includes("instruction_education")
        ? 5
        : answers.leadership === "want_lead"
          ? 4
          : 3;

    return [
      {
        label: "שטח ואתגר",
        value: fieldScore,
        answer: optionTitle(COMBAT_PREFERENCE_OPTIONS, answers.combatPreference),
      },
      {
        label: "טכנולוגיה וניתוח",
        value: technicalScore,
        answer: optionTitle(FOCUS_PREFERENCE_OPTIONS, answers.focus),
      },
      {
        label: "אנשים ופיקוד",
        value: peopleScore,
        answer:
          answers.leadership === "want_lead"
            ? "רוצה לפקד"
            : answers.leadership === "open"
              ? "פתוח/ה לפיקוד"
              : "עבודת צוות",
      },
    ];
  }, [
    answers.combatPreference,
    answers.focus,
    answers.leadership,
    answers.physicalActivityLevel,
    answers.rolesInterested,
  ]);

  if (variant === "review") {
    return <FinalSignalsReview answers={answers} className={className} />;
  }

  return (
    <section
      className={`space-y-7 text-right ${className}`}
      aria-labelledby="assessment-checkpoint-title"
    >
      <div>
        <p className="font-mono text-[10px] tracking-widest text-primary uppercase">נקודת ביניים</p>
        <h2 id="assessment-checkpoint-title" className="mt-2 text-xl font-black text-foreground">
          הפרופיל שלכם מתחיל לקבל צורה
        </h2>
        <p className="mt-2 text-sm leading-6 text-dust">
          זהו סיכום של התשובות שלכם, לא ציון התאמה ולא תחזית שיבוץ. אפשר לחזור ולשנות.
        </p>
      </div>

      <AssessmentInsights answers={answers} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-iron/25 bg-card/70 p-3 sm:p-5">
          <h3 className="text-sm font-bold text-foreground">
            מפת מדדי מא״ה ·{" "}
            {answers.yomHameahSource === "official"
              ? "ציונים רשמיים"
              : answers.yomHameahSource === "self"
                ? "הערכה עצמית"
                : "לא ידוע"}
          </h3>
          {answers.yomHameahSource === "unknown" ? (
            <div className="mt-4 border border-amber-500/45 bg-amber-500/10 p-4">
              <p className="text-sm font-bold text-foreground">מדדי מא״ה לא הוערכו</p>
              <p className="mt-2 text-xs leading-5 text-dust">
                ציוני 3 נשמרים כמציין מקום ניטרלי בלבד. הם לא יוצגו כחוזקה, לא ישמשו לאימות זכאות
                ויקבלו משקל אפסי כאות אישי.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-2 h-64 w-full" dir="rtl" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="68%">
                    <PolarGrid stroke="var(--iron)" strokeOpacity={0.45} />
                    <PolarAngleAxis
                      dataKey="label"
                      tick={{ fill: "var(--foreground)", fontSize: 11 }}
                    />
                    <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
                    <Radar
                      dataKey="value"
                      stroke="var(--primary)"
                      fill="var(--primary)"
                      fillOpacity={0.22}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-iron/20 pt-3 text-xs sm:grid-cols-2">
                {YOM_HAMEAH_KEYS.map((key) => (
                  <li key={key} className="flex items-start justify-between gap-2">
                    <span className="text-dust">{YOM_HAMEAH_LABELS_HE[key]}</span>
                    <strong className="font-mono tabular-nums text-foreground">
                      {answers.yomHameah[key]}/5
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="border border-iron/25 bg-card/70 p-3 sm:p-5">
          <h3 className="text-sm font-bold text-foreground">תמונת העדפות</h3>
          <div className="mt-3 h-52 w-full" dir="rtl" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={preferenceData}
                layout="vertical"
                margin={{ top: 4, right: 28, bottom: 4, left: 6 }}
              >
                <CartesianGrid stroke="var(--iron)" strokeOpacity={0.3} horizontal={false} />
                <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={94}
                  tick={{ fill: "var(--foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[0, 3, 3, 0]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value: unknown) => `${String(value)}/5`}
                    fill="var(--foreground)"
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 border-t border-iron/20 pt-3 text-sm">
            {preferenceData.map((item) => (
              <li key={item.label} className="flex items-start justify-between gap-3">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="text-left text-dust">
                  {item.value} מתוך 5 · {item.answer}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-5 text-dust">
            רמת פעילות שנבחרה:{" "}
            <strong className="font-medium text-foreground">
              {optionTitle(FITNESS_PREFERENCE_OPTIONS, answers.physicalActivityLevel)}
            </strong>
          </p>
        </div>
      </div>
    </section>
  );
}

function FinalSignalsReview({
  answers,
  className,
}: {
  answers: AssessmentAnswers;
  className: string;
}) {
  const branches = deriveAssessmentBranches(answers);
  const unknownCount = [
    answers.daparScore === "unknown",
    answers.medicalProfile === "unknown",
    answers.yomHameahSource === "unknown",
    answers.rolesInterested.includes("undecided"),
    answers.exitsPreference === "no_preference",
    answers.environment === "no_preference",
    answers.motivations.includes("unsure"),
    branches.wantsCombat && answers.combatDetails.run3kmBand === "unknown",
    branches.wantsCombat && answers.combatDetails.pullUpsBand === "unknown",
    branches.wantsCombat && answers.combatDetails.pushUpsBand === "unknown",
    branches.wantsTechnical && answers.technicalDetails.areas.includes("undecided"),
  ].filter(Boolean).length;
  const confidence = Math.max(
    35,
    94 -
      (answers.yomHameahSource === "self" ? 12 : 0) -
      (answers.yomHameahSource === "unknown" ? 18 : 0) -
      unknownCount * 5,
  );
  const roleLabels = answers.rolesInterested
    .map((value) => optionLabel(ROLE_INTEREST_OPTIONS, value))
    .join(" · ");
  const avoidanceLabels = answers.rolesAvoided
    .map((value) => optionLabel(ROLE_AVOIDANCE_OPTIONS, value))
    .join(" · ");
  const motivationLabels = answers.motivations
    .map((value) => optionLabel(MOTIVATION_OPTIONS, value))
    .join(" · ");
  const signals = [
    {
      title: "נתוני סף",
      detail: `דפ״ר ${thresholdLabel(answers.daparScore)}, פרופיל ${thresholdLabel(
        answers.medicalProfile,
      )}, גיוס ${answers.draftDate}`,
    },
    {
      title: "מא״ה",
      detail:
        answers.yomHameahSource === "official"
          ? "11 ציונים רשמיים"
          : answers.yomHameahSource === "self"
            ? "11 הערכות עצמיות, יסומנו בביטחון נמוך יותר"
            : "לא ידוע — ציונים ניטרליים נשמרים לתאימות בלבד ולא ישמשו כאות",
    },
    {
      title: "תחומי עניין והימנעות",
      detail: avoidanceLabels
        ? `מעניין: ${roleLabels}. להימנע: ${avoidanceLabels}`
        : `מעניין: ${roleLabels}. לא סומנו הימנעויות`,
    },
    {
      title: "כיוון והעדפות",
      detail: `${optionTitle(
        COMBAT_PREFERENCE_OPTIONS,
        answers.combatPreference,
      )} · ${optionTitle(FOCUS_PREFERENCE_OPTIONS, answers.focus)} · ${optionTitle(
        FITNESS_PREFERENCE_OPTIONS,
        answers.physicalActivityLevel,
      )}`,
    },
    {
      title: "סביבה ויציאות",
      detail: `${optionLabel(ENVIRONMENT_OPTIONS, answers.environment)} · ${optionLabel(
        EXIT_OPTIONS,
        answers.exitsPreference,
      )}`,
    },
    {
      title: "סגנון עבודה",
      detail: `${optionLabel(LEADERSHIP_OPTIONS, answers.leadership)} · ${optionLabel(
        STRESS_OPTIONS,
        answers.stress,
      )}`,
    },
    {
      title: "מוטיבציה",
      detail: motivationLabels,
    },
    ...(branches.wantsCombat
      ? [{ title: "עומק פיזי", detail: "נכללו מוכנות קרבית ומדדי כושר" }]
      : []),
    ...(branches.wantsTechnical
      ? [{ title: "עומק טכנולוגי", detail: "נכללו רמת ניסיון ותחומי טכנולוגיה" }]
      : []),
  ];

  return (
    <section
      className={`space-y-6 text-right ${className}`}
      aria-labelledby="assessment-review-title"
    >
      <div>
        <p className="font-mono text-[10px] tracking-widest text-primary uppercase">בדיקה אחרונה</p>
        <h2 id="assessment-review-title" className="mt-2 text-xl font-black text-foreground">
          האותות שישמשו את הפרופיל
        </h2>
        <p className="mt-2 text-sm leading-6 text-dust">
          ביטחון הנתונים מתאר כמה מהתשובות מבוססות על מידע רשמי ומפורט. הוא אינו ציון התאמה לתפקיד.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="השלמת ההערכה" value={100} />
        <Metric label="ביטחון בנתוני הקלט" value={confidence} />
      </div>

      {answers.daparScore === "unknown" ||
      answers.medicalProfile === "unknown" ||
      answers.yomHameahSource === "unknown" ? (
        <aside className="border border-amber-500/50 bg-amber-500/10 p-4 text-sm leading-6 text-foreground">
          <strong>לא ניתן לאמת זכאות מלאה:</strong> נתוני הסף שלא ידועים לא ייחשבו כאפס ולא יחסמו
          תפקידים, אבל גם אינם מוכיחים עמידה בתנאי הסף. יש לאמת זכאות מול צה״ל.
        </aside>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {signals.map((signal, index) => (
          <li key={signal.title} className="border border-iron/25 bg-card/70 p-4">
            <span className="font-mono text-[10px] tabular-nums text-primary" aria-hidden>
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="mt-1 text-sm font-bold text-foreground">{signal.title}</p>
            <p className="mt-1 text-xs leading-5 text-dust">{signal.detail}</p>
          </li>
        ))}
      </ul>

      <DraftRoadmap answers={answers} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-iron/25 bg-card/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <strong className="font-mono text-lg tabular-nums text-primary">{value}%</strong>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-iron/20"
        {...progressBarProps(value, label)}
      >
        <div className="h-full bg-primary" style={{ width: `${value}%` }} aria-hidden />
      </div>
    </div>
  );
}
