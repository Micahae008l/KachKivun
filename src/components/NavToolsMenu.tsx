import { useEffect, useId, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Calculator, ChevronDown, Crosshair, LayoutGrid, Lock, Mountain } from "lucide-react";

/** Free tools that feed into the questionnaire. Shared by the header dropdown, mobile menu and footer. */
export const FREE_TOOLS = [
  {
    to: "/role-calculator",
    label: "מחשבון תפקידים",
    desc: "מה פתוח לכם לפי דפ״ר ופרופיל",
    Icon: Calculator,
    tone: "text-steel",
  },
  {
    to: "/attention-test",
    label: "מבחן קשב",
    desc: "תרגול למבחן הקשב של צו ראשון",
    Icon: Crosshair,
    tone: "text-rust",
  },
  {
    to: "/role-insights",
    label: "תפקידים בצה״ל",
    desc: "דרישות, דפ״ר ופרופיל לכל תפקיד",
    Icon: LayoutGrid,
    tone: "text-teal",
  },
] as const;

export const FREE_TOOLS_LABEL = "כלים חינמיים";

/** Paid, listed after the free tools and marked as such. */
export const PAID_TOOL = {
  to: "/gibush",
  label: "מוכנות לגיבוש",
  desc: "סימולציה של יום הגיבוש ותוכנית אימון",
  Icon: Mountain,
  tone: "text-sand",
} as const;

export function PaidBadge() {
  return (
    <span className="inline-flex items-center gap-1 border border-sand/40 px-1.5 py-px font-mono text-[10px] font-normal text-sand">
      <Lock className="h-2.5 w-2.5" aria-hidden />
      בתשלום
    </span>
  );
}

/** Desktop disclosure: one header item instead of three equal-weight links. */
export function NavToolsMenu({ authed }: { authed: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active =
    pathname.startsWith("/roles/") ||
    pathname.startsWith(PAID_TOOL.to) ||
    FREE_TOOLS.some((t) => pathname.startsWith(t.to));

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`relative flex h-14 items-center gap-1 px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
          active || open
            ? "text-foreground"
            : "text-dust hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        {FREE_TOOLS_LABEL}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} aria-hidden />
        {active && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-primary" aria-hidden />}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute start-0 top-full z-50 w-72 overflow-hidden rounded-md border border-iron/30 bg-background shadow-lg"
        >
          <ul className="py-1">
            {FREE_TOOLS.map(({ to, label, desc, Icon, tone }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-iron/10 focus-visible:bg-iron/10"
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{label}</span>
                    <span className="block text-xs text-dust">{desc}</span>
                  </span>
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-iron/20 pt-1">
              <Link
                to={PAID_TOOL.to}
                className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-iron/10 focus-visible:bg-iron/10"
              >
                <PAID_TOOL.Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${PAID_TOOL.tone}`}
                  aria-hidden
                />
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {PAID_TOOL.label}
                    <PaidBadge />
                  </span>
                  <span className="block text-xs text-dust">{PAID_TOOL.desc}</span>
                </span>
              </Link>
            </li>
          </ul>
          {!authed && (
            <Link
              to="/post-signup"
              className="block border-t border-iron/20 px-4 py-3 text-xs text-dust transition hover:text-foreground"
            >
              רוצים התאמה אישית?{" "}
              <span className="font-semibold text-primary">התחילו את השאלון</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
