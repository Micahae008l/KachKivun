import { progressBarProps } from "@/lib/a11y";
import {
  BASE_OPTIONS,
  COMBAT_PREFERENCE_OPTIONS,
  ENVIRONMENT_OPTIONS,
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
import {
  AnswerEcho,
  CommitmentCard,
  DaparDoorsCard,
  NextStepsCard,
  ProfileHeadline,
  ProfileLadderCard,
  StrengthsCard,
} from "./AssessmentInsights";

type Props = {
  answers: AssessmentAnswers;
  className?: string;
  variant?: "profile" | "review";
};

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
  if (variant === "review") {
    return <FinalSignalsReview answers={answers} className={className} />;
  }

  return (
    <section className={`space-y-5 text-right ${className}`} aria-label="הפרופיל שלכם">
      <AnswerEcho answers={answers} />
      <ProfileHeadline answers={answers} />
      <div className="grid gap-5 lg:grid-cols-2">
        <DaparDoorsCard answers={answers} />
        <ProfileLadderCard answers={answers} />
      </div>
      <StrengthsCard answers={answers} />
      <CommitmentCard answers={answers} />
      <p className="text-[11px] leading-5 text-dust">
        ספים ומשכי שירות לפי אתר מתגייסים וחוק שירות ביטחון (יולי 2026). זו לא תחזית שיבוץ; אפשר לחזור ולשנות כל תשובה.
      </p>
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
    answers.basePreference === "no_preference",
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
            : "לא ידוע: ציונים ניטרליים, לא ישמשו כאות",
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
      title: "בסיס וסביבת עבודה",
      detail: `${optionLabel(BASE_OPTIONS, answers.basePreference)} · ${optionLabel(
        ENVIRONMENT_OPTIONS,
        answers.environment,
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
          שלמות הנתונים מתארת כמה מהתשובות מבוססות על מידע רשמי ומפורט. היא אינה ציון התאמה לתפקיד.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="השלמת ההערכה" value={100} />
        <Metric label="שלמות הנתונים" value={confidence} />
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

      <NextStepsCard answers={answers} />
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
