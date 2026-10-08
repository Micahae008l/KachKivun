import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { RoleMatchCards } from "@/components/RoleMatchCards";
import { MatchHistoryPanel } from "@/components/MatchHistoryPanel";
import { RoleMatchCardsSkeleton } from "@/components/skeletons/PageSkeletons";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { getIdfPhoto } from "@/lib/idf-images";
import { getPaymentOffer, matchRolesRequest, type RoleMatch } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";
import { dashboardQueryOptions } from "@/lib/queries";
import { getToken } from "@/lib/auth";
import { AI_PROFILE_MISSING_LABELS } from "@/lib/profile-preference-data";
import { migrateLegacyYomHameahTo12, YOM_HAMEAH_12_KEYS } from "@/lib/yom-hameah-12";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/ai-counselor")({
  component: AiCounselorPage,
  head: () => ({
    meta: [
      { title: "יועץ AI | קח כיוון" },
      {
        name: "description",
        content: "חמש התאמות תפקיד אישיות על בסיס הפרופיל וההערכה שלכם.",
      },
    ],
  }),
});

type GenerationState = "idle" | "loading" | "success" | "error";

function AiCounselorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const autoStarted = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [roles, setRoles] = useState<RoleMatch[] | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const token = mounted ? getToken() : null;
  const dashboardQuery = useQuery({
    ...dashboardQueryOptions(token),
    enabled: mounted && Boolean(token),
  });
  const offerQuery = useQuery({
    queryKey: ["payment-offer"],
    queryFn: getPaymentOffer,
    enabled: mounted,
    staleTime: 60_000,
    retry: 1,
  });
  const dashboard = dashboardQuery.data;
  const aiReady = Boolean(dashboard?.aiReady);
  const missingLabels =
    dashboard?.aiProfileMissing
      ?.map((key) => AI_PROFILE_MISSING_LABELS[key] ?? key)
      .filter(Boolean) ?? [];

  useEffect(() => {
    if (mounted && !token) {
      navigate({ to: "/post-signup", hash: "login", replace: true });
    }
  }, [mounted, navigate, token]);

  useEffect(() => {
    if (mounted && token) trackEvent("counselor_viewed");
  }, [mounted, token]);

  const generateRecommendation = useCallback(
    async (manual = false) => {
      if (!getToken() || !aiReady) return;
      setGenerationState("loading");
      setError("");
      setNotice("");
      if (manual) {
        setRoles(null);
        setHistoryId(null);
      }

      try {
        const response = await matchRolesRequest();
        setRoles(response.roles);
        setNotice(response.notice || "");
        setHistoryId(response.recommendationId || null);
        setGenerationState("success");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
          queryClient.invalidateQueries({ queryKey: ["match-history"] }),
          queryClient.invalidateQueries({ queryKey: ["recommendation"] }),
        ]);
      } catch (requestError) {
        setError(getErrorMessage(requestError, "לא הצלחנו ליצור את ההתאמות"));
        setGenerationState("error");
      }
    },
    [aiReady, queryClient],
  );

  useEffect(() => {
    if (!mounted || !token || !dashboard || !aiReady || autoStarted.current) {
      return;
    }
    autoStarted.current = true;
    void generateRecommendation();
  }, [aiReady, dashboard, generateRecommendation, mounted, token]);

  const yomAverage = (() => {
    const yom = dashboard?.stats?.yomHameah
      ? migrateLegacyYomHameahTo12(dashboard.stats.yomHameah)
      : null;
    if (!yom) return "—";
    const average =
      YOM_HAMEAH_12_KEYS.reduce((total, key) => total + yom[key], 0) / YOM_HAMEAH_12_KEYS.length;
    return `${average.toFixed(1)}/5`;
  })();

  if (!mounted || (!token && mounted) || (dashboardQuery.isPending && !dashboard)) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6" role="status">
        <RoleMatchCardsSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 topo-lines" dir="rtl">
      <div className="space-y-8">
        <div className="overflow-hidden rounded-sm border border-iron/30">
          <IdfPhotoPanel
            photo={getIdfPhoto("s3")}
            aspectClassName="aspect-[21/7]"
            overlayClassName="from-background/55 via-background/75 to-background"
          />
        </div>

        <header className="border-b border-iron/30 pb-6 text-right">
          <p className="mb-2 font-mono text-xs tracking-widest text-primary uppercase">
            היועץ האישי
          </p>
          <h1 className="text-2xl font-black text-foreground sm:text-3xl">
            חמש התאמות התפקיד שלכם
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-dust">
            ההתאמה מתחילה אוטומטית כשהפרופיל וההערכה הושלמו. הדירוג מוצג ממקום 5 ועד מקום 1, בלי
            המתנות מלאכותיות.
          </p>
        </header>

        {dashboardQuery.isError ? (
          <StateMessage
            icon="error"
            title="לא ניתן לטעון את הפרופיל"
            body={getErrorMessage(dashboardQuery.error, "רעננו את העמוד ונסו שוב.")}
          />
        ) : null}

        {dashboard && !aiReady ? (
          <section
            className="border border-iron/30 bg-card p-5 text-right"
            aria-labelledby="profile-required-heading"
          >
            <h2 id="profile-required-heading" className="font-bold text-foreground">
              השלימו את ההערכה לפני יצירת התאמות
            </h2>
            {missingLabels.length ? (
              <ul className="mt-3 list-disc space-y-1 pr-5 text-sm text-dust">
                {missingLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-dust">חסרים נתונים בפרופיל.</p>
            )}
            <Link
              to="/post-signup"
              className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              המשך להערכה
            </Link>
          </section>
        ) : null}

        {dashboard && aiReady ? (
          <section
            className="flex flex-wrap gap-x-6 gap-y-2 border border-iron/25 bg-card/60 px-4 py-3 font-mono text-xs text-dust"
            aria-label="הנתונים ששימשו להתאמה"
          >
            <span>
              דפ״ר{" "}
              <strong className="text-foreground" dir="ltr">
                {dashboard.stats?.daparScore ?? "—"}
              </strong>
            </span>
            <span>
              פרופיל רפואי{" "}
              <strong className="text-foreground" dir="ltr">
                {dashboard.stats?.medicalProfile ?? "—"}
              </strong>
            </span>
            <span>
              מא״ה <strong className="text-foreground">{yomAverage}</strong>
            </span>
          </section>
        ) : null}

        {generationState === "loading" ? (
          <section aria-labelledby="recommendation-loading-heading" aria-live="polite">
            <div className="mb-4 flex items-center gap-3 border border-primary/30 bg-primary/10 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
              <div>
                <h2
                  id="recommendation-loading-heading"
                  className="text-sm font-bold text-foreground"
                >
                  מנתחים את ההערכה
                </h2>
                <p className="text-xs text-dust">התוצאה תוצג מיד כשהשרת יסיים.</p>
              </div>
            </div>
            <RoleMatchCardsSkeleton />
          </section>
        ) : null}

        {generationState === "error" ? (
          <section
            className="border border-destructive/35 bg-destructive/10 p-5 text-right"
            aria-labelledby="recommendation-error-heading"
          >
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
            <h2 id="recommendation-error-heading" className="mt-3 font-bold text-foreground">
              יצירת ההתאמות נכשלה
            </h2>
            <p role="alert" className="mt-2 text-sm leading-6 text-dust">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void generateRecommendation(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              ניסיון ידני נוסף
            </button>
          </section>
        ) : null}

        {roles?.length ? (
          <>
            {notice ? (
              <p className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                {notice}
              </p>
            ) : null}
            <RoleMatchCards roles={roles} offer={offerQuery.data} />
          </>
        ) : null}

        {token ? (
          <MatchHistoryPanel
            activeId={historyId}
            onSelect={(historyRoles, meta) => {
              setRoles(historyRoles);
              setHistoryId(meta.id);
              setNotice("");
              setError("");
              setGenerationState("success");
            }}
          />
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-iron/25 pt-5">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md border border-iron/40 px-4 py-2 text-sm text-dust hover:border-primary/40 hover:text-foreground"
          >
            חזרה לדשבורד
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" aria-hidden />
          </Link>
          <Link
            to="/post-signup"
            hash="edit"
            className="inline-flex items-center gap-1.5 px-2 py-2 text-sm font-semibold text-primary hover:underline"
          >
            עדכון ההערכה
          </Link>
        </div>
      </div>
    </div>
  );
}

function StateMessage({
  icon,
  title,
  body,
}: {
  icon: "error" | "success";
  title: string;
  body: string;
}) {
  const Icon = icon === "error" ? AlertTriangle : CheckCircle2;
  return (
    <section className="border border-iron/30 bg-card p-5 text-right">
      <Icon className="h-5 w-5 text-primary" aria-hidden />
      <h2 className="mt-3 font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-dust">{body}</p>
    </section>
  );
}
