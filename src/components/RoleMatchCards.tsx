import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Bot,
  Briefcase,
  ChevronDown,
  CircleHelp,
  Clock3,
  Cpu,
  Heart,
  ListChecks,
  Lock,
  MapPin,
  Shield,
  Sparkles,
  Users,
  Waves,
} from "lucide-react";
import { IdfPhotoCredit } from "@/components/IdfPhotoCredit";
import {
  roleInsightSlug,
  type LockedRoleMatch,
  type PaymentOffer,
  type RoleMatch,
  type UnlockedRoleMatch,
} from "@/lib/api";
import { pickRolePhoto, type IdfPhoto } from "@/lib/idf-photo-catalog";
import { ARIA, progressBarProps } from "@/lib/a11y";
import { trackEvent } from "@/lib/analytics";
import { formatPaymentPrice } from "@/lib/payment-offer";

function tagIcon(tag: string) {
  const normalized = tag.toLowerCase();
  if (/קרב|שטח|לוחם/.test(normalized)) return Shield;
  if (/טכנ|מחשב|סייבר|מערכות/.test(normalized)) return Cpu;
  if (/משרד|משא|מנהל/.test(normalized)) return Briefcase;
  if (/ים|חיל הים/.test(normalized)) return Waves;
  if (/אנוש|טיפול|רפוא|פסיכ/.test(normalized)) return Heart;
  if (/צוות|ליווי|הדרכה/.test(normalized)) return Users;
  if (/מיקום|נהיגה/.test(normalized)) return MapPin;
  return Sparkles;
}

const SCORE_FACTOR_LABELS: Record<keyof NonNullable<UnlockedRoleMatch["scoreBreakdown"]>, string> =
  {
    preference: "העדפות שירות",
    focus: "מיקוד מקצועי",
    yom: "מדדי מא״ה",
    eligibility: "מרווח זכאות",
    catalogQuality: "איכות נתוני המאגר",
    structuredAssessment: "השאלון המובנה",
  };

function ScoreBreakdownPanel({
  breakdown,
}: {
  breakdown: NonNullable<UnlockedRoleMatch["scoreBreakdown"]>;
}) {
  return (
    <section aria-label="פירוט גורמי הציון הדטרמיניסטי">
      <h4 className="text-sm font-bold text-foreground">פירוט גורמי הציון הדטרמיניסטי</h4>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {Object.entries(SCORE_FACTOR_LABELS).map(([key, label]) => {
          const value = Math.max(
            0,
            Math.min(100, Math.round(breakdown[key as keyof typeof breakdown])),
          );
          return (
            <li key={key}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-dust">{label}</span>
                <strong className="font-mono tabular-nums text-foreground">{value}%</strong>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-iron/20"
                {...progressBarProps(value, `${label}: ${value}%`)}
              >
                <div className="h-full bg-primary" style={{ width: `${value}%` }} aria-hidden />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MatchRing({ percentage }: { percentage: number }) {
  const value = Math.min(100, Math.max(0, Math.round(percentage)));
  const size = 72;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-iron/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="text-primary"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center font-mono tabular-nums"
        role="img"
        aria-label={ARIA.matchPct(value)}
      >
        <span className="text-lg font-black text-foreground">{value}</span>
        <span className="text-[9px] text-dust">%</span>
      </div>
    </div>
  );
}

function LockedRoleCard({ role }: { role: LockedRoleMatch }) {
  const headingId = useId();
  return (
    <article
      className="relative overflow-hidden border border-iron/30 bg-card p-6 text-right"
      dir="rtl"
      aria-labelledby={headingId}
    >
      <div className="pointer-events-none absolute inset-0 opacity-35" aria-hidden>
        <div className="absolute right-6 top-16 h-4 w-2/3 rounded-sm bg-iron/25 blur-[2px]" />
        <div className="absolute right-6 top-24 h-3 w-1/2 rounded-sm bg-iron/20 blur-[2px]" />
      </div>
      <div className="relative flex min-h-28 items-start justify-between gap-5">
        <div>
          <p className="font-mono text-xs font-bold text-primary">מקום {role.rank}</p>
          <h3
            id={headingId}
            className="mt-3 flex items-center gap-2 text-base font-black text-foreground"
          >
            <Lock className="h-4 w-4 text-dust" aria-hidden />
            ההתאמה נעולה
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-dust">
            שם התפקיד, ההסבר והנתונים אינם נשלחים לחשבון ללא הרשאה.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-iron/30 bg-background/50">
          <Lock className="h-5 w-5 text-dust" aria-hidden />
        </div>
      </div>
    </article>
  );
}

function UnlockedRoleCard({ role, photo }: { role: UnlockedRoleMatch; photo: IdfPhoto | null }) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const detailsId = useId();
  const knownServiceData =
    role.requirements.length > 0 || role.locations.length > 0 || Boolean(role.serviceLengthLabel);

  return (
    <article
      className="overflow-hidden border border-iron/30 bg-card text-right"
      dir="rtl"
      aria-labelledby={headingId}
    >
      <div className={photo ? "grid md:grid-cols-[180px_1fr]" : ""}>
        {photo ? (
          <div className="relative min-h-40 overflow-hidden">
            <img
              src={photo.src}
              alt={photo.alt}
              className="h-full w-full object-cover opacity-75"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/65 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent px-3 pb-2 pt-9">
              <IdfPhotoCredit photo={photo} />
            </div>
          </div>
        ) : null}

        <div className="space-y-5 p-5 sm:p-7">
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-bold text-primary">מקום {role.rank}</p>
              <h3 id={headingId} className="mt-1 text-xl font-black text-foreground">
                {role.roleTitle}
              </h3>
              {role.category ? (
                <p className="mt-1 text-xs text-dust">תחום: {role.category}</p>
              ) : null}
            </div>
            <MatchRing percentage={role.matchPercentage} />
          </header>

          <section aria-label="סיכום היועץ">
            <p className="mb-1 font-mono text-[10px] tracking-widest text-dust uppercase">
              סיכום AI
            </p>
            <p className="text-sm leading-6 text-foreground/95">
              {role.summary || "לא סופק תקציר נפרד להתאמה זו."}
            </p>
          </section>

          <section aria-label="גורמי התאמה">
            <p className="mb-2 font-mono text-[10px] tracking-widest text-dust uppercase">
              גורמי התאמה
            </p>
            {role.tags.length ? (
              <ul className="flex flex-wrap gap-2" aria-label="תגיות התאמה">
                {role.tags.map((tag) => {
                  const Icon = tagIcon(tag);
                  return (
                    <li
                      key={tag}
                      className="inline-flex items-center gap-1.5 border border-iron/25 bg-secondary/60 px-2.5 py-1 text-[11px] text-dust"
                    >
                      <Icon className="h-3 w-3 shrink-0 text-primary/80" aria-hidden />
                      {tag}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-dust">לא סופקו תגיות התאמה.</p>
            )}
          </section>

          {role.dayToDay ? (
            <section className="border-r-2 border-primary/45 pr-3" aria-label="יום בתפקיד">
              <div className="mb-1 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" aria-hidden />
                <h4 className="text-sm font-bold text-foreground">מה עושים ביום־יום</h4>
              </div>
              <p className="text-sm leading-6 text-dust">{role.dayToDay}</p>
            </section>
          ) : (
            <p className="text-xs text-dust">לא הועבר מידע מובנה על שגרת היום־יום.</p>
          )}

          <div>
            <button
              type="button"
              onClick={() => {
                if (!expanded && role.rank >= 3 && role.rank <= 5) {
                  trackEvent("free_role_expanded", { rank: role.rank as 3 | 4 | 5 });
                }
                setExpanded((value) => !value);
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-primary/35 px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
              aria-expanded={expanded}
              aria-controls={detailsId}
            >
              {expanded ? "הסתרת פירוט היועץ" : "פתיחת כל פירוט היועץ"}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            {expanded ? (
              <div id={detailsId} className="mt-4 space-y-5 border-t border-iron/20 pt-5">
                {role.scoreBreakdown ? (
                  <ScoreBreakdownPanel breakdown={role.scoreBreakdown} />
                ) : null}

                <section aria-labelledby={`${detailsId}-explanation`}>
                  <div className="mb-2 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" aria-hidden />
                    <h4
                      id={`${detailsId}-explanation`}
                      className="text-sm font-bold text-foreground"
                    >
                      הסבר ההתאמה
                    </h4>
                  </div>
                  <p className="text-sm leading-6 text-dust">
                    {role.description || "לא סופק הסבר נוסף מעבר לתקציר."}
                  </p>
                </section>

                <section aria-labelledby={`${detailsId}-service`}>
                  <div className="mb-2 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" aria-hidden />
                    <h4 id={`${detailsId}-service`} className="text-sm font-bold text-foreground">
                      דרישות ונתוני שירות ידועים
                    </h4>
                  </div>
                  {knownServiceData ? (
                    <dl className="space-y-3 text-sm">
                      {role.requirements.length ? (
                        <div>
                          <dt className="font-semibold text-foreground">דרישות שידועות במאגר</dt>
                          <dd>
                            <ul className="mt-1 list-disc space-y-1 pr-5 text-dust">
                              {role.requirements.map((requirement) => (
                                <li key={requirement}>{requirement}</li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                      {role.serviceLengthLabel ? (
                        <div className="flex items-start gap-2">
                          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                          <div>
                            <dt className="font-semibold text-foreground">משך שירות</dt>
                            <dd className="text-dust">{role.serviceLengthLabel}</dd>
                          </div>
                        </div>
                      ) : null}
                      {role.locations.length ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                          <div>
                            <dt className="font-semibold text-foreground">מיקומים שידועים במאגר</dt>
                            <dd className="text-dust">{role.locations.join(" · ")}</dd>
                          </div>
                        </div>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-sm leading-6 text-dust">
                      לא הועברו נתוני דרישות, מיקום או משך שירות מאומתים לתפקיד זה.
                    </p>
                  )}
                </section>

                <section aria-labelledby={`${detailsId}-questions`}>
                  <div className="mb-2 flex items-center gap-2">
                    <CircleHelp className="h-4 w-4 text-primary" aria-hidden />
                    <h4 id={`${detailsId}-questions`} className="text-sm font-bold text-foreground">
                      שאלות מומלצות להמשך בירור
                    </h4>
                  </div>
                  {role.nextStepPrompts.length ? (
                    <ul className="space-y-2">
                      {role.nextStepPrompts.map((prompt) => (
                        <li
                          key={prompt}
                          className="border border-iron/25 bg-background/35 px-3 py-2 text-sm leading-6 text-dust"
                        >
                          {prompt}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-dust">לא סופקו שאלות המשך לתפקיד זה.</p>
                  )}
                </section>
              </div>
            ) : null}
          </div>

          <p className="border-t border-iron/20 pt-4 text-xs leading-5 text-dust">
            ההתאמה אינה אישור זכאות או הבטחת שיבוץ. תנאי הסף, המיונים והנתונים העדכניים נקבעים רק על
            ידי צה״ל ויש לאמת אותם בערוצים הרשמיים.
          </p>

          <Link
            to="/role-insights"
            search={{ role: roleInsightSlug(role.roleTitle) }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            מידע כללי נוסף על התפקיד (אופציונלי)
          </Link>
        </div>
      </div>
    </article>
  );
}

function PaywallCta({ offer }: { offer: PaymentOffer | null | undefined }) {
  useEffect(() => {
    if (offer?.enabled) trackEvent("paywall_viewed");
  }, [offer?.enabled]);

  if (!offer?.enabled) {
    return (
      <aside className="border border-iron/35 bg-card p-6 text-center sm:p-8" dir="rtl">
        <Lock className="mx-auto h-6 w-6 text-dust" aria-hidden />
        <h3 className="mt-3 text-lg font-black text-foreground">
          לא ניתן לפתוח את שתי ההתאמות כרגע
        </h3>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-dust">
          הקופה אינה זמינה, ולכן לא מוצג כאן מחיר או קישור חיוב.
        </p>
      </aside>
    );
  }

  const price = formatPaymentPrice(offer.product);

  return (
    <aside
      className="border border-primary/45 bg-primary/10 p-6 text-center sm:p-8"
      aria-labelledby="top-two-paywall-heading"
      dir="rtl"
    >
      <Lock className="mx-auto h-6 w-6 text-primary" aria-hidden />
      <h3 id="top-two-paywall-heading" className="mt-3 text-lg font-black text-foreground">
        שתי ההתאמות המובילות נשארו
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-dust">
        שלוש ההתאמות שכבר הוצגו נשארות בחינם. {price} סופיים, כולל מע״מ ככל שחל, פותחים את מקומות 2
        ו־1 לצמיתות בחשבון וגם בחישובים מחדש בעתיד. אין מנוי.
      </p>
      <Link
        to="/checkout"
        className="mt-5 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-black text-primary-foreground transition hover:brightness-110"
      >
        פתיחת מקומות 2 ו־1 ב־{price} פעם אחת, ללא מנוי
      </Link>
    </aside>
  );
}

export function RoleMatchCards({
  roles,
  offer,
}: {
  roles: RoleMatch[];
  offer?: PaymentOffer | null;
}) {
  const topRolesTracked = useRef(false);
  const ordered = useMemo(() => [...roles].sort((left, right) => right.rank - left.rank), [roles]);
  const photos = useMemo(() => {
    const used = new Set<string>();
    return new Map(
      ordered
        .filter((role): role is UnlockedRoleMatch => role.kind === "role")
        .map((role) => [role.rank, pickRolePhoto(role.tags, role.roleTitle, role.rank, used)]),
    );
  }, [ordered]);

  useEffect(() => {
    if (
      !topRolesTracked.current &&
      ordered.some((role) => role.kind === "role" && (role.rank === 1 || role.rank === 2))
    ) {
      topRolesTracked.current = true;
      trackEvent("unlocked_top_roles_viewed");
    }
  }, [ordered]);

  if (!ordered.length) return null;

  const firstLockedIndex = ordered.findIndex((role) => role.kind === "locked");
  const unlockedBeforePaywall =
    firstLockedIndex >= 0 ? ordered.slice(0, firstLockedIndex) : ordered;
  const lockedAfterPaywall = firstLockedIndex >= 0 ? ordered.slice(firstLockedIndex) : [];

  return (
    <section className="space-y-5" aria-labelledby="role-match-results-heading" dir="rtl">
      <header className="flex items-center gap-3 text-right">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 text-primary"
          aria-hidden
        >
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-widest text-primary uppercase">תוצאות</p>
          <h2 id="role-match-results-heading" className="text-xl font-black text-foreground">
            חמש ההתאמות, ממקום 5 עד מקום 1
          </h2>
          <p className="mt-1 text-xs leading-5 text-dust">
            אין השהיות חשיפה: כל תוצאה זמינה מוצגת מיד.
          </p>
        </div>
      </header>

      <ol reversed start={5} className="space-y-4 [list-style:none]">
        {unlockedBeforePaywall.map((role) => (
          <li key={`${role.kind}-${role.rank}`} value={role.rank}>
            {role.kind === "role" ? (
              <UnlockedRoleCard role={role} photo={photos.get(role.rank) ?? null} />
            ) : (
              <LockedRoleCard role={role} />
            )}
          </li>
        ))}
      </ol>

      {lockedAfterPaywall.length ? <PaywallCta offer={offer} /> : null}

      {lockedAfterPaywall.length ? (
        <ol reversed start={2} className="grid gap-4 [list-style:none] sm:grid-cols-2">
          {lockedAfterPaywall.map((role) => (
            <li key={`${role.kind}-${role.rank}`} value={role.rank}>
              {role.kind === "locked" ? (
                <LockedRoleCard role={role} />
              ) : (
                <UnlockedRoleCard role={role} photo={photos.get(role.rank) ?? null} />
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
