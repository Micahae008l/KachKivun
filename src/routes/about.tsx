import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpLeft,
  ChevronRight,
  Compass,
  Linkedin,
  Lock,
  Mail,
  MapPin,
  Quote,
  ShieldCheck,
  Target,
} from "lucide-react";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { getIdfPhoto } from "@/lib/idf-images";
import { SITE_NAME_EN, SITE_NAME_HE, SUPPORT_EMAIL } from "@/lib/brand";
import { MATCH_TOOL_NAME } from "@/lib/voice";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: `אודות | ${SITE_NAME_HE}` },
      {
        name: "description",
        content: `מי אנחנו ב־${SITE_NAME_HE}, מי עומד מאחורי הפרויקט, ואיך ליצור קשר.`,
      },
    ],
  }),
});

const ease = [0.16, 1, 0.3, 1] as const;
const CONTACT_EMAIL = SUPPORT_EMAIL;
const CEO_LINKEDIN = "https://www.linkedin.com/in/michael-haddad-6b2b83412/";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

function AboutPage() {
  return (
    <div className="topo-lines" dir="rtl">
      {/* ── Hero: full-bleed photo band ── */}
      <section className="relative overflow-hidden border-b border-iron/30">
        <div className="absolute inset-0">
          <IdfPhotoPanel
            photo={getIdfPhoto("s1")}
            aspectClassName="h-full min-h-full"
            overlayClassName="from-background/70 via-background/80 to-background"
            imgClassName="object-[center_35%]"
            showCredit={false}
            loading="eager"
            fetchPriority="high"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
          >
            <Link
              to="/"
              className="mb-6 inline-flex items-center gap-1 text-sm text-dust transition hover:text-primary"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
              חזרה לאתר
            </Link>
            <p className="mb-3 font-mono text-xs tracking-widest text-primary uppercase">
              הסיפור מאחורי המוצר
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
              נבנה כדי שתגיעו לשירות
              <br />
              <span className="text-primary">עם כיוון ברור.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-[1.75] text-dust">
              {SITE_NAME_HE} היא פלטפורמה ישראלית שמאגדת פרופיל, מא״ה והתאמת תפקידים במקום אחד, בלי
              רעש ובלי מנוי. ההערכה ושלוש התאמות בחינם; שתי ההתאמות המובילות זמינות
              ב־₪10 סופיים כולל מע״מ ככל שחל, פעם אחת.
            </p>
          </motion.div>

          <motion.div
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
            }}
            initial="hidden"
            animate="show"
            className="mt-12 flex flex-wrap gap-x-10 gap-y-6 border-t border-iron/25 pt-8 sm:mt-14"
          >
            <Stat value="+300" label="תפקידים ומסלולים במאגר" />
            <Stat value="11" label="ממדי מא״ה" />
            <Stat value="3 דק׳" label="זמן הרשמה" />
          </motion.div>
        </div>
      </section>

      {/* ── Mission: editorial split ── */}
      <section className="py-20 sm:py-28" aria-labelledby="mission-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[3fr_2fr] lg:gap-20">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="text-right"
            >
              <p className="mb-3 font-mono text-xs tracking-widest text-olive uppercase">
                מי אנחנו
              </p>
              <h2
                id="mission-heading"
                className="text-3xl font-bold leading-tight text-foreground sm:text-4xl"
              >
                נבנה למי שעומד לפני גיוס
              </h2>
              <p className="mt-5 max-w-xl text-base leading-[1.85] text-dust">
                {SITE_NAME_HE} ({SITE_NAME_EN}) היא פרויקט בבטא שנבנה מתוך צורך אמיתי: לעזור
                למתגייסים להבין מה הפרופיל שלהם אומר, בשפה פשוטה, בממשק נקי, ובלי לחץ מכירות. במקום
                מידע מפוזר בין קבוצות וואטסאפ וטבלאות, הכל מרוכז בכלי דיגיטלי אחד שמרגיש כמו מוצר
                אמיתי.
              </p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-dust">
                ההמלצות אינן רשמיות ואינן מבטיחות זכאות, זימון למיון או שיבוץ.
                תנאי הסף וההחלטות נקבעים רק על ידי צה״ל.
              </p>

              <blockquote className="mt-8 border-r-2 border-primary/60 pr-5 text-right">
                <p className="text-lg font-medium leading-[1.7] text-foreground sm:text-xl">
                  &ldquo;הכנה טובה לשירות מתחילה בהבנה, של עצמך, של האפשרויות, ושל הדרך
                  אליהן.&rdquo;
                </p>
              </blockquote>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease }}
              className="relative aspect-[4/5] overflow-hidden rounded-sm border border-iron/30"
            >
              <IdfPhotoPanel
                photo={getIdfPhoto("s8")}
                aspectClassName="h-full min-h-0"
                overlayClassName="from-background/25 via-transparent to-background/70"
                imgClassName="object-[center_30%]"
                loading="lazy"
                fetchPriority="auto"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Pillars ── */}
      <section className="py-20 sm:py-28" aria-labelledby="pillars-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14 max-w-xl text-right"
          >
            <p className="mb-3 font-mono text-xs tracking-widest text-primary uppercase">
              מה מנחה אותנו
            </p>
            <h2 id="pillars-heading" className="text-3xl font-bold leading-tight sm:text-4xl">
              שלושה עקרונות, בלי פשרות
            </h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            <Pillar
              icon={<Compass className="h-5 w-5" />}
              title="מיקוד אחד"
              desc={`${SITE_NAME_HE} מרכזת במקום אחד את מה שבדרך כלל מפוזר: דפ״ר, רפואי, מא״ה והעדפות שירות.`}
              idx={0}
            />
            <Pillar
              icon={<Target className="h-5 w-5" />}
              title="התאמה ברורה"
              desc={`${MATCH_TOOL_NAME} מחזיר רשימת תפקידים עם ציון והסבר, לא הבטחות רשמיות, אלא כיוון מבוסס נתונים.`}
              idx={1}
            />
            <Pillar
              icon={<ShieldCheck className="h-5 w-5" />}
              title="פרטיות קודם"
              desc="הנתונים משמשים להפעלה, אבטחה ותשלום לפי מדיניות הפרטיות. לא מוכרים רשימות משתמשים למפרסמים."
              idx={2}
            />
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Founder ── */}
      <section className="py-20 sm:py-28" aria-labelledby="ceo-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-10 text-right"
          >
            <p className="mb-2 font-mono text-xs tracking-widest text-olive uppercase">המייסד</p>
            <h2 id="ceo-heading" className="text-3xl font-bold text-foreground sm:text-4xl">
              מאחורי הקלעים
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease }}
            className="grid items-stretch gap-0 overflow-hidden border border-iron/30 bg-card lg:grid-cols-[minmax(0,18rem)_1fr]"
          >
            <div className="relative aspect-square overflow-hidden border-b border-iron/20 lg:aspect-auto lg:min-h-[22rem] lg:border-b-0 lg:border-l lg:border-iron/20">
              <img
                src="/ceo-michael-haddad.png"
                alt="מייקל חדד, מייסד ומנכ״ל קח כיוון"
                className="h-full w-full object-cover object-[center_20%]"
                loading="lazy"
                width={640}
                height={640}
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent lg:bg-gradient-to-l"
                aria-hidden
              />
            </div>

            <div className="flex flex-col justify-center gap-5 p-6 text-right sm:p-10">
              <Quote className="h-8 w-8 text-primary/40" aria-hidden />
              <p className="max-w-xl text-lg font-medium leading-[1.7] text-foreground sm:text-xl">
                בניתי את {SITE_NAME_HE} כדי להפוך את שלב ההכנה לגיוס לפחות מבולגן ויותר ברור, עם
                כלים דיגיטליים שמרגישים כמו מוצר אמיתי, לא עוד קבוצת וואטסאפ.
              </p>
              <div className="border-t border-iron/20 pt-5">
                <p className="font-mono text-[10px] tracking-widest text-primary uppercase">
                  CEO / Founder
                </p>
                <h3 className="mt-1 text-xl font-bold text-foreground">מייקל חדד</h3>
                <p className="mt-0.5 text-sm text-dust">מייסד ומנכ״ל {SITE_NAME_HE}</p>
                <div className="mt-4 flex flex-wrap items-center justify-start gap-3">
                  <a
                    href={CEO_LINKEDIN}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-iron/30 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary"
                  >
                    <Linkedin className="h-4 w-4" aria-hidden />
                    LinkedIn
                  </a>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="inline-flex items-center gap-2 text-sm text-dust transition hover:text-primary"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Contact ── */}
      <section className="py-20 sm:py-28" aria-labelledby="contact-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-10 text-right"
          >
            <p className="mb-2 font-mono text-xs tracking-widest text-primary uppercase">
              יצירת קשר
            </p>
            <h2 id="contact-heading" className="text-3xl font-bold text-foreground sm:text-4xl">
              דברו איתנו
            </h2>
            <p className="mt-3 max-w-2xl text-[0.9375rem] leading-[1.75] text-dust">
              שאלות על המוצר, פרטיות, שותפויות או דיווח על באג, נשמח לשמוע.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            <ContactCard
              icon={<Mail className="h-5 w-5" />}
              title="אימייל"
              body={CONTACT_EMAIL}
              note="נחזור אליכם בהקדם האפשרי"
              href={`mailto:${CONTACT_EMAIL}`}
              idx={0}
            />
            <ContactCard
              icon={<Linkedin className="h-5 w-5" />}
              title="LinkedIn"
              body="מייקל חדד"
              note="מתחברים ומתעדכנים"
              href={CEO_LINKEDIN}
              external
              idx={1}
            />
            <ContactCard
              icon={<MapPin className="h-5 w-5" />}
              title="מיקום"
              body="ישראל, שירות דיגיטלי מלא"
              note="אין סניף פיזי, הכל אונליין"
              idx={2}
            />
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="border-t border-iron/30 py-20 sm:py-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
          className="mx-auto max-w-3xl px-4 text-center sm:px-6"
        >
          <h2 className="text-3xl font-bold sm:text-4xl">מוכנים למצוא את הכיוון שלכם?</h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-dust">
            הערכה אדפטיבית ושלוש התאמות אישיות בחינם. מקומות 2 ו־1 ב־₪10
            סופיים כולל מע״מ ככל שחל, בתשלום חד־פעמי וללא מנוי.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/post-signup"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-7 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 active:scale-[0.97]"
              >
                התחילו את ההערכה בחינם
              </Link>
              <Link
                to="/role-insights"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-dust transition hover:text-foreground"
              >
                מה זה בכלל
                <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-dust/70">
              <Lock className="h-3 w-3" aria-hidden />
              ללא סיסמה, רק אימייל וקוד חד-פעמי
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

/* ── Sub-components ── */

function Stat({ value, label }: { value: string; label: string }) {
  const num = parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
  const prefix = value.trim().startsWith("+") ? "+" : "";
  const suffix = value.replace(/^\+/, "").replace(/[0-9]/g, "").trim();
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
        const duration = 900;
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
    <motion.div variants={fadeUp} className="text-right" ref={ref}>
      <p className="font-mono text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
        {prefix}
        {display}
        {suffix ? <span className="text-primary"> {suffix}</span> : null}
      </p>
      <p className="mt-1 text-xs text-dust sm:text-sm">{label}</p>
    </motion.div>
  );
}

function Pillar({
  icon,
  title,
  desc,
  idx,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  idx: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: idx * 0.1, ease }}
      className="group border border-iron/20 border-r-primary/40 bg-card p-6 text-right transition-colors hover:border-primary/30 sm:p-8"
    >
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-[1.7] text-dust">{desc}</p>
    </motion.div>
  );
}

function ContactCard({
  icon,
  title,
  body,
  note,
  href,
  external,
  idx,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  note: string;
  href?: string;
  external?: boolean;
  idx: number;
}) {
  const inner = (
    <>
      <div className="mb-4 text-primary opacity-80">{icon}</div>
      <h3 className="mb-2 text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-[1.7] text-dust group-hover:text-foreground">{body}</p>
      <p className="mt-2 text-xs text-dust/70">{note}</p>
    </>
  );

  const className =
    "group block border border-iron/20 border-r-primary/40 bg-card p-6 text-right transition-colors hover:border-r-primary/70 sm:p-8";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: idx * 0.08, ease }}
    >
      {href ? (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={className}
        >
          {inner}
        </a>
      ) : (
        <div className={className.replace("hover:border-r-primary/70", "")}>{inner}</div>
      )}
    </motion.div>
  );
}
