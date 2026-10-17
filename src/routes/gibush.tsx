import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Lock, Mountain, Plane } from "lucide-react";
import { ApiError, getGibushContent, getLatestAssessment, getPaymentOffer } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatPaymentPrice } from "@/lib/payment-offer";
import { normalizeAssessmentAnswers } from "@/features/assessment/draft";
import {
  BENCHMARK_NOTE,
  RATING_LABELS,
  SHARE_LEVELS,
  TRACK_CARD_LABEL,
  type Gender,
  type GibushContent,
  type Track,
} from "@/features/gibush/types";
import type { Answers } from "@/features/gibush/scoring";
import { Simulation, Moment } from "@/features/gibush/Simulation";
import { FighterCard, Result, SHARE_URL } from "@/features/gibush/Result";

const TITLE = "מוכנות לגיבוש: סימולציה של יום הגיבוש | קח כיוון";
const DESCRIPTION =
  "עוברים את יום הגיבוש רגע אחרי רגע, ומקבלים כרטיס לוחם, מפת מסלול ותוכנית אימון לשבועות שנשארו.";
const STORAGE_KEY = "kk_gibush";

type Search = { s?: number; u?: number };

export const Route = createFileRoute("/gibush")({
  component: GibushPage,
  validateSearch: (search: Record<string, unknown>): Search => {
    const s = Number(search.s);
    const u = Number(search.u);
    const ok = Number.isInteger(s) && s >= 40 && s <= 99 && Number.isInteger(u) && SHARE_LEVELS[u];
    return ok ? { s, u } : {};
  },
  head: ({ match }) => {
    const { s } = match.search;
    const ogTitle = s ? `מישהו קיבל ${s} בכרטיס הלוחם. כמה אתם מקבלים? | קח כיוון` : TITLE;
    return {
      meta: [
        { name: "robots", content: "noindex, nofollow" },
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:url", content: SHARE_URL },
        { name: "twitter:title", content: ogTitle },
        { name: "twitter:description", content: DESCRIPTION },
      ],
    };
  },
});

type Saved = { track: Track; gender: Gender; answers: Answers };

function readSaved(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return v && (v.track === "combat" || v.track === "pilot") && v.answers ? v : null;
  } catch {
    return null;
  }
}

function GibushPage() {
  const { s, u } = Route.useSearch();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const token = mounted ? getToken() : null;

  // The content is the paywall: the API sends it only to unlocked users (403 otherwise).
  const contentQuery = useQuery({
    queryKey: ["gibush-content"],
    queryFn: getGibushContent,
    enabled: Boolean(token) && s == null,
    staleTime: Infinity,
    retry: (count, err) => !(err instanceof ApiError && err.status === 403) && count < 1,
  });
  const assessmentQuery = useQuery({
    queryKey: ["assessment", "latest"],
    queryFn: getLatestAssessment,
    enabled: Boolean(token) && s == null,
    staleTime: 60_000,
  });
  const offerQuery = useQuery({
    queryKey: ["payment-offer"],
    queryFn: getPaymentOffer,
    enabled: mounted && s == null,
    staleTime: 60_000,
  });

  const shell = (children: React.ReactNode) => (
    <div className="topo-lines min-h-[70vh]" dir="rtl">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</div>
    </div>
  );

  if (s != null && u != null) return shell(<SharedTeaser score={s} levelIndex={u} />);
  if (!mounted || (token && (contentQuery.isPending || assessmentQuery.isPending))) {
    return shell(
      <div
        className="h-96 animate-pulse border border-iron/20 bg-card/50"
        role="status"
        aria-label="טוען"
      />,
    );
  }

  const locked = contentQuery.error instanceof ApiError && contentQuery.error.status === 403;
  if (!token || locked) {
    const price = offerQuery.data?.enabled ? formatPaymentPrice(offerQuery.data.product) : null;
    return shell(<LockedTeaser authed={Boolean(token)} price={price} />);
  }

  if (!contentQuery.data) {
    return shell(
      <div className="space-y-4 border border-iron/30 bg-card p-6" role="alert">
        <p className="text-sm text-foreground">לא הצלחנו לטעון את הסימולציה.</p>
        <button
          type="button"
          onClick={() => void contentQuery.refetch()}
          className="min-h-11 border border-iron/40 px-4 text-sm font-bold text-foreground transition hover:border-primary/50"
        >
          לנסות שוב
        </button>
      </div>,
    );
  }

  const raw = assessmentQuery.data?.assessment?.answers;
  const profile = raw ? normalizeAssessmentAnswers(raw) : null;
  return shell(
    <GibushApp
      content={contentQuery.data}
      name={profile?.preferredName.trim() || undefined}
      draftDate={profile?.draftDate || undefined}
      gender={profile?.gender || null}
      suggestedTrack={
        profile &&
        !profile.rolesInterested.includes("combat") &&
        profile.rolesInterested.some((r) => r === "air_force" || r === "navy")
          ? "pilot"
          : "combat"
      }
    />,
  );
}

function GibushApp({
  content,
  name,
  draftDate,
  gender: profileGender,
  suggestedTrack,
}: {
  content: GibushContent;
  name?: string;
  draftDate?: string;
  gender: Gender | null;
  suggestedTrack: Track;
}) {
  const saved = useMemo(readSaved, []);
  const [phase, setPhase] = useState<"intro" | "sim" | "result">(saved ? "result" : "intro");
  const [track, setTrack] = useState<Track>(saved?.track ?? suggestedTrack);
  const [gender, setGender] = useState<Gender>(saved?.gender ?? profileGender ?? "male");
  const [answers, setAnswers] = useState<Answers>(saved?.answers ?? {});

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);

  if (phase === "sim") {
    return (
      <Simulation
        content={content}
        gender={gender}
        key={track}
        track={track}
        onExit={() => setPhase("intro")}
        onDone={(a) => {
          setAnswers(a);
          setPhase("result");
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ track, gender, answers: a }));
          } catch {
            // storage blocked: the result just will not be there next visit
          }
        }}
      />
    );
  }
  if (phase === "result") {
    return (
      <Result
        content={content}
        track={track}
        gender={gender}
        answers={answers}
        name={name}
        draftDate={draftDate}
        onRestart={() => setPhase("intro")}
      />
    );
  }

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="font-mono text-xs tracking-wide text-primary">מוכנות לגיבוש · 05:30</p>
        <h1 className="mt-2 text-3xl font-black leading-tight text-foreground sm:text-4xl">
          {name ? `${name}, ` : ""}היום מתחיל עוד חושך
        </h1>
        <p className="mt-3 text-sm leading-6 text-dust">
          עוברים את יום הגיבוש רגע אחרי רגע. בכל רגע עונים מה באמת המספרים שלכם ומה הייתם עושים.
          בסוף היום: איפה הייתם נחתכים או שהגעתם עד הסוף, כרטיס לוחם, ותוכנית לשבועות שנשארו.
        </p>
      </header>

      <fieldset>
        <legend className="mb-3 text-sm font-bold text-foreground">איזה גיבוש?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["combat", "pilot"] as const).map((t) => {
            const on = track === t;
            const Icon = t === "pilot" ? Plane : Mountain;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTrack(t)}
                className={`flex min-h-20 items-start gap-3 border p-4 text-right transition ${
                  on
                    ? "border-primary bg-primary/10"
                    : "border-iron/40 bg-card hover:border-primary/50"
                }`}
              >
                <Icon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${on ? "text-primary" : "text-dust"}`}
                  aria-hidden
                />
                <span>
                  <span className="block text-base font-black text-foreground">
                    {content.tracks[t].title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-dust">
                    {content.tracks[t].subtitle}
                  </span>
                  <span className="mt-1 block font-mono text-[11px] text-dust/80">
                    {content.tracks[t].stages.length} רגעים
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {!profileGender && track === "combat" ? (
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-foreground">
            המסלולים הפתוחים תלויים בזה
          </legend>
          <div className="flex gap-2">
            {(
              [
                ["male", "בנים"],
                ["female", "בנות"],
              ] as const
            ).map(([g, label]) => (
              <button
                key={g}
                type="button"
                aria-pressed={gender === g}
                onClick={() => setGender(g)}
                className={`min-h-11 min-w-24 border px-4 text-sm font-bold transition ${
                  gender === g
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-iron/40 text-dust"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setPhase("sim")}
          className="cta-shine inline-flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-6 text-base font-black text-primary-foreground transition hover:brightness-110 sm:w-auto"
        >
          מתחילים את היום
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-xs leading-5 text-dust">{BENCHMARK_NOTE}</p>
      </div>
    </div>
  );
}

/** The one moment shown (blurred) to people who have not unlocked; the rest comes from the API. */
const TEASER_MOMENT = {
  clock: "06:10",
  place: "ריצת 2 ק״מ",
  scene: "שריקה אחת וכולם רצים. המגבשים לא אומרים מה הזמן שצריך.",
  question: "מה הזמן שלכם ל־2 ק״מ?",
  options: ["א", "ב", "ג", "ד"].map((label) => ({ label: `תשובה ${label}`, score: 0 })),
};

/** Logged out, or logged in without the unlock: the first moment, blurred, and the card face down. */
function LockedTeaser({ authed, price }: { authed: boolean; price: string | null }) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
      <div className="space-y-5">
        <p className="font-mono text-xs tracking-wide text-primary">מוכנות לגיבוש · בתשלום</p>
        <h1 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
          איפה הייתם נחתכים ביום הגיבוש?
        </h1>
        <p className="max-w-xl text-sm leading-6 text-dust">
          סימולציה של יום שלם, משעה 05:30 ועד הראיון: ריצות, דיונה, שקים, אלונקה. בסוף מקבלים כרטיס
          לוחם עם ציון, מפת מסלול עד הרמה שלכם, והפערים מול הרף עם תוכנית שבוע אחרי שבוע. יש מסלול
          קרבי ומסלול לגיבוש טיס וחובלים.
        </p>
        {authed ? (
          <Link
            to="/checkout"
            className="cta-shine flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110 sm:w-auto sm:inline-flex"
          >
            <Lock className="h-4 w-4" aria-hidden />
            {price ? `פתיחה ב־${price}, יחד עם ההתאמות החזקות` : "לפתיחת הגישה"}
          </Link>
        ) : (
          <div className="space-y-2">
            <Link
              to="/post-signup"
              hash="login"
              className="flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110 sm:inline-flex sm:w-auto"
            >
              התחברות
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>
            <p className="text-xs text-dust">
              עוד אין חשבון?{" "}
              <Link to="/post-signup" className="font-semibold text-primary">
                מתחילים מהשאלון
              </Link>
            </p>
          </div>
        )}
        <div className="relative select-none" aria-hidden>
          <div className="pointer-events-none blur-[5px]" inert>
            <Moment stage={TEASER_MOMENT} step={2} total={16} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/50 bg-background/80">
              <Lock className="h-5 w-5 text-primary" />
            </span>
          </div>
        </div>
        <p className="text-xs leading-5 text-dust">{BENCHMARK_NOTE}</p>
      </div>
      <FighterCard
        overall={null}
        levelName=""
        trackLabel="קרבי"
        ratings={RATING_LABELS.combat.map((r) => ({ ...r, value: null }))}
        silhouette
      />
    </div>
  );
}

/** What a shared link shows: score and level only, nothing private, and a way in. */
function SharedTeaser({ score, levelIndex }: { score: number; levelIndex: number }) {
  const { track, name } = SHARE_LEVELS[levelIndex];
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <p className="font-mono text-xs tracking-wide text-primary">כרטיס לוחם</p>
        <h1 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
          מישהו קיבל {score}. כמה אתם מקבלים?
        </h1>
        <p className="max-w-xl text-sm leading-6 text-dust">
          סימולציה של יום הגיבוש, רגע אחרי רגע. בסוף רואים איפה הייתם נחתכים, באיזו רמה אתם היום,
          ומה צריך לשפר עד הגיבוש.
        </p>
        <Link
          to="/gibush"
          className="cta-shine flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110 sm:inline-flex sm:w-auto"
        >
          לעבור את היום בעצמי
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
        <p className="text-xs leading-5 text-dust">{BENCHMARK_NOTE}</p>
      </div>
      <FighterCard
        overall={score}
        levelName={name}
        trackLabel={TRACK_CARD_LABEL[track]}
        ratings={RATING_LABELS[track].map((r) => ({ ...r, value: null }))}
        name="?"
      />
    </div>
  );
}
