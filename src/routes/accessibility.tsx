import { createFileRoute, Link } from "@tanstack/react-router";
import { Bullets, LegalDoc, Section } from "@/components/LegalDoc";
import { SITE_NAME_HE } from "@/lib/brand";

const CONTACT_EMAIL = "mishlahat.idf@gmail.com";
const COORDINATOR = "מיכאל חדד";
const LAST_UPDATED = "31 באוגוסט 2026";

export const Route = createFileRoute("/accessibility")({
  component: AccessibilityPage,
  head: () => ({
    meta: [
      { title: `הצהרת נגישות | ${SITE_NAME_HE}` },
      {
        name: "description",
        content: `הצהרת הנגישות של ${SITE_NAME_HE}: איך האתר מונגש, מה עדיין חסר, ולמי פונים בבעיה.`,
      },
    ],
  }),
});

function AccessibilityPage() {
  return (
    <LegalDoc title="הצהרת נגישות" lastUpdated={LAST_UPDATED}>
      <p>
        {SITE_NAME_HE} מחויב לאפשר שימוש באתר גם לאנשים עם מוגבלות, לפי{" "}
        <strong className="text-foreground">חוק שוויון זכויות לאנשים עם מוגבלות</strong> ותקנות נגישות
        השירות (תשע״ג־2013), ובהתאם לתקן הישראלי 5568 (מבוסס WCAG 2.0 רמה AA).
      </p>
      <p>
        זו הצהרה כנה על מצב האתר היום, לא תעודת התאמה. אם משהו מפריע לכם לגשת לתוכן או לפעולה, כתבו
        לנו ונתקן.
      </p>

      <Section heading="איך להשתמש באתר">
        <Bullets
          items={[
            <>
              <strong className="text-foreground">תפריט נגישות</strong> בפינה הימנית התחתונה: הגדלת
              טקסט, ניגודיות גבוהה, והפחתת אנימציה. ההעדפות נשמרות בדפדפן.
            </>,
            <>
              <strong className="text-foreground">דילוג לתוכן</strong> מופיע במעבר מקלדת (Tab) בראש כל
              עמוד.
            </>,
            <>אפשר לנווט באתר במקלדת בלבד, בלי עכבר.</>,
            <>הדפדפן יכול להגדיל את התצוגה (זום) בלי שנחסום זאת.</>,
            <>האתר בעברית, מימין לשמאל, עם תוויות בעברית לקוראי מסך.</>,
          ]}
        />
      </Section>

      <Section heading="מה כבר הונגש">
        <Bullets
          items={[
            "מבנה סמנטי, כותרות, וקישורי דילוג לתוכן הראשי.",
            "תוויות ARIA בעברית לתפריטים, טפסים, ומצבי טעינה.",
            "תיאורי תמונה (alt) לתמונות צה״ל שבאתר.",
            "מחוון מיקוד גלוי במעבר מקלדת.",
            "כיבוד העדפת מערכת להפחתת תנועה, וגם מתג ידני בתפריט.",
          ]}
        />
      </Section>

      <Section heading="מגבלות ידועות">
        <Bullets
          items={[
            "חלק מהאנימציות בדף הבית עדיין רצות אם לא הפעלתם הפחתת תנועה.",
            "דוחות שנוצרים ב־AI עשויים להיות ארוכים או לא מחולקים בצורה אידיאלית לקורא מסך.",
            "תמונות צד־שלישי או תוכן חיצוני (למשל קישורי מתגייסים) אינם בשליטתנו.",
            "האתר לא עבר בדיקת מעבדה חיצונית מול תקן 5568. אנחנו ממשיכים לתקן לפי דיווחים.",
          ]}
        />
      </Section>

      <Section heading="רכז נגישות ופניות">
        <p>
          רכז הנגישות: <strong className="text-foreground">{COORDINATOR}</strong>
          <br />
          דוא״ל:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline" dir="ltr">
            {CONTACT_EMAIL}
          </a>
        </p>
        <p>
          כתבו מה העמוד, מה ניסיתם לעשות, ואיזה מכשיר או קורא מסך השתמשתם. נשתדל להשיב ולתקן בתוך 60
          ימים, כפי שנדרש בתקנות כשמדווחים על ליקוי.
        </p>
      </Section>

      <Section heading="מסמכים קשורים">
        <p>
          <Link to="/privacy" className="text-primary hover:underline">
            מדיניות פרטיות
          </Link>
          {" · "}
          <Link to="/terms" className="text-primary hover:underline">
            תנאי שימוש
          </Link>
          {" · "}
          <Link to="/about" className="text-primary hover:underline">
            אודות
          </Link>
        </p>
      </Section>
    </LegalDoc>
  );
}
