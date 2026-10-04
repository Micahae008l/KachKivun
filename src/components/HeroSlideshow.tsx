import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { HERO_SLIDES, type HeroSlide } from "@/lib/hero-slideshow";
import { ARIA } from "@/lib/a11y";

const ease = [0.16, 1, 0.3, 1] as const;
const INTERVAL_MS = 5500;

type Props = {
  className?: string;
  slides?: readonly HeroSlide[];
  controls?: boolean;
};

export function HeroSlideshow({ className = "", slides = HERO_SLIDES, controls = true }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = setInterval(next, INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, next, count]);

  const slide = slides[index];

  return (
    <section
      className={`group relative overflow-hidden bg-background ${className}`}
      aria-roledescription="מצגת"
      aria-label={ARIA.heroSlideshow}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.img
          key={slide.id}
          src={slide.src}
          alt={slide.alt}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: slide.position ?? "center" }}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.85, ease }}
          decoding="async"
        />
      </AnimatePresence>

      {/* Cinematic overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-background/70 via-background/15 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,transparent_0%,oklch(0.1_0.005_260/0.3)_100%)]" />

      {/* Progress bars */}
      <div
        className={`absolute top-4 left-4 right-4 z-10 flex gap-1.5${controls ? "" : " hidden"}`}
        role="tablist"
        aria-label={ARIA.heroSlideshow}
      >
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-current={i === index ? "true" : undefined}
            aria-label={
              i === index ? ARIA.heroSlideCurrent(i + 1, count) : ARIA.heroSlide(i + 1, count)
            }
            onClick={() => setIndex(i)}
            className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-foreground/15"
          >
            {i < index ? (
              <span className="absolute inset-0 bg-primary" />
            ) : i === index ? (
              <motion.span
                key={`${index}-${paused}`}
                className="absolute inset-y-0 right-0 bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: paused ? 0.01 : INTERVAL_MS / 1000,
                  ease: "linear",
                }}
              />
            ) : null}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className={`absolute bottom-4 left-4 z-10 flex items-center gap-2${controls ? "" : " hidden"}`}>
        <button
          type="button"
          onClick={prev}
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-iron/40 bg-background/70 text-foreground backdrop-blur-sm transition hover:border-primary/50 hover:text-primary"
          aria-label={ARIA.heroPrev}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={next}
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-iron/40 bg-background/70 text-foreground backdrop-blur-sm transition hover:border-primary/50 hover:text-primary"
          aria-label={ARIA.heroNext}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-iron/40 bg-background/70 text-dust backdrop-blur-sm transition hover:text-foreground"
          aria-label={paused ? ARIA.heroPlay : ARIA.heroPause}
        >
          {paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
        </button>
        <span
          className="mr-1 font-mono text-[10px] tabular-nums text-dust/80"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">{ARIA.heroSlideStatus(index + 1, count)}</span>
          <span aria-hidden>
            {String(index + 1).padStart(2, "0")}/{String(count).padStart(2, "0")}
          </span>
        </span>
      </div>
    </section>
  );
}
