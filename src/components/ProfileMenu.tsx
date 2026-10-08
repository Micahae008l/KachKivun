import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, LogOut, Pencil, ReceiptText, Shield, Sparkles, User } from "lucide-react";

type Props = {
  displayName?: string;
  isAdmin?: boolean;
  onLogout: () => void;
  /** Compact trigger for mobile drawer sections */
  variant?: "dropdown" | "list";
  onNavigate?: () => void;
};

export function ProfileMenu({
  displayName,
  isAdmin,
  onLogout,
  variant = "dropdown",
  onNavigate,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const label = displayName?.trim() || "פרופיל";

  useEffect(() => {
    if (variant !== "dropdown" || !open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, variant]);

  function close() {
    setOpen(false);
    onNavigate?.();
  }

  const items = (
    <>
      <Link
        to="/ai-counselor"
        onClick={close}
        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition hover:bg-iron/10"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        היועץ האישי
      </Link>
      <Link
        to="/dashboard"
        onClick={close}
        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition hover:bg-iron/10"
      >
        <LayoutDashboard className="h-4 w-4 shrink-0 text-dust" aria-hidden />
        דשבורד
      </Link>
      {/* Profile editing lives in the dashboard's account panel, which is open by default. */}
      <Link
        to="/dashboard"
        hash="account-preferences-heading"
        onClick={close}
        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition hover:bg-iron/10"
      >
        <Pencil className="h-4 w-4 shrink-0 text-dust" aria-hidden />
        עריכת פרופיל
      </Link>
      <Link
        to="/cancellation"
        onClick={close}
        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition hover:bg-iron/10"
      >
        <ReceiptText className="h-4 w-4 shrink-0 text-dust" aria-hidden />
        תשלומים וביטולים
      </Link>
      {isAdmin ? (
        <Link
          to="/admin"
          onClick={close}
          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition hover:bg-iron/10"
        >
          <Shield className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          ניהול
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => {
          close();
          onLogout();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm text-dust transition hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        יציאה
      </button>
    </>
  );

  if (variant === "list") {
    return (
      <div className="border-t border-iron/20 pt-2 mt-1">
        <p className="px-2 pb-1 font-mono text-[10px] tracking-widest text-dust/60 uppercase">פרופיל</p>
        {items}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[10rem] items-center gap-1.5 rounded-md border border-iron/40 bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-primary/40"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <User className="h-4 w-4 shrink-0 text-dust" aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-dust transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute end-0 top-full z-50 mt-1 min-w-[13rem] overflow-hidden rounded-md border border-iron/30 bg-background py-1 shadow-lg"
        >
          {items}
        </div>
      ) : null}
    </div>
  );
}
