import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bot,
  Briefcase,
  ChevronDown,
  Cpu,
  Heart,
  MapPin,
  Shield,
  Sparkles,
  Users,
  Waves,
  BookOpen,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { IdfPhotoCredit } from "@/components/IdfPhotoCredit";
import type { LockedRoleMatch, MatchedRole, RoleMatch } from "@/lib/api";
import { isLockedRole, roleInsightSlug, startTopMatchesCheckout } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";
import { trackEvent } from "@/lib/analytics";
import { idfPhotoAt, pickRolePhoto, type IdfPhoto } from "@/lib/idf-photo-catalog";
import { ARIA } from "@/lib/a11y";

const ease = [0.16, 1, 0.3, 1] as const;

function tagIcon(tag: string) {
  const t = tag.toLowerCase();
  if (/קרב|שטח|לוחם/.test(t)) return Shield;
  if (/טכנ|מחשב|סייבר|מערכות/.test(t)) return Cpu;
  if (/משרד|משא|מנהל/.test(t)) return Briefcase;
  if (/ים|חיל הים/.test(t)) return Waves;
  if (/אנוש|טיפול|רפוא|פסיכ/.test(t)) return Heart;
  if (/צוות|ליווי|הדרכה/.test(t)) return Users;
  if (/שטח|מיקום|נהיגה/.test(t)) return MapPin;
  return Sparkles;
}

function MatchRing({ pct, size = "lg" }: { pct: number; size?: "lg" | "md" }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const dim = size === "lg" ? 88 : 64;
  const stroke = size === "lg" ? 6 : 5;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90" aria-hidden>
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-iron/30"
        />
        <motion.circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="text-primary"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center font-mono tabular-nums text-foreground"
        role="img"
        aria-label={ARIA.matchPct(clamped)}
      >
        <span className={size === "lg" ? "text-2xl font-black" : "text-lg font-black"}>{clamped}</span>
        <span className="text-[9px] text-dust">%</span>
      </div>
    </div>
  );
}

function RoleCard({
  role,
  rank,
  photo,
  featured = false,
}: {
  role: RoleMatch;
  rank: number;
  photo: IdfPhoto;
  featured?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const headline = role.summary?.trim() || role.description.split(/(?<=[.!?])\s+/)[0] || role.roleTitle;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: rank * 0.05, ease }}
      className={`overflow-hidden border text-right ${
        featured ? "border-primary/45 bg-card" : "border-iron/30 bg-card"
      }`}
    >
      <div
        dir="rtl"
        className={`grid ${featured ? "md:grid-cols-[220px_1fr]" : "grid-cols-1"}`}
      >
        <div className="relative min-h-[140px] overflow-hidden">
          <img
            src={photo.src}
            alt={photo.alt}
            className="h-full w-full object-cover opacity-75"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/75 to-transparent" />
          <span
            className="absolute top-3 right-3 rounded-sm border border-primary/30 bg-background/80 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-primary"
            aria-hidden
          >
            #{rank}
          </span>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 to-transparent px-3 pb-2 pt-8 text-right">
            <IdfPhotoCredit photo={photo} />
          </div>
        </div>

        <div className={`flex flex-col gap-4 p-6 ${featured ? "md:p-8" : ""}`} dir="rtl">
          <div className="flex items-start justify-between gap-4" dir="rtl">
            <div className="min-w-0 flex-1">
              <h3 className={`font-bold text-foreground ${featured ? "text-xl" : "text-base"}`}>
                {role.roleTitle}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{headline}</p>
            </div>
            <MatchRing pct={role.matchPercentage} size={featured ? "lg" : "md"} />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {role.tags.map((t) => {
              const Icon = tagIcon(t);
              return (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-iron/25 bg-secondary/60 px-2.5 py-1 text-[11px] text-dust"
                >
                  <Icon className="h-3 w-3 shrink-0 text-primary/80" aria-hidden />
                  {t}
                </span>
              );
            })}
          </div>

          {role.description && role.description !== headline ? (
            <div>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                aria-expanded={expanded}
                aria-controls={detailId}
              >
                {expanded ? "פחות פירוט" : "למה התפקיד מתאים?"}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {expanded ? (
                <motion.p
                  id={detailId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 text-xs leading-relaxed text-dust"
                >
                  {role.description}
                </motion.p>
              ) : null}
            </div>
          ) : null}

          <Link
            to="/role-insights"
            search={{ role: roleInsightSlug(role.roleTitle) }}
            className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-primary transition hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            מידע נוסף על התפקיד
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

const UNLOCK_PRICE_ILS = 10;

/** A top match behind the paywall: blurred, with its real percentage as the teaser. */
function LockedRoleCard({
  role,
  featured,
  busy,
  onUnlock,
}: {
  role: LockedRoleMatch;
  featured: boolean;
  busy: boolean;
  onUnlock: () => void;
}) {
  const photo = idfPhotoAt(role.rank * 7 + 3);
  const title = role.rank === 1 ? "ההתאמה הכי חזקה שלכם" : "ההתאמה השנייה בחוזקה שלכם";

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: role.rank * 0.05, ease }}
      className={`relative overflow-hidden border text-right ${
        featured ? "border-primary/60 bg-card shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]" : "border-iron/30 bg-card"
      }`}
      aria-label={`${title}, נעול`}
    >
      <div dir="rtl" className={`grid ${featured ? "md:grid-cols-[220px_1fr]" : "grid-cols-1"}`}>
        <div className="relative min-h-[140px] overflow-hidden">
          <img src={photo.src} alt="" className="h-full w-full scale-110 object-cover opacity-60 blur-md" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent" />
          <span
            className="absolute top-3 right-3 rounded-sm border border-primary/30 bg-background/80 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-primary"
            aria-hidden
          >
            #{role.rank}
          </span>
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-background/80 text-primary">
              <Lock className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className={`flex flex-col gap-4 p-6 ${featured ? "md:p-8" : ""}`} dir="rtl">
          <div className="flex items-start justify-between gap-4" dir="rtl">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] tracking-widest text-primary">נעול · #{role.rank}</p>
              <h3 className={`mt-1 font-bold text-foreground ${featured ? "text-xl" : "text-base"}`}>{title}</h3>
              <div className="mt-3 space-y-2 blur-[3px] select-none" aria-hidden>
                <div className="h-2.5 w-11/12 rounded-sm bg-foreground/15" />
                <div className="h-2.5 w-3/4 rounded-sm bg-foreground/15" />
                {featured ? <div className="h-2.5 w-2/3 rounded-sm bg-foreground/15" /> : null}
              </div>
            </div>
            {role.matchPercentage != null ? (
              <MatchRing pct={role.matchPercentage} size={featured ? "lg" : "md"} />
            ) : null}
          </div>

          {featured ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={onUnlock}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:w-auto"
              >
                <Lock className="h-4 w-4" aria-hidden />
                {busy ? "פותחים את התשלום…" : `פתחו את 2 ההתאמות המובילות · ₪${UNLOCK_PRICE_ILS}`}
              </button>
              <p className="text-[11px] leading-relaxed text-dust">
                תשלום חד־פעמי · Apple Pay · Google Pay · כרטיס אשראי · נפתח לתמיד, גם בהתאמות הבאות
              </p>
            </div>
          ) : (
            <p className="text-xs text-dust">נפתח יחד עם #1 בתשלום אחד של ₪{UNLOCK_PRICE_ILS}</p>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/** Opens the payment page; a user who already paid is sent straight to their unlocked results. */
function useUnlockTopMatches(onUnlocked?: () => void) {
  const [busy, setBusy] = useState(false);

  async function unlock() {
    trackEvent("unlock_clicked");
    setBusy(true);
    try {
      const res = await startTopMatchesCheckout();
      if (res.alreadyUnlocked) {
        onUnlocked?.();
        return;
      }
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      throw new Error("no payment page");
    } catch (e) {
      trackEvent("unlock_failed", { stage: "checkout" });
      toast.error(getErrorMessage(e, "לא הצלחנו לפתוח את התשלום, נסו שוב"));
    } finally {
      setBusy(false);
    }
  }

  return { busy, unlock };
}

export function RoleMatchCards({ roles, onUnlocked }: { roles: MatchedRole[]; onUnlocked?: () => void }) {
  const open = useMemo(() => roles.filter((r): r is RoleMatch => !isLockedRole(r)), [roles]);
  const locked = useMemo(() => roles.filter(isLockedRole), [roles]);
  const photos = useMemo(() => {
    const used = new Set<string>();
    return open.map((r, i) => pickRolePhoto(r.tags, r.roleTitle, locked.length + i + 1, used));
  }, [open, locked.length]);
  const { busy, unlock } = useUnlockTopMatches(onUnlocked);
  const viewed = useRef(false);

  useEffect(() => {
    if (locked.length && !viewed.current) {
      viewed.current = true;
      trackEvent("paywall_viewed", { locked: locked.length });
    }
  }, [locked.length]);

  if (!roles.length) return null;

  // With the top matches locked, the first open card is #3 and none is "featured".
  const [top, ...rest] = locked.length ? [undefined, ...open] : open;
  const [topPhoto, ...restPhotos] = locked.length ? [undefined, ...photos] : photos;
  const firstOpenRank = locked.length + 1;

  return (
    <section className="space-y-5" aria-labelledby="role-match-results-heading">
      <div dir="rtl" className="flex items-center justify-start gap-2 text-right">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary" aria-hidden>
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-widest text-primary uppercase">תוצאות</p>
          <h2 id="role-match-results-heading" className="text-xl font-bold text-foreground">
            {roles.length} תפקידים מותאמים לפרופיל שלכם
          </h2>
          <p className="mt-1 text-[11px] text-dust/70">לכל תפקיד תמונה שונה · קרדיט לצלם/מקור בתחתית התמונה</p>
        </div>
      </div>

      {locked.map((r, i) => (
        <LockedRoleCard key={`locked-${r.rank}`} role={r} featured={i === 0} busy={busy} onUnlock={unlock} />
      ))}

      {top && topPhoto ? <RoleCard role={top} rank={1} photo={topPhoto} featured /> : null}

      {rest.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((r, i) =>
            r ? (
              <RoleCard key={`${r.roleTitle}-${i}`} role={r} rank={firstOpenRank + i + (locked.length ? 0 : 1)} photo={restPhotos[i]!} />
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  );
}
