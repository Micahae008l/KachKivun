import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { roleInsightSlug } from "@/lib/api";
import { getBlogPost } from "@/lib/blog";

/** Building blocks for blog post bodies, so every post reads and links the same way. */

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 pt-4 text-2xl font-black leading-tight text-foreground">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-1 text-lg font-bold text-foreground">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-base leading-[1.85] text-foreground/85">{children}</p>;
}

export function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 pr-5 text-base leading-[1.8] text-foreground/85">
      {items.map((item, i) => (
        <li key={i} className="list-disc marker:text-primary/70">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function OL({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2 pr-5 text-base leading-[1.8] text-foreground/85">
      {items.map((item, i) => (
        <li key={i} className="list-decimal marker:font-mono marker:text-primary">
          {item}
        </li>
      ))}
    </ol>
  );
}

/** The one fact worth remembering from a section. */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="border-r-2 border-primary bg-primary/5 p-4 sm:p-5">
      <p className="text-sm font-black text-primary">{title}</p>
      <div className="mt-1.5 text-sm leading-7 text-foreground/90">{children}</div>
    </aside>
  );
}

/** Inline link to a role page; `title` must be the exact catalog title. */
export function RoleLink({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Link
      to="/roles/$slug"
      params={{ slug: roleInsightSlug(title) }}
      className="font-semibold text-primary underline decoration-primary/40 underline-offset-4 transition hover:decoration-primary"
    >
      {children ?? title}
    </Link>
  );
}

export function PostLink({ slug, children }: { slug: string; children?: ReactNode }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug }}
      className="font-semibold text-primary underline decoration-primary/40 underline-offset-4 transition hover:decoration-primary"
    >
      {children ?? getBlogPost(slug)?.shortTitle ?? slug}
    </Link>
  );
}

export type RoleFact = {
  /** Exact catalog title. */
  title: string;
  dapar?: number;
  profile?: number;
  note?: string;
};

/** Roles with their thresholds; each row links to the role page, which holds the current figures. */
export function RoleTable({ roles }: { roles: RoleFact[] }) {
  return (
    <ul className="divide-y divide-iron/25 border border-iron/30 bg-card">
      {roles.map((r) => (
        <li key={r.title}>
          <Link
            to="/roles/$slug"
            params={{ slug: roleInsightSlug(r.title) }}
            className="flex items-center justify-between gap-3 p-3 transition hover:bg-primary/5 sm:px-4"
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">{r.title}</span>
              {r.note ? <span className="mt-0.5 block text-xs text-dust">{r.note}</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-2 font-mono text-xs tabular-nums text-dust">
              {r.dapar != null ? <span>דפ״ר {r.dapar}+</span> : null}
              {r.profile != null ? <span>פרופיל {r.profile}+</span> : null}
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Plain list of role links, for roles we link to without quoting thresholds. */
export function RoleChips({ titles }: { titles: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {titles.map((t) => (
        <li key={t}>
          <Link
            to="/roles/$slug"
            params={{ slug: roleInsightSlug(t) }}
            className="inline-flex min-h-9 items-center border border-iron/30 bg-card px-3 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary"
          >
            {t}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type Source = { label: string; href: string };

export function Sources({ items }: { items: Source[] }) {
  return (
    <section className="border-t border-iron/30 pt-6">
      <h2 className="text-sm font-black text-foreground">מקורות</h2>
      <ul className="mt-3 space-y-2">
        {items.map((s) => (
          <li key={s.href}>
            <a
              href={encodeURI(s.href)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1.5 text-sm text-dust transition hover:text-primary"
            >
              <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
