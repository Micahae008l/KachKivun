import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { BLOG_POSTS, blogUrl, formatPostDate } from "@/lib/blog";

const TITLE = "מדריכים לקראת הגיוס: תפקידים, צו ראשון, מא״ה ושאלון העדפות | קח כיוון";
const DESCRIPTION =
  "מדריכים קצרים ומדויקים למלש״בים: תפקידים לפי דפ״ר ופרופיל, תפקידים לבנות, צו ראשון, יום המא״ה, שאלון העדפות, יום סיירות, טירונות ועתודה. כל עובדה עם מקור רשמי.";
const URL = "https://kachkivun.com/blog";

export const Route = createFileRoute("/blog/")({
  component: BlogIndexPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "מדריכים לקראת הגיוס",
          url: URL,
          inLanguage: "he-IL",
          blogPost: BLOG_POSTS.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: blogUrl(p.slug),
            datePublished: p.date,
            dateModified: p.updated,
          })),
        }),
      },
    ],
  }),
});

const TOOLS = [
  {
    to: "/attention-test",
    title: "מבחן הקשב: לוחצים רק על עיגול ירוק",
    description: "תרגול למבחן הקשב של הצו הראשון, עם ציון מ־1 עד 5 וזמן תגובה בסוף.",
  },
  {
    to: "/role-calculator",
    title: "מחשבון תפקידים: מה פתוח לי?",
    description: "בוחרים דפ״ר ופרופיל ורואים מיד אילו תפקידים עומדים בסף.",
  },
] as const;

// Sections follow the order tags first appear in posts.json.
const TAG_ORDER = [...new Set(BLOG_POSTS.map((p) => p.tag))];

function BlogIndexPage() {
  const [lead, ...rest] = BLOG_POSTS;

  return (
    <div className="topo-lines" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 text-right sm:px-6 sm:py-16">
        <header className="max-w-2xl">
          <p className="font-mono text-xs tracking-widest text-primary uppercase">מדריכים</p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-foreground sm:text-5xl">
            מה שכדאי לדעת לפני שמדרגים תפקיד
          </h1>
          <p className="mt-4 text-base leading-[1.8] text-dust">
            הליך הגיוס מלא בשלבים שאף אחד לא מסביר עד הסוף. כאן כל שלב מקבל מדריך אחד, קצר, עם מקור
            רשמי לכל עובדה.
          </p>
        </header>

        <Link
          to="/blog/$slug"
          params={{ slug: lead.slug }}
          className="group block border border-primary/40 bg-primary/5 p-5 transition hover:border-primary sm:p-8"
        >
          <p className="font-mono text-xs text-primary">{lead.tag}</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-foreground sm:text-3xl">
            {lead.title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-dust">{lead.description}</p>
          <p className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
            לקריאה, {lead.readMinutes} דקות
            <ChevronLeft
              className="h-4 w-4 transition-transform group-hover:-translate-x-1"
              aria-hidden
            />
          </p>
        </Link>

        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="mb-4 scroll-mt-20 text-xl font-black text-foreground">
            כלים חינם
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {TOOLS.map((tool) => (
              <li key={tool.to}>
                <Link
                  to={tool.to}
                  className="flex h-full flex-col border border-primary/40 bg-primary/5 p-5 transition hover:border-primary"
                >
                  <h3 className="text-lg font-black leading-snug text-foreground">{tool.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-dust">{tool.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {TAG_ORDER.map((tag) => {
          const posts = rest.filter((p) => p.tag === tag);
          if (!posts.length) return null;
          return (
            <section key={tag} aria-labelledby={`tag-${tag}`}>
              <h2
                id={`tag-${tag}`}
                className="mb-4 scroll-mt-20 text-xl font-black text-foreground"
              >
                {tag}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {posts.map((p) => (
                  <li key={p.slug}>
                    <Link
                      to="/blog/$slug"
                      params={{ slug: p.slug }}
                      className="flex h-full flex-col border border-iron/30 bg-card p-5 transition hover:border-primary/50"
                    >
                      <h3 className="text-lg font-black leading-snug text-foreground">{p.title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-6 text-dust">{p.description}</p>
                      <p className="mt-4 font-mono text-xs text-dust/70">
                        {formatPostDate(p.updated)} · {p.readMinutes} דקות קריאה
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
