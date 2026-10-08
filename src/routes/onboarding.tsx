import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { getDashboardStats, updateProfile, type YomHameah } from "@/lib/api";
import { dashboardQueryOptions } from "@/lib/queries";
import { getToken } from "@/lib/auth";
import { PreferenceOptionGrid } from "@/components/PreferenceOptionGrid";
import { DraftDateField } from "@/components/DraftDateField";
import {
  COMBAT_PREFERENCE_OPTIONS,
  FOCUS_PREFERENCE_OPTIONS,
  FITNESS_PREFERENCE_OPTIONS,
  type CombatPreferenceValue,
  type FocusPreferenceValue,
  type FitnessPreferenceValue,
} from "@/lib/profile-preference-data";
import { YOM_HAMEAH_12_KEYS, migrateLegacyYomHameahTo12 } from "@/lib/yom-hameah-12";
import {
  coerceCombat,
  coerceFitness,
  coerceFocus,
  draftDateToYmd,
} from "@/lib/profile-resume";
import { ARIA } from "@/lib/a11y";
import { FieldError } from "@/components/FormField";
import { getErrorMessage } from "@/lib/api-errors";
import { OnboardingSkeleton } from "@/components/skeletons/PageSkeletons";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { idfPhotoAt } from "@/lib/idf-images";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

const DAPAR_SCORES = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
const MEDICAL_SCORES = [21, 45, 64, 70, 72, 82, 97] as const;

const ease = [0.16, 1, 0.3, 1] as const;

function yomHameahComplete(y: unknown): boolean {
  return migrateLegacyYomHameahTo12(y) !== null;
}

function coarseYomFromFitness(f: FitnessPreferenceValue): YomHameah {
  const n = f === "High" ? 4 : f === "Medium" ? 3 : 2;
  return Object.fromEntries(YOM_HAMEAH_12_KEYS.map((k) => [k, n])) as YomHameah;
}

const STEP_COMBAT = 0;
const STEP_FOCUS = 1;
const STEP_FITNESS = 2;
const STEP_DRAFT = 3;
const STEP_STATS = 4;
const TOTAL_STEPS = 5;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [combat, setCombat] = useState<CombatPreferenceValue | "">("");
  const [focus, setFocus] = useState<FocusPreferenceValue | "">("");
  const [fitness, setFitness] = useState<FitnessPreferenceValue | "">("");
  const [draftDate, setDraftDate] = useState("");
  const [dapar, setDapar] = useState<number | null>(null);
  const [medical, setMedical] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const token = mounted ? getToken() : null;

  const { data: dash, isPending, isError, refetch } = useQuery({
    ...dashboardQueryOptions(token),
    enabled: mounted && !!token,
  });
  const showSkeleton = isPending && !dash;

  useEffect(() => {
    if (!dash || hydratedRef.current) return;
    hydratedRef.current = true;
    if (dash.aiReady) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    setCombat(coerceCombat(dash.preferences?.combatPreference));
    setFocus(coerceFocus(dash.preferences?.focus));
    setFitness(coerceFitness(dash.preferences?.physicalActivityLevel));
    if (dash.stats?.draftDate) setDraftDate(draftDateToYmd(dash.stats.draftDate));
    if (dash.stats?.daparScore != null) setDapar(dash.stats.daparScore);
    if (dash.stats?.medicalProfile != null) setMedical(dash.stats.medicalProfile);
  }, [dash, navigate]);

  function next() {
    setStepError(null);
    if (step === STEP_COMBAT && !combat) {
      setStepError("נא לבחור כיוון שירות לפני המשך");
      return;
    }
    if (step === STEP_FOCUS && !focus) {
      setStepError("נא לבחור מיקוד אחד לפני המשך");
      return;
    }
    if (step === STEP_FITNESS && !fitness) {
      setStepError("נא לבחור רמת כושר לפני המשך");
      return;
    }
    if (step === STEP_DRAFT && !draftDate.trim()) {
      setStepError("נא לבחור תאריך גיוס משוער");
      return;
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function prev() {
    setStepError(null);
    setDirection(-1);
    if (step > 0) setStep((s) => s - 1);
  }

  async function finish() {
    setStepError(null);
    if (!getToken()) {
      toast.error("יש להתחבר לפני שמירת הפרופיל");
      navigate({ to: "/post-signup" });
      return;
    }
    if (!combat) {
      setStepError("חסר כיוון שירות");
      setStep(STEP_COMBAT);
      return;
    }
    if (!focus) {
      setStepError("חסר מיקוד");
      setStep(STEP_FOCUS);
      return;
    }
    if (!fitness) {
      setStepError("חסרה רמת כושר");
      setStep(STEP_FITNESS);
      return;
    }
    if (!draftDate.trim()) {
      setStepError("חסר תאריך גיוס משוער");
      setStep(STEP_DRAFT);
      return;
    }
    if (dapar == null || medical == null) {
      setStepError('נא לבחור דפ"ר ופרופיל רפואי');
      setStep(STEP_STATS);
      return;
    }
    setSaving(true);
    try {
      let statsPayload: {
        draftDate: string;
        daparScore: number;
        medicalProfile: number;
        yomHameah?: YomHameah;
      } = {
        draftDate: new Date(draftDate).toISOString(),
        daparScore: dapar,
        medicalProfile: medical,
      };
      try {
        const dash = await getDashboardStats();
        if (!yomHameahComplete(dash.stats?.yomHameah)) {
          statsPayload = { ...statsPayload, yomHameah: coarseYomFromFitness(fitness) };
        }
      } catch {
        statsPayload = { ...statsPayload, yomHameah: coarseYomFromFitness(fitness) };
      }

      await updateProfile({
        status: "Pre-Draft",
        preferences: {
          combatPreference: combat,
          focus,
          physicalActivityLevel: fitness,
          schedule: "Any",
          location: "Anywhere",
        },
        stats: statsPayload,
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("הפרופיל נשמר בשרת");
      navigate({ to: "/dashboard" });
    } catch (e) {
      setStepError(getErrorMessage(e, "שגיאה בשמירת הפרופיל"));
    } finally {
      setSaving(false);
    }
  }

  const titleForStep =
    step === STEP_COMBAT
      ? "איך אתם רואים את השירות?"
      : step === STEP_FOCUS
        ? "מה הכי חשוב לכם?"
        : step === STEP_FITNESS
          ? "מה רמת הכושר שלכם?"
          : step === STEP_DRAFT
            ? "מתי הגיוס?"
            : 'דפ״ר ופרופיל רפואי';

  const subtitleForStep =
    step === STEP_COMBAT
      ? "בחרו את הכיוון שמתקרב למציאות שלכם."
      : step === STEP_FOCUS
        ? "מיקוד אחד עוזר ליועץ AI להתאים תפקידים."
        : step === STEP_FITNESS
          ? "הערכה עצמית."
          : step === STEP_DRAFT
            ? "בחרו תאריך משוער. אפשר לעדכן אחר כך."
            : "נדרש לפני שימוש ביועץ AI.";

  if (!mounted || (token && showSkeleton)) {
    return <OnboardingSkeleton />;
  }

  if (token && isError) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-6 py-16 text-center">
        <p className="text-sm text-dust">לא הצלחנו לטעון את הפרופיל מהשרת.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
        >
          נסו שוב
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-16">
      <div className="mb-8 hidden overflow-hidden rounded-sm border border-iron/30 lg:block">
        <IdfPhotoPanel
          photo={idfPhotoAt(step)}
          aspectClassName="aspect-[21/6]"
          overlayClassName="from-background/50 via-background/70 to-background"
        />
      </div>
      <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-8 space-y-2">
        <div className="flex gap-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className="relative h-1 flex-1 overflow-hidden bg-iron/20">
              <motion.div
                className="absolute inset-y-0 right-0 bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.35, ease }}
              />
            </div>
          ))}
        </div>
        <p className="text-center font-mono text-[10px] text-dust/50 tabular-nums">
          שלב {step + 1} מתוך {TOTAL_STEPS}
        </p>
      </div>

      <div className="border border-iron/30 bg-card p-5 overflow-hidden sm:p-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease }}
            className="space-y-6 text-center"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="inline-flex h-10 w-10 items-center justify-center border border-primary/30 text-primary">
                {step === STEP_DRAFT ? <Calendar className="h-5 w-5" /> : <Crosshair className="h-5 w-5" />}
              </div>
              <h2 className="text-2xl font-bold text-foreground">{titleForStep}</h2>
              <p className="text-sm text-dust">{subtitleForStep}</p>
            </div>

            {step === STEP_COMBAT && (
              <PreferenceOptionGrid
                options={COMBAT_PREFERENCE_OPTIONS}
                selected={combat}
                onSelect={(v) => {
                  setCombat(v);
                  setStepError(null);
                }}
                columnsClass="grid-cols-1 sm:grid-cols-2"
              />
            )}

            {step === STEP_FOCUS && (
              <PreferenceOptionGrid
                options={FOCUS_PREFERENCE_OPTIONS}
                selected={focus}
                onSelect={(v) => {
                  setFocus(v);
                  setStepError(null);
                }}
                columnsClass="grid-cols-1 sm:grid-cols-2"
              />
            )}

            {step === STEP_FITNESS && (
              <PreferenceOptionGrid
                options={FITNESS_PREFERENCE_OPTIONS}
                selected={fitness}
                onSelect={(v) => {
                  setFitness(v);
                  setStepError(null);
                }}
                columnsClass="grid-cols-1 sm:grid-cols-3"
              />
            )}

            {step === STEP_DRAFT && (
              <div className="space-y-3 text-right">
                <label className="block text-sm font-medium text-foreground">תאריך גיוס משוער</label>
                <DraftDateField
                  value={draftDate}
                  onChange={(v) => {
                    setDraftDate(v);
                    setStepError(null);
                  }}
                  invalid={Boolean(stepError)}
                />
              </div>
            )}

            {step === STEP_STATS && (
              <div className="space-y-5 text-right">
                <p className="text-xs font-medium text-dust">דפ&quot;ר</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {DAPAR_SCORES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setDapar(n);
                        setStepError(null);
                      }}
                      aria-pressed={dapar === n}
                      aria-label={ARIA.scoreChip(n, dapar === n)}
                      className={`rounded-sm border px-3.5 py-2 font-mono text-sm font-bold tabular-nums transition-colors ${
                        dapar === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-iron/30 bg-card text-foreground hover:border-primary/40"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-medium text-dust">פרופיל רפואי</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {MEDICAL_SCORES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setMedical(n);
                        setStepError(null);
                      }}
                      aria-pressed={medical === n}
                      aria-label={ARIA.scoreChip(n, medical === n)}
                      className={`rounded-sm border px-3.5 py-2 font-mono text-sm font-bold tabular-nums transition-colors ${
                        medical === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-iron/30 bg-card text-foreground hover:border-primary/40"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stepError ? <FieldError message={stepError} className="justify-center" /> : null}

            <div className="flex items-center justify-center gap-3 pt-2">
              {step === STEP_STATS ? (
                <button
                  type="button"
                  onClick={finish}
                  disabled={dapar == null || medical == null || saving}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  {saving ? "שומר…" : "סיום ושמירה"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  הבא
                </button>
              )}
              {step > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="rounded-md border border-iron/40 px-5 py-2.5 text-sm font-medium text-dust transition hover:border-primary/40 hover:text-foreground"
                >
                  הקודם
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}
