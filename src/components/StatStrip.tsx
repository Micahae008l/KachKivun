import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { TONES, type Tone } from "@/lib/tones";

export type Stat = { value: number; plus?: boolean; label: string; tone: Tone; icon: LucideIcon };

/**
 * The site's numbers as one panel: a strip of the accent colors on top, and per number its own
 * icon and color. Plain numbers only: a word next to a number ("כ־8 דק׳") breaks in RTL.
 */
export function StatStrip({ stats, className = "" }: { stats: Stat[]; className?: string }) {
  return (
    <div
      // gap-px over a tinted background draws the dividers, whatever the column count.
      className={`relative grid gap-px overflow-hidden border border-iron/30 bg-iron/25 backdrop-blur-sm ${className}`}
    >
      <span
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-sand via-steel to-rust"
        aria-hidden
      />
      {stats.map((s) => (
        <StatCell key={s.label} stat={s} />
      ))}
    </div>
  );
}

function StatCell({ stat }: { stat: Stat }) {
  const { value, plus, label, tone, icon: Icon } = stat;
  // Real number in the server HTML (a pre-hydration "+0" looked broken); the count-up runs after.
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / 800, 1);
          setDisplay(Math.round((1 - Math.pow(1 - t, 3)) * value));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="bg-card/90 px-3 py-4 text-right sm:px-4">
      <p
        className={`font-mono text-3xl font-black leading-none tabular-nums ${TONES[tone].text}`}
        dir="ltr"
      >
        {plus ? "+" : ""}
        {display}
      </p>
      <p className="mt-2 flex items-center gap-1.5 whitespace-nowrap text-xs text-foreground/80">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${TONES[tone].text}`} aria-hidden />
        {label}
      </p>
    </div>
  );
}
