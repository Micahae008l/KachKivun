import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Dumbbell,
  Heart,
  Mail,
  MapPin,
  Monitor,
  Shield,
  Sparkles,
  Target,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/FormField";
import { OtpInput } from "@/components/OtpInput";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { KachKivunLogo } from "@/components/KachKivunLogo";
import {
  PostSignupBootstrapSkeleton,
  PostSignupFormSkeleton,
} from "@/components/skeletons/PageSkeletons";
import {
  ApiError,
  completeAssessment,
  getLatestAssessment,
  requestOtp,
  verifyOtp,
  type DashboardResponse,
  type PaymentOffer,
} from "@/lib/api";
import { authErrorField, getErrorMessage } from "@/lib/api-errors";
import { progressBarProps } from "@/lib/a11y";
import { trackEvent } from "@/lib/analytics";
import { getToken, setAuthSession } from "@/lib/auth";
import { consumeAuthReturnTarget } from "@/lib/auth-return";
import { SITE_NAME_HE } from "@/lib/brand";
import { idfPhotoAt } from "@/lib/idf-images";
import { formatPaymentPrice } from "@/lib/payment-offer";
import {
  coerceCombat,
  coerceFitness,
  coerceFocus,
  draftDateToYmd,
  yomFromDashboard,
} from "@/lib/profile-resume";
import { dashboardQueryOptions, prefetchAuthedData } from "@/lib/queries";
import { AssessmentQuestionStep } from "./components/AssessmentQuestionStep";
import { createDefaultAssessmentAnswers } from "./defaults";
import {
  clearAssessmentDraft,
  createAssessmentDraft,
  loadAssessmentDraft,
  normalizeAssessmentAnswers,
} from "./draft";
import { buildAssessmentFlow, firstIncompleteAssessmentStep, validateAssessmentStep } from "./flow";
import {
  ASSESSMENT_SCHEMA_VERSION,
  type AssessmentAnswers,
  type AssessmentStepId,
  type SavedAssessment,
} from "./types";
import { useAssessmentDraft } from "./useAssessmentDraft";

const ease = [0.16, 1, 0.3, 1] as const;

const STEP_EFFORT: Record<AssessmentStepId, number> = {
  direction: 1,
  roles: 2,
  preferences: 2,
  environment: 2,
  style: 2,
  combat: 4,
  technical: 2,
  scores: 3,
  yom: 12,
  checkpoint: 1,
  motivation: 2,
  identity: 2,
  review: 1,
  email: 1,
  otp: 1,
};

type StepMeta = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
};

const STEP_META: Record<AssessmentStepId, StepMeta> = {
  direction: {
    icon: Compass,
    title: "איזה שירות מתאים לכם?",
    subtitle: "מתחילים מכיוון כללי. אפשר לדייק אותו בהמשך.",
  },
  roles: {
    icon: Target,
    title: "מה מעניין, ומה פחות",
    subtitle: "הבחירות כאן קובעות אילו שאלות המשך באמת רלוונטיות לכם.",
  },
  preferences: {
    icon: Sparkles,
    title: "מה חשוב ביום־יום",
    subtitle: "מיקוד מקצועי ורמת פעילות שמתאימה לכם.",
  },
  environment: {
    icon: MapPin,
    title: "בסיס וסביבת עבודה",
    subtitle: "התנאים שבהם יהיה לכם קל יותר להצליח לאורך זמן.",
  },
  style: {
    icon: Brain,
    title: "איך אתם עובדים",
    subtitle: "מנהיגות, לחץ והדרך שבה אתם מעדיפים להשתלב.",
  },
  combat: {
    icon: Dumbbell,
    title: "מוכנות למסלול פיזי",
    subtitle: "כמה הערכות קצרות שנוספו לפי הכיוון שבחרתם.",
  },
  technical: {
    icon: Monitor,
    title: "ניסיון ועניין טכנולוגי",
    subtitle: "השאלות האלה נוספו לפי תחומי העניין והמיקוד שלכם.",
  },
  scores: {
    icon: Shield,
    title: "נתוני סף בסיסיים",
    subtitle: "דפ״ר ופרופיל רפואי עוזרים לסנן תפקידים שאינם רלוונטיים.",
  },
  yom: {
    icon: Brain,
    title: "מדדי מא״ה",
    subtitle: "ציונים רשמיים, הערכה עצמית או בחירה כנה שעדיין לא ידוע.",
  },
  checkpoint: {
    icon: CheckCircle2,
    title: "מה הנתונים שלכם פותחים",
    subtitle: "התשובות שלכם מול הספים הרשמיים של צה״ל, לפני שממשיכים.",
  },
  motivation: {
    icon: Heart,
    title: "מה אתם רוצים לקבל מהשירות?",
    subtitle: "הסיבות שמניעות אתכם חשובות לא פחות מהנתונים.",
  },
  identity: {
    icon: User,
    title: "כמעט סיימנו",
    subtitle: "שם לפנייה ותאריך גיוס משוער.",
  },
  review: {
    icon: CheckCircle2,
    title: "זה הפרופיל שנשמור",
    subtitle: "סיכום האותות שישמשו להתאמה. אפשר לחזור ולתקן לפני השמירה.",
  },
  email: {
    icon: Mail,
    title: "הפרופיל מוכן לשמירה",
    subtitle: "אימייל אחד, בלי סיסמה. נשלח קוד חד־פעמי.",
  },
  otp: {
    icon: Mail,
    title: "בדקו את המייל",
    subtitle: "שלחנו אליכם קוד בן 6 ספרות.",
  },
};

const REVIEW_SAVE_TITLE = "הפרופיל שלכם מוכן";
const REVIEW_SAVE_SUBTITLE = "בדקו שהכול נכון, והזינו אימייל כדי לשמור. אפשר לחזור ולתקן כל שלב.";

type AuthField = "email" | "code";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeOtp(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 6);
}

function remainingTimeLabel(effort: number) {
  const minutes = Math.max(1, Math.ceil(effort / 4));
  return minutes === 1 ? "כדקה" : `כ־${minutes} דקות`;
}

function answersFromDashboard(dashboard: DashboardResponse): AssessmentAnswers {
  const defaults = createDefaultAssessmentAnswers();
  const yomSource = dashboard.preferences?.yomHameahSource;
  return normalizeAssessmentAnswers({
    ...defaults,
    preferredName: dashboard.user.preferredName ?? "",
    gender: dashboard.stats?.gender ?? "",
    daparScore: dashboard.stats?.daparScore ?? null,
    medicalProfile: dashboard.stats?.medicalProfile ?? null,
    draftDate: draftDateToYmd(dashboard.stats?.draftDate),
    yomHameah: yomFromDashboard(dashboard.stats),
    yomHameahSource:
      yomSource === "official" || yomSource === "self" || yomSource === "unknown" ? yomSource : "",
    combatPreference: coerceCombat(dashboard.preferences?.combatPreference),
    focus: coerceFocus(dashboard.preferences?.focus),
    physicalActivityLevel: coerceFitness(dashboard.preferences?.physicalActivityLevel),
  });
}

function mergeSavedAssessment(
  base: AssessmentAnswers,
  assessment: SavedAssessment | null,
): AssessmentAnswers {
  return assessment ? normalizeAssessmentAnswers({ ...base, ...assessment.answers }) : base;
}

function safeResumeStep(
  requested: AssessmentStepId,
  answers: AssessmentAnswers,
  includeAuth: boolean,
): AssessmentStepId {
  const flow = buildAssessmentFlow(answers, { includeAuth });
  const requestedIndex = flow.indexOf(requested);
  const stopAt = requestedIndex >= 0 ? requestedIndex : flow.length;

  for (let index = 0; index < stopAt; index += 1) {
    const step = flow[index];
    if (step !== "checkpoint" && validateAssessmentStep(step, answers)) return step;
  }
  if (requestedIndex >= 0) return requested;

  const incomplete = firstIncompleteAssessmentStep(answers);
  if (incomplete) return incomplete;
  return "review";
}

type PostSignupAssessmentPageProps = {
  mode: "adaptive" | "legacy";
  offer: PaymentOffer | null;
};

export function PostSignupAssessmentPage({ mode, offer }: PostSignupAssessmentPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const legacyMode = mode === "legacy";
  const [mounted, setMounted] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loginIntent, setLoginIntent] = useState(false);
  const [answers, setAnswers] = useState<AssessmentAnswers>(() => createDefaultAssessmentAnswers());
  const [clientDraftId, setClientDraftId] = useState("");
  const [step, setStep] = useState<AssessmentStepId>("direction");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [stepError, setStepError] = useState("");
  const [authErrors, setAuthErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const autoAdvanceTimer = useRef<number | undefined>(undefined);
  const advanceRef = useRef<() => void>(() => {});
  const authedRef = useRef(false);
  const assessmentStartTracked = useRef(false);
  const lastSectionTracked = useRef<AssessmentStepId | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function bootstrap() {
      const localDraft = loadAssessmentDraft();
      const token = getToken();
      const wantsLogin = window.location.hash === "#login";
      const wantsEdit = window.location.hash === "#edit";

      if (!token) {
        const initialDraft = localDraft ?? createAssessmentDraft();
        if (cancelled) return;
        setAnswers(initialDraft.answers);
        setClientDraftId(initialDraft.clientDraftId);
        setEmail(initialDraft.email);
        setLoginIntent(wantsLogin);
        setStep(
          wantsLogin || legacyMode
            ? "email"
            : safeResumeStep(initialDraft.currentStep, initialDraft.answers, true),
        );
        setBootstrapped(true);
        return;
      }

      authedRef.current = true;
      setAuthenticated(true);
      try {
        const dashboard = await queryClient.fetchQuery(dashboardQueryOptions(token));
        const latestResponse = await getLatestAssessment().catch(() => ({ assessment: null }));
        if (cancelled) return;

        if (localDraft && latestResponse.assessment?.clientDraftId === localDraft.clientDraftId) {
          clearAssessmentDraft();
        }
        if (legacyMode) {
          navigate({
            to: dashboard.aiReady ? "/dashboard" : "/onboarding",
            replace: true,
          });
          return;
        }
        if (dashboard.aiReady && !wantsEdit) {
          navigate({ to: "/ai-counselor", replace: true });
          return;
        }

        const savedAnswers = mergeSavedAssessment(
          answersFromDashboard(dashboard),
          latestResponse.assessment,
        );
        if (wantsEdit && dashboard.aiReady) {
          const revisedDraft = createAssessmentDraft(savedAnswers);
          setEditMode(true);
          setAnswers(savedAnswers);
          setClientDraftId(revisedDraft.clientDraftId);
          setEmail(dashboard.user.email);
          setStep("direction");
          return;
        }

        let hydrated = savedAnswers;
        const localBelongsToUser =
          localDraft &&
          Boolean(localDraft.email) &&
          normalizeEmail(localDraft.email) === normalizeEmail(dashboard.user.email);
        if (localBelongsToUser) hydrated = localDraft.answers;
        const nextDraft = localBelongsToUser ? localDraft : createAssessmentDraft(hydrated);

        setAnswers(hydrated);
        setClientDraftId(nextDraft.clientDraftId);
        setEmail(dashboard.user.email);
        setStep(
          localBelongsToUser
            ? safeResumeStep(nextDraft.currentStep, hydrated, false)
            : (firstIncompleteAssessmentStep(hydrated) ?? "review"),
        );
      } catch {
        if (cancelled) return;
        if (legacyMode) {
          navigate({ to: "/onboarding", replace: true });
          return;
        }
        const fallback = localDraft ?? createAssessmentDraft();
        setAnswers(fallback.answers);
        setClientDraftId(fallback.clientDraftId);
        setEmail(fallback.email);
        setStep(safeResumeStep(fallback.currentStep, fallback.answers, false));
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [legacyMode, mounted, navigate, queryClient]);

  useEffect(() => () => window.clearTimeout(autoAdvanceTimer.current), []);
  useEffect(() => {
    advanceRef.current = nextQuestion;
  });

  // Long steps on phones: each new step starts at the top, not where the last one was scrolled.
  useEffect(() => {
    if (bootstrapped) window.scrollTo({ top: 0 });
  }, [step, bootstrapped]);

  useAssessmentDraft({
    enabled: bootstrapped && !loginIntent && !authenticated && !legacyMode,
    clientDraftId,
    currentStep: step,
    email,
    answers,
  });

  const steps = useMemo(
    () =>
      loginIntent || legacyMode
        ? (["email", "otp"] as AssessmentStepId[])
        : buildAssessmentFlow(answers, { includeAuth: !authenticated }),
    [answers, authenticated, legacyMode, loginIntent],
  );
  const currentIndex = Math.max(0, steps.indexOf(step));
  const currentStep = steps[currentIndex] ?? steps[0] ?? "direction";
  const totalEffort = steps.reduce((sum, item) => sum + STEP_EFFORT[item], 0);
  const completedEffort = steps
    .slice(0, currentIndex)
    .reduce((sum, item) => sum + STEP_EFFORT[item], 0);
  const remainingEffort = steps
    .slice(currentIndex)
    .reduce((sum, item) => sum + STEP_EFFORT[item], 0);
  const progress = Math.round((completedEffort / Math.max(totalEffort, 1)) * 100);
  const meta =
    loginIntent && currentStep === "email"
      ? {
          ...STEP_META.email,
          title: `התחברות ל${SITE_NAME_HE}`,
          subtitle: "הזינו את האימייל של החשבון ונשלח קוד כניסה. בלי סיסמה.",
        }
      : loginIntent && currentStep === "otp"
        ? { ...STEP_META.otp, title: "קוד כניסה" }
        : legacyMode && currentStep === "email"
          ? {
              ...STEP_META.email,
              title: `יצירת חשבון ב${SITE_NAME_HE}`,
              subtitle: "מתחילים באימייל ובקוד חד־פעמי, ואז משלימים את הפרופיל הקצר.",
            }
          : STEP_META[currentStep];
  const MetaIcon = meta.icon;

  useEffect(() => {
    if (!bootstrapped || legacyMode || loginIntent || assessmentStartTracked.current) return;
    assessmentStartTracked.current = true;
    trackEvent("assessment_start", {
      mode: editMode || currentIndex > 0 ? "resume" : "fresh",
    });
  }, [bootstrapped, currentIndex, editMode, legacyMode, loginIntent]);

  useEffect(() => {
    if (!bootstrapped || legacyMode || loginIntent || lastSectionTracked.current === currentStep) {
      return;
    }
    lastSectionTracked.current = currentStep;
    trackEvent("assessment_section", { section: currentStep });
  }, [bootstrapped, currentStep, legacyMode, loginIntent]);

  function clearAuthError(field?: AuthField) {
    if (!field) {
      setAuthErrors({});
      return;
    }
    setAuthErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function clearFlowHash() {
    if (window.location.hash === "#login" || window.location.hash === "#edit") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  function enterLoginMode() {
    setStepError("");
    clearAuthError();
    setLoginIntent(true);
    setOtpVerified(false);
    setCode("");
    setStep("email");
  }

  function enterSignupMode() {
    clearFlowHash();
    setLoginIntent(false);
    setOtpVerified(false);
    setCode("");
    clearAuthError();
    if (legacyMode) {
      setStep("email");
      return;
    }
    const draft = loadAssessmentDraft();
    if (draft) {
      setAnswers(draft.answers);
      setClientDraftId(draft.clientDraftId);
      setEmail(draft.email);
      setStep(safeResumeStep(draft.currentStep, draft.answers, !authenticated));
      return;
    }
    setStep(safeResumeStep("direction", answers, !authenticated));
  }

  function deleteLocalDraft() {
    clearAssessmentDraft();
    const fresh = createAssessmentDraft();
    setAnswers(fresh.answers);
    setClientDraftId(fresh.clientDraftId);
    setEmail("");
    setCode("");
    setDevOtpHint(null);
    setOtpVerified(false);
    setLoginIntent(false);
    clearAuthError();
    setStepError("");
    clearFlowHash();
    setStep("direction");
    toast.success("הטיוטה המקומית נמחקה");
  }

  async function sendCode() {
    clearAuthError("email");
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes("@")) {
      setAuthErrors((current) => ({
        ...current,
        email: "נא להזין כתובת אימייל תקינה, למשל name@gmail.com",
      }));
      return;
    }

    setLoading(true);
    trackEvent("otp_request", { intent: loginIntent ? "login" : "signup" });
    try {
      const response = await requestOtp(normalized, {
        intent: loginIntent ? "login" : "signup",
      });
      setEmail(normalized);
      setCode(response.devCode ?? "");
      setDevOtpHint(response.devCode ?? null);
      setOtpVerified(false);
      setStep("otp");
      if (response.devCode) {
        toast.success("קוד פיתוח מוצג למטה", { duration: 12_000 });
      } else if (response.delivery === "console") {
        toast.success("קוד הפיתוח הודפס בלוג השרת", { duration: 12_000 });
      } else {
        toast.success("שלחנו קוד באימייל. בדקו גם בספאם");
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "OTP_RESEND_COOLDOWN") {
        setEmail(normalized);
        setCode("");
        setDevOtpHint(null);
        setStep("otp");
        toast.success("קוד פעיל כבר נשלח. הזינו אותו כאן");
        return;
      }
      const field = authErrorField(error) ?? "email";
      setAuthErrors((current) => ({
        ...current,
        [field]: getErrorMessage(error, "שגיאה בשליחת הקוד"),
      }));
    } finally {
      setLoading(false);
    }
  }

  async function persistAssessment(): Promise<boolean> {
    const incomplete = firstIncompleteAssessmentStep(answers);
    if (incomplete) {
      setLoginIntent(false);
      setStep(incomplete);
      setStepError(validateAssessmentStep(incomplete, answers) ?? "חסר פרט לפני השמירה");
      toast.error("חסר עוד פרט אחד לפני השמירה");
      return false;
    }
    if (!clientDraftId) {
      toast.error("לא ניתן לזהות את טיוטת ההערכה. רעננו ונסו שוב");
      return false;
    }

    try {
      await completeAssessment({
        schemaVersion: ASSESSMENT_SCHEMA_VERSION,
        clientDraftId,
        answers: {
          ...answers,
          preferredName: answers.preferredName.trim(),
          extraNote: answers.extraNote.trim(),
        },
      });
      trackEvent("assessment_complete");
      clearAssessmentDraft();
      clearFlowHash();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["assessment", "latest"] }),
      ]);
      toast.success("ההערכה נשמרה. היועץ האישי מוכן");
      navigate({ to: "/ai-counselor", replace: true });
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "לא הצלחנו לשמור. הטיוטה נשארה במכשיר"));
      return false;
    }
  }

  async function finishSignedInAssessment() {
    setLoading(true);
    try {
      await persistAssessment();
    } finally {
      setLoading(false);
    }
  }

  async function resumeAfterLogin(token: string) {
    const returnTarget = consumeAuthReturnTarget();
    if (returnTarget) {
      toast.success("התחברתם בהצלחה");
      navigate({ to: returnTarget, replace: true });
      return;
    }

    try {
      const dashboard = await queryClient.fetchQuery(dashboardQueryOptions(token));
      if (legacyMode) {
        toast.success("התחברתם בהצלחה");
        navigate({
          to: dashboard.aiReady ? "/dashboard" : "/onboarding",
          replace: true,
        });
        return;
      }
      if (dashboard.aiReady) {
        toast.success("התחברתם בהצלחה");
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      const latest = await getLatestAssessment().catch(() => ({ assessment: null }));
      let hydrated = mergeSavedAssessment(answersFromDashboard(dashboard), latest.assessment);
      const local = loadAssessmentDraft();
      const localBelongsToUser = Boolean(
        local &&
        local.email &&
        normalizeEmail(local.email) === normalizeEmail(dashboard.user.email),
      );
      if (local && localBelongsToUser) {
        hydrated = local.answers;
        setClientDraftId(local.clientDraftId);
      } else {
        setClientDraftId(createAssessmentDraft(hydrated).clientDraftId);
      }
      setAnswers(hydrated);
      setEmail(dashboard.user.email);
      setAuthenticated(true);
      setLoginIntent(false);
      clearFlowHash();
      setStep(
        local && localBelongsToUser
          ? safeResumeStep(local.currentStep, hydrated, false)
          : (firstIncompleteAssessmentStep(hydrated) ?? "review"),
      );
      toast.success("ממשיכים מהמקום שבו עצרתם");
    } catch {
      setAuthenticated(true);
      setLoginIntent(false);
      clearFlowHash();
      if (legacyMode) {
        navigate({ to: "/onboarding", replace: true });
      } else {
        setStep(firstIncompleteAssessmentStep(answers) ?? "review");
        toast.success("התחברתם. אפשר להמשיך את ההערכה");
      }
    }
  }

  async function verifyCode(codeInput = code) {
    clearAuthError("code");
    if (otpVerified && !loginIntent) {
      setLoading(true);
      try {
        await persistAssessment();
      } finally {
        setLoading(false);
      }
      return;
    }

    const cleanCode = normalizeOtp(codeInput);
    if (cleanCode.length !== 6) {
      setAuthErrors((current) => ({
        ...current,
        code: "נא להזין קוד בן 6 ספרות",
      }));
      return;
    }

    setLoading(true);
    try {
      const response = await verifyOtp(normalizeEmail(email), cleanCode, {
        intent: loginIntent ? "login" : "signup",
      });
      trackEvent("otp_verify", { intent: loginIntent ? "login" : "signup" });
      setAuthSession(response.token, response.role);
      authedRef.current = true;
      prefetchAuthedData(queryClient, response.token);

      if (loginIntent) {
        await resumeAfterLogin(response.token);
      } else if (legacyMode) {
        const returnTarget = consumeAuthReturnTarget();
        toast.success("החשבון נוצר בהצלחה");
        navigate({ to: returnTarget ?? "/onboarding", replace: true });
      } else {
        setOtpVerified(true);
        await persistAssessment();
      }
    } catch (error) {
      setAuthErrors((current) => ({
        ...current,
        [authErrorField(error) ?? "code"]: getErrorMessage(error, "קוד לא תקין"),
      }));
    } finally {
      setLoading(false);
    }
  }

  function nextQuestion() {
    window.clearTimeout(autoAdvanceTimer.current);
    setNavDirection(1);
    setStepError("");
    const validationError = validateAssessmentStep(currentStep, answers);
    if (validationError) {
      setStepError(validationError);
      return;
    }

    const index = steps.indexOf(currentStep);
    const next = steps[index + 1];
    if (next) {
      setStep(next);
      return;
    }
    if (authenticated) void finishSignedInAssessment();
  }

  function goBack() {
    window.clearTimeout(autoAdvanceTimer.current);
    setNavDirection(-1);
    setStepError("");
    clearAuthError();
    if (loginIntent && currentStep === "email") {
      enterSignupMode();
      return;
    }
    const index = steps.indexOf(currentStep);
    if (index <= 0) {
      navigate({ to: "/" });
      return;
    }
    setStep(steps[index - 1]);
  }

  // Single-question screens move on by themselves a beat after the tap.
  function scheduleAutoAdvance() {
    window.clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = window.setTimeout(() => advanceRef.current(), 320);
  }

  if (!mounted) {
    return (
      <div dir="rtl" className="flex min-h-dvh items-center justify-center bg-background px-6">
        <PostSignupFormSkeleton />
      </div>
    );
  }

  if (!bootstrapped) return <PostSignupBootstrapSkeleton />;

  const isAuthStep = currentStep === "email" || currentStep === "otp";
  // Signed-out users save straight from the review screen: recap above, email below.
  const reviewSaves = currentStep === "review" && !authenticated && !loginIntent && !legacyMode;
  const showLoginShortcut = !authenticated && !loginIntent && !isAuthStep && !authedRef.current;
  const photo = idfPhotoAt(currentIndex + 1);
  const offerPrice = offer ? formatPaymentPrice(offer.product) : "";

  return (
    <div dir="rtl" className="relative flex min-h-dvh">
      <div className="fixed inset-0 opacity-30 transition-opacity duration-500">
        <IdfPhotoPanel
          photo={photo}
          aspectClassName="absolute inset-0 min-h-0"
          className="absolute inset-0"
          overlayClassName="from-background/80 via-background/90 to-background"
          imgClassName="object-[center_35%]"
        />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto mb-6 flex w-full max-w-3xl items-center justify-between gap-4">
          <KachKivunLogo size="md" linked />
          {currentIndex === 0 && !loginIntent ? (
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-dust transition hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
              חזרה לאתר
            </Link>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-dust transition hover:text-foreground disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
              חזרה
            </button>
          )}
        </div>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35, ease }}
          className="w-full max-w-3xl border border-iron/30 bg-background/90 shadow-[0_4px_40px_-12px_oklch(0_0_0/0.6)] backdrop-blur-sm"
          aria-labelledby="assessment-step-title"
        >
          <div className="border-b border-iron/20 px-4 py-4 sm:px-6">
            <div className="mb-2 flex items-center justify-between gap-4 text-[11px] text-dust">
              <span className="font-mono tracking-widest uppercase">
                {loginIntent
                  ? "התחברות"
                  : legacyMode
                    ? "פתיחת חשבון"
                    : isAuthStep
                      ? "שמירת ההערכה"
                      : editMode
                        ? "עדכון ההערכה"
                        : "היכרות אישית"}
              </span>
              <span className="font-mono tabular-nums">
                {currentIndex + 1}/{steps.length}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-iron/20"
              {...progressBarProps(
                progress,
                `התקדמות בהערכה: שלב ${currentIndex + 1} מתוך ${steps.length}`,
              )}
            >
              <div
                className="h-full origin-right bg-primary transition-transform duration-300 ease-out"
                style={{ transform: `scaleX(${progress / 100})` }}
                aria-hidden
              />
            </div>
            {!loginIntent && !isAuthStep ? (
              <p className="mt-2 text-[11px] leading-4 text-dust">
                מספר השלבים והזמן מתעדכנים לפי התשובות · נותרו {remainingTimeLabel(remainingEffort)}
              </p>
            ) : null}
          </div>

          <div className="px-4 py-6 sm:px-8 sm:py-8">
            <motion.div
              key={currentStep}
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      // RTL: the next screen enters from the left, the previous one from the right.
                      transform: `translateX(${navDirection > 0 ? -16 : 16}px)`,
                    }
              }
              animate={{ opacity: 1, transform: "translateX(0px)" }}
              transition={{ duration: reduceMotion ? 0 : 0.26, ease }}
            >
              <header className="mb-7 text-center">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/5 text-primary">
                  <MetaIcon className="h-5 w-5" aria-hidden />
                </div>
                <h1
                  id="assessment-step-title"
                  className="text-xl font-black text-foreground sm:text-2xl"
                >
                  {reviewSaves ? REVIEW_SAVE_TITLE : meta.title}
                </h1>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-dust">
                  {reviewSaves ? REVIEW_SAVE_SUBTITLE : meta.subtitle}
                </p>
              </header>

              {!isAuthStep ? (
                <AssessmentQuestionStep
                  step={currentStep}
                  answers={answers}
                  setAnswers={setAnswers}
                  error={stepError}
                  clearError={() => setStepError("")}
                  onAutoAdvance={scheduleAutoAdvance}
                />
              ) : null}

              {currentStep === "email" ? (
                <FormField label="אימייל" error={authErrors.email}>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearAuthError("email");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void sendCode();
                    }}
                    placeholder="name@gmail.com"
                    className="input-field"
                  />
                </FormField>
              ) : null}

              {currentStep === "otp" ? (
                <div className="mx-auto max-w-sm space-y-6 text-center">
                  <p className="text-sm text-dust">
                    <span className="font-medium text-foreground" dir="ltr">
                      {email}
                    </span>
                    <span aria-hidden> · </span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={goBack}
                      className="font-semibold text-primary hover:underline disabled:opacity-50"
                    >
                      שינוי
                    </button>
                  </p>
                  {devOtpHint ? (
                    <p className="text-xs text-primary" dir="ltr">
                      קוד פיתוח: <strong className="font-mono tracking-widest">{devOtpHint}</strong>
                    </p>
                  ) : null}
                  <OtpInput
                    value={code}
                    onChange={(next) => {
                      setCode(next);
                      clearAuthError("code");
                      // The 6th digit submits; no extra tap needed.
                      if (next.length === 6 && !loading && !otpVerified) void verifyCode(next);
                    }}
                    disabled={loading || otpVerified}
                    invalid={Boolean(authErrors.code)}
                  />
                  {authErrors.code ? (
                    <p role="alert" className="text-sm text-destructive">
                      {authErrors.code}
                    </p>
                  ) : loading ? (
                    <p className="text-sm text-dust" aria-live="polite">
                      מאמתים…
                    </p>
                  ) : null}
                  {!otpVerified ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setCode("");
                        void sendCode();
                      }}
                      className="text-sm text-dust underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
                    >
                      לא הגיע? שלחו שוב
                    </button>
                  ) : null}
                </div>
              ) : null}
            </motion.div>

            {reviewSaves ? (
              // Pinned to the bottom so the save action never hides under the long recap.
              <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-primary/40 bg-background/95 pb-4 pl-4 pr-20 pt-3 shadow-[0_-16px_32px_-16px_oklch(0_0_0/0.9)] backdrop-blur-md sm:-mx-8 sm:px-8">
                <p className="mb-2 text-sm font-black text-foreground">
                  שמרו את הפרופיל וקבלו את ההתאמות
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <FormField label="אימייל" error={authErrors.email}>
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          clearAuthError("email");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void sendCode();
                        }}
                        placeholder="name@gmail.com"
                        className="input-field"
                      />
                    </FormField>
                  </div>
                  <div className="sm:pt-6">
                    <PrimaryButton loading={loading} onClick={sendCode}>
                      שלחו לי קוד ושמרו
                    </PrimaryButton>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-dust">
                  בלי סיסמה. נשלח קוד חד־פעמי לאימייל.
                </p>
              </div>
            ) : null}

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-iron/20 pt-6">
              {reviewSaves ? null : !isAuthStep ? (
                <PrimaryButton loading={loading} onClick={nextQuestion}>
                  {currentStep === "review" && authenticated ? "שמירה וסיום" : "הבא"}
                </PrimaryButton>
              ) : null}
              {currentStep === "email" ? (
                <PrimaryButton loading={loading} onClick={sendCode}>
                  שלחו לי קוד
                </PrimaryButton>
              ) : null}
              {currentStep === "otp" ? (
                <PrimaryButton loading={loading} onClick={verifyCode}>
                  {otpVerified && !loginIntent
                    ? "נסו לשמור שוב"
                    : loginIntent
                      ? "התחברות"
                      : "אימות וסיום"}
                </PrimaryButton>
              ) : null}

              {showLoginShortcut ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={enterLoginMode}
                  className="text-sm text-dust underline-offset-4 transition hover:text-foreground hover:underline disabled:opacity-50"
                >
                  כבר יש לי חשבון
                </button>
              ) : null}
              {legacyMode && !loginIntent && currentStep === "email" ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={enterLoginMode}
                  className="text-sm text-dust underline-offset-4 transition hover:text-foreground hover:underline disabled:opacity-50"
                >
                  כבר יש לי חשבון
                </button>
              ) : null}
              {loginIntent && currentStep === "email" ? (
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
            {!loginIntent && currentStep === "direction" ? (
              <p className="mt-5 text-xs leading-5 text-dust/80">
                {offer?.enabled
                  ? `ההערכה ושלוש ההתאמות במקומות 5 עד 3 בחינם. חשיפת מקומות 2 ו־1 עולה ${offerPrice} בתשלום חד־פעמי, ללא מנוי, כולל מע״מ ככל שחל.`
                  : "בתקופת הבטא ההערכה וכל חמש ההתאמות פתוחות בחינם."}{" "}
                ההמלצות אינן רשמיות ואינן מבטיחות זכאות, מיון או שיבוץ בצה״ל.
              </p>
            ) : null}
          </div>
        </motion.section>

        {!authenticated && !legacyMode ? (
          <button
            type="button"
            disabled={loading}
            onClick={deleteLocalDraft}
            className="mt-4 text-xs font-semibold text-dust underline-offset-4 transition hover:text-destructive hover:underline disabled:opacity-50"
          >
            מחיקת טיוטה מהמכשיר
          </button>
        ) : null}
        <p className="mt-5 text-center font-mono text-[11px] text-dust/50">{photo.creditShort}</p>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  loading,
  onClick,
}: {
  children: React.ReactNode;
  loading: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void onClick()}
      aria-busy={loading}
      className="inline-flex min-w-32 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 active:scale-[0.98] disabled:opacity-65"
    >
      {loading ? (
        <span className="h-4 w-20 animate-pulse rounded-sm bg-primary-foreground/30" aria-hidden />
      ) : (
        <>
          {children}
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </>
      )}
    </button>
  );
}
