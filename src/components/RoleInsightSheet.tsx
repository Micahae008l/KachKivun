import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ExternalLink, X } from "lucide-react";
import { getRoleInsight } from "@/lib/api";
import { RoleReviewsPanel } from "@/components/RoleReviewsPanel";

const ease = [0.16, 1, 0.3, 1] as const;

function IntensityBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const pct = Math.round((Math.min(5, Math.max(1, value)) / 5) * 100);
  return (
    <div className="space-y-1 text-right">
      <div className="flex items-center justify-between gap-3 text-xs" dir="rtl">
        <span className="text-dust">{label}</span>
        <span className="font-mono tabular-nums text-dust">{value}/5</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-iron/25">
        <div className="h-full bg-primary/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * One role's details in a sheet over the current page (bottom sheet on phones), so reading
 * about a role never navigates away from where the person was.
 */
export function RoleInsightSheet({ slug, onClose }: { slug: string | undefined; onClose: () => void }) {
  const reduce = useReducedMotion();
  const detailQuery = useQuery({
    queryKey: ["role-insight", slug],
    queryFn: () => getRoleInsight(slug!),
    enabled: Boolean(slug),
    staleTime: 10 * 60_000,
  });
  const detail = detailQuery.data?.role;

  useEffect(() => {
    if (!slug) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [slug, onClose]);

  return (
    <AnimatePresence>
      {slug ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center sm:p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-insight-title"
            initial={reduce ? false : { transform: "translateY(32px)", opacity: 0 }}
            animate={{ transform: "translateY(0px)", opacity: 1 }}
            exit={{ transform: "translateY(24px)", opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.28, ease }}
            className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-xl border border-iron/40 bg-card p-5 text-right shadow-xl sm:rounded-md sm:p-8"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-iron/40 sm:hidden" aria-hidden />
            <div className="mb-4 flex items-start justify-between gap-3" dir="ltr">
              <div className="min-w-0 flex-1 text-right" dir="rtl">
                <p className="font-mono text-[11px] tracking-widest text-primary uppercase">
                  {detail?.category || "תפקיד"}
                </p>
                <h2 id="role-insight-title" className="text-xl font-black text-foreground sm:text-2xl">
                  {detail?.roleTitle || "טוען…"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-iron/30 text-dust transition hover:text-foreground"
                aria-label="סגירה"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailQuery.isLoading ? (
              <p className="text-sm text-dust">טוען פירוט…</p>
            ) : detailQuery.isError ? (
              <p className="text-sm text-destructive">לא הצלחנו לטעון את התפקיד. נסו שוב.</p>
            ) : detail ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <IntensityBar label="עומס פיזי" value={detail.physicalDemand} />
                  <IntensityBar label="טכנולוגיה" value={detail.techIntensity} />
                  <IntensityBar label="עבודה עם אנשים" value={detail.peopleIntensity} />
                </div>

                <p className="text-sm leading-relaxed text-foreground/90">
                  {detail.about.split(/\n\n+/)[0]}
                </p>

                {detail.signals.length ? (
                  <div>
                    <h3 className="mb-2 text-xs font-bold text-foreground">מה עושים בפועל</h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {detail.signals.map((s) => (
                        <li key={s} className="border border-iron/30 bg-background/40 px-2 py-0.5 text-xs text-dust">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {detail.requirements.length || detail.serviceLengthLabel ? (
                  <div>
                    <h3 className="mb-2 text-xs font-bold text-foreground">דרישות</h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {[...detail.requirements, ...(detail.serviceLengthLabel ? [detail.serviceLengthLabel] : [])].map(
                        (s) => (
                          <li
                            key={s}
                            className="border border-iron/30 bg-secondary/60 px-2 py-0.5 text-xs font-semibold text-foreground"
                          >
                            {s}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 border-t border-iron/20 pt-4 sm:flex-row sm:justify-start" dir="rtl">
                  <a
                    href={detail.officialSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    לתפקיד באתר מתגייסים
                  </a>
                  <a
                    href={detail.officialDirectoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-iron/40 px-4 py-2.5 text-sm text-dust transition hover:border-primary/40 hover:text-foreground"
                  >
                    קטלוג תפקידים רשמי
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </a>
                </div>

                <RoleReviewsPanel roleSlug={detail.slug} roleTitle={detail.roleTitle} />
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
