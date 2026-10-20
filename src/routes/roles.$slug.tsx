import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink, Shield } from "lucide-react";
import { UL } from "@/components/blog/Prose";
import { IntensityBar } from "@/components/IntensityBar";
import { QuizCta } from "@/components/QuizCta";
import { RoleReviewsPanel } from "@/components/RoleReviewsPanel";
import type { RoleInsightDetail, RolePageContent } from "@/lib/api";
import { getBlogPost } from "@/lib/blog";
import { fetchRoleCatalog, fetchRoleDetail, roleUrl, SITE_URL } from "@/lib/roles-public";
import { TONES, roleField, type Tone } from "@/lib/tones";

/** One indexable page per role: what the role is, its thresholds, and a path into the assessment. */
export const Route = createFileRoute("/roles/$slug")({
  loader: async ({ params }) => {
    const role = await fetchRoleDetail(params.slug);
    if (!role) throw notFound();
    // The API ranks related roles; an older API without `page` falls back to same category.
    const related =
      role.page?.related ??
      ((await fetchRoleCatalog())?.roles ?? [])
        .filter((r) => r.slug !== role.slug && r.category === role.category)
        .slice(0, 6);
    return { role, related };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { role } = loaderData;
    const facts = [
      role.daparFloor != null ? `דפ״ר ${role.daparFloor} ומעלה` : "",
      role.medicalFloor != null ? `פרופיל ${role.medicalFloor} ומעלה` : "",
      role.serviceLengthLabel ? `שירות ${role.serviceLengthLabel}` : "",
    ].filter(Boolean);
    const title = `${role.roleTitle} בצה״ל: דרישות, דפ״ר ופרופיל | קח כיוון`;
    const description =
      role.page?.metaDescription ||
      `${role.roleTitle}${role.combat ? " (קרבי)" : ""}: מה עושים ביומיום${
        facts.length ? `, ${facts.join(", ")}` : ""
      }. בדקו בחינם אם התפקיד מתאים לכם.`.slice(0, 160);
    const url = roleUrl(role.slug);
    const faq = role.page?.faq ?? [];
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "קח כיוון", item: `${SITE_URL}/` },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "תפקידים בצה״ל",
                    item: `${SITE_URL}/role-insights`,
                  },
                  { "@type": "ListItem", position: 3, name: role.roleTitle, item: url },
                ],
              },
              ...(faq.length
                ? [
                    {
                      "@type": "FAQPage",
                      mainEntity: faq.map((f) => ({
                        "@type": "Question",
                        name: f.q,
                        acceptedAnswer: { "@type": "Answer", text: f.a },
                      })),
                    },
                  ]
                : []),
            ],
          }),
        },
      ],
    };
  },
  component: RolePage,
  notFoundComponent: RoleNotFound,
});

const FACT_TONES: Tone[] = ["sand", "steel", "rust", "olive"];

function Fact({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`border-t-2 p-3 text-right ${TONES[tone].tile}`}>
      <dt className="text-[11px] text-dust">{label}</dt>
      <dd className={`mt-1 text-base font-black ${TONES[tone].text}`}>{value}</dd>
    </div>
  );
}

const GENDER_LABEL = { all: "גברים ונשים", male_only: "גברים בלבד", female_only: "נשים בלבד" };

/** Guides that match what this role's data actually mentions, topped up with the general ones. */
function pickGuides(role: RoleInsightDetail, page: RolePageContent) {
  const text = [
    ...page.selection,
    ...page.training,
    ...page.requirements,
    page.serviceLengthLabel,
    role.category,
  ].join(" ");
  const womenCombat =
    role.combat && (role.genderEligibility === "all" || role.genderEligibility === "female_only");
  const slugs = [
    role.daparFloor != null ? "דפר" : "",
    page.profileFloor != null || /פרופיל/.test(text) ? "פרופיל-צבאי" : "",
    /גיבוש/.test(text) ? "גיבושים-בצהל" : "",
    /יום סיירות/.test(text) ? "יום-סיירות" : "",
    /מיון|מיוני/.test(text) || role.selective ? "מיונים-בצבא" : "",
    /מא״ה/.test(text) ? "יום-המאה" : "",
    /טירונות|רובאי/.test(text) ? "טירונות" : "",
    womenCombat ? "לוחמות-בצהל" : "",
    /פסיכומטרי|עתודה/.test(text) ? "עתודה-אקדמית" : "",
    ...(role.combat
      ? ["גיבושים-בצהל", "יום-סיירות", "פרופיל-צבאי", "טירונות", "מה-להביא-ליום-הגיוס"]
      : ["תפקידים-לפי-דפר", "תפקידים-לפי-פרופיל", "שאלון-העדפות", "מיונים-בצבא", "יום-המאה"]),
  ];
  return [...new Set(slugs.filter(Boolean))].slice(0, 6).flatMap((slug) => getBlogPost(slug) ?? []);
}

function RolePage() {
  const { role, related } = Route.useLoaderData();
  const field = roleField(role);
  // An older API has no `page`: show its raw fields, nothing derived.
  const page: RolePageContent = role.page ?? {
    profileFloor: role.medicalFloor,
    requirements: role.requirements,
    selection: [],
    training: [],
    serviceLengthLabel: role.serviceLengthLabel,
    locations: role.locations,
    dayToDay: role.dayToDay,
    faq: [],
    metaDescription: "",
    related: [],
  };
  const guides = pickGuides(role, page);
  const gender = role.genderEligibility ? GENDER_LABEL[role.genderEligibility] : null;
  const facts = [
    role.daparFloor != null ? { label: "דפ״ר מינימלי", value: String(role.daparFloor) } : null,
    page.profileFloor != null
      ? { label: "פרופיל מינימלי", value: String(page.profileFloor) }
      : null,
    gender ? { label: "פתוח ל", value: gender } : null,
    role.selective ? { label: "קבלה", value: "סלקטיבית" } : null,
  ].filter((f): f is { label: string; value: string } => f !== null);
  const floors = [
    role.daparFloor != null ? `דפ״ר ${role.daparFloor}` : "",
    page.profileFloor != null ? `פרופיל ${page.profileFloor}` : "",
  ].filter(Boolean);
  const hasTraining = Boolean(
    page.serviceLengthLabel || page.training.length || page.locations.length,
  );

  return (
    <article
      className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-right sm:px-6 sm:py-10"
      dir="rtl"
    >
      <nav aria-label="פירורי לחם" className="text-xs text-dust">
        <Link to="/" className="hover:text-foreground">
          ראשי
        </Link>
        <span aria-hidden> › </span>
        <Link to="/role-insights" className="hover:text-foreground">
          תפקידים בצה״ל
        </Link>
        <span aria-hidden> › </span>
        <span className="text-foreground">{role.roleTitle}</span>
      </nav>

      <header>
        <p className="flex flex-wrap items-center gap-2 text-xs text-dust">
          <span
            className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-bold ${TONES[field.tone].soft} ${TONES[field.tone].bg} ${TONES[field.tone].text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${TONES[field.tone].dot}`} aria-hidden />
            {field.label}
          </span>
          {role.category && role.category !== field.label ? role.category : null}
        </p>
        <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-black leading-tight text-foreground sm:text-4xl">
          {role.roleTitle}
          {role.combat ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-maroon/30 bg-maroon/10 px-2 py-0.5 text-xs font-bold text-maroon">
              <Shield className="h-3.5 w-3.5" aria-hidden />
              קרבי
            </span>
          ) : null}
        </h1>
        {page.dayToDay ? (
          <p className="mt-4 text-base leading-[1.8] text-foreground/90">{page.dayToDay}</p>
        ) : null}
        {role.signals.length ? (
          <div className="mt-4">
            <h2 className="text-xs text-dust">מאפייני התפקיד</h2>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {role.signals.map((s) => (
                <li
                  key={s}
                  className="border border-iron/30 bg-secondary/60 px-2 py-0.5 text-xs font-semibold text-foreground"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      {facts.length || page.requirements.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-black text-foreground">דרישות ותנאי קבלה</h2>
          {facts.length ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map((f, i) => (
                <Fact
                  key={f.label}
                  label={f.label}
                  value={f.value}
                  tone={FACT_TONES[i % FACT_TONES.length]}
                />
              ))}
            </dl>
          ) : null}
          {page.requirements.length ? <UL items={page.requirements} /> : null}
        </section>
      ) : null}

      {role.intensityFromData ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <IntensityBar label="עומס פיזי" value={role.physicalDemand} tone="rust" />
          <IntensityBar label="טכנולוגיה" value={role.techIntensity} tone="steel" />
          <IntensityBar label="עבודה עם אנשים" value={role.peopleIntensity} tone="sand" />
        </div>
      ) : null}

      <QuizCta compact title={`עומדים בסף? זה עוד לא אומר ש${role.roleTitle} מתאים לכם.`} />

      {page.selection.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-black text-foreground">איך מגיעים לתפקיד</h2>
          <UL items={page.selection} />
        </section>
      ) : null}

      {hasTraining ? (
        <section className="space-y-3">
          <h2 className="text-lg font-black text-foreground">מסלול והכשרה</h2>
          {page.serviceLengthLabel ? (
            <p className="text-base leading-[1.8] text-foreground/90">{page.serviceLengthLabel}</p>
          ) : null}
          {page.training.length ? <UL items={page.training} /> : null}
          {page.locations.length ? (
            <div>
              <h3 className="mb-1 text-sm font-black text-foreground">בסיסים ומיקומים</h3>
              <UL items={page.locations} />
            </div>
          ) : null}
        </section>
      ) : null}

      <QuizCta
        title={`${role.roleTitle} מתאים לכם?`}
        body={`${floors.length ? `${floors.join(" ו")} ${floors.length > 1 ? "הם" : "הוא"} רק תנאי סף. ` : ""}השאלון האישי מצליב את הדפ״ר, הפרופיל הרפואי ו־11 ציוני המא״ה מול יותר מ־300 תפקידים, ומחזיר 5 התאמות עם הסבר וסיכויי קבלה. כך תדעו אם ${role.roleTitle} באמת ביניהן.`}
      />

      {page.faq.length ? (
        <section className="space-y-4">
          <h2 className="text-lg font-black text-foreground">שאלות נפוצות</h2>
          <dl className="divide-y divide-iron/25 border-y border-iron/25">
            {page.faq.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="text-base font-bold text-foreground">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-7 text-foreground/85">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <a
        href={role.sourceUrl || role.officialSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-dust underline decoration-iron/50 underline-offset-4 transition hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
        {role.sourceUrl ? "מקור: אתר מתגייסים" : "התפקיד באתר מתגייסים"}
      </a>

      <RoleReviewsPanel roleSlug={role.slug} roleTitle={role.roleTitle} />

      {related.length ? (
        <section>
          <h2 className="mb-3 text-lg font-black text-foreground">תפקידים דומים</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((r) => {
              const floors =
                "daparFloor" in r
                  ? [
                      r.daparFloor != null ? `דפ״ר ${r.daparFloor}` : "",
                      r.profileFloor != null ? `פרופיל ${r.profileFloor}` : "",
                    ].filter(Boolean)
                  : [];
              return (
                <li key={r.slug}>
                  <Link
                    to="/roles/$slug"
                    params={{ slug: r.slug }}
                    className={`flex min-h-11 items-center justify-between gap-3 border border-r-2 border-iron/30 bg-card p-3 text-sm transition hover:bg-secondary/40 ${TONES[roleField(r).tone].edge}`}
                  >
                    <span>
                      <span className="block font-bold text-foreground">{r.roleTitle}</span>
                      {floors.length ? (
                        <span className="mt-0.5 block text-xs text-dust">{floors.join(" · ")}</span>
                      ) : null}
                    </span>
                    <ChevronLeft className="h-4 w-4 shrink-0 text-dust" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-black text-foreground">מדריכים שיעזרו לכם להגיע לתפקיד</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {guides.map((p) => (
            <li key={p.slug}>
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="flex min-h-11 items-center justify-between gap-3 border border-iron/30 bg-card p-3 text-sm transition hover:border-primary/40"
              >
                <span className="font-bold text-foreground">{p.shortTitle}</span>
                <ChevronLeft className="h-4 w-4 shrink-0 text-dust" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs leading-5 text-dust">
        המידע אינו רשמי ועשוי להשתנות. תנאי הסף והשיבוץ נקבעים רק על ידי צה״ל; אמתו באתר מתגייסים.
      </p>
    </article>
  );
}

function RoleNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center" dir="rtl">
      <h1 className="text-2xl font-black text-foreground">התפקיד לא נמצא</h1>
      <p className="mt-3 text-sm text-dust">ייתכן שהשם השתנה. אפשר לחפש אותו בקטלוג.</p>
      <Link
        to="/role-insights"
        className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
      >
        לקטלוג התפקידים
      </Link>
    </div>
  );
}
