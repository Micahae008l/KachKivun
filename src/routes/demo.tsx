import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { RoleMatchCards } from "@/components/RoleMatchCards";
import { MatchExtras } from "@/components/MatchExtras";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { getIdfPhoto } from "@/lib/idf-images";
import type { MatchExtras as MatchExtrasData, PaymentOffer, RoleMatch } from "@/lib/api";

type DemoSide = { roles: RoleMatch[]; extras: MatchExtrasData };
type DemoPersona = {
  id: string;
  label: string;
  dapar: number;
  profile: number;
  paid: DemoSide;
  unpaid: DemoSide;
};

const DEMO_OFFER = {
  enabled: true,
  product: { amountMinor: 2499, currency: "ILS" },
} as unknown as PaymentOffer;

/**
 * Local-only: the results page as one sample user sees it, with no login, database or AI
 * call. Data comes from scripts/generate-demo-results.mjs; the route does not exist in production.
 */
export const Route = createFileRoute("/demo")({
  loader: async () => {
    if (!import.meta.env.DEV) throw notFound();
    const data = await import("@/dev/demo-results.json");
    return { persona: data.default.personas[0] as unknown as DemoPersona };
  },
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }, { title: "דמו מקומי" }],
  }),
  component: DemoPage,
});

function DemoPage() {
  const { persona } = Route.useLoaderData();
  const queryClient = useQueryClient();
  // Unpaid first: that is what every user sees on their first visit.
  const [paid, setPaid] = useState(false);
  const side = paid ? persona.paid : persona.unpaid;
  const key = `demo-${persona.id}-${paid ? "paid" : "unpaid"}`;
  // MatchExtras reads through the query cache; seed it so no request is made.
  queryClient.setQueryData(["match-extras", key], side.extras);

  return (
    <>
      <div
        className="sticky top-14 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-950/95 px-4 py-2 text-xs text-amber-100"
        dir="rtl"
      >
        <span>דמו מקומי · {persona.label} · טקסט התפקידים אינו טקסט ה־AI</span>
        <span className="flex gap-1">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setPaid(value)}
              aria-pressed={paid === value}
              className={`min-h-8 rounded-sm border px-2 font-semibold ${
                paid === value
                  ? "border-amber-300 bg-amber-300 text-amber-950"
                  : "border-amber-500/50"
              }`}
            >
              {value ? "אחרי תשלום" : "לפני תשלום"}
            </button>
          ))}
        </span>
      </div>

      {/* Same structure as /ai-counselor, so this is what the real page looks like. */}
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
            <p className="mb-2 font-mono text-xs tracking-wide text-primary uppercase">
              היועץ האישי
            </p>
            <h1 className="text-2xl font-black text-foreground sm:text-3xl">
              חמש התאמות התפקיד שלכם
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-dust">
              מתחילים ממקום 5, וההתאמה הכי חזקה מחכה בסוף.
            </p>
          </header>

          <section
            className="flex flex-wrap gap-x-6 gap-y-2 border border-iron/25 bg-card/60 px-4 py-3 font-mono text-xs text-dust"
            aria-label="הנתונים ששימשו להתאמה"
          >
            <span>
              דפ״ר{" "}
              <strong className="text-foreground" dir="ltr">
                {persona.dapar}
              </strong>
            </span>
            <span>
              פרופיל רפואי{" "}
              <strong className="text-foreground" dir="ltr">
                {persona.profile}
              </strong>
            </span>
          </section>

          <RoleMatchCards key={`cards-${key}`} roles={side.roles} offer={DEMO_OFFER} />
          <MatchExtras key={`extras-${key}`} recommendationId={key} offer={DEMO_OFFER} />

          <section className="flex flex-col items-center gap-3 border border-iron/25 bg-card/40 px-5 py-6 text-center">
            <h2 className="text-base font-bold text-foreground">לא בטוחים בתוצאות?</h2>
            <p className="text-sm leading-6 text-dust">נבנה לכם חמישייה חדשה מאותו פרופיל.</p>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/60 px-5 text-sm font-bold text-primary">
              <RefreshCw className="h-4 w-4" aria-hidden />
              נסו סבב חדש
            </span>
          </section>
        </div>
      </div>
    </>
  );
}
