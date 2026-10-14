/**
 * IDF photography — see idf-photo-catalog.ts for per-image credits and keywords.
 */
export {
  IDF_PHOTO_CATALOG,
  IDF_BACKDROP_PHOTOS,
  IDF_PHOTO_SIZES,
  ATTRIBUTION_HE,
  pickRolePhoto,
  getIdfPhoto,
  idfPhotoAt,
  idfPhotosForIds,
  type IdfPhoto,
} from "./idf-photo-catalog";

import {
  IDF_BACKDROP_PHOTOS,
  IDF_PHOTO_CATALOG,
  IDF_PHOTO_SIZES,
  LEGACY_PHOTO_ALIASES,
} from "./idf-photo-catalog";

const byId = Object.fromEntries(IDF_PHOTO_CATALOG.map((p) => [p.id, p.src])) as Record<string, string>;
for (const [legacy, slideId] of Object.entries(LEGACY_PHOTO_ALIASES)) {
  byId[legacy] = byId[slideId];
}

export const IDF_IMAGE_KFIR_TRAINING_1600 = byId["kfir-training"];
export const IDF_IMAGE_BORDER_PREP_1600 = byId["border-prep"];
export const IDF_IMAGE_NAHAL_MARCH_1600 = byId["nahal-march"];
export const IDF_IMAGE_NAVY_TRAINING_1600 = byId["navy-training"];
export const IDF_IMAGE_PARATROOPERS_1600 = byId["paratroopers"];
export const IDF_IMAGE_ALPINE_TRAINING = byId["alpine-training"];
export const IDF_IMAGE_OFFICER_GRADUATION = byId["officer-graduation"];
export const IDF_IMAGE_SOLDIERS_SNOW = byId["soldiers-snow"];
export const IDF_IMAGE_SOLDIERS_CLIMBING = byId["soldiers-climbing"];

/** Direct slide URLs (s1–s9) */
export const HERO_SLIDE_IMAGE_URLS = IDF_PHOTO_CATALOG.map((p) => p.src);

const preloadedHrefs = new Set<string>();

/** After load: warms the next slideshow photos, same srcset/sizes as the <img>, so the browser picks the same file. */
export function preloadIdfBackdropImages(): void {
  if (typeof document === "undefined") return;
  const inHead = new Set(
    [...document.querySelectorAll('link[rel="preload"][as="image"]')].map((el) =>
      el.getAttribute("href"),
    ),
  );
  for (const photo of IDF_BACKDROP_PHOTOS.slice(0, 3)) {
    if (preloadedHrefs.has(photo.src) || inHead.has(photo.src)) continue;
    preloadedHrefs.add(photo.src);
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = photo.src;
    link.imageSrcset = photo.srcSet;
    link.imageSizes = IDF_PHOTO_SIZES;
    document.head.appendChild(link);
  }
}
