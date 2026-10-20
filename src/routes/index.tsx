import { createFileRoute, Link } from "@tanstack/react-router";
import { TONES, type Tone } from "@/lib/tones";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  ChevronDown,
  ChevronLeft,
  Target,
  Lock,
  Shield,
  MessageSquareText,
  Gauge,
  Info,
  CreditCard,
  RotateCcw,
  Layers,
  Users,
  Clock3,
} from "lucide-react";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { StatStrip } from "@/components/StatStrip";
import { Reveal } from "@/components/Reveal";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { getIdfPhoto } from "@/lib/idf-images";
import { getDashboardStats, getPaymentOffer } from "@/lib/api";
import { getToken, subscribeAuth } from "@/lib/auth";
import { formatPaymentPrice, salePercentOff } from "@/lib/payment-offer";
import { authedEntryHref } from "@/lib/profile-resume";
import { SITE_NAME_HE } from "@/lib/brand";

const HOME_TITLE = "לאיזה תפקיד בצה״ל אתם מתאימים? שאלון התאמה לפי דפ״ר ופרופיל | קח כיוון";
const HOME_DESCRIPTION =
  "שאלון אישי אחד מצליב דפ״ר, פרופיל רפואי וציוני מא״ה מול יותר מ־300 תפקידים בצה״ל, ומחזיר 5 התאמות עם הסבר וסיכויי קבלה. 2 התאמות בחינם, ושלוש החזקות ביותר בתשלום חד־פעמי.";

/** Plain-text answers: rendered on the page and in the FAQPage JSON-LD, so both say the same thing. */
const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "מה זה קח כיוון?",
    a: "כלי עזר שמתאים תפקידים בצה״ל לפי הנתונים שלכם. שאלון אישי מצליב דפ״ר, פרופיל רפואי, ציוני מא״ה ומה שחשוב לכם בשירות מול יותר מ־300 תפקידים, ומחזיר 5 התאמות מדורגות עם הסבר וסיכויי קבלה לכל אחת.",
  },
  {
    q: "כמה זמן לוקח השאלון, וצריך להירשם?",
    a: "כ־8 דקות. מתחילים את השאלון בלי הרשמה. בסוף מאמתים כתובת אימייל בקוד חד־פעמי, בלי סיסמה, וכך ההתאמות נשמרות ומוצגות לכם.",
  },
  {
    q: "מה בחינם ומה בתשלום?",
    a: "השאלון ומקומות 5 ו־4 בחינם, כולל הסבר וסיכויי קבלה. שלוש ההתאמות החזקות ביותר, מקומות 3, 2 ו־1, נפתחות בתשלום חד־פעמי, בלי מנוי. רואים את מקומות 5 ו־4 לפני שמחליטים.",
  },
  {
    q: "עוד אין לי דפ״ר או ציוני מא״ה. אפשר להתחיל?",
    a: "כן. בדפ״ר ובפרופיל הרפואי אפשר לבחור ״לא יודע/ת כרגע״, ואת ציוני המא״ה אפשר להעריך בעצמכם או לדלג ולהוסיף אחר כך. בלי דפ״ר ופרופיל ההתאמה פחות מדויקת, ואי אפשר להעריך סיכויי קבלה.",
  },
  {
    q: "זה שירות רשמי של צה״ל? ההמלצות מחייבות?",
    a: "לא. קח כיוון הוא כלי עזר לא רשמי ואינו קשור לצה״ל. ההתאמות הן הכוונה בלבד, לא אישור זכאות ולא הבטחת שיבוץ. את הדרישות כדאי תמיד לאמת מול אתר מתגייסים ולשכת הגיוס.",
  },
  {
    q: "אילו נתונים נשמרים עליי?",
    a: "האימייל שאיתו נכנסים, הנתונים שמילאתם בשאלון (דפ״ר, פרופיל רפואי, ציוני מא״ה והעדפות) וההתאמות שקיבלתם. לא מבקשים תעודת זהות או מסמכים רפואיים, לא מוכרים את המידע למפרסמים, ואפשר למחוק את החשבון ואת הנתונים בעצמכם בדשבורד.",
  },
];

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESCRIPTION },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://kachkivun.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "קח כיוון",
              url: "https://kachkivun.com/",
              logo: "https://kachkivun.com/favicon.png",
              email: "support@kachkivun.com",
            },
            {
              "@type": "WebSite",
              name: "קח כיוון",
              url: "https://kachkivun.com/",
              inLanguage: "he-IL",
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQ.map(({ q, a }) => ({
                "@type": "Question",
                name: q,
                acceptedAnswer: { "@type": "Answer", text: a },
              })),
            },
          ],
        }),
      },
    ],
  }),
});

const CTA_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[15px] font-bold text-primary-foreground transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] sm:min-h-12 sm:px-7 sm:py-3 sm:text-base";

/** The one primary action on the page; signed-in visitors go where their profile left off. */
function HomePrimaryCta({ className = CTA_CLASS }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [to, setTo] = useState("/post-signup");
  const [label, setLabel] = useState("קבלו 2 התאמות בחינם");

  useEffect(() => {
    setMounted(true);
    setToken(getToken());
    // The page no longer waits for the session refresh, so pick up a login that lands later.
    return subscribeAuth(() => setToken(getToken()));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) return;
    let cancelled = false;
    getDashboardStats()
      .then((d) => {
        if (cancelled) return;
        const dest = authedEntryHref(d);
        setTo(dest);
        if (dest === "/dashboard") setLabel("לדשבורד שלי");
        else if (dest === "/onboarding") setLabel("השלימו פרופיל");
        else setLabel("המשיכו בהרשמה");
      })
      .catch(() => {
        if (!cancelled) {
          setTo("/post-signup");
          setLabel("המשיכו בהרשמה");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, token]);

  return (
    <Link to={to} className={className}>
      {label}
      <ChevronLeft className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function HomePage() {
  const { data: offer } = useQuery({
    queryKey: ["payment-offer"],
    queryFn: getPaymentOffer,
    staleTime: 60_000,
    retry: 1,
  });
  const paywallEnabled = offer?.enabled === true;
  const betaOpen = offer?.enabled === false;
  const price = offer ? formatPaymentPrice(offer.product) : "";
  const listPrice =
    offer && offer.product.listAmountMinor && salePercentOff(offer.product) > 0
      ? formatPaymentPrice({ ...offer.product, amountMinor: offer.product.listAmountMinor })
      : "";

  return (
    <div className="topo-lines">
      {/* ── 1. Hero: what it is + the primary action ── */}
      <section className="relative min-h-[calc(100dvh-3.5rem)]">
        {/* Mobile background slideshow */}
        <div className="absolute inset-0 lg:hidden">
          <HeroSlideshow className="h-full w-full" controls={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/45" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl items-stretch px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:min-h-[calc(100vh-3.5rem)]">
          {/* CSS entrance, not framer: it runs from the first paint, before hydration. */}
          <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center py-10 lg:min-h-0 lg:py-24">
            <p
              className="animate-slide-up mb-4 font-mono text-xs tracking-wide text-dust uppercase sm:mb-6"
              style={{ animationDelay: "100ms" }}
            >
              התאמת תפקידים בצה״ל, לפי הנתונים שלכם
            </p>

            {/* Headline, intro and CTA are static: they are the first paint and the LCP, so no fade-in. */}
            <h1 className="text-[2.5rem] font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              לאיזה תפקיד בצה״ל
              <br />
              <span className="text-primary">אתם מתאימים?</span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-[1.7] text-foreground/85">
              שאלון אישי אחד מצליב דפ״ר, פרופיל רפואי ו־11 ציוני מא״ה מול יותר מ־300 תפקידים, ומחזיר
              5 התאמות עם הסבר וסיכויי קבלה.
            </p>

            <div className="mt-8 flex flex-col items-start gap-3">
              <HomePrimaryCta />
              <p className="flex items-start gap-1.5 text-xs leading-5 text-dust">
                <Lock className="mt-1 h-3 w-3 shrink-0" aria-hidden />
                {paywallEnabled
                  ? `השאלון ו־2 התאמות בחינם. שלוש החזקות ביותר ב־${price}, תשלום חד־פעמי בלי מנוי.`
                  : betaOpen
                    ? "בתקופת הבטא כל חמש ההתאמות פתוחות; בסוף השאלון מאמתים אימייל כדי לשמור ולראות אותן."
                    : "מתחילים את השאלון בלי הרשמה; בסוף מאמתים אימייל כדי לשמור ולראות את ההתאמות."}
              </p>
            </div>

            <div className="animate-slide-up mt-10 sm:mt-12" style={{ animationDelay: "300ms" }}>
              <StatStrip
                className="grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
                stats={[
                  { value: 300, plus: true, label: "תפקידים", tone: "sand", icon: Layers },
                  { value: 11, label: "ציוני מא״ה", tone: "steel", icon: Gauge },
                  // ponytail: hand-set floor (253 users on 2026-10-17); bump it, or serve a live count if it should track
                  { value: 250, plus: true, label: "משתמשים", tone: "olive", icon: Users },
                  { value: 8, label: "דקות שאלון", tone: "rust", icon: Clock3 },
                ]}
              />
            </div>
          </div>

          {/* Slideshow, left side in RTL */}
          <div
            className="animate-scale-in relative hidden min-h-[420px] lg:block lg:min-h-0"
            style={{ animationDelay: "150ms" }}
          >
            <div className="absolute inset-y-0 left-0 right-6">
              <HeroSlideshow className="h-full min-h-[420px] rounded-sm border border-iron/25" />
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── 2. What you get ── */}
      <section className="py-14 sm:py-24" aria-labelledby="get-heading">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[3fr_2fr] lg:gap-20">
          <div className="text-right">
            <SectionHead
              tone="steel"
              eyebrow="מה מקבלים"
              id="get-heading"
              title="5 תפקידים, מדורגים בשבילכם"
            />
            <ul className="mt-8 grid gap-px bg-iron/20 sm:grid-cols-3 lg:grid-cols-1">
              <Feature
                icon={<Target className="h-5 w-5" />}
                title="התאמה אישית"
                desc="חמישה תפקידים מתוך יותר מ־300, מדורגים ממקום 5 עד מקום 1 לפי הנתונים וההעדפות שלכם."
              />
              <Feature
                tone="steel"
                icon={<MessageSquareText className="h-5 w-5" />}
                title="הסבר לכל התאמה"
                desc="למה התפקיד מתאים דווקא לכם, ומה עושים בו ביום־יום."
              />
              <Feature
                tone="sand"
                icon={<Gauge className="h-5 w-5" />}
                title="סיכויי קבלה"
                desc="הערכה של הסיכוי להתקבל לכל תפקיד, עם הסיבה."
              />
            </ul>
          </div>
          <div className="relative hidden aspect-[4/5] overflow-hidden rounded-sm border border-iron/25 lg:block">
            <IdfPhotoPanel
              photo={getIdfPhoto("s8")}
              aspectClassName="h-full min-h-0"
              overlayClassName="from-background/20 via-transparent to-background/60"
              imgClassName="object-[center_40%]"
              loading="lazy"
              fetchPriority="auto"
            />
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── 2b. What a result looks like (illustrative; role fields from the real catalog) ── */}
      <SampleResult />

      <div className="section-divider" />

      {/* ── 3. How it works ── */}
      <section id="how" className="scroll-mt-16 py-14 sm:py-24" aria-labelledby="how-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead
            tone="olive"
            eyebrow="איך זה עובד"
            id="how-heading"
            title="שלושה צעדים, תשובה אישית"
          />
          <ol className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
            <Step
              tone="olive"
              num="01"
              title="מתחילים בשאלון"
              desc="בלי הרשמה, ישר לשאלון האישי. כ־8 דקות."
            />
            <Step
              tone="steel"
              num="02"
              title="ממלאים את הנתונים"
              desc="דפ״ר, פרופיל רפואי, ציוני מא״ה ומה חשוב לכם בשירות."
            />
            <Step
              tone="rust"
              num="03"
              title="מאמתים אימייל ומקבלים 5 התאמות"
              desc="קוד חד־פעמי לאימייל שומר את התוצאות. ההתאמות מדורגות, עם הסבר וסיכויי קבלה לכל תפקיד."
            />
          </ol>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── 4. Free vs paid, said plainly ── */}
      <section className="py-14 sm:py-24" aria-labelledby="price-heading">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHead
            tone="rust"
            eyebrow="מה בחינם ומה בתשלום"
            id="price-heading"
            title={betaOpen ? "בתקופת הבטא הכול פתוח" : "2 התאמות בחינם, 3 החזקות בתשלום חד־פעמי"}
          />
          <ul className="mt-8 border border-iron/30 bg-card">
            <PriceRow
              title="השאלון האישי"
              note="מתחילים בלי הרשמה, ובסוף מאמתים אימייל כדי לשמור את ההתאמות"
              value="בחינם"
              free
            />
            <PriceRow title="מקומות 5 ו־4" note="כולל הסבר וסיכויי קבלה" value="בחינם" free />
            <PriceRow
              title="מקומות 3, 2 ו־1"
              note={
                betaOpen
                  ? "ההתאמות החזקות ביותר, פתוחות בתקופת הבטא"
                  : "ההתאמות החזקות ביותר. תשלום אחד, בלי מנוי, כולל מע״מ ככל שחל"
              }
              value={betaOpen ? "בחינם" : paywallEnabled ? price : "חד־פעמי"}
              listValue={paywallEnabled ? listPrice : ""}
              free={betaOpen}
            />
          </ul>
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <HomePrimaryCta />
            <p className="text-xs text-dust">
              רואים את מקומות 5 ו־4 לפני שמחליטים אם לפתוח את השאר.
            </p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── 5. Trust ── */}
      <section className="py-14 sm:py-24" aria-labelledby="trust-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead
            tone="steel"
            eyebrow="שקיפות"
            id="trust-heading"
            title="כדאי לדעת לפני שמתחילים"
          />
          <ul className="mt-8 grid gap-px bg-iron/20 sm:grid-cols-2">
            <Feature
              tone="sand"
              icon={<Info className="h-5 w-5" />}
              title="לא רשמי, ולא מטעם צה״ל"
              desc={`${SITE_NAME_HE} הוא כלי עזר לא רשמי ואינו קשור לצה״ל. ההתאמה אינה אישור זכאות או הבטחת שיבוץ.`}
            />
            {!betaOpen && (
              <Feature
                tone="steel"
                icon={<CreditCard className="h-5 w-5" />}
                title="תשלום מאובטח"
                desc="התשלום מתבצע בעמוד המאובטח של Grow. פרטי האשראי לא עוברים אלינו."
              />
            )}
            {!betaOpen && (
              <Feature
                tone="rust"
                icon={<RotateCcw className="h-5 w-5" />}
                title="ביטול והחזר"
                desc={
                  <>
                    אפשר לבקש ביטול של הרכישה החד־פעמית בעמוד{" "}
                    <Link to="/cancellation" className="font-semibold text-primary hover:underline">
                      ביטול עסקה והחזרים
                    </Link>
                    . הזכאות להחזר כפופה לדין ולנסיבות העסקה.
                  </>
                }
              />
            )}
            <Feature
              icon={<Shield className="h-5 w-5" />}
              title="המידע שלכם"
              desc="כניסה בקוד חד־פעמי לאימייל, בלי סיסמה. לא מוכרים את המידע ולא מעבירים למפרסמים, ואפשר לבקש למחוק אותו."
            />
          </ul>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── 5b. FAQ (same text as the FAQPage JSON-LD in head) ── */}
      <section className="py-14 sm:py-24" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHead
            tone="sand"
            eyebrow="שאלות נפוצות"
            id="faq-heading"
            title="מה שואלים לפני שמתחילים"
          />
          <div className="mt-8 border border-iron/30 bg-card">
            {FAQ.map(({ q, a }, i) => (
              <details key={q} className="group border-b border-iron/25 last:border-b-0">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 p-4 text-right text-base font-bold text-foreground sm:p-5 [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-dust transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-dust sm:px-5 sm:pb-5">
                  {i === 2 && betaOpen
                    ? "בתקופת הבטא כל חמש ההתאמות פתוחות בחינם. בהמשך מקומות 3, 2 ו־1 ייפתחו בתשלום חד־פעמי, בלי מנוי."
                    : a}
                  {i === 2 && paywallEnabled && price ? ` המחיר כרגע: ${price}.` : ""}
                  {i === 5 ? (
                    <>
                      {" "}
                      <Link to="/privacy" className="font-semibold text-primary hover:underline">
                        מדיניות הפרטיות
                      </Link>
                    </>
                  ) : null}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── 6. Closing CTA ── */}
      <section className="py-14 sm:py-24">
        <Reveal className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12">
          <div className="order-2 hidden overflow-hidden rounded-sm border border-iron/30 sm:block lg:order-1">
            <IdfPhotoPanel
              photo={getIdfPhoto("s4")}
              aspectClassName="aspect-[16/10] min-h-[220px]"
              overlayClassName="from-background/50 via-transparent to-transparent"
              loading="lazy"
              fetchPriority="auto"
            />
          </div>
          <div className="order-1 max-w-xl text-right lg:order-2">
            <h2 className="text-3xl font-bold sm:text-4xl">
              השירות שלכם, <span className="text-primary">בראש שקט.</span>
            </h2>
            <p className="mt-4 text-base text-dust">שאלון אחד, 5 התאמות, והסבר ברור לכל אחת.</p>
            <div className="mt-8">
              <HomePrimaryCta />
            </div>
          </div>
        </Reveal>
      </section>

      <div className="section-divider" />

      {/* ── 7. Extras: the free tools, one quiet line (the footer lists them too) ── */}
      <section className="py-8 sm:py-10" aria-label="כלים חינמיים">
        <p className="mx-auto max-w-6xl px-4 text-center text-sm leading-7 text-dust sm:px-6">
          גם בחינם, לבדיקה מהירה:{" "}
          {EXTRAS.map(([to, label], i) => (
            <span key={to}>
              {i ? " · " : ""}
              <Link
                to={to}
                className="font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                {label}
              </Link>
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}

const EXTRAS = [
  ["/role-insights", "קטלוג התפקידים"],
  ["/role-calculator", "מחשבון תפקידים"],
  ["/attention-test", "תרגול מבחן קשב"],
  ["/blog", "מדריכים"],
] as const;

/* ── Sub-components ── */

/**
 * One result card, clearly marked as an example. Role fields are copied from the catalog entry
 * for מגן/ת סייבר (server/data/role-enrichment-v3.json, checked against mitgaisim.idf.il);
 * the personal parts are described, not invented.
 */
function SampleResult() {
  return (
    <section className="py-14 sm:py-24" aria-labelledby="sample-heading">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHead
          tone="sand"
          eyebrow="דוגמה להמחשה"
          id="sample-heading"
          title="ככה נראית התאמה"
        />
        <article className="mt-8 border border-iron/30 bg-card text-right">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-iron/25 p-4 sm:p-5">
            <div>
              <p className="font-mono text-xs text-steel">מקום 4 · סייבר</p>
              <h3 className="mt-1 text-xl font-bold text-foreground">
                <Link
                  to="/roles/$slug"
                  params={{ slug: "מגן-ת-סייבר" }}
                  className="hover:text-primary"
                >
                  מגן/ת סייבר
                </Link>
              </h3>
            </div>
            <span className="rounded-sm border border-iron/40 px-2 py-1 text-xs text-dust">
              דוגמה להמחשה, לא תוצאה אמיתית
            </span>
          </header>
          <dl className="grid gap-4 p-4 text-sm leading-relaxed sm:p-5">
            <SampleField label="מה עושים ביום־יום">
              מאתרים, מנתחים ומטפלים באיומי סייבר בזמן אמת, ומבצעים חקירת עומק ופורנזיקה דיגיטלית
              לזיהוי מקור התקיפה והיקפה.
            </SampleField>
            <SampleField label="דרישות">
              דפ״ר 70 ומעלה · סיווג ביטחוני · לא נדרש ידע מוקדם, רק חשיבה לוגית
            </SampleField>
            <SampleField label="משך והכשרה">שירות חובה מלא; קורס כ־19 שבועות בבסמ״ח</SampleField>
            <SampleField label="למה זה מתאים לכם">
              בתוצאה שלכם: הסבר אישי לפי הנתונים וההעדפות שמילאתם.
            </SampleField>
            <SampleField label="סיכויי קבלה">
              בתוצאה שלכם: גבוה, בינוני או נמוך, עם הסיבה. בתפקיד הזה למשל המיון תחרותי מאוד, ומשקל
              גדול יש לפער בין הדפ״ר שלכם לסף.
            </SampleField>
          </dl>
        </article>
      </div>
    </section>
  );
}

function SampleField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-bold text-foreground">{label}</dt>
      <dd className="mt-0.5 text-dust">{children}</dd>
    </div>
  );
}

function SectionHead({
  eyebrow,
  id,
  title,
  tone,
}: {
  eyebrow: string;
  id: string;
  title: string;
  tone: Tone;
}) {
  return (
    <Reveal margin="-60px" className="max-w-xl text-right">
      <p className={`mb-3 font-mono text-xs tracking-wide uppercase ${TONES[tone].text}`}>
        {eyebrow}
      </p>
      <h2 id={id} className="text-3xl font-bold leading-tight sm:text-4xl">
        {title}
      </h2>
    </Reveal>
  );
}

function Feature({
  icon,
  title,
  desc,
  tone = "olive",
}: {
  icon: React.ReactNode;
  title: string;
  desc: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <li className="flex gap-4 bg-card p-5 text-right sm:p-6">
      <div
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${TONES[tone].icon}`}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-dust">{desc}</p>
      </div>
    </li>
  );
}

function Step({
  num,
  title,
  desc,
  tone,
}: {
  num: string;
  title: string;
  desc: string;
  tone: Tone;
}) {
  return (
    <li className={`border-t-2 pt-4 text-right ${TONES[tone].soft}`}>
      <p className={`mb-1 font-mono text-3xl font-black ${TONES[tone].text}`}>{num}</p>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-dust">{desc}</p>
    </li>
  );
}

function PriceRow({
  title,
  note,
  value,
  listValue = "",
  free = false,
}: {
  title: string;
  note: string;
  value: string;
  listValue?: string;
  free?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-iron/25 p-4 last:border-b-0 sm:p-5">
      <div className="min-w-0 text-right">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-dust">{note}</p>
      </div>
      <p className="flex shrink-0 items-baseline gap-2">
        {listValue && (
          <span className="text-xs text-dust line-through">
            <span className="sr-only">במקום </span>
            {listValue}
          </span>
        )}
        <span
          className={
            free
              ? "rounded-sm bg-primary/15 px-2 py-1 text-sm font-bold text-primary"
              : "font-mono text-lg font-bold text-foreground"
          }
        >
          {value}
        </span>
      </p>
    </li>
  );
}
