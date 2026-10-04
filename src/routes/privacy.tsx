import { createFileRoute, Link } from "@tanstack/react-router";
import { Bullets, LegalDoc, Section } from "@/components/LegalDoc";
import { SITE_NAME_HE } from "@/lib/brand";

const CONTACT_EMAIL = "mishlahat.idf@gmail.com";
const LAST_UPDATED = "30 ביולי 2026";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: `מדיניות פרטיות | ${SITE_NAME_HE}` },
      {
        name: "description",
        content: `אילו נתונים ${SITE_NAME_HE} אוסף, למה, עם מי הם משותפים, ואיך מוחקים אותם.`,
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <LegalDoc title="מדיניות פרטיות" lastUpdated={LAST_UPDATED}>
      <p>
        {SITE_NAME_HE} הוא כלי עזר למתגייסים ולמשרתים בצה״ל. הדף הזה מסביר בשפה פשוטה אילו נתונים אנחנו
        אוספים, מה אנחנו עושים איתם, עם מי הם משותפים, ואיך אתם מוחקים אותם. לשאלות בנושא פרטיות:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline" dir="ltr">
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <Section heading="אילו נתונים אנחנו אוספים">
        <p>רק מה שאתם מזינים בעצמכם, ובלי סיסמה:</p>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">כתובת אימייל</strong>, לצורך כניסה לחשבון בקוד חד־פעמי.
              איננו שומרים סיסמאות.
            </>,
            <>
              <strong className="text-foreground">שם משתמש</strong> שבחרתם (לא חייב להיות שמכם האמיתי).
            </>,
            <>
              <strong className="text-foreground">מין</strong>, המשמש לסינון תפקידים שאינם פתוחים לכל
              המגדרים.
            </>,
            <>
              <strong className="text-foreground">ציון דפ״ר ופרופיל רפואי</strong> כפי שדיווחתם. הפרופיל
              הרפואי הוא מידע רגיש, ואנחנו משתמשים בו רק לחישוב סף התאמה לתפקידים.
            </>,
            <>
              <strong className="text-foreground">ציוני מא״ה</strong> (12 ממדים) בהערכה עצמית.
            </>,
            <>
              <strong className="text-foreground">תאריך גיוס משוער</strong> והעדפות שירות (כיוון, מיקוד,
              רמת כושר).
            </>,
            <>
              <strong className="text-foreground">תוצאות התאמה</strong> שנוצרו עבורכם, וביקורות על תפקידים
              אם בחרתם לכתוב.
            </>,
          ]}
        />
        <p>
          איננו מבקשים מספר תעודת זהות, מסמכים רפואיים, או פרטי אמצעי תשלום. איננו אוספים את הנתונים שלכם
          מצה״ל, ממתגייסים, או מכל גוף רשמי אחר. כל מה שיש לנו הוא מה שהקלדתם.
        </p>
      </Section>

      <Section heading="למה אנחנו צריכים את זה">
        <p>
          כדי לחשב אילו תפקידים מתאימים לכם ולהציג הסבר לכל התאמה. בלי דפ״ר, פרופיל רפואי וציוני מא״ה אין
          דרך לדעת לאילו תפקידים אתם עומדים בסף, ולכן השירות לא יעבוד בלעדיהם.
        </p>
      </Section>

      <Section heading="עם מי הנתונים משותפים">
        <p>
          איננו מוכרים את הנתונים שלכם ואיננו מעבירים אותם למפרסמים. אנחנו נעזרים בספקי תשתית, וחלקם
          מאוחסנים מחוץ לישראל (בעיקר בארצות הברית):
        </p>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">OpenAI</strong>, לניסוח ההסברים וההתאמות. הפרופיל שלכם
              (דפ״ר, פרופיל רפואי, ציוני מא״ה והעדפות) נשלח לשם לצורך העיבוד. איננו שולחים את האימייל שלכם.
            </>,
            <>
              <strong className="text-foreground">Resend</strong>, לשליחת קודי הכניסה לאימייל.
            </>,
            <>
              <strong className="text-foreground">MongoDB Atlas</strong>, לאחסון הנתונים.
            </>,
            <>
              <strong className="text-foreground">Render ו־Cloudflare</strong>, להרצת השרת והאתר.
            </>,
            <>
              <strong className="text-foreground">PostHog</strong> (שרתים באיחוד האירופי), למדידת שימוש באתר.
              הוא אינו משתמש בקוקיז, אינו שומר את מה שאתם מקלידים ואינו מקושר לשם או לאימייל שלכם.
            </>,
          ]}
        />
        <p>
          נעביר מידע לגורם נוסף רק אם נידרש לכך על פי דין, או כדי להגן על האתר מפני שימוש לרעה או פגיעה
          באנשים.
        </p>
      </Section>

      <Section heading="גיל המשתמשים">
        <p>
          חלק גדול מהמשתמשים בשירות הם בני 16 עד 18, כלומר קטינים. אם אתם מתחת לגיל 18, השימוש בשירות ומסירת
          הפרטים כאן צריכים להיעשות בידיעת הורה או אפוטרופוס. אם אתם הורה ואתם רוצים שנמחק מידע של ילדכם,
          כתבו לנו ונמחק אותו.
        </p>
      </Section>

      <Section heading="כמה זמן אנחנו שומרים">
        <p>
          הנתונים נשמרים כל עוד החשבון קיים, כדי שתוכלו לחזור ולראות את הפרופיל וההתאמות. אם תבקשו מחיקה,
          נמחק את החשבון והנתונים הקשורים אליו. קודי כניסה חד־פעמיים נמחקים או נפסלים תוך זמן קצר ממילא.
        </p>
      </Section>

      <Section heading="הזכויות שלכם">
        <p>
          אתם יכולים לבקש לראות את הנתונים שלכם, לתקן אותם, או למחוק את החשבון כולו. חלק מהפרטים אפשר לעדכן
          לבד בדשבורד. לכל השאר, שלחו בקשה מהאימייל שאיתו נרשמתם אל{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline" dir="ltr">
            {CONTACT_EMAIL}
          </a>{" "}
          ונטפל בה.
        </p>
      </Section>

      <Section heading="אבטחה">
        <p>
          הכניסה היא בקוד חד־פעמי לאימייל, בלי סיסמאות לשמור או לדלוף. התעבורה מוצפנת ב־HTTPS, וקודי הכניסה
          נשמרים בצורה מוצפנת ולא כטקסט קריא. עם זאת, אף שירות אינו חסין לחלוטין, ואיננו יכולים להתחייב
          לאבטחה מושלמת.
        </p>
      </Section>

      <Section heading="שינויים במדיניות">
        <p>
          נעדכן את הדף הזה אם נשנה את אופן הטיפול בנתונים, ותאריך העדכון בראש הדף ישתנה בהתאם.
        </p>
      </Section>

      <Section heading="יצירת קשר">
        <p>
          לשאלות, בקשות מחיקה, או כל דבר אחר בנושא פרטיות:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline" dir="ltr">
            {CONTACT_EMAIL}
          </a>
          . ראו גם את{" "}
          <Link to="/terms" className="text-primary hover:underline">
            תנאי השימוש
          </Link>
          .
        </p>
      </Section>
    </LegalDoc>
  );
}
