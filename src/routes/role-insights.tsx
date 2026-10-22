import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { m } from "framer-motion";
import { ChevronDown, ChevronLeft, Search, Shield } from "lucide-react";
import { listRoles, roleInsightSlug } from "@/lib/api";
import { fetchRoleCatalog } from "@/lib/roles-public";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { QuizCta } from "@/components/QuizCta";
import { getIdfPhoto } from "@/lib/idf-images";
import { ROLE_FIELDS, TONES, roleField } from "@/lib/tones";

type Search = {
  role?: string;
  q?: string;
  category?: string;
};

export const Route = createFileRoute("/role-insights")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    role: typeof raw.role === "string" && raw.role.trim() ? raw.role.trim() : undefined,
    q: typeof raw.q === "string" && raw.q.trim() ? raw.q.trim() : undefined,
    category:
      typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : undefined,
  }),
  // Old shared links opened a role as ?role=; each role now has its own page.
  beforeLoad: ({ search }) => {
    if (search.role) {
      throw redirect({
        to: "/roles/$slug",
        params: { slug: roleInsightSlug(decodeURIComponent(search.role)) },
        statusCode: 301,
      });
    }
  },
  loader: () => fetchRoleCatalog(),
  component: RoleInsightsPage,
  head: ({ loaderData }) => {
    const title = `תפקידים בצה״ל: ${loaderData?.total ?? 300}+ תפקידים, דרישות ודפ״ר | קח כיוון`;
    const description =
      "כל התפקידים בצה״ל במקום אחד: מה עושים ביומיום, דפ״ר ופרופיל מינימליים, משך שירות ואיפה משרתים. חיפוש לפי שם, חיל או תחום.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
      links: [{ rel: "canonical", href: "https://kachkivun.com/role-insights" }],
    };
  },
});

const ease = [0.16, 1, 0.3, 1] as const;

function RoleInsightsPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const fullCatalog = Route.useLoaderData();

  const [query, setQuery] = useState(search.q || "");
  const deferredQ = useDeferredValue(query.trim());

  const listQuery = useQuery({
    queryKey: ["roles-catalog", deferredQ],
    queryFn: () => listRoles({ q: deferredQ || undefined }),
    // The unfiltered list is rendered on the server, so search engines see every role.
    initialData: !deferredQ ? (fullCatalog ?? undefined) : undefined,
    staleTime: 5 * 60_000,
  });

  const field = ROLE_FIELDS.find((f) => f.key === search.category);
  const roles = (listQuery.data?.roles ?? []).filter(
    (r) => !field || roleField(r).key === field.key,
  );

  function setCategory(category?: string) {
    void navigate({
      search: (prev) => ({
        ...prev,
        category: category || undefined,
        role: undefined,
      }),
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 topo-lines">
      <m.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
        className="relative overflow-hidden border border-iron/30 p-5 text-right sm:p-8"
      >
        <IdfPhotoPanel
          photo={getIdfPhoto("s8")}
          aspectClassName="absolute inset-0 min-h-0"
          className="absolute inset-0"
          overlayClassName="from-background/70 via-background/85 to-background"
          imgClassName="object-[center_30%]"
        />
        <div className="relative space-y-3">
          <p className="font-mono text-xs tracking-wide text-primary uppercase">קטלוג תפקידים</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            תפקידים בצה״ל
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-dust sm:text-base">
            כל {listQuery.data?.total ?? "300+"} התפקידים בצה״ל: מה עושים ביומיום, דפ״ר ופרופיל
            מינימליים, משך שירות, וקישור לאתר מתגייסים הרשמי.
          </p>
          <p className="text-sm text-dust">
            מחפשות לפי תחום?{" "}
            <Link
              to="/blog/$slug"
              params={{ slug: "תפקידים-בצבא-לבנות" }}
              className="font-semibold text-primary underline decoration-primary/40 underline-offset-4"
            >
              תפקידים בצבא לבנות
            </Link>
            {" · "}
            <Link
              to="/blog"
              className="font-semibold text-primary underline decoration-primary/40 underline-offset-4"
            >
              כל המדריכים
            </Link>
          </p>
        </div>
      </m.header>

      <QuizCta compact title="לא בטוחים מאיפה להתחיל?" />

      {/* Search and one field filter; a wall of category chips read as clutter. */}
      <div className="flex flex-col gap-2 sm:flex-row" dir="rtl">
        <label className="relative block flex-1">
          <span className="sr-only">חיפוש תפקיד</span>
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dust" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם, קטגוריה או מילת מפתח…"
            className="input-field w-full pr-10"
          />
        </label>
        <label className="relative block sm:w-60">
          <span className="sr-only">סינון לפי תחום</span>
          <select
            value={search.category ?? ""}
            onChange={(e) => setCategory(e.target.value || undefined)}
            className="input-field w-full cursor-pointer appearance-none pl-9"
          >
            <option value="">כל התחומים</option>
            {ROLE_FIELDS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dust" />
        </label>
      </div>

      <p className="text-right text-xs text-dust" dir="rtl">
        {listQuery.isLoading
          ? "טוען…"
          : listQuery.isError
            ? "לא הצלחנו לטעון את הקטלוג"
            : `מציגים ${roles.length} מתוך ${listQuery.data?.total ?? 0} תפקידים`}
      </p>

      {listQuery.isError ? (
        <div className="border border-destructive/30 bg-destructive/5 p-5 text-right" dir="rtl">
          <p className="text-sm font-semibold text-foreground">שגיאה בטעינת התפקידים</p>
          <p className="mt-1 text-sm text-dust">רעננו את העמוד או נסו שוב בעוד רגע.</p>
          <button
            type="button"
            onClick={() => void listQuery.refetch()}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            נסו שוב
          </button>
        </div>
      ) : null}

      {/* Phones: a compact list (name, field, combat) you can scan; the summary shows from sm up. */}
      <div className="grid border-t border-iron/20 sm:grid-cols-2 sm:gap-3 sm:border-t-0" dir="rtl">
        {roles.map((r) => {
          const f = roleField(r);
          const t = TONES[f.tone];
          return (
            <Link
              key={r.slug}
              to="/roles/$slug"
              params={{ slug: r.slug }}
              className={`flex items-center gap-3 border-b border-r-2 border-iron/20 px-3 py-3 text-right transition hover:bg-card sm:block sm:border sm:bg-card sm:p-4 ${t.edge}`}
            >
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-bold leading-snug text-foreground sm:text-base">
                    {r.roleTitle}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-dust sm:mt-1">
                    <span className={`font-bold ${t.text}`}>{f.label}</span>
                    {r.category && r.category !== f.label ? ` · ${r.category}` : null}
                  </p>
                </div>
                {r.combat ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-maroon/30 bg-maroon/10 px-2 py-0.5 text-[10px] text-maroon">
                    <Shield className="h-3 w-3" aria-hidden />
                    קרבי
                  </span>
                ) : null}
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-dust/60 sm:hidden" aria-hidden />
              <p className="mt-2 hidden line-clamp-2 text-xs leading-relaxed text-dust sm:block">
                {r.summary}
              </p>
              {r.signals.length ? (
                <p className="mt-2 hidden text-[11px] text-dust/80 sm:block">
                  {r.signals.slice(0, 3).join(" · ")}
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>

      {!listQuery.isLoading && !listQuery.isError && roles.length === 0 ? (
        <p className="py-10 text-center text-sm text-dust">לא נמצאו תפקידים לחיפוש הזה.</p>
      ) : null}

      <QuizCta
        title={`${listQuery.data?.total ?? "300+"} תפקידים זה הרבה לעבור לבד`}
        body="השאלון האישי עושה את הסינון בשבילכם: מצליב את הדפ״ר, הפרופיל הרפואי ו־11 ציוני המא״ה מול כל הקטלוג, ומחזיר את 5 התפקידים שהכי מתאימים לכם, עם הסבר וסיכויי קבלה."
      />
    </div>
  );
}
