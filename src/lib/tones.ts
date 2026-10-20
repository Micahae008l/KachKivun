/**
 * The site's secondary accents. Olive stays the action color (buttons, links); sand, steel and
 * rust only mark data, fields and sections, so the site gets color without losing its one CTA.
 * Full class strings on purpose: Tailwind only ships classes it can see written out.
 */
export const TONES = {
  olive: {
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary",
    soft: "border-primary/40",
    tile: "border-primary bg-primary/10",
    icon: "border-primary/25 bg-primary/10 text-primary",
    dot: "bg-primary",
    /** Start edge only (right in RTL), for list rows. */
    edge: "border-r-primary",
    /** Top edge only, for cards. */
    top: "border-t-primary",
    stroke: "var(--primary)",
  },
  sand: {
    text: "text-sand",
    bg: "bg-sand/10",
    border: "border-sand",
    soft: "border-sand/40",
    tile: "border-sand bg-sand/10",
    icon: "border-sand/25 bg-sand/10 text-sand",
    dot: "bg-sand",
    /** Start edge only (right in RTL), for list rows. */
    edge: "border-r-sand",
    /** Top edge only, for cards. */
    top: "border-t-sand",
    stroke: "var(--sand)",
  },
  steel: {
    text: "text-steel",
    bg: "bg-steel/10",
    border: "border-steel",
    soft: "border-steel/40",
    tile: "border-steel bg-steel/10",
    icon: "border-steel/25 bg-steel/10 text-steel",
    dot: "bg-steel",
    /** Start edge only (right in RTL), for list rows. */
    edge: "border-r-steel",
    /** Top edge only, for cards. */
    top: "border-t-steel",
    stroke: "var(--steel)",
  },
  rust: {
    text: "text-rust",
    bg: "bg-rust/10",
    border: "border-rust",
    soft: "border-rust/40",
    tile: "border-rust bg-rust/10",
    icon: "border-rust/25 bg-rust/10 text-rust",
    dot: "bg-rust",
    /** Start edge only (right in RTL), for list rows. */
    edge: "border-r-rust",
    /** Top edge only, for cards. */
    top: "border-t-rust",
    stroke: "var(--rust)",
  },
  maroon: {
    text: "text-maroon",
    bg: "bg-maroon/10",
    border: "border-maroon",
    soft: "border-maroon/40",
    tile: "border-maroon bg-maroon/10",
    icon: "border-maroon/25 bg-maroon/10 text-maroon",
    dot: "bg-maroon",
    /** Start edge only (right in RTL), for list rows. */
    edge: "border-r-maroon",
    /** Top edge only, for cards. */
    top: "border-t-maroon",
    stroke: "var(--maroon)",
  },
  teal: {
    text: "text-teal",
    bg: "bg-teal/10",
    border: "border-teal",
    soft: "border-teal/40",
    tile: "border-teal bg-teal/10",
    icon: "border-teal/25 bg-teal/10 text-teal",
    dot: "bg-teal",
    /** Start edge only (right in RTL), for list rows. */
    edge: "border-r-teal",
    /** Top edge only, for cards. */
    top: "border-t-teal",
    stroke: "var(--teal)",
  },
} as const;
export type Tone = keyof typeof TONES;

/**
 * The catalog has ~190 fine-grained categories; the site groups them into a dozen fields, each
 * with a color loosely after its beret (combat maroon, tech teal, air and sea blue-grey). First match wins, so the order matters (סייבר before מודיעין, רפואה before הדרכה).
 */
export const ROLE_FIELDS = [
  { key: "combat", label: "לחימה", tone: "maroon", re: /לחימה|קומנדו|סיירות/ },
  {
    key: "cyber",
    label: "סייבר ומחשבים",
    tone: "teal",
    re: /סייבר|מקצועות המחשב|תוכנה|דאטה|אבטחת מידע|ביטחון מידע|תקשוב/,
  },
  { key: "intel", label: "מודיעין", tone: "sand", re: /מודיעין|שב"כ|מוסד|סיווג/ },
  { key: "air", label: "חיל האוויר", tone: "steel", re: /אוויר|כטמ/ },
  { key: "navy", label: "חיל הים", tone: "steel", re: /חיל הים|ימי/ },
  { key: "medical", label: "רפואה", tone: "olive", re: /רפוא|שיניים/ },
  {
    key: "tech",
    label: "טכנולוגיה והנדסה",
    tone: "teal",
    re: /טכנולוג|הנדס|מערך טכני|אלקטרוניק|בינוי|תשתיות/,
  },
  {
    key: "academic",
    label: "עתודה ומסלולי מצוינות",
    tone: "sand",
    re: /עתודה|עילית|מצטיינים|הנדסאים/,
  },
  { key: "instruction", label: "הדרכה, חינוך ופיקוד", tone: "olive", re: /הדרכה|חינוך|פיקוד|כושר/ },
  { key: "media", label: "תקשורת, דוברות ואמנות", tone: "sand", re: /דוברות|תקשורת|אמנות|מוזיקה/ },
  {
    key: "logistics",
    label: "לוגיסטיקה, מנהלה ושירות",
    tone: "olive",
    re: /לוגיסטיקה|תובלה|מנהלה|מטה|כספים|משאבי אנוש|שירות|גיוס|רבנות|משפטים|משטרה|אבחון|פסיכולוג|מבצעים|חירום|תיאום/,
  },
] as const satisfies readonly { key: string; label: string; tone: Tone; re: RegExp }[];

export type RoleField = (typeof ROLE_FIELDS)[number];

export function roleField(r: { category?: string | null; combat?: boolean }): RoleField {
  if (r.combat) return ROLE_FIELDS[0];
  return (
    ROLE_FIELDS.find((f) => f.re.test(r.category ?? "")) ?? ROLE_FIELDS[ROLE_FIELDS.length - 1]
  );
}

/** Match %: green when strong, sand in the middle, rust when a stretch. Real scores run 64-96, median 82. */
export function matchTone(pct: number): Tone {
  return pct >= 85 ? "olive" : pct >= 75 ? "sand" : "rust";
}

/** Each guide section in its own color; combat keeps the combat maroon used across the site. */
const BLOG_TAG_TONE: Record<string, Tone> = {
  תפקידים: "teal",
  לחימה: "maroon",
  "הליך הגיוס": "steel",
  "השירות עצמו": "sand",
  מסלולים: "olive",
};
export const tagTone = (tag: string) => TONES[BLOG_TAG_TONE[tag] ?? "olive"];
