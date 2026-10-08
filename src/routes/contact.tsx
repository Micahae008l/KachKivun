import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { sendContactMessage, type ContactTopic } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";
import { SITE_NAME_HE, SUPPORT_EMAIL } from "@/lib/brand";

type ContactSearch = { topic?: ContactTopic; order?: string };

const TOPICS: { value: ContactTopic; label: string }[] = [
  { value: "cancellation", label: "ביטול עסקה / החזר" },
  { value: "payment", label: "תשלום או קבלה" },
  { value: "bug", label: "תקלה באתר" },
  { value: "account", label: "חשבון וכניסה" },
  { value: "other", label: "אחר" },
];

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  validateSearch: (search: Record<string, unknown>): ContactSearch => ({
    topic: TOPICS.some((t) => t.value === search.topic) ? (search.topic as ContactTopic) : undefined,
    order: typeof search.order === "string" ? search.order.slice(0, 64) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `צור קשר | ${SITE_NAME_HE}` },
      { name: "description", content: "פנייה בכתב לצוות: ביטול עסקה, תשלומים, תקלות ושאלות. עונים במייל." },
    ],
  }),
});

function ContactPage() {
  const search = Route.useSearch();
  const [topic, setTopic] = useState<ContactTopic | "">(search.topic ?? "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!topic) return setError("בחרו נושא לפנייה");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError("נא להזין אימייל תקין כדי שנוכל לחזור אליכם");
    if (message.trim().length < 10) return setError("כתבו לפחות משפט אחד על הפנייה");
    setState("sending");
    try {
      await sendContactMessage({ topic, email: email.trim(), name: name.trim(), message: message.trim(), orderId: search.order, website });
      setState("sent");
    } catch (e) {
      setError(getErrorMessage(e, "לא הצלחנו לשלוח. נסו שוב בעוד רגע."));
      setState("idle");
    }
  }

  return (
    <div className="topo-lines min-h-[65vh]" dir="rtl">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="font-mono text-xs tracking-widest text-primary uppercase">שירות לקוחות</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">צור קשר</h1>
        <p className="mt-3 text-sm leading-7 text-dust">
          פונים בכתב ומקבלים תשובה למייל, בדרך כלל תוך יום עסקים. לביטול רכישה אפשר גם ישירות דרך{" "}
          <Link to="/cancellation" className="text-primary hover:underline">
            עמוד הביטולים
          </Link>
          .
        </p>

        {state === "sent" ? (
          <section className="mt-8 border border-primary/40 bg-primary/10 p-6">
            <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden />
            <h2 className="mt-2 text-lg font-black text-foreground">הפנייה נשלחה</h2>
            <p className="mt-1 text-sm leading-6 text-foreground/80">
              נחזור אליכם לכתובת <span dir="ltr">{email}</span>. אם לא הגיעה תשובה, בדקו בתיקיית הספאם.
            </p>
          </section>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5 border border-iron/30 bg-card p-5 sm:p-6" noValidate>
            <fieldset>
              <legend className="text-sm font-bold text-foreground">נושא</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTopic(t.value)}
                    aria-pressed={topic === t.value}
                    className={`border px-3 py-1.5 text-sm transition ${
                      topic === t.value ? "border-primary bg-primary/15 text-foreground" : "border-iron/30 text-dust hover:border-iron/60"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-bold text-foreground">אימייל לתשובה</span>
                <input type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field mt-1.5" required />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-foreground">שם (אופציונלי)</span>
                <input type="text" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="input-field mt-1.5" />
              </label>
            </div>

            <label className="block text-sm">
              <span className="font-bold text-foreground">ההודעה</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                rows={6}
                className="input-field mt-1.5 min-h-36 resize-y"
                placeholder={topic === "cancellation" ? "מה תרצו לבטל, ומאיזה אימייל בוצעה הרכישה?" : "ספרו לנו במה מדובר"}
                required
              />
              <span className="mt-1 block text-left font-mono text-[10px] text-dust">{message.length}/2000</span>
            </label>

            {/* Honeypot: hidden from people, bots fill it. */}
            <label className="hidden" aria-hidden>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>

            {search.order ? <p className="text-xs text-dust">מספר הזמנה: <span dir="ltr">{search.order}</span></p> : null}
            {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}

            <button
              type="submit"
              disabled={state === "sending"}
              className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              שליחה
            </button>
          </form>
        )}

        <p className="mt-6 text-xs leading-6 text-dust">
          אפשר גם לכתוב ישירות אל{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline" dir="ltr">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
