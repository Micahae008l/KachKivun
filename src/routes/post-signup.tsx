import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Mail, Shield, Sparkles, User, X } from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  completeScoreOnboarding,
  requestOtp,
  verifyOtp,
  type DashboardResponse,
  type YomHameah,
} from "@/lib/api";
import { getToken, setAuthSession } from "@/lib/auth";
import { dashboardQueryOptions, prefetchAuthedData } from "@/lib/queries";
import { PreferenceOptionGrid } from "@/components/PreferenceOptionGrid";
import { DraftDateField } from "@/components/DraftDateField";
import {
  COMBAT_PREFERENCE_OPTIONS,
  ENVIRONMENT_OPTIONS,
  FOCUS_PREFERENCE_OPTIONS,
  FITNESS_PREFERENCE_OPTIONS,
  LANGUAGE_OPTIONS,
  MOTIVATION_OPTIONS,
  STRENGTH_OPTIONS,
  languagesReaction,
  type CombatPreferenceValue,
  type EnvironmentValue,
  type FocusPreferenceValue,
  type FitnessPreferenceValue,
  type LanguageValue,
  type MotivationValue,
  type PersonalOption,
  type StrengthValue,
} from "@/lib/profile-preference-data";
import { LAST_PROFILE_STEP, STEP, STEP_NAME, TOTAL_STEPS } from "@/lib/signup-steps";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { KachKivunLogo } from "@/components/KachKivunLogo";
import { SITE_NAME_HE } from "@/lib/brand";
import { idfPhotoAt } from "@/lib/idf-images";
import { defaultYomHameah12Scores, YOM_HAMEAH_12_KEYS, YOM_HAMEAH_12_LABELS_HE } from "@/lib/yom-hameah-12";
import { ARIA } from "@/lib/a11y";
import {
  trackSignupCodeSent,
  trackSignupCodeVerified,
  trackSignupComplete,
  trackSignupError,
  trackSignupStep,
} from "@/lib/analytics";
import {
  PostSignupBootstrapSkeleton,
  PostSignupFormSkeleton,
} from "@/components/skeletons/PageSkeletons";
import { FormField, FieldError } from "@/components/FormField";
import { authErrorField, getErrorMessage } from "@/lib/api-errors";
import {
  coerceCombat,
  coerceFitness,
  coerceFocus,
  computePostSignupResumeStep,
  draftDateToYmd,
  yomFromDashboard,
} from "@/lib/profile-resume";

export const Route = createFileRoute("/post-signup")({
  component: PostSignupPage,
});

const DAPAR_SCORES = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
const MEDICAL_SCORES = [21, 45, 64, 72, 82, 97] as const;

/** Answers survive an Instagram in-app-browser reload (very common when checking mail for the OTP). */
const DRAFT_KEY = "kk_signup_draft_v1";
/** Drafts saved before the personal questions numbered screens 1–9; map them onto today's. */
const DRAFT_STEPS_V1: Record<number, number> = {
  1: STEP.combat,
  2: STEP.focus,
  3: STEP.fitness,
  4: STEP.scores,
  5: STEP.yom,
  6: STEP.draft,
  7: STEP.name,
  8: STEP.email,
  9: STEP.code,
};

type FieldKey =
  | "email"
  | "code"
  | "username"
  | "dapar"
  | "medical"
  | "gender"
  | "combat"
  | "focus"
  | "fitness"
  | "motivation"
  | "strengths"
  | "environment"
  | "languages"
  | "draftDate";
type FieldErrors = Partial<Record<FieldKey, string>>;

const ease = [0.16, 1, 0.3, 1] as const;

function normalizeEmailInput(value: string) {
  return value.trim().toLowerCase();
}

function normalizeOtpInput(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 6);
}

function PostSignupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [step, setStep] = useState<number>(STEP.combat);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [dapar, setDapar] = useState<number | "">("");
  const [medical, setMedical] = useState<number | "">("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [yomScores, setYomScores] = useState(() => defaultYomHameah12Scores());
  const [combatPreference, setCombatPreference] = useState<CombatPreferenceValue | "">("");
  const [focusPref, setFocusPref] = useState<FocusPreferenceValue | "">("");
  const [fitnessPref, setFitnessPref] = useState<FitnessPreferenceValue | "">("");
  const [motivation, setMotivation] = useState<MotivationValue | "">("");
  const [strengths, setStrengths] = useState<StrengthValue | "">("");
  const [environment, setEnvironment] = useState<EnvironmentValue | "">("");
  const [languages, setLanguages] = useState<LanguageValue[]>([]);
  const [draftDate, setDraftDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  /** True when the user chose sign-in (or landed on #login) instead of the signup quiz. */
  const [loginIntent, setLoginIntent] = useState(false);
  const authed = useRef(false);

  function clearFieldErrors(...keys: FieldKey[]) {
    if (keys.length === 0) {
      setFieldErrors({});
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function setFieldError(key: FieldKey, message: string) {
    setFieldErrors((prev) => ({ ...prev, [key]: message }));
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  function applyServerProfile(d: DashboardResponse) {
    setEmail(d.user.email ?? "");
    setUsername(d.user.preferredName?.trim() ?? "");
    if (d.stats?.daparScore != null) setDapar(d.stats.daparScore);
    if (d.stats?.medicalProfile != null) setMedical(d.stats.medicalProfile);
    if (d.stats?.gender) setGender(d.stats.gender);
    setYomScores(yomFromDashboard(d.stats));
    const p = d.preferences;
    setCombatPreference(coerceCombat(p?.combatPreference));
    setFocusPref(coerceFocus(p?.focus));
    setFitnessPref(coerceFitness(p?.physicalActivityLevel));
    setDraftDate(draftDateToYmd(d.stats?.draftDate));
    setMotivation(pickOption(MOTIVATION_OPTIONS, p?.motivation));
    setStrengths(pickOption(STRENGTH_OPTIONS, p?.strengths));
    setEnvironment(pickOption(ENVIRONMENT_OPTIONS, p?.environment));
    setLanguages(pickLanguages(p?.languages));
    setStep(computePostSignupResumeStep(d));
  }

  function restoreDraft() {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(DRAFT_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.email === "string") setEmail(d.email);
      if (typeof d.username === "string") setUsername(d.username);
      if (typeof d.dapar === "number") setDapar(d.dapar);
      if (typeof d.medical === "number") setMedical(d.medical);
      if (d.gender === "male" || d.gender === "female") setGender(d.gender);
      if (d.yomScores && typeof d.yomScores === "object") {
        setYomScores({ ...defaultYomHameah12Scores(), ...(d.yomScores as YomHameah) });
      }
      const combat = coerceCombat(d.combatPreference as string | undefined);
      const focus = coerceFocus(d.focusPref as string | undefined);
      const fitness = coerceFitness(d.fitnessPref as string | undefined);
      setCombatPreference(combat);
      setFocusPref(focus);
      setFitnessPref(fitness);
      const draft = typeof d.draftDate === "string" ? d.draftDate : "";
      if (draft) setDraftDate(draft);
      setMotivation(pickOption(MOTIVATION_OPTIONS, d.motivation));
      setStrengths(pickOption(STRENGTH_OPTIONS, d.strengths));
      setEnvironment(pickOption(ENVIRONMENT_OPTIONS, d.environment));
      setLanguages(pickLanguages(d.languages));

      // Never resume on the email/OTP screens from a draft unless the quiz is done.
      // Accidental "כבר יש לי חשבון" used to stick people on the login screen forever.
      const missing = missingProfileStep({
        combatPreference: combat,
        focusPref: focus,
        fitnessPref: fitness,
        gender: d.gender === "male" || d.gender === "female" ? d.gender : "",
        dapar: typeof d.dapar === "number" ? d.dapar : "",
        medical: typeof d.medical === "number" ? d.medical : "",
        draftDate: draft,
        username: typeof d.username === "string" ? d.username : "",
      });
      const rawStep = typeof d.step === "number" ? d.step : STEP.combat;
      const savedStep = d.v === 2 ? rawStep : (DRAFT_STEPS_V1[rawStep] ?? STEP.combat);
      if (missing !== 0) {
        setStep(missing);
      } else if (savedStep >= STEP.combat && savedStep <= TOTAL_STEPS) {
        setStep(savedStep);
      }
    } catch {
      /* corrupt draft, start clean */
    }
  }

  function clearLoginHash() {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#login") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  function enterLoginMode() {
    clearFieldErrors();
    setLoginIntent(true);
    setStep(STEP.email);
  }

  function enterSignupMode() {
    clearFieldErrors();
    setLoginIntent(false);
    clearLoginHash();
    const missing = firstMissingStep();
    setStep(missing === 0 ? STEP.combat : missing);
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        if (!cancelled) {
          const wantsLogin = window.location.hash === "#login";
          restoreDraft();
          // "/post-signup#login" — returning users skip the quiz and go straight to email.
          if (wantsLogin) {
            setLoginIntent(true);
            setStep(STEP.email);
          }
          setBootstrapped(true);
        }
        return;
      }
      authed.current = true;
      try {
        const d = await queryClient.fetchQuery(dashboardQueryOptions(getToken()));
        if (cancelled) return;
        if (d.aiReady) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        applyServerProfile(d);
      } catch {
        if (!cancelled && getToken()) setStep(STEP.combat);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, navigate, queryClient]);

  // Funnel: one event per wizard screen the visitor actually sees.
  useEffect(() => {
    if (bootstrapped) trackSignupStep(step, TOTAL_STEPS, STEP_NAME[step] ?? String(step));
  }, [bootstrapped, step]);

  // Persist answers for anonymous visitors only; signed-in state lives on the server.
  useEffect(() => {
    if (!bootstrapped || authed.current) return;
    try {
      // Don't persist the login shortcut as the resume step — that traps new signups on email.
      const missing = firstMissingStep();
      const draftStep =
        loginIntent || (step >= STEP.email && missing !== 0) ? (missing === 0 ? STEP.name : missing) : step;
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          v: 2,
          step: draftStep,
          email,
          username,
          dapar,
          medical,
          gender,
          yomScores,
          combatPreference,
          focusPref,
          fitnessPref,
          motivation,
          strengths,
          environment,
          languages,
          draftDate,
        }),
      );
    } catch {
      /* private mode / quota */
    }
  }, [
    bootstrapped,
    loginIntent,
    step,
    email,
    username,
    dapar,
    medical,
    gender,
    yomScores,
    combatPreference,
    focusPref,
    fitnessPref,
    motivation,
    strengths,
    environment,
    languages,
    draftDate,
  ]);

  /** First profile step still missing a required answer, or 0 when complete. */
  function firstMissingStep(): number {
    return missingProfileStep({
      combatPreference,
      focusPref,
      fitnessPref,
      gender,
      dapar,
      medical,
      draftDate,
      username,
    });
  }

  async function sendCode() {
    clearFieldErrors("email");
    const normalizedEmail = normalizeEmailInput(email);
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setFieldError("email", "נא להזין כתובת אימייל תקינה (למשל name@gmail.com)");
      return;
    }
    setLoading(true);
    try {
      const res = await requestOtp(normalizedEmail);
      setEmail(normalizedEmail);
      if (res.devCode) {
        setDevOtpHint(res.devCode);
        setCode(res.devCode);
        toast.success("קוד פיתוח, מוצג למטה (ללא SMTP)", { duration: 12_000 });
      } else if (res.delivery === "console") {
        setDevOtpHint(null);
        toast.success("ללא SMTP, הקוד מודפס בלוג השרת בלבד.", { duration: 12_000 });
      } else {
        setDevOtpHint(null);
        toast.success("שלחנו קוד באימייל (בדקו גם בספאם)");
      }
      clearFieldErrors("code");
      trackSignupCodeSent(false);
      setStep(STEP.code);
    } catch (err) {
      // A cooldown means a still-valid code is already in their inbox — show the
      // code screen instead of stranding them with no field to type it into.
      if (err instanceof ApiError && err.code === "OTP_RESEND_COOLDOWN") {
        setEmail(normalizedEmail);
        setDevOtpHint(null);
        clearFieldErrors("code");
        trackSignupCodeSent(true);
        setStep(STEP.code);
        toast.success("כבר שלחנו קוד לאימייל הזה, הזינו אותו כאן (בדקו גם בספאם)");
        return;
      }
      trackSignupError(
        "email",
        err instanceof ApiError ? err.code || `http_${err.status}` : "network",
      );
      const msg = getErrorMessage(err, "שגיאה בשליחת קוד");
      const field = authErrorField(err) ?? "email";
      setFieldError(field, msg);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    clearFieldErrors("code");
    const normalizedEmail = normalizeEmailInput(email);
    const clean = normalizeOtpInput(code);
    if (clean.length !== 6) {
      setFieldError("code", "נא להזין קוד בן 6 ספרות");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(normalizedEmail, clean);
      setAuthSession(res.token, res.role);
      trackSignupCodeVerified(Boolean(res.isNewUser));
      authed.current = true;
      prefetchAuthedData(queryClient, res.token);

      // Came through the quiz: save the answers they just gave and go straight to results.
      if (firstMissingStep() === 0) {
        await saveProfile();
        return;
      }

      // Came in via "כבר יש לי חשבון": resume from whatever the server has.
      try {
        const d = await queryClient.fetchQuery(dashboardQueryOptions(res.token));
        if (d.aiReady) {
          clearDraft();
          toast.success("התחברתם בהצלחה");
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        toast.success("ממשיכים להשלמת הפרופיל האישי");
        applyServerProfile(d);
      } catch {
        toast.success("בואו נשלים את הפרופיל");
        setStep(STEP.combat);
      }
    } catch (err) {
      trackSignupError(
        "code",
        err instanceof ApiError ? err.code || `http_${err.status}` : "network",
      );
      const msg = getErrorMessage(err, "קוד לא תקין");
      setFieldError(authErrorField(err) ?? "code", msg);
    } finally {
      setLoading(false);
    }
  }

  function nextFromProfileStep() {
    if (step === STEP.combat) {
      clearFieldErrors("combat");
      if (!combatPreference) {
        setFieldError("combat", "נא לבחור כיוון שירות לפני המשך");
        return;
      }
    }
    if (step === STEP.focus) {
      clearFieldErrors("focus");
      if (!focusPref) {
        setFieldError("focus", "נא לבחור מיקוד אחד לפני המשך");
        return;
      }
    }
    if (step === STEP.fitness) {
      clearFieldErrors("fitness");
      if (!fitnessPref) {
        setFieldError("fitness", "נא לבחור רמת כושר לפני המשך");
        return;
      }
    }
    const personal: [number, FieldKey, boolean, string][] = [
      [STEP.motivation, "motivation", !motivation, "בחרו מה הכי חשוב לכם"],
      [STEP.strengths, "strengths", !strengths, "בחרו במה אתם הכי חזקים"],
      [STEP.environment, "environment", !environment, "בחרו סביבה, או «לא משנה»"],
      [STEP.languages, "languages", languages.length === 0, "בחרו לפחות אפשרות אחת, גם «עברית בלבד» זה בסדר"],
    ];
    for (const [screen, key, missing, message] of personal) {
      if (step !== screen) continue;
      clearFieldErrors(key);
      if (missing) {
        setFieldError(key, message);
        return;
      }
    }
    if (step === STEP.scores) {
      clearFieldErrors("dapar", "medical", "gender");
      let hasError = false;
      if (gender === "") {
        setFieldError("gender", "נא לבחור");
        hasError = true;
      }
      if (dapar === "") {
        setFieldError("dapar", 'נא לבחור ציון דפ"ר');
        hasError = true;
      }
      if (medical === "") {
        setFieldError("medical", "נא לבחור פרופיל רפואי");
        hasError = true;
      }
      if (hasError) return;
    }
    if (step === STEP.draft) {
      clearFieldErrors("draftDate");
      if (!draftDate.trim()) {
        setFieldError("draftDate", "נא לבחור תאריך גיוס משוער");
        return;
      }
      if (Number.isNaN(Date.parse(draftDate))) {
        setFieldError("draftDate", "תאריך הגיוס לא תקין, בחרו תאריך מהלוח");
        return;
      }
    }
    if (step === STEP.name) {
      clearFieldErrors("username");
      if (!username.trim()) {
        setFieldError("username", "נא לבחור שם משתמש, איך לקרוא לכם בדשבורד");
        return;
      }
      // Already signed in (resuming a profile) — nothing left to ask.
      if (authed.current) {
        void saveProfile();
        return;
      }
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  /** POST the collected profile. Requires a token to already be stored. */
  async function saveProfile() {
    const missing = firstMissingStep();
    if (missing || dapar === "" || medical === "" || !combatPreference || !focusPref || !fitnessPref) {
      setStep(missing || STEP.scores);
      toast.error("חסר עוד פרט אחד לפני סיום");
      return;
    }

    const yomHameah: YomHameah = { ...yomScores };

    setLoading(true);
    try {
      await completeScoreOnboarding({
        username: username.trim(),
        serviceLifeCycle: "pre",
        daparScore: dapar,
        medicalProfile: medical,
        gender: gender || null,
        yomHameah,
        yomHameahSource: "self",
        draftDate,
        preferences: {
          combatPreference: combatPreference,
          focus: focusPref,
          physicalActivityLevel: fitnessPref,
          schedule: "Any",
          location: "Anywhere",
          ...(motivation ? { motivation } : {}),
          ...(strengths ? { strengths } : {}),
          ...(environment ? { environment } : {}),
          ...(languages.length ? { languages } : {}),
        },
      });
      clearDraft();
      trackSignupComplete();
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("הפרופיל נשמר, אפשר להשתמש ביועץ AI");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(getErrorMessage(err, "שגיאה בשמירת הפרופיל"));
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    if (loginIntent) {
      if (step === STEP.code) {
        setStep(STEP.email);
        return;
      }
      // Leave sign-in and return to the quiz (or home if they never started).
      enterSignupMode();
      return;
    }
    if (step <= STEP.combat) {
      navigate({ to: "/" });
      return;
    }
    setStep((s) => Math.max(STEP.combat, s - 1));
  }

  if (!mounted) {
    return (
      <div dir="rtl" className="flex min-h-dvh items-center justify-center bg-background px-6">
        <PostSignupFormSkeleton />
      </div>
    );
  }

  if (getToken() && !bootstrapped) {
    return <PostSignupBootstrapSkeleton />;
  }

  const isAuthStep = step >= STEP.email;
  // Sign-in shortcut or #login — not the end of the signup quiz.
  const loginOnly = loginIntent;
  const stepCount = authed.current ? LAST_PROFILE_STEP : TOTAL_STEPS;
  const displayStep = loginOnly ? step - STEP.email + 1 : Math.min(step, stepCount);
  const displayTotal = loginOnly ? 2 : stepCount;
  const progress = Math.round((displayStep / displayTotal) * 100);
  const meta = getStepMeta(step, loginOnly);
  const showSignInShortcut = !authed.current && !loginIntent && step < STEP.email;

  return (
    <div dir="rtl" className="relative flex min-h-dvh">
      {/* Background image */}
      <div className="fixed inset-0 transition-opacity duration-500 opacity-30">
        <IdfPhotoPanel
          photo={idfPhotoAt(step)}
          aspectClassName="absolute inset-0 min-h-0"
          className="absolute inset-0"
          overlayClassName="from-background/80 via-background/90 to-background"
          imgClassName="object-[center_35%]"
        />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10">
        {/* Top bar */}
        <div className="mx-auto mb-8 flex w-full max-w-2xl items-center justify-between gap-4">
          <KachKivunLogo size="md" linked />
          {step === STEP.combat ? (
            <Link to="/" className="flex items-center gap-1.5 text-sm text-dust transition hover:text-foreground">
              <X className="h-4 w-4" />
              חזרה לאתר
            </Link>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-dust transition hover:text-foreground disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
              חזרה
            </button>
          )}
          {isAuthStep ? (
            <span className="font-mono text-[10px] tracking-widest text-dust/40 uppercase">חיבור מאובטח</span>
          ) : (
            <span className="w-px shrink-0" aria-hidden />
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="w-full max-w-2xl border border-iron/30 bg-background/90 backdrop-blur-sm shadow-[0_4px_40px_-12px_oklch(0_0_0/0.6)]"
        >
          {/* Progress bar */}
          <div className="flex items-center justify-between border-b border-iron/20 px-6 py-4">
            <span className="font-mono text-[10px] tracking-widest text-dust uppercase">
              {loginOnly ? "התחברות" : isAuthStep ? "שמירת התוצאות" : "בדיקת התאמה"}
            </span>
            <div className="mx-4 h-1 flex-1 overflow-hidden bg-iron/20">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease }}
              />
            </div>
            <span className="font-mono text-[10px] tabular-nums text-dust">
              {displayStep}/{displayTotal}
            </span>
          </div>

          <div className="px-4 py-6 sm:px-10 sm:py-10">
            {/* Step header */}
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="mb-8 text-center"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center border border-primary/30 text-primary mb-3">
                {meta.icon}
              </div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{meta.title}</h1>
              <p className="mt-1 text-sm text-dust">{meta.subtitle}</p>
            </motion.div>

            <div className="space-y-5">
              {step === STEP.combat && (
                <div className="space-y-3">
                  <PreferenceOptionGrid
                    options={COMBAT_PREFERENCE_OPTIONS}
                    selected={combatPreference}
                    onSelect={(v) => {
                      setCombatPreference(v);
                      clearFieldErrors("combat");
                    }}
                    columnsClass="grid-cols-1 sm:grid-cols-2"
                  />
                  {fieldErrors.combat ? <FieldError message={fieldErrors.combat} /> : null}
                </div>
              )}

              {step === STEP.focus && (
                <div className="space-y-3">
                  <PreferenceOptionGrid
                    options={FOCUS_PREFERENCE_OPTIONS}
                    selected={focusPref}
                    onSelect={(v) => {
                      setFocusPref(v);
                      clearFieldErrors("focus");
                    }}
                    columnsClass="grid-cols-1 sm:grid-cols-2"
                  />
                  {fieldErrors.focus ? <FieldError message={fieldErrors.focus} /> : null}
                </div>
              )}

              {step === STEP.fitness && (
                <div className="space-y-3">
                  <PreferenceOptionGrid
                    options={FITNESS_PREFERENCE_OPTIONS}
                    selected={fitnessPref}
                    onSelect={(v) => {
                      setFitnessPref(v);
                      clearFieldErrors("fitness");
                    }}
                    columnsClass="grid-cols-1 sm:grid-cols-3"
                  />
                  {fieldErrors.fitness ? <FieldError message={fieldErrors.fitness} /> : null}
                </div>
              )}

              {step === STEP.motivation && (
                <PersonalQuestion
                  options={MOTIVATION_OPTIONS}
                  selected={motivation}
                  onSelect={(v) => {
                    setMotivation(v);
                    clearFieldErrors("motivation");
                  }}
                  error={fieldErrors.motivation}
                />
              )}

              {step === STEP.strengths && (
                <PersonalQuestion
                  options={STRENGTH_OPTIONS}
                  selected={strengths}
                  onSelect={(v) => {
                    setStrengths(v);
                    clearFieldErrors("strengths");
                  }}
                  error={fieldErrors.strengths}
                />
              )}

              {step === STEP.environment && (
                <PersonalQuestion
                  options={ENVIRONMENT_OPTIONS}
                  selected={environment}
                  onSelect={(v) => {
                    setEnvironment(v);
                    clearFieldErrors("environment");
                  }}
                  error={fieldErrors.environment}
                />
              )}

              {step === STEP.languages && (
                <div className="space-y-3">
                  <PreferenceOptionGrid
                    options={LANGUAGE_OPTIONS}
                    selectedMany={languages}
                    onSelect={(v) => {
                      clearFieldErrors("languages");
                      setLanguages((prev) => toggleLanguage(prev, v));
                    }}
                    columnsClass="grid-cols-2 sm:grid-cols-4"
                  />
                  <ReactionLine text={languagesReaction(languages)} />
                  {fieldErrors.languages ? <FieldError message={fieldErrors.languages} /> : null}
                </div>
              )}

              {step === STEP.scores && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="מין" error={fieldErrors.gender}>
                    <select
                      value={gender}
                      onChange={(e) => {
                        setGender(e.target.value as "male" | "female" | "");
                        clearFieldErrors("gender");
                      }}
                      className="input-field"
                    >
                      <option value="">בחרו</option>
                      <option value="male">זכר</option>
                      <option value="female">נקבה</option>
                    </select>
                  </FormField>
                  <FormField label='דפ"ר' error={fieldErrors.dapar}>
                    <select
                      value={dapar}
                      onChange={(e) => {
                        setDapar(e.target.value === "" ? "" : Number(e.target.value));
                        clearFieldErrors("dapar");
                      }}
                      className="input-field"
                    >
                      <option value="">בחרו</option>
                      {DAPAR_SCORES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="פרופיל רפואי" error={fieldErrors.medical}>
                    <select
                      value={medical}
                      onChange={(e) => {
                        setMedical(e.target.value === "" ? "" : Number(e.target.value));
                        clearFieldErrors("medical");
                      }}
                      className="input-field"
                    >
                      <option value="">בחרו</option>
                      {MEDICAL_SCORES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              )}

              {step === STEP.yom && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {YOM_HAMEAH_12_KEYS.map((key) => (
                    <YomSliderCard
                      key={key}
                      title={YOM_HAMEAH_12_LABELS_HE[key]}
                      value={yomScores[key]}
                      onChange={(value) => setYomScores((prev) => ({ ...prev, [key]: value }))}
                    />
                  ))}
                </div>
              )}

              {step === STEP.draft && (
                <div className="space-y-3 text-right">
                  <FormField label="תאריך גיוס משוער" error={fieldErrors.draftDate}>
                    <DraftDateField
                      value={draftDate}
                      onChange={(v) => {
                        setDraftDate(v);
                        clearFieldErrors("draftDate");
                      }}
                      invalid={Boolean(fieldErrors.draftDate)}
                    />
                  </FormField>
                  <p className="text-xs text-dust">אפשר לעדכן מאוחר יותר בפרופיל.</p>
                </div>
              )}

              {step === STEP.name && (
                <FormField label="שם משתמש" error={fieldErrors.username}>
                  <div className="relative">
                    <input
                      type="text"
                      autoComplete="nickname"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        clearFieldErrors("username");
                      }}
                      placeholder="איך לקרוא לכם?"
                      className={`input-field pl-10 pr-4${fieldErrors.username ? " input-field--invalid" : ""}`}
                      aria-invalid={fieldErrors.username ? true : undefined}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dust/40">
                      <User className="h-4 w-4" />
                    </span>
                  </div>
                </FormField>
              )}

              {step === STEP.email && (
                <FormField label="אימייל" error={fieldErrors.email}>
                  <div className="relative">
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldErrors("email");
                      }}
                      placeholder="name@gmail.com"
                      className={`input-field pl-10 pr-4${fieldErrors.email ? " input-field--invalid" : ""}`}
                      aria-invalid={fieldErrors.email ? true : undefined}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dust/40">
                      <Mail className="h-4 w-4" />
                    </span>
                  </div>
                </FormField>
              )}

              {step === STEP.code && (
                <div className="mx-auto max-w-md space-y-5">
                  <p className="text-center text-sm text-dust">
                    שלחנו קוד ל־<span className="font-medium text-foreground" dir="ltr">{email}</span>
                  </p>
                  {devOtpHint ? (
                    <p className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-2 text-center text-sm text-primary" dir="ltr">
                      קוד פיתוח (ללא SMTP): <span className="font-mono font-bold tracking-widest">{devOtpHint}</span>
                    </p>
                  ) : null}
                  <FormField label="קוד אימות (6 ספרות)" error={fieldErrors.code}>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => {
                        setCode(normalizeOtpInput(e.target.value));
                        clearFieldErrors("code");
                      }}
                      placeholder="000000"
                      disabled={loading}
                      dir="ltr"
                      className={`input-field text-center font-mono text-2xl font-bold tracking-[0.35em]${fieldErrors.code ? " input-field--invalid" : ""}`}
                      aria-invalid={fieldErrors.code ? true : undefined}
                    />
                  </FormField>
                  <p className="text-center text-xs text-dust">
                    התשובות שלכם שמורות. אפשר לצאת לאימייל ולחזור לכאן.
                  </p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setCode("");
                      void sendCode();
                    }}
                    className="block w-full text-center text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    לא קיבלתם? שלחו קוד חדש
                  </button>
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-iron/20 pt-6">
              {step <= STEP.name && (
                <PrimaryButton loading={loading} onClick={nextFromProfileStep}>
                  {step === STEP.name && authed.current ? "סיום ודשבורד" : "הבא"}
                </PrimaryButton>
              )}
              {step === STEP.email && <PrimaryButton loading={loading} onClick={sendCode}>שלחו לי קוד</PrimaryButton>}
              {step === STEP.code && <PrimaryButton loading={loading} onClick={verifyCode}>לתוצאות שלי</PrimaryButton>}

              {showSignInShortcut ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={enterLoginMode}
                  className="text-sm text-dust underline-offset-4 transition hover:text-foreground hover:underline disabled:opacity-50"
                >
                  כבר יש לי חשבון
                </button>
              ) : null}
              {loginOnly && step === STEP.email ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={enterSignupMode}
                  className="text-sm text-dust underline-offset-4 transition hover:text-foreground hover:underline disabled:opacity-50"
                >
                  הרשמה חדשה
                </button>
              ) : null}
            </div>
          </div>
        </motion.div>

        <p className="mt-6 text-center font-mono text-[9px] text-dust/50">
          {idfPhotoAt(step).creditShort}
        </p>
      </div>
    </div>
  );
}

function missingProfileStep(p: {
  combatPreference: CombatPreferenceValue | "";
  focusPref: FocusPreferenceValue | "";
  fitnessPref: FitnessPreferenceValue | "";
  gender: "male" | "female" | "";
  dapar: number | "";
  medical: number | "";
  draftDate: string;
  username: string;
}): number {
  if (!p.combatPreference) return STEP.combat;
  if (!p.focusPref) return STEP.focus;
  if (!p.fitnessPref) return STEP.fitness;
  if (p.gender === "" || p.dapar === "" || p.medical === "") return STEP.scores;
  if (!p.draftDate.trim() || Number.isNaN(Date.parse(p.draftDate))) return STEP.draft;
  if (!p.username.trim()) return STEP.name;
  return 0;
}

function getStepMeta(step: number, loginOnly = false) {
  const icon = <Shield className="h-5 w-5 text-primary" />;
  if (step === STEP.combat)
    return { icon, title: "איך אתם רואים את השירות?", subtitle: "בחרו כיוון שמתאים לכם. בלי הרשמה, מתחילים ישר." };
  if (step === STEP.focus) return { icon, title: "מה הכי חשוב לכם?", subtitle: "מיקוד אחד עוזר ליועץ AI." };
  if (step === STEP.fitness) return { icon, title: "רמת כושר", subtitle: "הערכה עצמית." };
  if (step === STEP.motivation)
    return { icon, title: "מה הכי חשוב לכם בשירות?", subtitle: "אין תשובה נכונה. זה עוזר לנו לדייק את ההתאמה בשבילכם." };
  if (step === STEP.strengths)
    return { icon, title: "במה אתם הכי חזקים?", subtitle: "לפי איך שאתם רואים את עצמכם, לא לפי ציונים." };
  if (step === STEP.environment) return { icon, title: "איפה אתם רואים את עצמכם?", subtitle: "בחרו את הסביבה שהכי מושכת אתכם." };
  if (step === STEP.languages)
    return { icon, title: "אילו שפות אתם מדברים?", subtitle: "אפשר לבחור כמה. שפות פותחות תפקידים שלא כולם מכירים." };
  if (step === STEP.scores) return { icon, title: "ציונים בסיסיים", subtitle: "דפ״ר ופרופיל רפואי קובעים לאילו תפקידים אתם עומדים בסף." };
  if (step === STEP.yom) return { icon, title: "ציוני מא״ה", subtitle: "12 מדדים. דירוג 1 עד 5 לכל אחד." };
  if (step === STEP.draft)
    return { icon: <Calendar className="h-5 w-5 text-primary" />, title: "מתי הגיוס?", subtitle: "בחרו תאריך משוער. אפשר לעדכן בהדרכה." };
  if (step === STEP.name)
    return { icon: <User className="h-5 w-5 text-primary" />, title: "שם משתמש", subtitle: "זה השם שיופיע בדשבורד וביועץ." };
  if (step === STEP.email)
    return {
      icon: <Mail className="h-5 w-5 text-primary" />,
      title: loginOnly ? `התחברות ל${SITE_NAME_HE}` : "הפרופיל מוכן",
      subtitle: loginOnly
        ? "הזינו את האימייל של החשבון ונשלח קוד כניסה. בלי סיסמה."
        : `הזינו אימייל כדי לשמור אותו ולראות את ההתאמות ב${SITE_NAME_HE}. אם כבר יש לכם חשבון, תיכנסו ישר לדשבורד.`,
    };
  return { icon, title: "הזינו את הקוד", subtitle: "שלחנו קוד לאימייל שלכם." };
}

function PrimaryButton({ children, loading, onClick }: { children: React.ReactNode; loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      aria-busy={loading}
      className="inline-flex min-w-[8rem] items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 active:scale-[0.97] disabled:opacity-70"
    >
      {loading ? (
        <span className="h-4 w-24 animate-pulse rounded-sm bg-primary-foreground/30" aria-hidden />
      ) : (
        <>
          {children}
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </>
      )}
    </button>
  );
}

function YomSliderCard({ title, value, onChange }: { title: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="border border-iron/20 bg-card p-4">
      <label className="block">
        <div className="flex justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="font-mono text-sm font-bold tabular-nums text-primary" aria-hidden>
            {value}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-3 w-full accent-primary"
          aria-valuetext={ARIA.rangeValue(title, value, 5)}
        />
      </label>
    </div>
  );
}

/** A saved answer if it is still one of the options, else empty. */
function pickOption<T extends string>(options: { value: T }[], value: unknown): T | "" {
  return options.find((o) => o.value === value)?.value ?? "";
}

function pickLanguages(value: unknown): LanguageValue[] {
  if (!Array.isArray(value)) return [];
  return LANGUAGE_OPTIONS.map((o) => o.value).filter((v) => value.includes(v));
}

/** "Hebrew only" and the other languages exclude each other. */
function toggleLanguage(prev: LanguageValue[], v: LanguageValue): LanguageValue[] {
  if (prev.includes(v)) return prev.filter((l) => l !== v);
  if (v === "HebrewOnly") return ["HebrewOnly"];
  return [...prev.filter((l) => l !== "HebrewOnly"), v];
}

/** The personal touch: what the match will do with the answer just picked. */
function ReactionLine({ text }: { text: string }) {
  if (!text) return null;
  return (
    <motion.p
      key={text}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease }}
      className="flex items-start gap-2 rounded-sm border border-primary/25 bg-primary/5 px-3 py-2.5 text-right text-sm text-foreground/90"
      dir="rtl"
      role="status"
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span>{text}</span>
    </motion.p>
  );
}

function PersonalQuestion<T extends string>({
  options,
  selected,
  onSelect,
  error,
}: {
  options: PersonalOption<T>[];
  selected: T | "";
  onSelect: (value: T) => void;
  error?: string;
}) {
  const reaction = options.find((o) => o.value === selected)?.reaction ?? "";
  return (
    <div className="space-y-3">
      <PreferenceOptionGrid
        options={options}
        selected={selected}
        onSelect={onSelect}
        columnsClass="grid-cols-1 sm:grid-cols-2"
      />
      <ReactionLine text={reaction} />
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}
