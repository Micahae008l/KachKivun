/**
 * The gibush page's own photos. Every one is openly licensed (Wikimedia Commons) and credited next
 * to the image and on /about. Credits and licenses: src/assets/gibush/CREDITS.md. WebP copies at
 * 640 and 1280 wide, made by scripts/hero-webp.py from the JPG masters.
 */
const WEBP = import.meta.glob<string>("/src/assets/gibush/*.webp", {
  eager: true,
  import: "default",
});
const WIDTHS = [640, 1280] as const;

function webp(name: string): { src: string; srcSet: string } {
  const at = (w: number) => WEBP[`/src/assets/gibush/${name}-${w}.webp`];
  return { src: at(1280), srcSet: WIDTHS.map((w) => `${at(w)} ${w}w`).join(", ") };
}

export type GibushPhoto = {
  id: string;
  src: string;
  srcSet: string;
  alt: string;
  /** CSS object-position for crops */
  position: string;
  /** Shown next to the photo: what it really shows (none was taken at a gibush) and its credit. */
  caption: string;
  /** Full credit for /about, in the same form as the site's other photos. */
  credit: string;
  commonsUrl: string;
};

const photo = (id: string, p: Omit<GibushPhoto, "id" | "src" | "srcSet">): GibushPhoto => ({
  id,
  ...webp(id),
  ...p,
});

export const DAWN = photo("dawn", {
  alt: "צנחן בצללית על רכס מול שמש נמוכה",
  position: "42% 65%",
  caption: "צנחנים באימון, 2010. צילום: דובר צה״ל, CC BY 2.0",
  credit: "Israel Defense Forces, CC BY 2.0, via Wikimedia Commons",
  commonsUrl:
    "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_Paratroopers_in_Training.jpg",
});

export const STRETCHER = photo("stretcher", {
  alt: "אלונקה נישאת בשדה, מצולמת מאחור",
  position: "45% 50%",
  caption: "תרגיל של יחידת אגוז, 2020. צילום: דובר צה״ל, CC BY-SA 3.0",
  credit: "IDF Spokesperson's Unit photographer, CC BY-SA 3.0, via Wikimedia Commons",
  commonsUrl: "https://commons.wikimedia.org/wiki/File:Egoz_September_2020,_II.jpg",
});

export const DUNE = photo("dune", {
  alt: "הדיונה הגדולה של אשדוד",
  position: "50% 70%",
  caption: "הדיונה הגדולה של אשדוד, 2023. CC0",
  credit: "מקף־עברי, CC0, via Wikimedia Commons",
  commonsUrl:
    "https://commons.wikimedia.org/wiki/File:%D7%94%D7%93%D7%99%D7%95%D7%A0%D7%94_%D7%94%D7%92%D7%93%D7%95%D7%9C%D7%94_%D7%A9%D7%9C_%D7%90%D7%A9%D7%93%D7%95%D7%93,_%D7%93%D7%A6%D7%9E%D7%91%D7%A8_2023.jpg",
});

const RIPPLES = photo("ripples", {
  alt: "גלי חול על דיונה",
  position: "50% 50%",
  caption: "גלי חול. צילום: Chenspec, CC BY-SA 3.0",
  credit: "Chenspec, CC BY-SA 3.0, via Wikimedia Commons",
  commonsUrl: "https://commons.wikimedia.org/wiki/File:Sand_dune.jpg",
});

const TRACKS = photo("tracks", {
  alt: "חולות ראשון לציון ב־1945, עם עקבות דחפור",
  position: "50% 50%",
  caption: "חולות ראשון לציון, 1945. צילום: זולטן קלוגר, לע״מ, נחלת הכלל",
  credit: "Zoltan Kluger, GPO (לע״מ), public domain, via Wikimedia Commons (PikiWiki Israel)",
  commonsUrl:
    "https://commons.wikimedia.org/wiki/File:112105_rishon_lezion_sand_dunes_PikiWiki_Israel.jpg",
});

export const GIBUSH_PHOTOS: readonly GibushPhoto[] = [DAWN, STRETCHER, DUNE, RIPPLES, TRACKS];

/** Hours since midnight, from a stage's "HH:MM". */
const hour = (clock: string) => Number(clock.slice(0, 2)) + Number(clock.slice(3, 5)) / 60;

/** The run's backdrop follows the day: first light, the dune, the sand pits, the stretcher, the afternoon. */
export function backdropFor(clock: string): GibushPhoto {
  const h = hour(clock);
  return h < 6 ? DAWN : h < 8 ? DUNE : h < 10 ? RIPPLES : h < 13 ? STRETCHER : TRACKS;
}

/** The part of the day a moment belongs to; the run shows this instead of a clock. */
export function partOfDay(clock: string): string {
  const h = hour(clock);
  return h < 10 ? "בוקר" : h < 13 ? "צהריים" : "אחר הצהריים";
}
