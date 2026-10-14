/**
 * Display-ready content for a public role page, built only from fields that exist in the
 * catalog and the enrichment overrides. A missing field yields no section and no FAQ entry;
 * nothing here invents a fact.
 */

export const he = (s) =>
  String(s ?? "").replace(/(?<=[\u0590-\u05FF])"(?=[\u0590-\u05FF])/g, "״");

const SELECTION_RE = /גיבוש|מיון|מיוני|יום סיירות|יום חשיפה|ראיון|ראיונות|מבדק|דראפט|זימון|הרשמה|סינון/;
const TRAINING_RE = /שבועות|חודשים|חודשי הכשרה|טירונות|קורס|קד״צ|טר״צ|בה״ד/;

const strip = (s) => s.replace(/[.\s]+$/, "");

const reqs = (role) => (role.requirements || []).map((r) => strip(he(r))).filter(Boolean);
const PROFILE_REQ_RE = /פרופיל \d|פרופיל עורפי/;
const profileReq = (role) => reqs(role).find((r) => PROFILE_REQ_RE.test(r) && !r.includes("דפ״ר"));

/**
 * The profile floor worth showing. 21 is the bottom of the scale, so as a floor it says
 * nothing; and when the requirement text names a different profile, the text wins.
 */
export function profileFloor(role) {
  const f = role.medicalFloor;
  if (f == null || f === 21) return null;
  const req = profileReq(role);
  if (req && /\d/.test(req) && !req.includes(String(f))) return null;
  return f;
}

/** Split the free-text requirements into selection steps, training facts and the rest. */
export function groupRequirements(role) {
  const out = { selection: [], training: [], other: [] };
  const floors = new Set(
    [
      ...(role.daparFloor != null ? [`דפ״ר ${role.daparFloor} ומעלה`, `דפ״ר ${role.daparFloor}`] : []),
      ...(profileFloor(role) != null
        ? [`פרופיל ${profileFloor(role)} ומעלה`, `פרופיל ${profileFloor(role)}`]
        : []),
    ],
  );
  for (const r of reqs(role)) {
    // Source notes ("לפי עמוד ...") are caveats, not steps.
    if (!r.startsWith("לפי ") && SELECTION_RE.test(r)) out.selection.push(r);
    else if (!r.startsWith("לפי ") && TRAINING_RE.test(r)) out.training.push(r);
    else if (!floors.has(r)) out.other.push(r); // the floor tiles already say it
  }
  return out;
}

/** "https://www.mitgaisim.idf.il/..." for a specific official role page, else null. */
export function officialSourceUrl(...candidates) {
  for (const c of candidates) {
    const m = /^(?:https?:\/\/)?(?:www\.)?mitgaisim\.idf\.il\/(\S+)$/.exec(String(c || "").trim());
    if (!m) continue;
    const path = m[1].replace(/^\/+/, "");
    if (/^(roles|תפקידים)\/?$/.test(path)) continue; // the directory, not a role page
    try {
      return new URL(`https://www.mitgaisim.idf.il/${path}`).href;
    } catch {
      /* not a URL */
    }
  }
  return null;
}

// Hebrew prefix "ל" attaches to the word: ל + לוחם בגולני = ללוחם בגולני.
const to = (title) => `ל${title}`;

// "all" is the common case, so only a restriction earns space in the meta description.
const GENDER_RESTRICTION = { male_only: "גברים בלבד", female_only: "נשים בלבד" };

export function buildFaq(role, groups) {
  const t = role.roleTitle;
  const faq = [];

  if (role.daparFloor != null) {
    const req = reqs(role).find((r) => r.includes("דפ״ר") && /\d/.test(r));
    faq.push({ q: `איזה דפ״ר צריך ${to(t)}?`, a: `${req || `דפ״ר ${role.daparFloor} ומעלה`}.` });
  }

  const profReq = profileReq(role);
  const pf = profileFloor(role);
  if (profReq || pf != null) {
    faq.push({ q: `איזה פרופיל צריך ${to(t)}?`, a: `${profReq || `פרופיל ${pf} ומעלה`}.` });
  }

  const label = strip(he(role.serviceLengthLabel || ""));
  if (label || groups.training.length) {
    const parts = [label, groups.training.length ? `הכשרה: ${groups.training.join("; ")}` : ""];
    faq.push({
      q: label ? `כמה זמן נמשכים ההכשרה והשירות של ${t}?` : `כמה זמן ההכשרה של ${t}?`,
      a: `${parts.filter(Boolean).join(". ")}.`,
    });
  }

  if (groups.selection.length) {
    faq.push({ q: `איך מתקבלים ${to(t)}?`, a: `${groups.selection.join(". ")}.` });
  }

  if (role.genderEligibility === "all") {
    faq.push({ q: `האם גם מתגייסות יכולות להתקבל ${to(t)}?`, a: "כן, פתוח לגברים ולנשים." });
  } else if (role.genderEligibility === "male_only") {
    faq.push({ q: `האם גם מתגייסות יכולות להתקבל ${to(t)}?`, a: "לא, לפי הנתונים לגברים בלבד." });
  } else if (role.genderEligibility === "female_only") {
    faq.push({ q: `האם גם מתגייסים יכולים להתקבל ${to(t)}?`, a: "לא, לפי הנתונים לנשים בלבד." });
  }

  // Already the page lead, so it only fills a short FAQ.
  if (role.dayToDay) {
    faq.push({ q: `מה עושים בתפקיד ${t}?`, a: `${strip(he(role.dayToDay))}.` });
  }

  if (role.locations?.length) {
    faq.push({ q: `איפה משרתים בתפקיד ${t}?`, a: `${role.locations.map((l) => strip(he(l))).join("; ")}.` });
  }

  return faq.slice(0, 5);
}

/** Unique, data-only meta description, whole clauses only, at most `max` chars. */
export function buildMetaDescription(role, groups, max = 160) {
  const t = role.roleTitle;
  const facts = [
    role.daparFloor != null ? `דפ״ר ${role.daparFloor}` : "",
    profileFloor(role) != null ? `פרופיל ${profileFloor(role)}` : "",
    GENDER_RESTRICTION[role.genderEligibility] || "",
  ].filter(Boolean);
  const label = strip(he(role.serviceLengthLabel || ""));
  const clauses = [
    facts.length ? `דרישות ל${t}: ${facts.join(", ")}.` : `${t} בצה״ל${role.combat ? " (קרבי)" : ""}.`,
    label ? `מסלול: ${label}.` : groups.training[0] ? `הכשרה: ${groups.training[0]}.` : "",
    groups.selection[0] ? `קבלה: ${groups.selection[0]}.` : "",
    !facts.length && role.signals?.length ? `מאפיינים: ${role.signals.map(he).join(", ")}.` : "",
    "בדקו בחינם אם מתאים לכם.",
  ].filter(Boolean);
  let out = "";
  for (const c of clauses) {
    const next = out ? `${out} ${c}` : c;
    if (next.length <= max) out = next;
  }
  return out || clauses[0].slice(0, max);
}

const top = (category) => String(category || "").split("/")[0].trim();

/** 4 to 6 nearby roles: same category first, then same branch, shared interests, combat match. */
export function relatedRoles(role, all, limit = 6) {
  const tags = new Set(role.tags || []);
  return all
    .filter((r) => r.slug !== role.slug)
    .map((r) => {
      const shared = (r.tags || []).filter((x) => tags.has(x)).length;
      const sameTop = top(r.category) === top(role.category);
      const score =
        (r.category === role.category ? 4 : 0) +
        (sameTop ? 3 : 0) +
        shared +
        (r.combat === role.combat ? 1 : 0) +
        (r.selective === role.selective ? 0.5 : 0);
      // Same branch or 2+ shared interests first; 1 shared interest only fills the gaps.
      return { r, score, strong: sameTop || shared >= 2, ok: sameTop || shared >= 1 };
    })
    .filter((x) => x.ok)
    .sort(
      (a, b) =>
        b.strong - a.strong ||
        b.score - a.score ||
        a.r.roleTitle.localeCompare(b.r.roleTitle, "he"),
    )
    .slice(0, limit)
    .map(({ r }) => ({
      slug: r.slug,
      roleTitle: r.roleTitle,
      combat: r.combat,
      daparFloor: r.daparFloor ?? null,
      profileFloor: profileFloor(r),
    }));
}

/** Everything the role page renders beyond the base insight. */
export function buildRolePage(role, all) {
  const groups = groupRequirements(role);
  return {
    profileFloor: profileFloor(role),
    requirements: groups.other,
    selection: groups.selection,
    training: groups.training,
    serviceLengthLabel: strip(he(role.serviceLengthLabel || "")),
    locations: (role.locations || []).map((l) => strip(he(l))),
    dayToDay: he(role.dayToDay || ""),
    faq: buildFaq(role, groups),
    metaDescription: buildMetaDescription(role, groups),
    related: relatedRoles(role, all),
  };
}
