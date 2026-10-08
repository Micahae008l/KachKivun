import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { ChevronLeft, BarChart3, Brain, Target, Lock, Shield, ArrowUpLeft } from "lucide-react";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { getIdfPhoto, idfPhotoAt, type IdfPhoto } from "@/lib/idf-images";
import { getDashboardStats, getPaymentOffer } from "@/lib/api";
import { getToken, subscribeAuth } from "@/lib/auth";
import { formatPaymentPrice } from "@/lib/payment-offer";
import { authedEntryHref } from "@/lib/profile-resume";
import { SITE_NAME_HE } from "@/lib/brand";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const ease = [0.16, 1, 0.3, 1] as const;
function HomePrimaryCta({ className }: { className: string }) {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [to, setTo] = useState("/post-signup");
  const [label, setLabel] = useState("בדקו התאמה בחינם");

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
      <ChevronLeft className="h-4 w-4" />
      {label}
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

  return (
    <div className="topo-lines">
      {/* ── Hero: asymmetric 5/7 split ── */}
      <section className="relative min-h-[calc(100dvh-3.5rem)]">
        {/* Mobile background slideshow */}
        <div className="absolute inset-0 lg:hidden">
          <HeroSlideshow className="h-full w-full" controls={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl items-stretch px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:min-h-[calc(100vh-3.5rem)]">
          {/* Text column, right side in RTL */}
          {/* CSS entrance, not framer: it runs from the first paint, before hydration. */}
          <div className="flex flex-col justify-center py-16 lg:py-24">
            <p
              className="animate-slide-up font-mono text-xs tracking-widest text-dust uppercase mb-6"
              style={{ animationDelay: "100ms" }}
            >
              פלטפורמת הכנה לשירות צה״ל
            </p>

            <h1
              className="animate-slide-up text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]"
              style={{ animationDelay: "150ms" }}
            >
              שירות מתחיל
              <br />
              <span className="text-primary">בתכנון.</span>
            </h1>

            <p
              className="animate-slide-up mt-6 max-w-md text-base leading-[1.7] text-dust"
              style={{ animationDelay: "200ms" }}
            >
              שאלון אישי אחד, וחמשת התפקידים שהכי מתאימים לכם, עם הסבר למה.
            </p>

            <div
              className="animate-slide-up mt-10 flex flex-col gap-3"
              style={{ animationDelay: "250ms" }}
            >
              <div className="flex items-center gap-4">
                <HomePrimaryCta className="inline-flex items-center gap-2 rounded-md bg-primary px-7 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 active:scale-[0.97]" />
                <Link
                  to="/about"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-dust transition hover:text-foreground"
                >
                  איך זה עובד
                  <ArrowUpLeft className="h-3.5 w-3.5" />
                </Link>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-dust/70">
                <Lock className="h-3 w-3" />
                {paywallEnabled
                  ? "מתחילים מיד בלי הרשמה. המחיר כולל מע״מ ככל שחל; חשבון נדרש לשמירת התוצאות."
                  : betaOpen
                    ? "בתקופת הבטא כל חמש ההתאמות פתוחות; חשבון נדרש לשמירת התוצאות."
                    : "מתחילים מיד בלי הרשמה; חשבון נדרש לשמירת התוצאות."}
              </p>
            </div>

            <div
              className="animate-slide-up mt-12 flex gap-6 sm:mt-16 sm:gap-10"
              style={{ animationDelay: "300ms" }}
            >
              <DataPoint value="+300" label="תפקידים ומסלולים" />
              <DataPoint value="11" label="ממדי מא״ה" />
              <DataPoint value="5" label="התאמות אישיות" />
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

      {/* ── Capabilities, staggered asymmetric cards ── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, ease }}
            className="mb-14 max-w-xl text-right"
          >
            <p className="font-mono text-xs tracking-widest text-primary uppercase mb-3">כלים</p>
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">שלושה כלים, מסך אחד</h2>
            <p className="mt-3 text-base text-dust leading-relaxed">
              כל מה שצריך כדי להתכונן לשירות, מרוכז ונגיש.
            </p>
          </motion.div>

          <div className="grid gap-px bg-iron/20 grid-cols-1 sm:grid-cols-3">
            <CapabilityCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="מעקב נתונים"
              description="דפ״ר, פרופיל רפואי, ויום המאה. הכל במסך אחד עם ספירה לאחור חיה."
              photo={idfPhotoAt(0)}
              idx={0}
            />
            <CapabilityCard
              icon={<Target className="h-5 w-5" />}
              title="התאמת תפקיד"
              description="מנוע התאמה שמצליב את הנתונים שלכם מול 300+ תפקידים ומסלולים בצה״ל, עם ספי דפ״ר ופרופיל רשמיים, ומציג ציון התאמה לכל אחד."
              photo={idfPhotoAt(1)}
              idx={1}
            />
            <CapabilityCard
              icon={<Brain className="h-5 w-5" />}
              title="יועץ AI אישי"
              description="יועץ מבוסס AI שמנתח את הפרופיל שלכם ונותן המלצות מותאמות אישית."
              photo={idfPhotoAt(2)}
              idx={2}
            />
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Evidence: photo + text, offset grid ── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[2fr_3fr] lg:gap-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative aspect-[4/3] overflow-hidden rounded-sm"
            >
              <IdfPhotoPanel
                photo={getIdfPhoto("s8")}
                aspectClassName="h-full min-h-0"
                overlayClassName="from-background/20 via-transparent to-background/60"
                imgClassName="object-[center_40%]"
                loading="lazy"
                fetchPriority="auto"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: 0.1, ease }}
              className="text-right"
            >
              <p className="font-mono text-xs tracking-widest text-olive uppercase mb-3">
                איך זה עובד
              </p>
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
                מהנתונים שלכם לתפקיד שמתאים
              </h2>
              <p className="mt-4 max-w-lg text-base leading-[1.7] text-dust">
                מילאתם דפ״ר, פרופיל רפואי, וציוני מא״ה. המערכת מצליבה את הנתונים מול מאגר התפקידים
                ומדרגת חמש המלצות.{" "}
                {paywallEnabled
                  ? `מקומות 5–3 מוצגים בחינם; מקומות 2 ו־1 נפתחים ב־${price} בתשלום חד־פעמי וללא מנוי.`
                  : betaOpen
                    ? "בתקופת הבטא כל חמש ההתאמות פתוחות בחינם."
                    : "פרטי הגישה לכל חמש ההתאמות יוצגו לפי מצב השירות."}
              </p>

              <div className="mt-10 grid grid-cols-1 gap-4 border-t border-iron/30 pt-8 sm:grid-cols-3 sm:gap-6">
                <StepBlock num="01" title="הרשמה" desc="חשבון חינמי תוך 3 דקות" idx={0} />
                <StepBlock num="02" title="נתונים" desc="דפ״ר, רפואי, מא״ה והעדפות" idx={1} />
                <StepBlock num="03" title="תובנות" desc="התאמה + המלצות AI" idx={2} />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Trust, horizontal bar ── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4 }}
            className="mb-10 text-center font-mono text-xs tracking-widest text-dust/60 uppercase"
          >
            למה לסמוך עלינו
          </motion.p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            <TrustBlock
              icon={<Lock className="h-5 w-5" />}
              title="כניסה בלי סיסמה"
              desc="נכנסים עם קוד חד־פעמי לאימייל, אז אין סיסמה שיכולה לדלוף. וכל התעבורה באתר מוצפנת."
              idx={0}
            />
            <TrustBlock
              icon={<Shield className="h-5 w-5" />}
              title="לא מוכרים את המידע"
              desc="לא מוכרים ולא מעבירים למפרסמים. המידע משמש רק כדי לבנות לכם התאמה, ואפשר לבקש למחוק אותו בכל רגע."
              idx={1}
            />
            <TrustBlock
              icon={<Target className="h-5 w-5" />}
              title={paywallEnabled ? "מחיר שקוף" : betaOpen ? "בטא פתוחה" : "גישה שקופה"}
              desc={
                paywallEnabled
                  ? `ההערכה ושלוש התאמות בחינם; מקומות 2 ו־1 ב־${price} סופיים כולל מע״מ ככל שחל, ללא מנוי.`
                  : betaOpen
                    ? "בתקופת הבטא ההערכה וכל חמש ההתאמות פתוחות בחינם."
                    : "פרטי הגישה מוצגים לפי מצב השירות בזמן אמת."
              }
              idx={2}
            />
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── CTA with photo ── */}
      <section className="pt-20 pb-6 sm:pt-28 sm:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease }}
          className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12"
        >
          <div className="order-2 lg:order-1 overflow-hidden rounded-sm border border-iron/30">
            <IdfPhotoPanel
              photo={getIdfPhoto("s4")}
              aspectClassName="aspect-[16/10] min-h-[220px]"
              overlayClassName="from-background/50 via-transparent to-transparent"
              loading="lazy"
              fetchPriority="auto"
            />
          </div>
          <div className="order-1 lg:order-2 max-w-xl text-right">
            <h2 className="text-3xl font-bold sm:text-4xl">
              השירות שלכם, <span className="text-primary">בראש שקט.</span>
            </h2>
            <p className="mt-4 text-base text-dust">
              {paywallEnabled
                ? `ההערכה ושלוש התאמות בחינם. פתיחת שתי המובילות ב־${price} סופיים כולל מע״מ ככל שחל, פעם אחת וללא מנוי.`
                : betaOpen
                  ? "בתקופת הבטא ההערכה וכל חמש ההתאמות פתוחות בחינם."
                  : "התחילו בהערכה האישית; פרטי הגישה יוצגו לפי מצב השירות."}
            </p>
            <HomePrimaryCta className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-7 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 active:scale-[0.97]" />
            <p className="mt-3 flex items-center gap-1.5 text-xs text-dust/70">
              <Lock className="h-3 w-3" />
              המלצות לא רשמיות — אין הבטחת זכאות, מיון או שיבוץ בצה״ל
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

/* ── Sub-components ── */

function DataPoint({ value, label }: { value: string; label: string }) {
  const num = parseInt(value.replace(/[^0-9]/g, ""), 10);
  const prefix = value.startsWith("+") ? "+" : "";
  const suffix = value.replace(/[+0-9]/g, "");
  const [display, setDisplay] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAnimated || !ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setHasAnimated(true);
        obs.disconnect();
        const duration = 800;
        const start = performance.now();
        function tick(now: number) {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(eased * num));
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [hasAnimated, num]);

  return (
    <div className="text-right" ref={ref}>
      <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
        {prefix}
        {display}
        {suffix}
      </p>
      <p className="mt-0.5 text-xs text-dust">{label}</p>
    </div>
  );
}

function CapabilityCard({
  icon,
  title,
  description,
  photo,
  idx,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  photo: IdfPhoto;
  idx: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden bg-card text-right transition-colors hover:bg-secondary"
    >
      <IdfPhotoPanel
        photo={photo}
        aspectClassName="aspect-[21/9]"
        overlayClassName="from-card via-background/10 to-transparent"
        showCredit={false}
        loading="lazy"
        fetchPriority="auto"
      />
      <div className="p-5 sm:p-8">
        <div className="text-primary mb-4">{icon}</div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-dust">{description}</p>
      </div>
    </motion.div>
  );
}

function StepBlock({
  num,
  title,
  desc,
  idx,
}: {
  num: string;
  title: string;
  desc: string;
  idx: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: 0.15 + idx * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="text-right"
    >
      <p className="font-mono text-xs font-bold text-primary mb-2">{num}</p>
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-dust leading-relaxed">{desc}</p>
    </motion.div>
  );
}

function TrustBlock({
  icon,
  title,
  desc,
  idx = 0,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  idx?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="group border border-iron/20 bg-card p-8 text-right transition-colors hover:border-primary/30"
    >
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
        {icon}
      </div>
      <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm leading-relaxed text-dust">{desc}</p>
    </motion.div>
  );
}
