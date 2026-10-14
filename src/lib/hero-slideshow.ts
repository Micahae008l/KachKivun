/**
 * Hero slideshow — same assets as the global photo catalog (idf-photo-catalog).
 */
import { IDF_BACKDROP_PHOTOS } from "@/lib/idf-photo-catalog";

export type HeroSlide = {
  id: string;
  src: string;
  srcSet: string;
  alt: string;
  /** CSS object-position */
  position?: string;
};

export const HERO_SLIDES: readonly HeroSlide[] = IDF_BACKDROP_PHOTOS.map((p) => ({
  id: p.id,
  src: p.src,
  srcSet: p.srcSet,
  alt: p.alt,
  position: p.objectPosition,
}));

export const HERO_SLIDE_URLS = HERO_SLIDES.map((s) => s.src);
