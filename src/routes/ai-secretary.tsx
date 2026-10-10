import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bot, Sparkles } from "lucide-react";

export const Route = createFileRoute("/ai-secretary")({
  component: AiSecretaryPage,
  head: () => ({
    meta: [
      { title: "מזכיר AI | קח כיוון" },
      { name: "description", content: "מזכיר AI אישי, שאלות על גיוס, פרופיל ותהליך. בקרוב." },
    ],
  }),
});

const ease = [0.16, 1, 0.3, 1] as const;

function AiSecretaryPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24 topo-lines" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="border border-iron/30 bg-card p-8 text-right sm:p-10"
      >
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center border border-primary/30 text-primary">
          <Bot className="h-6 w-6" aria-hidden />
        </div>
        <p className="font-mono text-[10px] tracking-wide text-primary uppercase mb-2">מזכיר AI</p>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">בקרוב</h1>
        <p className="mt-3 text-sm leading-relaxed text-dust">
          מזכיר אישי שיענה על שאלות על הגיוס, הפרופיל והתהליך, בשיחה חופשית, בעברית.
        </p>
        <p className="mt-4 text-sm text-dust">
          בינתיים אפשר להשתמש ב־
          <Link to="/ai-counselor" className="mx-1 font-semibold text-primary hover:underline">
            יוצר התאמת תפקידים
          </Link>
          לקבלת המלצות מותאמות לפרופיל שלכם.
        </p>
        <Link
          to="/ai-counselor"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          ליוצר התאמת תפקידים
        </Link>
      </motion.div>
    </div>
  );
}
