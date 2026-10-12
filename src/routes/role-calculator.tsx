import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUp, ChevronLeft, Sparkles } from "lucide-react";
import catalog from "@/content/blog/role-calculator.json";
import { roleInsightSlug } from "@/lib/api";

const URL = "https://kachkivun.com/role-calculator";
const TITLE = "מחשבון תפקידים: מה פתוח לי עם הדפ״ר והפרופיל שלי | קח כיוון";
const DESCRIPTION =
  "בחרו דפ״ר ופרופיל רפואי וראו מיד אילו מתוך יותר מ־300 תפקידים בצה״ל פתוחים לכם, לפי ספים שאומתו מול אתר מתגייסים, ומה היה נפתח עם צעד אחד למעלה.";

export const Route = createFileRoute("/role-calculator")({
  component: RoleCalculatorPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

type Threshold = {
  title: string;
  category: string;
  combat: boolean;
  dapar: number | null;
  profile: number | null;
  /** False when no floor was published for the role, so nothing is known to block it. */
  verified: boolean;
};

const ROLES = catalog as Threshold[];
const DAPAR_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
// 21 means unfit for service, so the scale starts at the lowest serving profile.
const PROFILE_STEPS = [45, 64, 72, 82, 97];

/** Open when the person meets every known floor; a role with no published floor blocks no one. */
const isOpen = (role: Threshold, dapar: number, profile: number) =>
  (role.dapar == null || dapar >= role.dapar) && (role.profile == null || profile >= role.profile);

const countOpen = (dapar: number, profile: number) =>
  ROLES.filter((role) => isOpen(role, dapar, profile)).length;

const broadField = (category: string) => category.split("/")[0].trim() || "כללי";

/** A row of values to pick from, with the chosen one shown large beside the label. */
function Stepper({
  label,
  steps,
  value,
  onChange,
}: {
  label: string;
  steps: number[];
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <fieldset>
      <legend className="flex w-full items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="font-mono text-3xl font-black tabular-nums leading-none text-primary">
          {value}
        </span>
      </legend>
      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            aria-pressed={step === value}
            aria-label={`${label} ${step}`}
            onClick={() => onChange(step)}
            className={`min-h-11 border font-mono text-sm font-bold tabular-nums transition active:scale-[0.95] ${
              step === value
                ? "border-primary bg-primary text-primary-foreground"
                : step < value
                  ? "border-primary/30 bg-primary/10 text-foreground hover:border-primary/60"
                  : "border-iron/40 text-dust hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {step}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const TOP_FIELDS = 8;

function FieldGroup({ field, roles, open }: { field: string; roles: Threshold[]; open: boolean }) {
  return (
    <details open={open} className="group border border-iron/30 bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base font-black text-foreground transition hover:text-primary">
        <span className="flex items-center gap-2">
          <ChevronLeft
            className="h-4 w-4 text-dust transition-transform group-open:-rotate-90"
            aria-hidden
          />
          {field}
        </span>
        <span className="font-mono text-sm font-normal text-dust">{roles.length}</span>
      </summary>
      <ul className="flex flex-wrap gap-2 border-t border-iron/25 p-4">
        {roles.map((role) => (
          <li key={role.title}>
            <Link
              to="/roles/$slug"
              params={{ slug: roleInsightSlug(role.title) }}
              className={`inline-flex min-h-9 items-center border px-3 text-sm font-semibold transition hover:border-primary hover:text-primary ${
                role.verified
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-iron/30 text-foreground/80"
              }`}
            >
              {role.title}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function RoleCalculatorPage() {
  const [dapar, setDapar] = useState(50);
  const [profile, setProfile] = useState(64);

  const open = useMemo(
    () => ROLES.filter((role) => isOpen(role, dapar, profile)),
    [dapar, profile],
  );
  const groups = useMemo(() => {
    const byField = new Map<string, Threshold[]>();
    for (const role of open) {
      const field = broadField(role.category);
      byField.set(field, [...(byField.get(field) ?? []), role]);
    }
    return [...byField.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [open]);

  const verifiedOpen = open.filter((role) => role.verified).length;
  const unknownOpen = open.length - verifiedOpen;
  const blocked = ROLES.length - open.length;
  const share = (count: number) => `${(count / ROLES.length) * 100}%`;

  const nextDapar = DAPAR_STEPS.find((step) => step > dapar);
  const nextProfile = PROFILE_STEPS.find((step) => step > profile);
  const steps = [
    nextDapar
      ? {
          label: `דפ״ר ${nextDapar}`,
          gain: countOpen(nextDapar, profile) - open.length,
          apply: () => setDapar(nextDapar),
        }
      : null,
    nextProfile
      ? {
          label: `פרופיל ${nextProfile}`,
          gain: countOpen(dapar, nextProfile) - open.length,
          apply: () => setProfile(nextProfile),
        }
      : null,
  ].flatMap((step) => (step && step.gain > 0 ? [step] : []));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-right sm:px-6 sm:py-12" dir="rtl">
      <header>
        <p className="font-mono text-xs tracking-widest text-primary uppercase">כלי חינם</p>
        <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
          מה פתוח לי עם הדפ״ר והפרופיל שלי?
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-[1.8] text-dust">
          בחרו את שני המספרים וראו אילו תפקידים עומדים בסף. בלי הרשמה.
        </p>
      </header>

      <div className="mt-6 border border-iron/30 bg-card">
        <section className="grid gap-6 p-5 sm:grid-cols-[3fr_2fr] sm:p-6">
          <Stepper label="דפ״ר" steps={DAPAR_STEPS} value={dapar} onChange={setDapar} />
          <Stepper
            label="פרופיל רפואי"
            steps={PROFILE_STEPS}
            value={profile}
            onChange={setProfile}
          />
        </section>

        <section className="border-t border-iron/25 bg-background/40 p-5 sm:p-6" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <p className="flex items-baseline gap-3">
              <span className="font-mono text-7xl font-black tabular-nums leading-none text-primary sm:text-8xl">
                {open.length}
              </span>
              <span className="text-sm leading-5 text-foreground">
                תפקידים פתוחים לכם
                <span className="block text-dust">מתוך {ROLES.length} בקטלוג</span>
              </span>
            </p>
            {steps.length ? (
              <div className="flex flex-wrap gap-2">
                {steps.map((step) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={step.apply}
                    className="inline-flex min-h-11 items-center gap-2 border border-primary/50 px-3 text-sm font-bold text-foreground transition hover:bg-primary/10 active:scale-[0.97]"
                  >
                    <ArrowUp className="h-4 w-4 text-primary" aria-hidden />
                    {step.label}
                    <span className="font-mono text-primary">+{step.gain}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* One bar for the whole catalog: met floors, no published floor, blocked. */}
          <div
            className="mt-5 flex h-3 overflow-hidden bg-iron/25"
            role="img"
            aria-label={`${verifiedOpen} עם סף מאומת, ${unknownOpen} בלי סף שפורסם, ${blocked} חסומים`}
          >
            <span
              className="bg-primary transition-[width] duration-300 ease-out"
              style={{ width: share(verifiedOpen) }}
            />
            <span
              className="bg-primary/35 transition-[width] duration-300 ease-out"
              style={{ width: share(unknownOpen) }}
            />
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-dust">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-primary" aria-hidden />
              <strong className="font-mono text-foreground">{verifiedOpen}</strong> עם סף מאומת שאתם
              עומדים בו
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-primary/35" aria-hidden />
              <strong className="font-mono text-foreground">{unknownOpen}</strong> שלא פורסם להם סף
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-iron/40" aria-hidden />
              <strong className="font-mono text-foreground">{blocked}</strong> חסומים כרגע
            </li>
          </ul>
        </section>
      </div>

      <h2 className="mt-10 mb-3 text-xl font-black text-foreground">התפקידים, לפי תחום</h2>
      <div className="space-y-2">
        {groups.slice(0, TOP_FIELDS).map(([field, roles], i) => (
          <FieldGroup key={field} field={field} roles={roles} open={i < 2} />
        ))}
      </div>
      {groups.length > TOP_FIELDS ? (
        <details className="group mt-2 border border-iron/30">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-bold text-dust transition hover:text-foreground">
            עוד {groups.length - TOP_FIELDS} תחומים
            <ChevronLeft
              className="h-4 w-4 transition-transform group-open:-rotate-90"
              aria-hidden
            />
          </summary>
          <div className="space-y-2 border-t border-iron/25 p-2">
            {groups.slice(TOP_FIELDS).map(([field, roles]) => (
              <FieldGroup key={field} field={field} roles={roles} open={false} />
            ))}
          </div>
        </details>
      ) : null}
      <p className="mt-3 text-xs text-dust">
        מסגרת ירוקה: תפקיד עם סף מאומת שאתם עומדים בו. מסגרת אפורה: לא פורסם סף.
      </p>

      <aside className="mt-10 border border-primary/40 bg-primary/10 p-5 sm:p-6">
        <h2 className="text-lg font-black text-foreground">
          פתוח לכם זה לא אותו דבר כמו מתאים לכם
        </h2>
        <p className="mt-2 text-sm leading-6 text-dust">
          המחשבון בודק רק ספים. השאלון האישי מוסיף את ציוני המא״ה, תחומי העניין ומה שחשוב לכם,
          ומחזיר את 5 התפקידים שהכי מתאימים מתוך יותר מ־300. מתחילים בחינם.
        </p>
        <Link
          to="/post-signup"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          בדקו התאמה בחינם
        </Link>
      </aside>

      <p className="mt-6 text-xs leading-5 text-dust">
        הספים אומתו מול דפי התפקיד באתר מתגייסים. תפקיד שלא פורסם לו סף מופיע כפתוח, אבל ייתכן שיש
        לו דרישות שלא פורסמו. סף הוא תנאי כניסה ולא הבטחה: ברוב התפקידים יש מיון, והשיבוץ תלוי גם
        בצורכי הצבא. עוד על הספים במדריכים{" "}
        <Link
          to="/blog/$slug"
          params={{ slug: "תפקידים-לפי-דפר" }}
          className="font-semibold text-primary underline underline-offset-4"
        >
          תפקידים לפי דפ״ר
        </Link>{" "}
        ו
        <Link
          to="/blog/$slug"
          params={{ slug: "תפקידים-לפי-פרופיל" }}
          className="font-semibold text-primary underline underline-offset-4"
        >
          תפקידים לפי פרופיל
        </Link>
        .
      </p>
    </div>
  );
}
