import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Accessibility, Minus, Plus, RotateCcw, X } from "lucide-react";
import { ARIA } from "@/lib/a11y";
import {
  type A11yPrefs,
  applyA11yPrefs,
  DEFAULT_A11Y_PREFS,
  readA11yPrefs,
  saveA11yPrefs,
} from "@/lib/a11y-prefs";

export function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_A11Y_PREFS);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const next = readA11yPrefs();
    setPrefs(next);
    applyA11yPrefs(next);
  }, []);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  function update(partial: Partial<A11yPrefs>) {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    saveA11yPrefs(next);
  }

  function cycleText(dir: 1 | -1) {
    const order = ["md", "lg", "xl"] as const;
    const i = order.indexOf(prefs.text);
    const next = order[Math.min(order.length - 1, Math.max(0, i + dir))];
    update({ text: next });
  }

  return (
    <div
      ref={rootRef}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[70] flex flex-col items-start"
      dir="rtl"
    >
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={ARIA.a11yMenu}
          className="mb-2 w-[min(18.5rem,calc(100vw-2rem))] rounded-sm border border-iron/50 bg-background/98 p-3 shadow-[0_8px_32px_oklch(0_0_0/0.5)] backdrop-blur-sm"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-iron/25 pb-2">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Accessibility className="h-3.5 w-3.5 text-primary" aria-hidden />
              נגישות
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center text-dust transition hover:text-foreground"
              aria-label={ARIA.closeA11yMenu}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-sm border border-iron/25 bg-card px-3 py-2">
              <span className="text-xs text-dust">גודל טקסט</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => cycleText(-1)}
                  disabled={prefs.text === "md"}
                  className="flex h-8 w-8 items-center justify-center text-foreground transition hover:text-primary disabled:opacity-30"
                  aria-label="הקטן טקסט"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="w-8 text-center font-mono text-xs tabular-nums text-foreground">
                  {prefs.text === "md" ? "א" : prefs.text === "lg" ? "אא" : "אאא"}
                </span>
                <button
                  type="button"
                  onClick={() => cycleText(1)}
                  disabled={prefs.text === "xl"}
                  className="flex h-8 w-8 items-center justify-center text-foreground transition hover:text-primary disabled:opacity-30"
                  aria-label="הגדל טקסט"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>

            <ToggleRow
              label="ניגודיות גבוהה"
              pressed={prefs.contrast}
              onClick={() => update({ contrast: !prefs.contrast })}
            />
            <ToggleRow
              label="הפחתת אנימציה"
              pressed={prefs.reduceMotion}
              onClick={() => update({ reduceMotion: !prefs.reduceMotion })}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-iron/20 pt-2">
            <Link
              to="/accessibility"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              הצהרת נגישות
            </Link>
            <button
              type="button"
              onClick={() => {
                setPrefs(DEFAULT_A11Y_PREFS);
                saveA11yPrefs(DEFAULT_A11Y_PREFS);
              }}
              className="inline-flex items-center gap-1 text-xs text-dust transition hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              איפוס
            </button>
          </div>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group flex h-11 items-center gap-2 rounded-sm border bg-background/90 px-3 shadow-[0_6px_20px_oklch(0_0_0/0.5)] backdrop-blur-sm transition-colors ${
          open ? "border-primary/70" : "border-iron/60 hover:border-primary/60"
        }`}
        aria-label={open ? ARIA.closeA11yMenu : ARIA.openA11yMenu}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Accessibility className="h-5 w-5 text-primary" aria-hidden />
        <span className="hidden text-xs font-semibold text-dust transition-colors group-hover:text-foreground sm:inline">
          נגישות
        </span>
      </button>
    </div>
  );
}

function ToggleRow({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex w-full items-center justify-between gap-3 rounded-sm border bg-card px-3 py-2 text-right transition-colors ${
        pressed ? "border-primary/50" : "border-iron/25 hover:border-iron/50"
      }`}
    >
      <span className="text-xs text-foreground">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-sm transition-colors ${
          pressed ? "bg-primary" : "bg-iron/50"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-[1px] bg-background transition-[inset-inline-start] ${
            pressed ? "start-4" : "start-0.5"
          }`}
        />
      </span>
    </button>
  );
}
