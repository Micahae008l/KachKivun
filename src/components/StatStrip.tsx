import { useEffect, useRef, useState } from "react";

export type Stat = { value: number; plus?: boolean; label: string };

/**
 * The site's numbers: plain green numbers with a small label, nothing around them. Plain numbers
 * only: a word next to a number ("כ־8 דק׳") breaks in RTL.
 */
export function StatStrip({ stats, className = "" }: { stats: Stat[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-8 gap-y-5 sm:gap-x-10 ${className}`}>
      {stats.map((s) => (
        <StatItem key={s.label} stat={s} />
      ))}
    </div>
  );
}

function StatItem({ stat }: { stat: Stat }) {
  const { value, plus, label } = stat;
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
          const k = Math.min((now - start) / 800, 1);
          setDisplay(Math.round((1 - Math.pow(1 - k, 3)) * value));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-right">
      <p className="font-mono text-2xl font-bold tabular-nums text-primary sm:text-3xl" dir="ltr">
        {plus ? "+" : ""}
        {display}
      </p>
      <p className="mt-1 text-xs text-dust sm:text-sm">{label}</p>
    </div>
  );
}
