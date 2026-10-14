import { useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Sparkles } from "lucide-react";
import { getToken, subscribeAuth } from "@/lib/auth";

/** The honest free/paid split, said the same way on every free page. */
const SPLIT = "מקומות 5 ו־4 בחינם. שלוש ההתאמות החזקות (3, 2 ו־1) נפתחות בתשלום חד־פעמי, בלי מנוי.";
const DEFAULT_BODY =
  "שאלון אישי אחד מצליב את הדפ״ר, הפרופיל הרפואי ו־11 ציוני המא״ה מול יותר מ־300 תפקידים, ומחזיר 5 התאמות עם הסבר וסיכויי קבלה.";

/**
 * The one "next step" on free tools and content pages: guests go to the questionnaire,
 * signed-in users go back to their matches.
 */
export function QuizCta({
  title,
  body = DEFAULT_BODY,
  compact = false,
  className = "",
}: {
  title: ReactNode;
  body?: ReactNode;
  /** One line and a small button, for the top of a page or a support page. */
  compact?: boolean;
  className?: string;
}) {
  const authed = useSyncExternalStore(
    subscribeAuth,
    () => !!getToken(),
    () => false,
  );
  const to = authed ? "/ai-counselor" : "/post-signup";
  const label = authed ? "להתאמות שלי" : "קבלו 2 התאמות בחינם";

  if (compact) {
    return (
      <aside
        className={`flex flex-col gap-3 border border-primary/30 bg-primary/5 p-4 text-right sm:flex-row sm:items-center sm:justify-between ${className}`}
      >
        <p className="text-sm leading-6 text-foreground">
          <strong className="font-black">{title}</strong>{" "}
          <span className="text-dust">
            {authed
              ? "ההתאמות האישיות שלכם שמורות בחשבון."
              : "השאלון האישי מחזיר 5 תפקידים שמתאימים לכם."}
          </span>
        </p>
        <Link
          to={to}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110"
        >
          {label}
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      </aside>
    );
  }

  return (
    <aside className={`border border-primary/40 bg-primary/10 p-5 text-right sm:p-6 ${className}`}>
      <h2 className="text-lg font-black leading-snug text-foreground sm:text-xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-dust">
        {authed ? "ההתאמות האישיות שלכם שמורות בחשבון. אפשר לחזור אליהן בכל רגע." : body}
      </p>
      <Link
        to={to}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-black text-primary-foreground transition hover:brightness-110 sm:w-auto"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {label}
      </Link>
      {authed ? null : <p className="mt-3 text-xs leading-5 text-dust">{SPLIT}</p>}
    </aside>
  );
}
