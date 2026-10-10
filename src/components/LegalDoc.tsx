import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

/** Shared shell for the privacy / terms pages: RTL prose, no hero, no motion. */
export function LegalDoc({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="topo-lines" dir="rtl">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-dust transition hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          חזרה לאתר
        </Link>

        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-3 font-mono text-xs tracking-wide text-dust/60 uppercase">
          עדכון אחרון: {lastUpdated}
        </p>

        <div className="mt-10 space-y-8 text-sm leading-[1.85] text-dust">{children}</div>
      </div>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">{heading}</h2>
      {children}
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 pr-5">
      {items.map((item, i) => (
        <li key={i} className="list-disc marker:text-primary/60">
          {item}
        </li>
      ))}
    </ul>
  );
}
