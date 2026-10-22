import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "framer-motion";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, Lock } from "lucide-react";
import {
  getMatchExtras,
  roleInsightSlug,
  type MatchExtras as MatchExtrasData,
  type PaymentOffer,
  type WhatIfScenario,
} from "@/lib/api";
import { formatPaymentPrice } from "@/lib/payment-offer";

type Panel = "plan" | "whatif";

const ease = [0.16, 1, 0.3, 1] as const;
const scenarioLabel = (s: WhatIfScenario) =>
  s.metric === "dapar" ? `דפ״ר ${s.to}` : `פרופיל ${s.to}`;

/**
 * Two closed rows under the matches, each a single number and one sentence. Opening a row
 * shows its detail; only one is open at a time, so the page never becomes a wall.
 * Free users get their open places in full; the paid places stay in position, unnamed.
 */
export function MatchExtras({
  recommendationId,
  offer,
}: {
  recommendationId: string | null;
  offer?: PaymentOffer | null;
}) {
  const [open, setOpen] = useState<Panel | null>(null);
  const query = useQuery({
    queryKey: ["match-extras", recommendationId],
    queryFn: () => getMatchExtras(recommendationId),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const extras = query.data;
  // The five matches are the core result; these rows simply stay out of the way on failure.
  if (!extras) return null;
  const price = !extras.unlocked && offer?.enabled ? formatPaymentPrice(offer.product) : null;
  // Lead with the step that opens the most.
  const headline = [...extras.whatIf].sort((a, b) => b.openedCount - a.openedCount)[0];
  const toggle = (panel: Panel) => setOpen((current) => (current === panel ? null : panel));

  return (
    <div className="space-y-3" dir="rtl">
      <Row
        open={open === "plan"}
        onToggle={() => toggle("plan")}
        number={extras.plan.length}
        title="תפקידים מדורגים מראש לשאלון ההעדפות"
        hint="מה לתת 5, מה 4 ומה 3"
      >
        <Plan extras={extras} price={price} />
      </Row>

      {headline ? (
        <Row
          open={open === "whatif"}
          onToggle={() => toggle("whatif")}
          number={headline.openedCount}
          title={`תפקידים נוספים היו נפתחים לכם עם ${scenarioLabel(headline)}`}
          hint="מה צעד אחד למעלה משנה"
        >
          <WhatIf extras={extras} price={price} initialKey={headline.key} />
        </Row>
      ) : null}
    </div>
  );
}

function Row({
  open,
  onToggle,
  number,
  title,
  hint,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  number: number;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`border bg-card transition-colors ${open ? "border-primary/50" : "border-iron/30"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-right transition active:scale-[0.99] sm:p-5"
      >
        <span className="w-14 shrink-0 text-center font-mono text-4xl font-black tabular-nums leading-none text-primary sm:w-16 sm:text-5xl">
          {number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black leading-snug text-foreground">{title}</span>
          <span className="mt-0.5 block text-xs text-dust">{hint}</span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-dust transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            className="overflow-hidden"
          >
            <div className="border-t border-iron/25 p-4 sm:p-5">{children}</div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function UnlockLine({ text, price }: { text: string; price: string | null }) {
  return (
    <div className="mt-4 flex flex-col gap-3 border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm leading-6 text-foreground">
        <Lock className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
        {text}
      </p>
      {price ? (
        <Link
          to="/checkout"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110 active:scale-[0.97]"
        >
          פתחו ב־{price}
        </Link>
      ) : null}
    </div>
  );
}

function RoleTitleLink({ title }: { title: string }) {
  return (
    <Link
      to="/roles/$slug"
      params={{ slug: roleInsightSlug(title) }}
      className="font-bold text-foreground underline decoration-iron/60 underline-offset-4 transition hover:text-primary hover:decoration-primary"
    >
      {title}
    </Link>
  );
}

function Plan({ extras, price }: { extras: MatchExtrasData; price: string | null }) {
  const [copied, setCopied] = useState(false);
  const matches = extras.plan.filter((e) => e.source === "match");
  const backups = extras.plan.flatMap((e) => (e.locked || e.source !== "backup" ? [] : [e]));
  const lockedCount = matches.filter((e) => e.locked).length;

  async function copy() {
    const lines = extras.plan.flatMap((e) => (e.locked ? [] : [`${e.rating}: ${e.roleTitle}`]));
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("ההעתקה נכשלה. אפשר לסמן את הרשימה ולהעתיק ידנית.");
    }
  }

  return (
    <>
      <ul className="divide-y divide-iron/25 border border-iron/25">
        {matches.map((entry) => (
          <li
            key={entry.rank}
            className={`flex items-center gap-3 p-3 ${entry.locked ? "bg-primary/5" : ""}`}
          >
            <span className="w-8 shrink-0 text-center font-mono text-2xl font-black tabular-nums text-primary">
              {entry.rating}
            </span>
            {entry.locked ? (
              <>
                <Lock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="font-mono text-xs text-primary">מקום {entry.rank}</span>
                {/* A blurred bar stands in for the name; the real title is never sent to the browser. */}
                <span
                  aria-hidden
                  className="h-3.5 max-w-[11rem] flex-1 rounded-sm bg-foreground/25 blur-[5px]"
                />
                <span className="sr-only">נעול</span>
              </>
            ) : (
              <span className="min-w-0 text-sm">
                <RoleTitleLink title={entry.roleTitle} />
                {entry.notes[0] ? (
                  <span className="mt-0.5 block text-xs leading-5 text-dust">{entry.notes[0]}</span>
                ) : null}
              </span>
            )}
          </li>
        ))}
      </ul>

      {backups.length ? (
        <p className="mt-3 text-sm leading-7 text-dust">
          <strong className="text-foreground">ועוד {backups.length} גיבויים לדירוג 3:</strong>{" "}
          {backups.map((entry, i) => (
            <span key={entry.roleTitle}>
              {i ? ", " : ""}
              <RoleTitleLink title={entry.roleTitle} />
            </span>
          ))}
          . ככל שיש יותר יעדים ב־3 ומעלה, גדל הסיכוי שיתחשבו בשאלון.
        </p>
      ) : null}

      {lockedCount ? (
        <UnlockLine price={price} text="התפקידים שכדאי לדרג הכי גבוה הם מקומות 3, 2 ו־1 שלכם." />
      ) : (
        <button
          type="button"
          onClick={() => void copy()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/60 px-4 text-sm font-bold text-primary transition hover:bg-primary/10 active:scale-[0.97]"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "הועתק" : "העתקת הרשימה"}
        </button>
      )}
    </>
  );
}

function WhatIf({
  extras,
  price,
  initialKey,
}: {
  extras: MatchExtrasData;
  price: string | null;
  initialKey: string;
}) {
  const [key, setKey] = useState(initialKey);
  const scenario = extras.whatIf.find((s) => s.key === key) ?? extras.whatIf[0];
  const hiddenOpened = scenario.openedCount - scenario.opened.length;

  return (
    <>
      {extras.whatIf.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="בחירת תרחיש">
          {extras.whatIf.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={s.key === scenario.key}
              onClick={() => setKey(s.key)}
              className={`min-h-10 border px-3 text-sm font-bold transition active:scale-[0.97] ${
                s.key === scenario.key
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-iron/40 text-dust hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {scenarioLabel(s)} · {s.openedCount}
            </button>
          ))}
        </div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={scenario.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="mt-4"
        >
          {scenario.opened.length ? (
            <ul className="divide-y divide-iron/25 border border-iron/25">
              {scenario.opened.slice(0, 4).map((role) => (
                <li key={role.roleTitle} className="p-3 text-sm">
                  <RoleTitleLink title={role.roleTitle} />
                </li>
              ))}
              {scenario.openedCount > Math.min(4, scenario.opened.length) ? (
                <li className="flex items-center gap-2 p-3 text-sm text-dust">
                  {hiddenOpened > 0 && !extras.unlocked ? (
                    <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
                  ) : null}
                  ועוד {scenario.openedCount - Math.min(4, scenario.opened.length)} תפקידים
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-dust">
              לא נפתחים תפקידים חדשים. מה שחסום לכם היום חסום מסיבה אחרת.
            </p>
          )}

          {scenario.enteringTopFive.length ? (
            <p className="mt-3 text-sm leading-6 text-foreground">
              <strong>היו נכנסים לחמישייה שלכם:</strong> {scenario.enteringTopFive.join(", ")}.
            </p>
          ) : scenario.enteringCount ? (
            <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-foreground">
              <Lock className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {scenario.enteringCount} תפקידים חדשים היו נכנסים לחמישייה שלכם.
            </p>
          ) : null}

          <Link
            to="/blog/$slug"
            params={{ slug: scenario.metric === "dapar" ? "דפר" : "פרופיל-צבאי" }}
            className="mt-3 inline-block text-xs font-semibold text-primary underline underline-offset-4"
          >
            {scenario.metric === "dapar" ? "מתי אפשר לבקש מבחן חוזר" : "איך מערערים על פרופיל"}
          </Link>
        </m.div>
      </AnimatePresence>

      {extras.unlocked ? null : (
        <UnlockLine price={price} text="הרשימה המלאה נפתחת יחד עם מקומות 3, 2 ו־1." />
      )}
    </>
  );
}
