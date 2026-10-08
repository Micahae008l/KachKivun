import type { CSSProperties } from "react";
import { Ban, Compass, Flame, Gauge, Heart, Home, Users, type LucideIcon } from "lucide-react";
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
import { YomRadar } from "./YomRadar";

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
    <section className={`space-y-8 text-right ${className}`} aria-label="הפרופיל שלכם">
      <AnswerEcho answers={answers} />
      <ProfileHeadline answers={answers} />
      <DaparDoorsCard answers={answers} />
      <ProfileLadderCard answers={answers} />
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
  const labels = <T extends string>(options: readonly { value: T; label: string }[], values: T[]) =>
    values.map((value) => optionLabel(options, value));
  const yomKnown = answers.yomHameahSource === "official" || answers.yomHameahSource === "self";

  const rows: { icon: LucideIcon; title: string; chips: string[]; muted?: boolean }[] = [
    {
      icon: Gauge,
      title: "נתוני סף",
      chips: [
        `דפ״ר ${thresholdLabel(answers.daparScore)}`,
        `פרופיל ${thresholdLabel(answers.medicalProfile)}`,
      ],
    },
    {
      icon: Compass,
      title: "כיוון",
      chips: [
        optionTitle(COMBAT_PREFERENCE_OPTIONS, answers.combatPreference),
        optionTitle(FOCUS_PREFERENCE_OPTIONS, answers.focus),
        `כושר ${optionTitle(FITNESS_PREFERENCE_OPTIONS, answers.physicalActivityLevel)}`,
      ],
    },
    { icon: Heart, title: "מעניין", chips: labels(ROLE_INTEREST_OPTIONS, answers.rolesInterested) },
    ...(answers.rolesAvoided.length
      ? [{ icon: Ban, title: "להימנע", chips: labels(ROLE_AVOIDANCE_OPTIONS, answers.rolesAvoided), muted: true }]
      : []),
    {
      icon: Home,
      title: "בסיס וסביבה",
      chips: [
        optionLabel(BASE_OPTIONS, answers.basePreference).split(":")[0],
        optionLabel(ENVIRONMENT_OPTIONS, answers.environment),
      ],
    },
    {
      icon: Users,
      title: "סגנון",
      chips: [optionLabel(LEADERSHIP_OPTIONS, answers.leadership), optionLabel(STRESS_OPTIONS, answers.stress)],
    },
    { icon: Flame, title: "מה מניע אתכם", chips: labels(MOTIVATION_OPTIONS, answers.motivations) },
  ];

  return (
    <section className={`space-y-5 text-right ${className}`} aria-labelledby="assessment-review-title">
      <h2 id="assessment-review-title" className="sr-only">
        סיכום הפרופיל
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <RingMetric label="השלמת ההערכה" value={100} />
        <RingMetric label="שלמות הנתונים" value={confidence} />
      </div>

      {answers.daparScore === "unknown" ||
      answers.medicalProfile === "unknown" ||
      answers.yomHameahSource === "unknown" ? (
        <p className="border-r-2 border-amber-400 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-foreground">
          חלק מנתוני הסף לא ידועים, אז את הזכאות תאמתו מול צה״ל.
        </p>
      ) : null}

      {yomKnown ? (
        <div className="border border-iron/25 bg-card/70 p-3">
          <p className="mb-1 text-xs font-bold text-dust">מפת מא״ה</p>
          <div className="mx-auto max-w-xs">
            <YomRadar answers={answers} />
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-iron/20 border border-iron/25 bg-card/70">
        {rows.map(({ icon: Icon, title, chips, muted }) => (
          <li key={title} className="flex items-start gap-3 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-dust">{title}</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {chips.filter(Boolean).map((chip) => (
                  <li
                    key={chip}
                    className={`border px-2 py-0.5 text-xs font-semibold ${
                      muted
                        ? "border-iron/30 bg-background/40 text-dust line-through decoration-dust/50"
                        : "border-primary/30 bg-primary/10 text-foreground"
                    }`}
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <NextStepsCard answers={answers} />
    </section>
  );
}

function RingMetric({ label, value }: { label: string; value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-3 border border-iron/25 bg-card/70 p-3">
      <svg width="64" height="64" className="-rotate-90 shrink-0" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-iron/25" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="animate-ring stroke-primary"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          style={{ "--ring-from": circumference } as CSSProperties}
        />
      </svg>
      <div {...progressBarProps(value, label)}>
        <p className="font-mono text-xl font-black tabular-nums text-primary">{value}%</p>
        <p className="text-xs leading-4 text-dust">{label}</p>
      </div>
    </div>
  );
}
