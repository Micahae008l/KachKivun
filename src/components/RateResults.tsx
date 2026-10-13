import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Star } from "lucide-react";
import {
  getResultFeedback,
  saveResultFeedback,
  type FeedbackReason,
  type ResultFeedback,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";

const WORDS = ["", "ממש לא", "לא כל כך", "בסדר", "טוב", "מעולה"];
const REASONS: { value: FeedbackReason; label: string }[] = [
  { value: "not_me", label: "התפקידים לא מתאימים לי" },
  { value: "missing_role", label: "חסר תפקיד שציפיתי לראות" },
  { value: "too_generic", label: "ההסברים כלליים מדי" },
  { value: "wrong_info", label: "יש מידע לא מדויק" },
  { value: "request_ignored", label: "לא התייחסו לבקשה שלי" },
  { value: "other", label: "משהו אחר" },
];

/**
 * Paying users rate their result. The stars save on click; a low score (1-3) opens a short
 * "what felt off" form, a high one only offers an optional comment.
 */
export function RateResults({ resultId }: { resultId: string }) {
  const queryClient = useQueryClient();
  const key = ["result-feedback", resultId];
  const saved = useQuery({
    queryKey: key,
    queryFn: () => getResultFeedback(resultId),
    staleTime: Infinity,
  });
  const current = saved.data?.feedback ?? null;

  const [hover, setHover] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [reasons, setReasons] = useState<FeedbackReason[] | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const shownRating = rating ?? current?.rating ?? 0;
  const shownReasons = reasons ?? current?.reasons ?? [];
  const shownComment = comment ?? current?.comment ?? "";
  const low = shownRating > 0 && shownRating <= 3;

  async function save(next: Omit<ResultFeedback, "updatedAt">) {
    setBusy(true);
    setError("");
    try {
      const response = await saveResultFeedback(resultId, next);
      queryClient.setQueryData(key, response);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, "לא הצלחנו לשמור. נסו שוב."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function pick(value: number) {
    setRating(value);
    setSent(false);
    await save({ rating: value, reasons: shownReasons, comment: shownComment });
  }

  async function send() {
    if (await save({ rating: shownRating, reasons: shownReasons, comment: shownComment.trim() })) {
      setSent(true);
      setShowComment(false);
    }
  }

  function toggle(reason: FeedbackReason) {
    setSent(false);
    setReasons(
      shownReasons.includes(reason)
        ? shownReasons.filter((r) => r !== reason)
        : [...shownReasons, reason],
    );
  }

  if (saved.isPending) return null;

  return (
    <section
      className="border border-iron/25 bg-card/60 px-5 py-6 text-right"
      aria-labelledby="rate-results-heading"
    >
      <h2 id="rate-results-heading" className="text-base font-black text-foreground">
        איך ההתאמות שקיבלתם?
      </h2>
      <p className="mt-1 text-sm text-dust">הדירוג שלכם עוזר לנו לשפר את היועץ.</p>

      <div className="mt-4 flex items-center gap-3">
        <div
          className="flex"
          role="radiogroup"
          aria-label="דירוג מ־1 עד 5"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((value) => {
            const lit = value <= (hover || shownRating);
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={shownRating === value}
                aria-label={`${value} מתוך 5: ${WORDS[value]}`}
                disabled={busy}
                onMouseEnter={() => setHover(value)}
                onClick={() => void pick(value)}
                className="p-1 transition-transform duration-150 active:scale-90 disabled:cursor-wait"
              >
                <Star
                  className={`h-8 w-8 transition-colors duration-150 ${
                    lit ? "fill-primary text-primary" : "text-iron"
                  }`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
        <span className="text-sm font-bold text-foreground" aria-live="polite">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          ) : (
            WORDS[hover || shownRating]
          )}
        </span>
      </div>

      {low ? (
        <div className="mt-5 space-y-3 border-t border-iron/20 pt-4">
          <p className="text-sm font-bold text-foreground">מה הרגיש לא נכון?</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((reason) => {
              const on = shownReasons.includes(reason.value);
              return (
                <button
                  key={reason.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(reason.value)}
                  className={`min-h-10 rounded-full border px-3 text-xs font-bold transition-colors ${
                    on
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-iron/30 bg-card text-dust hover:text-foreground"
                  }`}
                >
                  {reason.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={shownComment}
            onChange={(event) => {
              setSent(false);
              setComment(event.target.value.slice(0, 500));
            }}
            rows={3}
            maxLength={500}
            placeholder="רוצים לפרט? למשל איזה תפקיד ציפיתם לראות (אופציונלי)"
            className="input-field min-h-20 w-full resize-y"
            aria-label="פירוט"
          />
          <SendRow busy={busy} sent={sent} onSend={() => void send()} />
        </div>
      ) : shownRating >= 4 ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-dust">תודה! שמחים שזה עזר.</p>
          {showComment || shownComment ? (
            <>
              <textarea
                value={shownComment}
                onChange={(event) => {
                  setSent(false);
                  setComment(event.target.value.slice(0, 500));
                }}
                rows={2}
                maxLength={500}
                placeholder="מה הכי עזר, או מה היה אפשר לשפר?"
                className="input-field min-h-16 w-full resize-y"
                aria-label="הערה"
              />
              <SendRow busy={busy} sent={sent} onSend={() => void send()} />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowComment(true)}
              className="text-sm font-semibold text-primary hover:underline"
            >
              רוצים להוסיף משהו?
            </button>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SendRow({ busy, sent, onSend }: { busy: boolean; sent: boolean; onSend: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        שליחה
      </button>
      {sent ? (
        <span className="inline-flex items-center gap-1 text-sm text-primary" aria-live="polite">
          <Check className="h-4 w-4" aria-hidden />
          תודה, קראנו.
        </span>
      ) : null}
    </div>
  );
}
