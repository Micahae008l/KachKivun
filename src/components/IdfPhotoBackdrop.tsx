import { useEffect, useState } from "react";

import { IDF_PHOTO_SIZES } from "@/lib/idf-photo-catalog";

type Props = {
  src: string;
  /** Responsive candidates (dropped on a retry, which goes through `src`). */
  srcSet?: string;
  alt: string;
  /** CSS object-position */
  objectPosition?: string;
  /** Tailwind gradient overlay e.g. from-background/90 via-background/40 to-transparent */
  overlayClassName?: string;
  /** Extra classes on the image */
  imgClassName?: string;
  /** Controls native lazy loading. Default "eager" for hero/above-fold, use "lazy" for below-fold. */
  loading?: "eager" | "lazy";
  /** Fetch priority hint. Default "high" for hero, use "auto" for below-fold. */
  fetchPriority?: "high" | "low" | "auto";
};

const MAX_RETRIES = 2;

function withRetryParam(url: string, attempt: number): string {
  if (attempt <= 0) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}kachkivun_retry=${attempt}`;
}

/**
 * Full-bleed photo with gradient overlay.
 * The image is always painted at full opacity (no "invisible until onLoad" — that breaks with cache + SPA).
 * Base gradient stays underneath until pixels arrive; optional retries on hard failures.
 */
export function IdfPhotoBackdrop({ src, srcSet, alt, objectPosition, overlayClassName, imgClassName, loading = "eager", fetchPriority = "high" }: Props) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    setAttempt(0);
  }, [src]);

  const effectiveSrc = withRetryParam(src, attempt);

  const overlay =
    overlayClassName ??
    "from-background via-background/55 to-background/92 dark:via-background/65";

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-olive/15 via-background to-background">
      {!failed ? (
        <img
          key={`${src}-${attempt}`}
          src={effectiveSrc}
          srcSet={attempt === 0 ? srcSet : undefined}
          sizes={attempt === 0 && srcSet ? IDF_PHOTO_SIZES : undefined}
          alt={alt}
          width={1600}
          height={1067}
          className={`h-full w-full object-cover ${imgClassName ?? ""}`}
          style={objectPosition ? { objectPosition } : undefined}
          onError={() => {
            if (attempt < MAX_RETRIES) setAttempt((a) => a + 1);
            else setFailed(true);
          }}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
        />
      ) : null}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${overlay}`} />
    </div>
  );
}
