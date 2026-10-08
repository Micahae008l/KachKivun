import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Sparkles } from "lucide-react";
import { DraftDateField } from "@/components/DraftDateField";
import { FieldError, FormField } from "@/components/FormField";
import { PreferenceOptionGrid } from "@/components/PreferenceOptionGrid";
import { ARIA } from "@/lib/a11y";
import { defaultYomHameahScores, YOM_HAMEAH_KEYS, YOM_HAMEAH_LABELS_HE } from "@/lib/yom-hameah";
import { AssessmentCheckpoint } from "./AssessmentCheckpoint";
import { stepReflection } from "../insights";
import {
  COMBAT_PREFERENCE_OPTIONS,
  COMBAT_READINESS_OPTIONS,
  DAPAR_SCORES,
  ENVIRONMENT_OPTIONS,
  BASE_OPTIONS,
  FITNESS_PREFERENCE_OPTIONS,
  FOCUS_PREFERENCE_OPTIONS,
  LEADERSHIP_OPTIONS,
  MEDICAL_PROFILES,
  MOTIVATION_OPTIONS,
  PULL_UP_OPTIONS,
  PUSH_UP_OPTIONS,
  ROLE_AVOIDANCE_OPTIONS,
  ROLE_INTEREST_OPTIONS,
  RUN_3KM_OPTIONS,
  STRESS_OPTIONS,
  TECH_AREA_OPTIONS,
  TECH_LEVEL_OPTIONS,
  UNKNOWN_SCORE_LABEL,
  UNKNOWN_SCORE_VALUE,
  YOM_SOURCE_OPTIONS,
  type AssessmentOption,
} from "../options";
import type { AssessmentAnswers, AssessmentStepId, DaparScore, MedicalProfile } from "../types";

type Props = {
  step: AssessmentStepId;
  answers: AssessmentAnswers;
  setAnswers: Dispatch<SetStateAction<AssessmentAnswers>>;
  error?: string;
  clearError: () => void;
  /** Called after an answer on a single-question screen, so the flow can move on by itself. */
  onAutoAdvance?: () => void;
};

export function AssessmentQuestionStep({
  step,
  answers,
  setAnswers,
  error,
  clearError,
  onAutoAdvance,
}: Props) {
  function update(patch: Partial<AssessmentAnswers>) {
    clearError();
    setAnswers((current) => ({ ...current, ...patch }));
  }

  let content: ReactNode = null;

  if (step === "direction") {
    content = (
      <OptionSection legend="איזה כיוון שירות נשמע לכם נכון כרגע?">
        <PreferenceOptionGrid
          options={COMBAT_PREFERENCE_OPTIONS}
          selected={answers.combatPreference}
          onSelect={(combatPreference) => {
            update({ combatPreference });
            onAutoAdvance?.();
          }}
        />
      </OptionSection>
    );
  }

  if (step === "roles") {
    content = (
      <div className="space-y-7">
        <OptionSection
          legend="אילו תחומים מעניינים אתכם?"
          hint="אפשר לבחור עד חמישה. הבחירה מתאימה את השאלות הבאות."
        >
          <MultiChoice
            options={ROLE_INTEREST_OPTIONS}
            values={answers.rolesInterested}
            max={5}
            exclusiveValue="undecided"
            onChange={(rolesInterested) => update({ rolesInterested })}
          />
        </OptionSection>
        <OptionSection legend="ממה הייתם מעדיפים להימנע?" hint="אופציונלי. אפשר לבחור כמה תשובות.">
          <MultiChoice
            options={ROLE_AVOIDANCE_OPTIONS}
            values={answers.rolesAvoided}
            max={6}
            onChange={(rolesAvoided) => update({ rolesAvoided })}
          />
        </OptionSection>
      </div>
    );
  }

  if (step === "preferences") {
    content = (
      <div className="space-y-8">
        <OptionSection legend="מה מושך אתכם יותר בעבודה עצמה?">
          <PreferenceOptionGrid
            options={FOCUS_PREFERENCE_OPTIONS}
            selected={answers.focus}
            onSelect={(focus) => update({ focus })}
          />
        </OptionSection>
        <OptionSection legend="איזו רמת פעילות פיזית מתאימה לכם?">
          <PreferenceOptionGrid
            options={FITNESS_PREFERENCE_OPTIONS}
            selected={answers.physicalActivityLevel}
            onSelect={(physicalActivityLevel) => update({ physicalActivityLevel })}
            columnsClass="grid-cols-1 sm:grid-cols-3"
          />
        </OptionSection>
      </div>
    );
  }

  if (step === "environment") {
    content = (
      <div className="space-y-7">
        <OptionSection
          legend="בסיס פתוח או סגור?"
          hint="צה״ל לא מפרסם מערכת יציאות קבועה לתפקיד; היא משתנה לפי יחידה ומצב ביטחוני. מה שכן מפורסם הוא אם הבסיס פתוח או סגור, ולפי זה נתאים."
        >
          <SingleChoice
            options={BASE_OPTIONS}
            value={answers.basePreference}
            onChange={(basePreference) => update({ basePreference })}
            cards
          />
        </OptionSection>
        <OptionSection legend="איפה הייתם מעדיפים לעבוד?">
          <SingleChoice
            options={ENVIRONMENT_OPTIONS}
            value={answers.environment}
            onChange={(environment) => update({ environment })}
          />
        </OptionSection>
      </div>
    );
  }

  if (step === "style") {
    content = (
      <div className="space-y-7">
        <OptionSection legend="איך אתם מרגישים לגבי מנהיגות ופיקוד?">
          <SingleChoice
            options={LEADERSHIP_OPTIONS}
            value={answers.leadership}
            onChange={(leadership) => update({ leadership })}
          />
        </OptionSection>
        <OptionSection legend="איך אתם מתפקדים בלחץ ובעומס?">
          <SingleChoice
            options={STRESS_OPTIONS}
            value={answers.stress}
            onChange={(stress) => update({ stress })}
          />
        </OptionSection>
      </div>
    );
  }

  if (step === "combat") {
    const details = answers.combatDetails;
    const updateCombat = (patch: Partial<AssessmentAnswers["combatDetails"]>) =>
      update({ combatDetails: { ...details, ...patch } });
    content = (
      <div className="space-y-7">
        <p className="border-r-2 border-primary bg-primary/5 px-4 py-3 text-sm leading-6 text-dust">
          השלב הזה הופיע בגלל הכיוון שבחרתם. לא צריך מספר מדויק, וגם ״לא יודע/ת״ היא תשובה
          טובה.
        </p>
        <OptionSection legend="ריצת 3 ק״מ">
          <SingleChoice
            options={RUN_3KM_OPTIONS}
            value={details.run3kmBand}
            onChange={(run3kmBand) => updateCombat({ run3kmBand })}
          />
        </OptionSection>
        <OptionSection legend="מתח">
          <SingleChoice
            options={PULL_UP_OPTIONS}
            value={details.pullUpsBand}
            onChange={(pullUpsBand) => updateCombat({ pullUpsBand })}
          />
        </OptionSection>
        <OptionSection legend="שכיבות סמיכה בשתי דקות">
          <SingleChoice
            options={PUSH_UP_OPTIONS}
            value={details.pushUpsBand}
            onChange={(pushUpsBand) => updateCombat({ pushUpsBand })}
          />
        </OptionSection>
        <OptionSection legend="איך אתם מרגישים לגבי המוכנות לכיוון קרבי?">
          <SingleChoice
            options={COMBAT_READINESS_OPTIONS}
            value={details.readiness}
            onChange={(readiness) => updateCombat({ readiness })}
          />
        </OptionSection>
      </div>
    );
  }

  if (step === "technical") {
    const details = answers.technicalDetails;
    content = (
      <div className="space-y-7">
        <p className="border-r-2 border-primary bg-primary/5 px-4 py-3 text-sm leading-6 text-dust">
          השלב הזה הופיע בגלל תחומי העניין והמיקוד שבחרתם.
        </p>
        <OptionSection legend="מה רמת הניסיון שלכם במחשבים?">
          <SingleChoice
            options={TECH_LEVEL_OPTIONS}
            value={details.level}
            onChange={(level) => update({ technicalDetails: { ...details, level } })}
          />
        </OptionSection>
        <OptionSection legend="אילו תחומים טכנולוגיים מעניינים אתכם?" hint="אפשר לבחור עד ארבעה.">
          <MultiChoice
            options={TECH_AREA_OPTIONS}
            values={details.areas}
            max={4}
            exclusiveValue="undecided"
            onChange={(areas) => update({ technicalDetails: { ...details, areas } })}
          />
        </OptionSection>
      </div>
    );
  }

  if (step === "scores") {
    const scoreOptions = <T extends number>(values: readonly T[]) => [
      ...values.map((score) => ({ value: String(score), label: String(score) })),
      { value: UNKNOWN_SCORE_VALUE as string, label: UNKNOWN_SCORE_LABEL },
    ];
    const toScore = <T extends number>(value: string) =>
      value === UNKNOWN_SCORE_VALUE ? UNKNOWN_SCORE_VALUE : (Number(value) as T);
    content = (
      <div className="space-y-7">
        <OptionSection legend="מין">
          <SingleChoice
            options={
              [
                { value: "male", label: "זכר" },
                { value: "female", label: "נקבה" },
              ] as const
            }
            value={answers.gender}
            onChange={(gender) => update({ gender })}
          />
        </OptionSection>
        <OptionSection legend='דפ"ר' hint="הציון מהצו הראשון, בקפיצות של 10.">
          <SingleChoice
            options={scoreOptions(DAPAR_SCORES)}
            value={answers.daparScore === null ? "" : String(answers.daparScore)}
            onChange={(value) => update({ daparScore: toScore<DaparScore>(value) })}
          />
        </OptionSection>
        <OptionSection legend="פרופיל רפואי">
          <SingleChoice
            options={scoreOptions(MEDICAL_PROFILES)}
            value={answers.medicalProfile === null ? "" : String(answers.medicalProfile)}
            onChange={(value) => update({ medicalProfile: toScore<MedicalProfile>(value) })}
          />
        </OptionSection>
      </div>
    );
  }

  if (step === "yom") {
    content = (
      <div className="space-y-6">
        <OptionSection legend="מאיפה הציונים?">
          <SingleChoice
            options={YOM_SOURCE_OPTIONS}
            value={answers.yomHameahSource}
            onChange={(yomHameahSource) =>
              update({
                yomHameahSource,
                ...(yomHameahSource === "unknown" ? { yomHameah: defaultYomHameahScores() } : {}),
              })
            }
            cards
          />
        </OptionSection>
        <p className="border-r-2 border-primary bg-primary/5 px-4 py-3 text-sm leading-6 text-dust">
          {answers.yomHameahSource === "official"
            ? "סמנו את הציון שקיבלתם בכל ממד."
            : answers.yomHameahSource === "self"
              ? "העריכו בכנות. נתייחס להערכה עצמית בזהירות יותר מציון רשמי."
              : answers.yomHameahSource === "unknown"
                ? "אפשר להוסיף את הציונים מאוחר יותר, והתוצאות יתעדכנו."
                : "בחרו מאיפה הציונים כדי להמשיך."}
        </p>
        {answers.yomHameahSource === "official" || answers.yomHameahSource === "self" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {YOM_HAMEAH_KEYS.map((key) => (
              <YomScoreRow
                key={key}
                title={YOM_HAMEAH_LABELS_HE[key]}
                value={answers.yomHameah[key]}
                onChange={(value) => update({ yomHameah: { ...answers.yomHameah, [key]: value } })}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (step === "checkpoint") {
    content = <AssessmentCheckpoint answers={answers} />;
  }

  if (step === "review") {
    content = <AssessmentCheckpoint answers={answers} variant="review" />;
  }

  if (step === "motivation") {
    content = (
      <div className="space-y-7">
        <OptionSection legend="מה הכי חשוב לכם לקבל מהשירות?" hint="אפשר לבחור עד ארבעה.">
          <MultiChoice
            options={MOTIVATION_OPTIONS}
            values={answers.motivations}
            max={4}
            exclusiveValue="unsure"
            onChange={(motivations) => update({ motivations })}
          />
        </OptionSection>
        <FormField label="מה חשוב לכם שהיועץ יידע? (אופציונלי)">
          <p className="mb-2 text-xs leading-5 text-dust">
            מה שתכתבו כאן משפיע על בחירת התפקידים, והיועץ גם יענה עליו ישירות בתוצאות. כתבו תחום שמעניין
            אתכם או דילמה. לדוגמה: ״אני ממש בקטע של רחפנים״, ״יש לי פרופיל 97 אבל אני רוצה טכנולוגיה״ או
            ״אני רוצה 8200 אבל הדפ״ר שלי 60״.
          </p>
          <textarea
            value={answers.extraNote}
            onChange={(event) => update({ extraNote: event.target.value.slice(0, 400) })}
            maxLength={400}
            rows={4}
            placeholder="עד 400 תווים"
            className="input-field min-h-28 resize-y"
          />
        </FormField>
        <p className="-mt-4 text-left font-mono text-[10px] tabular-nums text-dust">
          {answers.extraNote.length}/400
        </p>
      </div>
    );
  }

  if (step === "identity") {
    content = (
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="איך לקרוא לכם?">
          <input
            type="text"
            autoComplete="nickname"
            value={answers.preferredName}
            onChange={(event) => update({ preferredName: event.target.value.slice(0, 120) })}
            maxLength={120}
            placeholder="שם פרטי או כינוי"
            className="input-field"
          />
        </FormField>
        <FormField label="תאריך גיוס משוער">
          <DraftDateField
            value={answers.draftDate}
            onChange={(draftDate) => update({ draftDate })}
          />
        </FormField>
        <p className="text-xs leading-5 text-dust sm:col-span-2">
          אפשר לעדכן את התאריך והפרטים בהמשך. הם משמשים להתאמה אישית בלבד.
        </p>
      </div>
    );
  }

  const reflection = stepReflection(step, answers);

  return (
    <div className="space-y-5">
      {content}
      {reflection ? (
        <p
          key={reflection}
          className="animate-reflection flex items-start gap-2.5 border border-primary/35 bg-primary/10 px-4 py-3 text-sm leading-6 text-foreground"
          aria-live="polite"
        >
          <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
          {reflection}
        </p>
      ) : null}
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}

function OptionSection({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold text-foreground">{legend}</legend>
      {hint ? <p className="text-xs leading-5 text-dust">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

function SingleChoice<T extends string>({
  options,
  value,
  onChange,
  cards = false,
}: {
  options: readonly AssessmentOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  cards?: boolean;
}) {
  return (
    <div className={cards ? "grid gap-2" : "flex flex-wrap gap-2"}>
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            style={{ animationDelay: `${index * 35}ms` }}
            className={`animate-option border text-right text-sm transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] ${
              cards ? "w-full px-4 py-3" : "rounded-sm px-3 py-2"
            } ${
              selected
                ? "border-primary bg-primary/10 font-semibold text-foreground"
                : "border-iron/30 bg-card text-dust hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <span
              className={`ml-2 inline-block h-2 w-2 rounded-full border ${
                selected ? "border-primary bg-primary" : "border-dust/60"
              }`}
              aria-hidden
            />
            <span>
              <span className={option.description ? "block" : undefined}>{option.label}</span>
              {option.description ? (
                <span className="mt-1 block text-xs font-normal leading-5 text-dust">
                  {option.description}
                </span>
              ) : null}
            </span>
            <span className="sr-only">{selected ? ", נבחר" : ", לא נבחר"}</span>
          </button>
        );
      })}
    </div>
  );
}

function MultiChoice<T extends string>({
  options,
  values,
  onChange,
  max,
  exclusiveValue,
}: {
  options: readonly AssessmentOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  max: number;
  exclusiveValue?: T;
}) {
  function toggle(value: T) {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    if (exclusiveValue && value === exclusiveValue) {
      onChange([value]);
      return;
    }
    const withoutExclusive = exclusiveValue
      ? values.filter((item) => item !== exclusiveValue)
      : values;
    if (withoutExclusive.length >= max) return;
    onChange([...withoutExclusive, value]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option, index) => {
        const selected = values.includes(option.value);
        const disabled =
          !selected &&
          option.value !== exclusiveValue &&
          values.filter((item) => item !== exclusiveValue).length >= max;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggle(option.value)}
            style={{ animationDelay: `${index * 35}ms` }}
            className={`animate-option rounded-sm border px-3 py-2 text-xs font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${
              selected
                ? "border-primary bg-primary/15 text-primary"
                : "border-iron/30 bg-card text-dust hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <span aria-hidden>{selected ? "✓ " : "+ "}</span>
            {option.label}
            <span className="sr-only">{selected ? ", נבחר" : ", לא נבחר"}</span>
          </button>
        );
      })}
    </div>
  );
}

function YomScoreRow({
  title,
  value,
  onChange,
}: {
  title: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="flex items-center justify-between gap-3 border border-iron/25 bg-card px-3 py-2.5">
      <legend className="sr-only">{title}</legend>
      <span className="text-sm font-semibold leading-5 text-foreground" aria-hidden>
        {title}
      </span>
      <span className="flex shrink-0 gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map((score) => {
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              aria-pressed={selected}
              aria-label={ARIA.rangeValue(title, score, 5)}
              onClick={() => onChange(score)}
              className={`h-9 w-9 rounded-sm border font-mono text-sm tabular-nums transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.94] ${
                selected
                  ? "border-primary bg-primary font-black text-primary-foreground"
                  : score < value
                    ? "border-primary/40 bg-primary/15 text-foreground"
                    : "border-iron/30 bg-background/40 text-dust hover:border-primary/40"
              }`}
            >
              {score}
            </button>
          );
        })}
      </span>
    </fieldset>
  );
}
