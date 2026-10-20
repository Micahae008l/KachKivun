import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Lock, Plane, Star } from "lucide-react";
import { ApiError, getGibushContent, getLatestAssessment, getPaymentOffer } from "@/lib/api";
import { getToken, hasSessionHint, subscribeAuth } from "@/lib/auth";
import { formatPaymentPrice } from "@/lib/payment-offer";
import { normalizeAssessmentAnswers } from "@/features/assessment/draft";
import {
  BENCHMARK_NOTE,
  RATING_LABELS,
  SHARE_LEVELS,
  type Gender,
  type GibushContent,
} from "@/features/gibush/types";
import type { Answers } from "@/features/gibush/scoring";
import { Simulation, Moment, type RunState } from "@/features/gibush/Simulation";
import { FighterCard, LEVEL_BADGE, Result, SHARE_URL } from "@/features/gibush/Result";
import { DAWN, DUNE, STRETCHER } from "@/features/gibush/photos";

const TITLE = "מוכנות לגיבוש: סימולציה של יום הגיבוש | קח כיוון";
const DESCRIPTION =
  "עוברים את יום הגיבוש רגע אחרי רגע, ומקבלים כרטיס לוחם, מפת מסלול ותוכנית אימון לשבועות שנשארו.";
const STORAGE_KEY = "kk_gibush_day";
/** A run in progress, so a reload (phones drop background tabs) does not throw it away. */
const RUN_KEY = "kk_gibush_day_run";

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
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:url", content: SHARE_URL },
        { name: "twitter:title", content: ogTitle },
        { name: "twitter:description", content: DESCRIPTION },
      ],
      links: [{ rel: "canonical", href: SHARE_URL }],
    };
  },
});

type Saved = { gender: Gender; answers: Answers };
type SavedRun = Saved & RunState;

function readJson<T extends Saved>(key: string): T | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v && (v.gender === "male" || v.gender === "female") && v.answers ? v : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: nothing is kept for next time
  }
}

function GibushPage() {
  const { s, u } = Route.useSearch();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const token = useSyncExternalStore(subscribeAuth, getToken, () => null);
  // A returning user's token is still being refreshed: wait, rather than flash the paywall.
  const authPending = mounted && !token && hasSessionHint();
  // VITE_GIBUSH_FREE=1 (local .env.local only): guests get the simulation, for testing.
  const free = import.meta.env.VITE_GIBUSH_FREE === "1";

  // The content is the paywall: the API sends it only to unlocked users (403 otherwise).
  const contentQuery = useQuery({
    queryKey: ["gibush-content"],
    queryFn: getGibushContent,
    enabled: mounted && (Boolean(token) || free) && s == null,
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

  // pb-20: the last lines clear the floating accessibility button.
  const shell = (children: React.ReactNode) => (
    // During the run (no site header or footer) on desktop: the background fills the screen and
    // the moment sits in the middle of it. Phones keep the top-aligned layout tested at 320px.
    <div
      className="topo-lines min-h-[70vh] overflow-x-clip lg:[html[data-run]_&]:flex lg:[html[data-run]_&]:min-h-dvh lg:[html[data-run]_&]:items-center"
      dir="rtl"
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-4 sm:px-6 sm:pt-12 lg:[html[data-run]_&]:py-10 2xl:[html[data-run]_&]:max-w-[88rem]">
        {children}
      </div>
    </div>
  );

  if (s != null && u != null) return shell(<SharedTeaser score={s} levelIndex={u} />);
  // The server sends the public teaser (the page is indexed); the buttons wait for the browser.
  if (!mounted) return shell(<LockedTeaser authed={null} price={null} />);
  if (
    authPending ||
    ((token || free) && (contentQuery.isPending || (token && assessmentQuery.isPending)))
  ) {
    return shell(
      <div
        className="h-96 animate-pulse border border-iron/20 bg-card/50"
        role="status"
        aria-label="טוען"
      />,
    );
  }

  const locked = contentQuery.error instanceof ApiError && contentQuery.error.status === 403;
  if ((!token && !free) || locked) {
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
    />,
  );
}

function GibushApp({
  content,
  name,
  draftDate,
  gender: profileGender,
}: {
  content: GibushContent;
  name?: string;
  draftDate?: string;
  gender: Gender | null;
}) {
  const run = useMemo(() => readJson<SavedRun>(RUN_KEY), []);
  const saved = useMemo(() => run ?? readJson<Saved>(STORAGE_KEY), [run]);
  const [phase, setPhase] = useState<"intro" | "sim" | "result">(
    run ? "sim" : saved ? "result" : "intro",
  );
  // Nobody is preselected: the girls' ladder is different, so the choice has to be theirs.
  const [gender, setGender] = useState<Gender | null>(saved?.gender ?? profileGender);
  const [answers, setAnswers] = useState<Answers>(saved?.answers ?? {});
  // Only the first run after a reload resumes; a fresh start begins at the first moment.
  const [resume, setResume] = useState(run);
  const saveRun = useCallback((r: RunState) => writeJson(RUN_KEY, { gender, ...r }), [gender]);
  const rise = useRise();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);

  if (phase === "sim" && gender) {
    return (
      <Simulation
        content={content}
        gender={gender}
        initial={resume ?? undefined}
        onProgress={saveRun}
        onExit={() => {
          writeJson(RUN_KEY, null);
          setResume(null);
          setPhase("intro");
        }}
        onDone={(a) => {
          setAnswers(a);
          setPhase("result");
          setResume(null);
          writeJson(RUN_KEY, null);
          writeJson(STORAGE_KEY, { gender, answers: a });
        }}
      />
    );
  }
  if (phase === "result" && gender) {
    return (
      <Result
        content={content}
        gender={gender}
        answers={answers}
        name={name}
        draftDate={draftDate}
        onRestart={() => setPhase("intro")}
      />
    );
  }

  const start = (
    <button
      type="button"
      disabled={!gender}
      onClick={() => setPhase("sim")}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-6 text-base font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 sm:w-auto"
    >
      {gender ? "מתחילים את היום" : "בחרו בנים או בנות כדי להתחיל"}
      {gender ? <ChevronLeft className="h-4 w-4" aria-hidden /> : null}
    </button>
  );

  return (
    <div className="space-y-20 sm:space-y-32">
      <div className="relative">
        {/* First light: a band across the top on phones, the left of the screen on wider ones. */}
        <div
          className="pointer-events-none absolute -inset-x-4 -top-4 h-80 overflow-hidden sm:-inset-x-6 sm:-top-12 md:inset-y-0 md:-top-12 md:left-[calc(50%-50vw)] md:right-auto md:h-auto md:w-[55vw]"
          aria-hidden
        >
          <img
            src={DAWN.src}
            srcSet={DAWN.srcSet}
            sizes="(min-width: 768px) 55vw, 100vw"
            alt=""
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-60 md:opacity-85"
            style={{ objectPosition: DAWN.position }}
          />
          <div
            className="absolute inset-0 md:hidden"
            style={{
              background:
                "linear-gradient(to top, var(--background) 8%, color-mix(in oklch, var(--background) 55%, transparent))",
            }}
          />
          <div
            className="absolute inset-0 hidden md:block"
            style={{
              background:
                "linear-gradient(to left, var(--background), color-mix(in oklch, var(--background) 55%, transparent) 35%, transparent 70%), linear-gradient(to top, var(--background), transparent 30%)",
            }}
          />
          <p className="absolute bottom-3 left-4 hidden bg-background/60 px-1.5 py-0.5 text-xs text-sand-light md:block">
            {DAWN.caption}
          </p>
        </div>
        <div className="relative space-y-6 sm:space-y-8 md:max-w-xl lg:max-w-2xl">
          <motion.header {...rise(0)} className="max-w-2xl">
            <p className="font-mono text-sm tracking-wide text-sand">מוכנות לגיבוש</p>
            <h1 className="mt-3 text-balance text-4xl font-black leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
              {name ? `${name}, ` : ""}היום מתחיל עוד חושך
            </h1>
            <p className="mt-4 text-pretty text-base leading-7 text-dust sm:text-lg sm:leading-8">
              עוברים את יום הגיבוש רגע אחרי רגע, ועונים מה באמת המספרים שלכם ומה הייתם עושים.{" "}
              <span className="hidden sm:inline">
                בסוף היום: איפה הייתם נחתכים או שהגעתם עד הסוף, כרטיס לוחם, ותוכנית לשבועות שנשארו.
              </span>
            </p>
          </motion.header>

          <motion.p
            {...rise(0.08)}
            className="border-r-2 border-sand bg-sand/5 px-4 py-3 text-base leading-7 text-foreground"
          >
            <span className="font-mono font-bold text-sand">{content.day.stages.length} רגעים</span>{" "}
            · {content.day.subtitle}
          </motion.p>

          {!profileGender ? (
            <motion.fieldset {...rise(0.16)}>
              <legend className="mb-3 text-sm font-bold text-foreground">
                בנים או בנות? <span className="font-normal text-dust">לכל אחד סולם יחידות אחר</span>
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
            </motion.fieldset>
          ) : null}

          <motion.div {...rise(0.24)} className="space-y-3">
            {start}
            <p className="text-sm leading-6 text-dust">{BENCHMARK_NOTE}</p>
            <p className="text-xs text-dust md:hidden">{DAWN.caption}</p>
          </motion.div>
        </div>
      </div>

      <IntroLadder ladder={content.ladders[gender ?? "male"]} />
      <IntroOutcome />

      <div className="flex flex-col items-start gap-3 border-t border-iron/30 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg font-black text-foreground">
          {content.day.stages.length} רגעים, בערך 5 דקות.
        </p>
        {start}
      </div>
    </div>
  );
}

const ease = [0.16, 1, 0.3, 1] as const;

/** Rises into place on first render; still under reduced motion. */
function useRise() {
  const reduce = useReducedMotion();
  return (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease },
        };
}

/** The same rise, once, as it scrolls into view. */
function useRiseInView() {
  const reduce = useReducedMotion();
  return (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" },
          transition: { duration: 0.55, delay, ease },
        };
}

/** Tier colors, rarest last: the way a game colors its ranks. Full class strings for Tailwind. */
const TIER = [
  { num: "text-dust", bar: "bg-iron/60", chip: "border-iron/40" },
  { num: "text-primary", bar: "bg-primary", chip: "border-primary/30" },
  { num: "text-steel", bar: "bg-steel", chip: "border-steel/30" },
  { num: "text-maroon", bar: "bg-maroon", chip: "border-maroon/35" },
  { num: "text-sand", bar: "bg-sand", chip: "border-sand/40" },
];

/** "a, b (c, d). note" → ["a", "b (c, d)"] and "note": commas inside parentheses stay. */
function splitUnits(text: string) {
  const [list, ...note] = text.split(". ");
  return { units: list.split(/,\s*(?![^()]*\))/), note: note.join(". ") };
}

/** The levels a day can end on, as a tier list: the rarest at the top. */
function IntroLadder({ ladder }: { ladder: GibushContent["ladders"]["male"] }) {
  const tiers = ladder.map((l, i) => ({ l, i, tier: TIER[TIER.length - ladder.length + i] }));
  const rise = useRiseInView();
  return (
    <section aria-labelledby="intro-ladder-h">
      {/* The dune, edge to edge, with the heading set on its lower part. */}
      <div className="relative mx-[calc(50%-50vw)] flex h-72 items-end overflow-hidden sm:h-96">
        <img
          src={DUNE.src}
          srcSet={DUNE.srcSet}
          sizes="100vw"
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover saturate-[.7]"
          style={{ objectPosition: DUNE.position }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--background), color-mix(in oklch, var(--background) 60%, transparent) 45%, color-mix(in oklch, var(--background) 15%, transparent))",
          }}
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 sm:pb-9">
          <h2
            id="intro-ladder-h"
            className="text-balance text-3xl font-black leading-tight text-foreground sm:text-5xl"
          >
            לאן אפשר להגיע
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-7 text-sand-light sm:text-lg sm:leading-8">
            בסוף היום מקבלים דרגה. לטיס ולחובלים יש דרך משלהם לשתי הרמות העליונות: חשיבה, תכנון
            וצוות במקום סחיבה.
          </p>
        </div>
        <p className="absolute left-4 top-3 bg-background/60 px-1.5 py-0.5 text-xs text-sand-light sm:left-6">
          {DUNE.caption}
        </p>
      </div>
      <ol className="mt-8 space-y-2">
        {tiers.reverse().map(({ l, i, tier }, row) => {
          const badge = LEVEL_BADGE[l.name];
          const elite = badge === "עילית";
          const { units, note } = splitUnits(l.units);
          return (
            <motion.li
              {...rise(row * 0.06)}
              key={l.name}
              className={`relative grid grid-cols-[3rem_1fr] items-center gap-x-4 gap-y-3 overflow-hidden border bg-card py-4 pe-4 ps-5 md:grid-cols-[3.5rem_13rem_1fr] ${
                elite ? "border-sand/40 bg-sand/[0.06]" : "border-iron/30"
              }`}
            >
              <span className={`absolute inset-y-0 right-0 w-1 ${tier.bar}`} aria-hidden />
              <span
                className={`row-span-2 font-mono text-4xl font-black leading-none md:row-span-1 md:text-5xl ${tier.num}`}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-lg font-black leading-tight text-foreground sm:text-xl">
                  {l.name}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-dust">
                  {badge ? (
                    <span className={`inline-flex items-center gap-1 font-black ${tier.num}`}>
                      <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                      {badge}
                    </span>
                  ) : null}
                  {l.screening}
                </p>
              </div>
              <div className="col-start-2 md:col-start-3">
                <ul className="flex flex-wrap gap-1.5">
                  {units.map((u) => (
                    <li
                      key={u}
                      className={`border bg-background/40 px-2 py-0.5 text-sm text-foreground/90 ${tier.chip}`}
                    >
                      {u}
                    </li>
                  ))}
                  {l.alt ? (
                    <li className="inline-flex items-center gap-1 border border-sand/50 bg-sand/10 px-2 py-0.5 text-sm font-bold text-sand">
                      <Plane className="h-3.5 w-3.5" aria-hidden />
                      {splitUnits(l.alt.units).units.join(", ")}
                    </li>
                  ) : null}
                </ul>
                {note ? <p className="mt-1.5 text-sm text-dust">{note}</p> : null}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}

const OUTCOME = [
  {
    tone: "border-steel",
    title: "דרגה וכרטיס לוחם",
    body: "איפה הייתם נחתכים, או עד איזו רמה הגעתם, עם ציון לכל תחום. אפשר לשתף בלי שם ובלי תשובות.",
  },
  {
    tone: "border-rust",
    title: "הפערים מול הרף",
    body: "מה שלכם היום מול מה שהמגבשים מחפשים, בכל רגע שבו לא עמדתם ברף.",
  },
  {
    tone: "border-sand",
    title: "תוכנית לשבועות שנשארו",
    body: "בסיס, עצימות בתנאי גיבוש, והורדת עומס בשבוע האחרון. בנויה על הזמן שיש לכם.",
  },
];

function IntroOutcome() {
  const rise = useRiseInView();
  return (
    <section
      aria-labelledby="intro-out-h"
      className="grid gap-8 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-16"
    >
      <h2
        id="intro-out-h"
        className="text-balance text-3xl font-black leading-tight text-foreground sm:text-4xl"
      >
        מה מקבלים בסוף היום
      </h2>
      <ul className="space-y-8 sm:space-y-10">
        {OUTCOME.map(({ tone, title, body }, i) => (
          <motion.li {...rise(i * 0.08)} key={title} className={`border-s-4 ps-5 ${tone}`}>
            <p className="text-2xl font-black leading-tight text-foreground sm:text-3xl">{title}</p>
            <p className="mt-2 max-w-xl text-pretty text-base leading-7 text-dust sm:text-lg sm:leading-8">
              {body}
            </p>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

/** The one moment shown (blurred) to people who have not unlocked; the rest comes from the API. */
const TEASER_MOMENT = {
  place: "ריצת 2 ק״מ",
  scene: "שריקה אחת וכולם רצים. המגבשים לא אומרים מה הזמן שצריך.",
  question: "מה הזמן שלכם ל־2 ק״מ?",
  options: ["א", "ב", "ג", "ד"].map((label) => ({ label: `תשובה ${label}`, score: 0 })),
};

/** Logged out, or logged in without the unlock: a moment of the day, blurred, beside a real stretcher. */
function LockedTeaser({ authed, price }: { authed: boolean | null; price: string | null }) {
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:items-start lg:grid-cols-2 lg:gap-16">
      <div className="space-y-5">
        <p className="font-mono text-xs tracking-wide text-sand">מוכנות לגיבוש · בתשלום</p>
        <h1 className="text-balance text-3xl font-black leading-[1.05] text-foreground sm:text-5xl">
          איפה הייתם נחתכים ביום הגיבוש?
        </h1>
        <p className="max-w-xl text-pretty text-base leading-7 text-dust">
          סימולציה של יום שלם, מהקליטה בבוקר ועד הראיון: ריצות, דיונה, שקים, אלונקה. בסוף מקבלים
          כרטיס לוחם עם ציון, מפת מסלול עד הרמה שלכם, והפערים מול הרף עם תוכנית שבוע אחרי שבוע. אחר
          הצהריים מגיע החלק של טיס וחובלים: תכנון, חידות ותחקיר.
        </p>
        {authed == null ? (
          <div className="h-12" aria-hidden />
        ) : authed ? (
          <Link
            to="/checkout"
            className="flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110 sm:w-auto sm:inline-flex"
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
            <Moment stage={TEASER_MOMENT} step={2} total={20} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/50 bg-background/80">
              <Lock className="h-5 w-5 text-primary" />
            </span>
          </div>
        </div>
        <p className="text-sm leading-6 text-dust">{BENCHMARK_NOTE}</p>
      </div>
      <figure className="md:sticky md:top-24">
        <img
          src={STRETCHER.src}
          srcSet={STRETCHER.srcSet}
          sizes="(min-width: 1024px) 50vw, (min-width: 768px) 24rem, 100vw"
          alt={STRETCHER.alt}
          loading="lazy"
          decoding="async"
          className="aspect-[4/5] w-full object-cover lg:aspect-auto lg:h-[36rem]"
          style={{ objectPosition: STRETCHER.position }}
        />
        <figcaption className="mt-2 text-xs text-dust">{STRETCHER.caption}</figcaption>
      </figure>
    </div>
  );
}

/** What a shared link shows: score and level only, nothing private, and a way in. */
function SharedTeaser({ score, levelIndex }: { score: number; levelIndex: number }) {
  const name = SHARE_LEVELS[levelIndex];
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <p className="font-mono text-xs tracking-wide text-sand">כרטיס לוחם</p>
        <h1 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
          מישהו קיבל {score}. כמה אתם מקבלים?
        </h1>
        <p className="max-w-xl text-sm leading-6 text-dust">
          סימולציה של יום הגיבוש, רגע אחרי רגע. בסוף רואים איפה הייתם נחתכים, באיזו רמה אתם היום,
          ומה צריך לשפר עד הגיבוש.
        </p>
        <Link
          to="/gibush"
          className="flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110 sm:inline-flex sm:w-auto"
        >
          לעבור את היום בעצמי
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
        <p className="text-xs leading-5 text-dust">{BENCHMARK_NOTE}</p>
      </div>
      <FighterCard
        overall={score}
        levelName={name}
        ratings={RATING_LABELS.map((r) => ({ ...r, value: null }))}
        name="?"
      />
    </div>
  );
}
