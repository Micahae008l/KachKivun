import { createFileRoute, Link } from "@tanstack/react-router";
import { TONES, type Tone } from "@/lib/tones";

/** Cards and stats take the site accents in turn, so the page is not all olive. */
const ABOUT_TONES: Tone[] = ["steel", "sand", "teal", "rust"];
import { motion } from "framer-motion";
import {
  ChevronRight,
  Compass,
  Linkedin,
  Lock,
  Mail,
  MapPin,
  Quote,
  ShieldCheck,
  Target,
  Layers,
  Gauge,
  Clock3,
} from "lucide-react";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { StatStrip } from "@/components/StatStrip";
import { QuizCta } from "@/components/QuizCta";
import { getIdfPhoto, IDF_PHOTO_CATALOG } from "@/lib/idf-images";
import { GIBUSH_PHOTOS } from "@/features/gibush/photos";
import { SITE_NAME_EN, SITE_NAME_HE, SUPPORT_EMAIL } from "@/lib/brand";
import { MATCH_TOOL_NAME } from "@/lib/voice";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    links: [{ rel: "canonical", href: "https://kachkivun.com/about" }],
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
            <p className="mb-3 font-mono text-xs tracking-wide text-steel uppercase">
              הסיפור מאחורי המוצר
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
              נבנה כדי שתגיעו לשירות
              <br />
              <span className="text-primary">עם כיוון ברור.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-[1.75] text-dust">
              {SITE_NAME_HE} היא פלטפורמה ישראלית שמאגדת פרופיל, מא״ה והתאמת תפקידים במקום אחד, בלי
              רעש ובלי מנוי. ההערכה ושתי התאמות (מקומות 5 ו־4) בחינם. שלוש ההתאמות החזקות (3, 2 ו־1)
              נפתחות בתשלום חד־פעמי אחד.
            </p>
          </motion.div>

          <StatStrip
            className="mt-12 max-w-3xl grid-cols-1 sm:mt-14 sm:grid-cols-3"
            stats={[
              {
                value: 300,
                plus: true,
                label: "תפקידים ומסלולים במאגר",
                tone: "sand",
                icon: Layers,
              },
              { value: 11, label: "ממדי מא״ה", tone: "steel", icon: Gauge },
              { value: 8, label: "דקות שאלון, בערך", tone: "rust", icon: Clock3 },
            ]}
          />
        </div>
      </section>

      {/* ── Mission: editorial split ── */}
      <section className="py-14 sm:py-28" aria-labelledby="mission-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[3fr_2fr] lg:gap-20">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="text-right"
            >
              <p className="mb-3 font-mono text-xs tracking-wide text-olive uppercase">מי אנחנו</p>
              <h2
                id="mission-heading"
                className="text-3xl font-bold leading-tight text-foreground sm:text-4xl"
              >
                נבנה למי שעומד לפני גיוס
              </h2>
              <p className="mt-5 max-w-xl text-base leading-[1.85] text-dust">
                {SITE_NAME_HE} ({SITE_NAME_EN}) נבנה מתוך צורך אמיתי: לעזור למתגייסים להבין מה
                הפרופיל שלהם אומר, בשפה פשוטה, בממשק נקי, ובלי לחץ מכירות. במקום מידע מפוזר בין
                קבוצות וואטסאפ וטבלאות, הכל מרוכז בכלי דיגיטלי אחד שמרגיש כמו מוצר אמיתי.
              </p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-dust">
                ההמלצות אינן רשמיות ואינן מבטיחות זכאות, זימון למיון או שיבוץ. תנאי הסף וההחלטות
                נקבעים רק על ידי צה״ל.
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
      <section className="py-14 sm:py-28" aria-labelledby="pillars-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14 max-w-xl text-right"
          >
            <p className="mb-3 font-mono text-xs tracking-wide text-sand uppercase">
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
      <section className="py-14 sm:py-28" aria-labelledby="ceo-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-10 text-right"
          >
            <p className="mb-2 font-mono text-xs tracking-wide text-olive uppercase">המייסד</p>
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
                <p className="font-mono text-[10px] tracking-wide text-primary uppercase">
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
      <section className="py-14 sm:py-28" aria-labelledby="contact-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-10 text-right"
          >
            <p className="mb-2 font-mono text-xs tracking-wide text-teal uppercase">יצירת קשר</p>
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
      <section className="border-t border-iron/30 py-14 sm:py-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
          className="mx-auto max-w-3xl px-4 sm:px-6"
        >
          <QuizCta title="מוכנים למצוא את הכיוון שלכם?" />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-dust/70">
            <Lock className="h-3 w-3" aria-hidden />
            ללא סיסמה, רק אימייל וקוד חד-פעמי
          </p>
        </motion.div>
      </section>

      {/* CC licenses require a credit for every photo, including the ones shown without a caption. */}
      <section
        id="photo-credits"
        className="scroll-mt-24 border-t border-iron/30 py-12"
        aria-labelledby="photo-credits-heading"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 id="photo-credits-heading" className="text-base font-bold">
            קרדיט צילומים
          </h2>
          <p className="mt-2 text-xs leading-5 text-dust">
            הצילומים באתר הם של דובר צה״ל, U.S. Air Force וצלמים נוספים, ברישיונות פתוחים
            מ־Wikimedia Commons.
          </p>
          <ul className="mt-4 space-y-1.5 text-xs leading-5 text-dust" dir="rtl">
            {[...IDF_PHOTO_CATALOG, ...GIBUSH_PHOTOS].map((photo) => (
              <li key={photo.id}>
                {photo.alt}:{" "}
                <a
                  href={photo.commonsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/80 hover:text-primary hover:underline"
                >
                  <bdi>{photo.credit}</bdi>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

/* ── Sub-components ── */

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
      className={`group border border-r-2 border-iron/20 bg-card p-6 text-right transition-colors hover:bg-secondary/40 sm:p-8 ${TONES[ABOUT_TONES[idx % 4]].edge}`}
    >
      <div
        className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border ${TONES[ABOUT_TONES[idx % 4]].icon}`}
      >
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
      <div className={`mb-4 ${TONES[ABOUT_TONES[idx % 4]].text}`}>{icon}</div>
      <h3 className="mb-2 text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-[1.7] text-dust group-hover:text-foreground">{body}</p>
      <p className="mt-2 text-xs text-dust/70">{note}</p>
    </>
  );

  const className = `group block border border-r-2 border-iron/20 bg-card p-6 text-right transition-colors hover:bg-secondary/40 sm:p-8 ${TONES[ABOUT_TONES[idx % 4]].edge}`;

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
        <div className={className}>{inner}</div>
      )}
    </motion.div>
  );
}
