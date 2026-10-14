import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { PencilLine, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteAccount,
  logoutRequest,
  setMarketingConsent,
  type DashboardResponse,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";

type Props = {
  data: DashboardResponse;
};

/**
 * The profile is edited in the onboarding flow itself (/post-signup#edit): same steps, same
 * questions, with the saved answers already selected, so the two can never drift apart.
 */
export function DashboardAccountPreferences({ data }: Props) {
  const name = data.user.preferredName?.trim();
  return (
    <section
      className="border border-iron/30 bg-card px-5 py-5 text-right sm:px-6"
      dir="rtl"
      aria-labelledby="account-preferences-heading"
    >
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="font-mono text-[10px] tracking-wide text-primary uppercase">חשבון</p>
          <h2
            id="account-preferences-heading"
            className="text-base font-bold text-foreground sm:text-lg"
          >
            {name ? `הפרופיל של ${name}` : "הפרופיל שלכם"}
          </h2>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-dust">
        עורכים באותם שלבים כמו בהרשמה, והתשובות הקיימות כבר מסומנות. משנים רק מה שצריך, ובסוף
        ההתאמות מתעדכנות לפי הפרופיל החדש.
      </p>
      <Link
        to="/post-signup"
        hash="edit"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
      >
        <PencilLine className="h-4 w-4" aria-hidden />
        עריכת הפרופיל
      </Link>
      <MarketingEmailToggle initial={Boolean(data.user.marketingConsent)} />
      <div className="mt-5">
        <DeleteAccount />
      </div>
    </section>
  );
}

/** Opt in or out of marketing email; saved right away, the dashboard refetches afterwards. */
function MarketingEmailToggle({ initial }: { initial: boolean }) {
  const queryClient = useQueryClient();
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle(next: boolean) {
    setSaving(true);
    setOn(next);
    try {
      await setMarketingConsent(next, "dashboard");
      toast.success(next ? "נרשמתם לעדכונים במייל" : "הוסרתם מהעדכונים במייל");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      setOn(!next);
      toast.error(getErrorMessage(error, "השמירה נכשלה. נסו שוב."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-iron/20 pt-4 text-sm leading-6 text-dust">
      <input
        type="checkbox"
        checked={on}
        disabled={saving}
        onChange={(event) => void toggle(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-primary"
      />
      <span>
        <strong className="block text-foreground">עדכונים ומבצעים במייל</strong>
        מדריכים לקראת הגיוס ומבצעים מקח כיוון. אפשר לבטל בכל רגע.
      </span>
    </label>
  );
}

const DELETE_WORD = "מחיקה";

/** Self-service account deletion: closed by default, and armed only by typing the word. */
function DeleteAccount() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const armed = typed.trim() === DELETE_WORD;

  async function remove() {
    if (!armed || deleting) return;
    setDeleting(true);
    try {
      await deleteAccount(DELETE_WORD);
      await logoutRequest();
      queryClient.clear();
      toast.success("החשבון והנתונים האישיים נמחקו");
      void navigate({ to: "/" });
    } catch (error) {
      toast.error(getErrorMessage(error, "המחיקה נכשלה. נסו שוב או פנו אלינו."));
      setDeleting(false);
    }
  }

  return (
    <div className="border-t border-iron/20 pt-4 text-right">
      {open ? (
        <div className="space-y-3 border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-bold text-foreground">מחיקת החשבון לצמיתות</p>
          <p className="text-xs leading-5 text-dust">
            יימחקו הפרופיל, תשובות השאלון, ההתאמות וההיסטוריה שלכם. אי אפשר לשחזר. רשומות תשלום
            נשמרות לפי החוק, כמפורט במדיניות הפרטיות.
          </p>
          <label className="block text-xs text-dust">
            כדי לאשר, הקלידו <strong className="text-foreground">{DELETE_WORD}</strong>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="input-field mt-1.5 w-full"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void remove()}
              disabled={!armed || deleting}
              aria-busy={deleting}
              className="inline-flex min-h-11 items-center rounded-md bg-destructive px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {deleting ? "מוחקים…" : "מחקו את החשבון שלי"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
              className="inline-flex min-h-11 items-center rounded-md border border-iron/40 px-4 text-sm text-dust transition hover:text-foreground"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-dust underline underline-offset-4 transition hover:text-destructive"
        >
          מחיקת החשבון והנתונים שלי
        </button>
      )}
    </div>
  );
}
