/**
 * Catalog requirements and service-length labels mix both genders in one string
 * ("גברים פרופיל 45-64, נשים 45 ומעלה"). These keep only the clauses that apply to the
 * candidate. An unknown gender gets the input back unchanged.
 */

// The first gender word decides who a clause is about ("נשים: שירות כמו גברים" is about women).
const GENDER_WORD_RE = /(?<!\p{L})(?:[ולה]?(?:נשים|אישה|אשה|בנות)|מיון לוחמות|[ולה]?(גברים|גבר|בנים))(?!\p{L})/u;
const BOTH_RE = /נשים וגברים|גברים ונשים|כדין/;

function genderOf(text) {
  const match = GENDER_WORD_RE.exec(text);
  return match ? (match[1] ? "male" : "female") : null;
}

const known = (gender) => gender === "male" || gender === "female";

export function textForGender(text, gender) {
  if (!known(gender) || typeof text !== "string" || !genderOf(text)) return text;
  const keep = (part) => BOTH_RE.test(part) || [null, gender].includes(genderOf(part));
  // "(גם לנשים)" goes first, so "32 חודשים (גם לנשים)" stays "32 חודשים" for men.
  const parts = text
    .replace(/\s*\(([^)]*)\)/g, (group, inner) => (keep(inner) ? group : ""))
    .split(/\s*(;|,(?!\d))\s*/);
  let out = "";
  let carried = "";
  for (let i = 0; i < parts.length; i += 2) {
    const clause = parts[i].trim();
    const separator = i ? parts[i - 1] : "";
    if (!clause || !keep(clause)) {
      // "a; גברים 32, נשים 24" keeps the ";" in front of what survives.
      if (separator === ";") carried = ";";
      continue;
    }
    out += out ? `${carried || separator} ${clause}` : clause;
    carried = "";
  }
  return out;
}

/** Per-gender requirements list; an entry that loses every clause is removed. */
export function requirementsForGender(list, gender) {
  if (!Array.isArray(list) || !known(gender)) return list;
  return list.map((item) => textForGender(item, gender)).filter(Boolean);
}
