import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const BUILD_STEPS = [
  "קוראים את הפרופיל שלכם",
  "מסננים את כל התפקידים לפי הדפ״ר והפרופיל",
  "בודקים מה כתבתם ומה מעניין אתכם",
  "מדרגים ובוחרים את חמש ההתאמות",
  "כותבים לכם הסבר אישי לכל תפקיד",
];

/** Shown while the matches are generated: real steps of the pipeline, ticking forward. */
/** Seconds at which each step starts; the last one (writing five explanations) is the long one. */
const STEP_AT = [0, 2.5, 5.5, 9, 13];

export function BuildingMatches() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => window.clearInterval(id);
  }, []);
  const step = STEP_AT.filter((at) => elapsed >= at).length - 1;
  // Never stalls and never claims to be done: approaches 95% while the answer is still coming.
  const progress = 0.95 * (1 - Math.exp(-elapsed / 16));

  return (
    <section
      className="animate-scale-in mx-auto w-full max-w-md border border-primary/35 bg-card p-6 text-right sm:p-8"
      aria-live="polite"
      aria-labelledby="building-matches-heading"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
          <span className="relative h-3 w-3 rounded-full bg-primary" />
        </span>
        <div>
          <h2 id="building-matches-heading" className="text-lg font-black text-foreground">
            מכינים לכם את ההתאמות
          </h2>
          <p className="text-xs text-dust" aria-live="off">
            {elapsed < 20
              ? "בדרך כלל פחות מדקה."
              : "כמעט שם. כותבים הסבר אישי לכל אחת מחמש ההתאמות, זה החלק הארוך."}
          </p>
        </div>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-iron/20" aria-hidden>
        <div
          className="h-full origin-right bg-primary transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <ol className="mt-5 space-y-3">
        {BUILD_STEPS.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                current ? "font-bold text-foreground" : done ? "text-dust" : "text-dust/40"
              }`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : current ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-iron/50" />
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
