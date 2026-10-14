import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Sources } from "@/components/blog/Prose";
import { QuizCta } from "@/components/QuizCta";
import { POST_CONTENT } from "@/content/blog";
import { BLOG_POSTS, blogUrl, formatPostDate, getBlogPost } from "@/lib/blog";

const SITE_URL = "https://kachkivun.com";

/** One guide per page: body, FAQ, official sources and a path into the assessment. */
export const Route = createFileRoute("/blog/$slug")({
  // Dynamic import: a static one here (loader/head stay in the main bundle) shipped every
  // guide's body to every page, the homepage included.
  loader: async ({ params }) => {
    const post = getBlogPost(params.slug);
    const content = post ? (await import("@/content/blog")).POST_CONTENT[post.slug] : undefined;
    if (!post || !content) throw notFound();
    return { post, faq: content.faq };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { post, faq } = loaderData;
    const url = blogUrl(post.slug);
    const title = `${post.title} | קח כיוון`;
    return {
      meta: [
        { title },
        { name: "description", content: post.description },
        { property: "og:type", content: "article" },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:url", content: url },
        { property: "article:published_time", content: post.date },
        { property: "article:modified_time", content: post.updated },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: post.description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                headline: post.title,
                description: post.description,
                datePublished: post.date,
                dateModified: post.updated,
                inLanguage: "he-IL",
                mainEntityOfPage: url,
                image: `${SITE_URL}/og-image.png`,
                author: {
                  "@type": "Person",
                  name: "מייקל חדד",
                  jobTitle: "מייסד קח כיוון",
                  url: `${SITE_URL}/about`,
                },
                publisher: {
                  "@type": "Organization",
                  name: "קח כיוון",
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.png` },
                },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "קח כיוון", item: `${SITE_URL}/` },
                  { "@type": "ListItem", position: 2, name: "מדריכים", item: `${SITE_URL}/blog` },
                  { "@type": "ListItem", position: 3, name: post.shortTitle, item: url },
                ],
              },
              {
                "@type": "FAQPage",
                mainEntity: faq.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              },
            ],
          }),
        },
      ],
    };
  },
  component: BlogPostPage,
  notFoundComponent: PostNotFound,
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  const { Body, faq, sources } = POST_CONTENT[post.slug];
  const more = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 text-right sm:px-6 sm:py-12" dir="rtl">
      <nav aria-label="פירורי לחם" className="text-xs text-dust">
        <Link to="/" className="hover:text-foreground">
          ראשי
        </Link>
        <span aria-hidden> › </span>
        <Link to="/blog" className="hover:text-foreground">
          מדריכים
        </Link>
        <span aria-hidden> › </span>
        <span className="text-foreground">{post.shortTitle}</span>
      </nav>

      <header className="mt-6 border-b border-iron/30 pb-6">
        <p className="font-mono text-xs tracking-wide text-primary">{post.tag}</p>
        <h1 className="mt-2 text-3xl font-black leading-[1.15] tracking-tight text-foreground sm:text-[2.6rem]">
          {post.title}
        </h1>
        <p className="mt-4 text-sm text-dust">
          באחריות{" "}
          <Link to="/about" className="font-semibold text-foreground hover:text-primary">
            מייקל חדד
          </Link>
          , מייסד {"קח כיוון"}. המקורות מופיעים בסוף המדריך.
        </p>
        <p className="mt-2 font-mono text-xs text-dust/80">
          עודכן ב־<time dateTime={post.updated}>{formatPostDate(post.updated)}</time> ·{" "}
          {post.readMinutes} דקות קריאה
        </p>
      </header>

      <QuizCta compact className="mt-6" title="רוצים את השורה התחתונה בשבילכם?" />

      <div className="mt-8 space-y-5">
        <Body />
      </div>

      <QuizCta className="mt-12" title="עכשיו השאלה האמיתית: לאילו תפקידים אתם מתאימים?" />

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl font-black text-foreground">שאלות נפוצות</h2>
        <dl className="divide-y divide-iron/25 border-y border-iron/25">
          {faq.map((f) => (
            <div key={f.q} className="py-4">
              <dt className="text-base font-bold text-foreground">{f.q}</dt>
              <dd className="mt-1.5 text-sm leading-7 text-foreground/85">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-10">
        <Sources items={sources} />
        <p className="mt-4 text-xs leading-5 text-dust">
          המידע אינו רשמי ועשוי להשתנות. תנאי הסף, המועדים והשיבוץ נקבעים רק על ידי צה״ל; אמתו באתר
          מתגייסים ובאזור האישי שלכם.
        </p>
      </div>

      <section className="mt-12">
        <h2 className="mb-3 text-lg font-black text-foreground">עוד מדריכים</h2>
        <ul className="grid gap-2">
          {more.map((p) => (
            <li key={p.slug}>
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="flex items-center justify-between gap-3 border border-iron/30 bg-card p-3 text-sm transition hover:border-primary/40"
              >
                <span className="font-bold text-foreground">{p.title}</span>
                <ChevronLeft className="h-4 w-4 shrink-0 text-dust" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function PostNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center" dir="rtl">
      <h1 className="text-2xl font-black text-foreground">המדריך לא נמצא</h1>
      <p className="mt-3 text-sm text-dust">ייתכן שהכתובת השתנתה. כל המדריכים נמצאים בעמוד אחד.</p>
      <Link
        to="/blog"
        className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
      >
        לכל המדריכים
      </Link>
    </div>
  );
}
