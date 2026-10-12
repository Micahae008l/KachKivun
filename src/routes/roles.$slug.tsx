import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink, Shield, Sparkles } from "lucide-react";
import { IntensityBar } from "@/components/RoleInsightSheet";
import { RoleReviewsPanel } from "@/components/RoleReviewsPanel";
import { getBlogPost } from "@/lib/blog";
import { fetchRoleCatalog, fetchRoleDetail, roleUrl, SITE_URL } from "@/lib/roles-public";

/** One indexable page per role: what the role is, its thresholds, and a path into the assessment. */
export const Route = createFileRoute("/roles/$slug")({
  loader: async ({ params }) => {
    const [role, catalog] = await Promise.all([fetchRoleDetail(params.slug), fetchRoleCatalog()]);
    if (!role) throw notFound();
    const related = (catalog?.roles ?? [])
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
    const description = `${role.roleTitle}${role.combat ? " (קרבי)" : ""}: מה עושים ביומיום${
      facts.length ? `, ${facts.join(", ")}` : ""
    }. בדקו בחינם אם התפקיד מתאים לכם.`.slice(0, 160);
    const url = roleUrl(role.slug);
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
          }),
        },
      ],
    };
  },
  component: RolePage,
  notFoundComponent: RoleNotFound,
});

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-iron/25 bg-background/40 p-3 text-right">
      <dt className="text-[11px] text-dust">{label}</dt>
      <dd className="mt-1 text-base font-black text-foreground">{value}</dd>
    </div>
  );
}

function RolePage() {
  const { role, related } = Route.useLoaderData();
  const paragraphs = role.about.split(/\n\n+/).filter(Boolean);
  // Combat roles get the field-screening guides; the rest get thresholds and the questionnaire.
  const guideSlugs = role.combat
    ? ["יום-סיירות", "פרופיל-צבאי", "טירונות", "לוחמות-בצהל"]
    : ["תפקידים-לפי-דפר", "תפקידים-לפי-פרופיל", "שאלון-העדפות", "יום-המאה"];
  const guides = guideSlugs.flatMap((slug) => getBlogPost(slug) ?? []);

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
        <p className="font-mono text-xs tracking-wide text-primary">{role.category}</p>
        <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-black leading-tight text-foreground sm:text-4xl">
          {role.roleTitle}
          {role.combat ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              <Shield className="h-3.5 w-3.5" aria-hidden />
              קרבי
            </span>
          ) : null}
        </h1>
        {paragraphs[0] ? (
          <p className="mt-4 text-base leading-[1.8] text-foreground/90">{paragraphs[0]}</p>
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact
          label="דפ״ר מינימלי"
          value={role.daparFloor != null ? String(role.daparFloor) : "לא צוין"}
        />
        <Fact
          label="פרופיל מינימלי"
          value={role.medicalFloor != null ? String(role.medicalFloor) : "לא צוין"}
        />
        <Fact label="משך שירות" value={role.serviceLengthLabel || "לא צוין"} />
        <Fact label="מיון" value={role.selective ? "יש מיון" : "ללא מיון ייעודי"} />
      </dl>

      <div className="grid gap-3 sm:grid-cols-3">
        <IntensityBar label="עומס פיזי" value={role.physicalDemand} />
        <IntensityBar label="טכנולוגיה" value={role.techIntensity} />
        <IntensityBar label="עבודה עם אנשים" value={role.peopleIntensity} />
      </div>

      {role.dayToDay ? (
        <section>
          <h2 className="text-lg font-black text-foreground">מה עושים ביומיום</h2>
          <p className="mt-2 text-sm leading-7 text-foreground/90">{role.dayToDay}</p>
        </section>
      ) : null}

      {paragraphs.length > 1 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-black text-foreground">על התפקיד</h2>
          {paragraphs.slice(1).map((p) => (
            <p key={p.slice(0, 40)} className="text-sm leading-7 text-foreground/90">
              {p}
            </p>
          ))}
        </section>
      ) : null}

      {role.requirements.length || role.locations.length ? (
        <section className="grid gap-5 sm:grid-cols-2">
          {role.requirements.length ? (
            <div>
              <h2 className="mb-2 text-sm font-black text-foreground">דרישות ותנאים</h2>
              <ul className="flex flex-wrap gap-1.5">
                {role.requirements.map((r) => (
                  <li
                    key={r}
                    className="border border-iron/30 bg-secondary/60 px-2 py-0.5 text-xs font-semibold text-foreground"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {role.locations.length ? (
            <div>
              <h2 className="mb-2 text-sm font-black text-foreground">איפה משרתים</h2>
              <p className="text-sm text-foreground/90">{role.locations.join(" · ")}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <aside className="border border-primary/40 bg-primary/10 p-5 sm:p-6">
        <h2 className="text-lg font-black text-foreground">{role.roleTitle} מתאים לכם?</h2>
        <p className="mt-2 text-sm leading-6 text-dust">
          שאלון אישי אחד מצליב את הדפ״ר, הפרופיל, ציוני המא״ה ומה שחשוב לכם מול יותר מ־300 תפקידים,
          ומחזיר 5 התאמות עם הסבר וסיכויי קבלה. מתחילים בחינם.
        </p>
        <Link
          to="/post-signup"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground transition hover:brightness-110"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          בדקו התאמה בחינם
        </Link>
      </aside>

      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={role.officialSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-iron/40 px-4 text-sm text-dust transition hover:border-primary/40 hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          התפקיד באתר מתגייסים
        </a>
      </div>

      <RoleReviewsPanel roleSlug={role.slug} roleTitle={role.roleTitle} />

      {related.length ? (
        <section>
          <h2 className="mb-3 text-lg font-black text-foreground">
            תפקידים דומים ב{role.category}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  to="/roles/$slug"
                  params={{ slug: r.slug }}
                  className="flex items-center justify-between gap-3 border border-iron/30 bg-card p-3 text-sm transition hover:border-primary/40"
                >
                  <span className="font-bold text-foreground">{r.roleTitle}</span>
                  <ChevronLeft className="h-4 w-4 shrink-0 text-dust" aria-hidden />
                </Link>
              </li>
            ))}
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
                className="flex items-center justify-between gap-3 border border-iron/30 bg-card p-3 text-sm transition hover:border-primary/40"
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
