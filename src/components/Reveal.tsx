import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fades its content up once it scrolls into view (CSS only, no animation library). */
export function Reveal({
  className = "",
  margin = "0px",
  children,
}: {
  className?: string;
  /** IntersectionObserver rootMargin, e.g. "-60px" to wait until it is a bit inside the screen. */
  margin?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        obs.disconnect();
      },
      { rootMargin: margin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margin]);

  return (
    <div ref={ref} className={`${shown ? "animate-slide-up" : "opacity-0"} ${className}`}>
      {children}
    </div>
  );
}
