/**
 * Site photo catalog: hero slideshow assets used across panels, role cards, and backdrops.
 * Every photo is openly licensed (Wikimedia Commons). Credits and licenses: src/assets/hero-slideshow/CREDITS.md.
 */
/**
 * Responsive WebP copies of each slide (640/960/1280/1920 wide), made by scripts/hero-webp.py
 * from the slide-N.jpg masters in the same folder.
 */
const WEBP = import.meta.glob<string>("/src/assets/hero-slideshow/slide-*.webp", {
  eager: true,
  import: "default",
});
const WEBP_WIDTHS = [640, 960, 1280, 1920] as const;

function webp(n: number, w: number): string {
  return WEBP[`/src/assets/hero-slideshow/slide-${n}-${w}.webp`];
}

/** `src` (a mid size, also the fallback) and `srcSet` for slide N. */
function slide(n: number): { src: string; srcSet: string } {
  return {
    src: webp(n, 1280),
    srcSet: WEBP_WIDTHS.map((w) => `${webp(n, w)} ${w}w`).join(", "),
  };
}

/**
 * `sizes` for every full-bleed photo. One shared value on purpose: the homepage renders the
 * slideshow twice (mobile background + desktop panel), and the root preload must name the same
 * candidate the <img> picks, so the preloaded file is the one actually used.
 */
export const IDF_PHOTO_SIZES = "(min-width: 1280px) 760px, (min-width: 1024px) 60vw, 100vw";

export type IdfPhoto = {
  id: string;
  src: string;
  /** Responsive WebP candidates; pair with IDF_PHOTO_SIZES */
  srcSet: string;
  alt: string;
  /** CSS object-position for crops */
  objectPosition?: string;
  credit: string;
  creditShort: string;
  /** Short license name shown next to the credit, e.g. "CC BY-SA 2.0" */
  license: string;
  commonsUrl?: string;
  keywords: string[];
};

export const IDF_PHOTO_CATALOG: readonly IdfPhoto[] = [
  {
    id: "s1",
    ...slide(1),
    alt: "לוחם בצללית על רקע שקיעה",
    objectPosition: "center 40%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Israel Defense Forces, CC BY-SA 2.0, via Wikimedia Commons",
    license: "CC BY-SA 2.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_A_Soldier_of_the_Armored_Brigade%27s_Reconnaissance_Unit_Paving_the_Way.jpg",
    keywords: [
      "שקיעה",
      "שטח",
      "לוחם",
      "קרבי",
      'חי"ר',
      "גיוס",
      "לחימה",
      "combat",
      "field",
      "סיור",
      "רפואה",
      "care",
    ],
  },
  {
    id: "s2",
    ...slide(2),
    alt: "טנק מרכבה באימון ברמת הגולן",
    objectPosition: "center 55%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Israel Defense Forces, CC BY-SA 2.0, via Wikimedia Commons",
    license: "CC BY-SA 2.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_401st_Brigade_Training_at_Golan_Heights,_Feb_2010.jpg",
    keywords: ["טנק", "שריון", "מרכבה", "אימון", "שטח", "קרבי", "armor", "גולן"],
  },
  {
    id: "s3",
    ...slide(3),
    alt: "לוחם משגר רחפן תצפית בשטח פתוח",
    objectPosition: "center 45%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Israel Defense Forces, CC BY-SA 3.0, via Wikimedia Commons",
    license: "CC BY-SA 3.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_Skylark_Drone_Flight_Training_(4).jpg",
    keywords: [
      "רחפן",
      "רחפנים",
      'מל"ט',
      "drone",
      "תצפית",
      "טכנולוגיה",
      "סייבר",
      "מחשב",
      "it",
      "cyber",
      "data",
      "מערכות",
      "תוכנה",
      "מודיעין",
      "מטאור",
      "תותחנים",
    ],
  },
  {
    id: "s4",
    ...slide(4),
    alt: "צוות על סיפון ספינת טילים בשקיעה",
    objectPosition: "center 55%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Israel Defense Forces, CC BY 2.0, via Wikimedia Commons",
    license: "CC BY 2.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_Crew_Cleaning_on_IDF_Missile_Ship.jpg",
    keywords: ["ים", "חיל הים", "ספינה", "ספינת טילים", "חוף", "navy", "sea", "ימי", "משט"],
  },
  {
    id: "s5",
    ...slide(5),
    alt: "לוחמים מסתערים לצד טנק בשטח",
    objectPosition: "center 45%",
    creditShort: "צילום: דובר צה״ל",
    credit: "IDF Spokesperson's Unit photographer, CC BY-SA 3.0, via Wikimedia Commons",
    license: "CC BY-SA 3.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:High-Ranking_Officers_Training_near_Tze%27elim_(20900623865).jpg",
    keywords: [
      "טנק",
      "שטח",
      "לוחם",
      "קרבי",
      "כפיר",
      "גבעתי",
      "גולני",
      "הסתערות",
      "אימון",
      "urban",
      "combat",
    ],
  },
  {
    id: "s6",
    ...slide(6),
    alt: "לוחם בתצפית על קו הרכס",
    objectPosition: "center 40%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Israel Defense Forces, CC BY 2.0, via Wikimedia Commons",
    license: "CC BY 2.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_Guarding_the_Horizon.jpg",
    keywords: [
      "גבול",
      "שמירה",
      "כוננות",
      "אבטחה",
      "שטח",
      "סיור",
      "border",
      "תצפית",
      "הר",
      'מג"ב',
      "קרקל",
    ],
  },
  {
    id: "s7",
    ...slide(7),
    alt: "טנקים בתרגיל עם עשן צבעוני",
    objectPosition: "center 50%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Israel Defense Forces, CC BY 2.0, via Wikimedia Commons",
    license: "CC BY 2.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_7th_Brigade_Batallion_Exercise,_March_2009.jpg",
    keywords: ["טנק", "עשן", "אימון", "תרגיל", "שטח", "קרבי", "לחימה", "armor", "field", "הנדסה"],
  },
  {
    id: "s8",
    ...slide(8),
    alt: "לוחמים נושאים אלונקה במסע",
    objectPosition: "center 35%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Israel Defense Forces, CC BY-SA 2.0, via Wikimedia Commons",
    license: "CC BY-SA 2.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_IDF_Soldiers_Practice_Operation_Rescues.jpg",
    keywords: [
      "מסע",
      "אלונקה",
      "נחל",
      'נח"ל',
      "צנחנים",
      "צנח",
      "כושר",
      "חילוץ",
      "מסע כומתה",
      "פיקוד העורף",
      "לוחם",
      "רפואה",
      "חובש",
    ],
  },
  {
    id: "s9",
    ...slide(9),
    alt: "טנק בצללית בשקיעה",
    objectPosition: "center 60%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Israel Defense Forces, CC BY-SA 2.0, via Wikimedia Commons",
    license: "CC BY-SA 2.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_7th_Brigade_Batallion_Exercise,_March_2009_(1).jpg",
    keywords: ["לילה", "טנק", "שקיעה", "שריון", "ראיית לילה", "armor"],
  },
  {
    id: "s10",
    ...slide(10),
    alt: "מטוס F-35I אדיר של חיל האוויר",
    objectPosition: "center 50%",
    creditShort: "צילום: U.S. Air Force",
    credit: "Airman 1st Class Trevor Bell, Public domain, via Wikimedia Commons",
    license: "Public domain",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:230315-F-WM701-1003_-_F-35I_Adir_at_Red_Flag.jpg",
    keywords: [
      "חיל האוויר",
      "טייס",
      "טיסה",
      "מטוס",
      "אוויר",
      "טכנאי",
      "מכונאי",
      "תעופה",
      "air force",
      "pilot",
      "aircraft",
    ],
  },
  {
    id: "s11",
    ...slide(11),
    alt: "טקס סיום מסלול עם כומתות",
    objectPosition: "center 30%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Israel Defense Forces, CC BY-SA 2.0, via Wikimedia Commons",
    license: "CC BY-SA 2.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Flickr_-_Israel_Defense_Forces_-_Field_Intelligence_Corps_Recruits%27_Graduation_Ceremony_(1).jpg",
    keywords: [
      "טקס",
      "קצינים",
      "קצין",
      "פיקוד",
      "מודיעין",
      'אמ"ן',
      "מנהלה",
      "admin",
      'משא"ן',
      "חינוך",
      'מש"ק',
      "כומתה",
    ],
  },
  {
    id: "s12",
    ...slide(12),
    alt: "לוחמי נח״ל בזחילה בתרגיל",
    objectPosition: "center 45%",
    creditShort: "צילום: דובר צה״ל",
    credit: "Gadi Yampel / IDF Spokesperson's Unit, CC BY-SA 3.0, via Wikimedia Commons",
    license: "CC BY-SA 3.0",
    commonsUrl:
      "https://commons.wikimedia.org/wiki/File:Nahal_Brigade_Military_Exercise,_October_2014_(15087752174).jpg",
    keywords: ["נחל", 'נח"ל', 'חי"ר', "זחילה", "תרגיל", "לוחם", "קרבי", "שטח", "גדוד", "infantry"],
  },
] as const;

/** Maps old Wikimedia catalog ids → hero slide ids */
export const LEGACY_PHOTO_ALIASES: Record<string, string> = {
  "kfir-training": "s1",
  "border-prep": "s6",
  "nahal-march": "s8",
  "navy-training": "s4",
  paratroopers: "s8",
  "alpine-training": "s8",
  "officer-graduation": "s2",
  "soldiers-snow": "s1",
  "soldiers-climbing": "s8",
};

export const ATTRIBUTION_HE =
  "צילומים: דובר צה״ל ו־U.S. Air Force, ברישיונות פתוחים דרך Wikimedia Commons.";

const catalogById = Object.fromEntries(IDF_PHOTO_CATALOG.map((p) => [p.id, p])) as Record<
  string,
  IdfPhoto
>;

function resolvePhotoId(id: string): string {
  return LEGACY_PHOTO_ALIASES[id] ?? id;
}

function scorePhoto(photo: IdfPhoto, blob: string): number {
  let score = 0;
  for (const kw of photo.keywords) {
    if (blob.includes(kw.toLowerCase())) score += 2;
  }
  return score;
}

/** Pick a catalog photo: keyword match first, then unique spread across ranks (no repeats in one results set). */
export function pickRolePhoto(
  tags: string[],
  title: string,
  rank: number,
  usedIds: Set<string>,
): IdfPhoto {
  const blob = `${tags.join(" ")} ${title}`.toLowerCase();

  const ranked = [...IDF_PHOTO_CATALOG]
    .map((photo) => ({
      photo,
      score: scorePhoto(photo, blob) + (usedIds.has(photo.id) ? -100 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const bestUnused = ranked.find((r) => !usedIds.has(r.photo.id));
  if (bestUnused && bestUnused.score > 0) {
    usedIds.add(bestUnused.photo.id);
    return bestUnused.photo;
  }

  const fallbackIndex = (rank - 1) % IDF_PHOTO_CATALOG.length;
  for (let offset = 0; offset < IDF_PHOTO_CATALOG.length; offset++) {
    const photo = IDF_PHOTO_CATALOG[(fallbackIndex + offset) % IDF_PHOTO_CATALOG.length];
    if (!usedIds.has(photo.id)) {
      usedIds.add(photo.id);
      return photo;
    }
  }

  const photo = IDF_PHOTO_CATALOG[fallbackIndex];
  usedIds.add(photo.id);
  return photo;
}

/**
 * Homepage slideshow and backdrop order. Opens on non-weapon scenes (air force, navy, drone/tech,
 * intelligence, rescue) since most users serve in non-combat roles; the heavier combat shots
 * (s1 silhouette, s5, s7, s9 armour) stay in the catalog for role cards but are left out of the hero.
 */
export const HERO_PHOTO_IDS = ["s10", "s4", "s3", "s11", "s8", "s2", "s6", "s12"] as const;

export const IDF_BACKDROP_PHOTOS: readonly IdfPhoto[] = HERO_PHOTO_IDS.map((id) => catalogById[id]);

export function getIdfPhoto(id: string): IdfPhoto {
  const resolved = resolvePhotoId(id);
  return catalogById[resolved] ?? IDF_PHOTO_CATALOG[0];
}

/** Stable pick for step index, route hash, etc. — spreads across full catalog. */
export function idfPhotoAt(index: number): IdfPhoto {
  const i =
    ((index % IDF_PHOTO_CATALOG.length) + IDF_PHOTO_CATALOG.length) % IDF_PHOTO_CATALOG.length;
  return IDF_PHOTO_CATALOG[i];
}

export function idfPhotosForIds(ids: string[]): IdfPhoto[] {
  return ids.map((id) => getIdfPhoto(id));
}
