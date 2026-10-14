import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFaq,
  buildMetaDescription,
  buildRolePage,
  groupRequirements,
  he,
  officialSourceUrl,
  profileFloor,
  relatedRoles,
} from "../utils/rolePage.js";
import { getRoleInsightBySlug, listRoleInsights } from "../utils/roleInsights.js";

const role = (extra = {}) => ({
  slug: "x",
  roleTitle: "לוחם בדיקה",
  category: "לחימה",
  combat: true,
  selective: false,
  tags: ["combat", "fitness"],
  signals: ["כושר"],
  requirements: [],
  locations: [],
  serviceLengthLabel: "",
  dayToDay: "",
  daparFloor: null,
  medicalFloor: null,
  genderEligibility: null,
  ...extra,
});

test("he turns ASCII quotes inside Hebrew words into gershayim only", () => {
  assert.equal(he('דפ"ר 50, "ציטוט"'), 'דפ״ר 50, "ציטוט"');
});

test("a role with no data gets no FAQ and no invented facts in the meta description", () => {
  const r = role();
  const groups = groupRequirements(r);
  assert.deepEqual(buildFaq(r, groups), []);
  const meta = buildMetaDescription(r, groups);
  assert.ok(!/דפ״ר|פרופיל|גברים|נשים/.test(meta), meta);
  assert.ok(meta.length <= 160);
});

test("requirements split into selection, training and the rest; floor duplicates dropped", () => {
  const r = role({
    daparFloor: 40,
    medicalFloor: 82,
    requirements: ['פרופיל 82 ומעלה', 'דפ"ר 40', "BMI 17-32", "מיון גיבוש", 'קד"צ כ-5 שבועות'],
  });
  assert.deepEqual(groupRequirements(r), {
    selection: ["מיון גיבוש"],
    training: ["קד״צ כ-5 שבועות"],
    other: ["BMI 17-32"],
  });
});

test("FAQ answers only from present fields, prefers the requirement wording, caps at 5", () => {
  const r = role({
    daparFloor: 70,
    medicalFloor: 21,
    serviceLengthLabel: "32 חודשים",
    genderEligibility: "male_only",
    locations: ["צריפין"],
    requirements: ['דפ"ר 70 ומעלה (80 לבעלי פרופיל קרבי)', "גיבוש 3 ימים"],
  });
  const faq = buildFaq(r, groupRequirements(r));
  assert.equal(faq.length, 5);
  assert.equal(faq[0].a, "דפ״ר 70 ומעלה (80 לבעלי פרופיל קרבי).");
  // Profile 21 is no floor, and the dapar line that mentions a profile is not a profile answer.
  assert.ok(!faq.some((f) => f.q.includes("פרופיל")));
  assert.ok(faq.some((f) => f.a === "גיבוש 3 ימים."));
  assert.ok(faq.some((f) => f.a.includes("לגברים בלבד")));
});

test("profile floor yields to a requirement that names a different profile", () => {
  assert.equal(profileFloor(role({ medicalFloor: 45, requirements: ["פרופיל 25 ומעלה"] })), null);
  assert.equal(profileFloor(role({ medicalFloor: 72, requirements: ["פרופיל 82 (72 במגבלות)"] })), 72);
  assert.equal(profileFloor(role({ medicalFloor: 21 })), null);
});

test("meta description stays under 160 chars and keeps whole clauses", () => {
  const r = role({
    daparFloor: 40,
    medicalFloor: 82,
    genderEligibility: "male_only",
    serviceLengthLabel: "שירות חובה מלא; " + "טירונות ארוכה מאוד ".repeat(10),
    requirements: ["מיון גיבוש"],
  });
  const meta = buildMetaDescription(r, groupRequirements(r));
  assert.ok(meta.length <= 160, meta);
  assert.ok(meta.startsWith("דרישות ללוחם בדיקה: דפ״ר 40, פרופיל 82, גברים בלבד."));
  assert.ok(!meta.includes("טירונות"));
});

test("official source URL only for a specific mitgaisim page", () => {
  assert.equal(officialSourceUrl("mitgaisim.idf.il/roles/"), null);
  assert.equal(officialSourceUrl("timesofisrael.com 05.12.2025"), null);
  assert.equal(officialSourceUrl('mitgaisim.idf.il סיירת מטכ"ל'), null);
  assert.equal(
    officialSourceUrl(null, "mitgaisim.idf.il/roles/abc/"),
    "https://www.mitgaisim.idf.il/roles/abc/",
  );
});

test("related roles prefer the same category and never include the role itself", () => {
  const all = [
    role({ slug: "a", roleTitle: "א", category: "לחימה" }),
    role({ slug: "b", roleTitle: "ב", category: "לחימה / ימי" }),
    role({ slug: "c", roleTitle: "ג", category: "רפואה", combat: false, tags: ["medicine"] }),
    role(),
  ];
  const rel = relatedRoles(role(), all);
  assert.deepEqual(rel.map((r) => r.slug), ["a", "b"]);
});

test("every catalog role builds a page; no em dash anywhere; 4+ related almost everywhere", () => {
  const all = listRoleInsights();
  let thin = 0;
  for (const r of all) {
    const page = buildRolePage(r, all);
    assert.ok(!JSON.stringify(page).includes(String.fromCharCode(0x2014)), r.roleTitle);
    assert.ok(page.metaDescription.length <= 160, r.roleTitle);
    if (page.related.length < 4) thin++;
  }
  assert.ok(thin <= 3, `${thin} roles with fewer than 4 related`);
  const golani = getRoleInsightBySlug("לוחם-בגולני");
  assert.equal(golani.genderEligibility, "male_only");
  assert.match(golani.sourceUrl, /^https:\/\/www\.mitgaisim\.idf\.il\//);
});
