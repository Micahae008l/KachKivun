import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";
import {
  createAdminPromoCode,
  getAdminPromoCodes,
  setAdminPromoCodeActive,
  type AdminPromoCode,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";

const SITE = "https://kachkivun.com";
const shareLink = (code: string) => `${SITE}/checkout?code=${encodeURIComponent(code)}`;

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} הועתק`);
  } catch {
    toast.error("ההעתקה נכשלה");
  }
}

function status(promo: AdminPromoCode) {
  if (!promo.active) return { label: "כבוי", tone: "text-dust" };
  if (promo.expiresAt && new Date(promo.expiresAt) <= new Date()) {
    return { label: "פג תוקף", tone: "text-amber-300" };
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { label: "נוצל", tone: "text-amber-300" };
  }
  return { label: "פעיל", tone: "text-primary" };
}

/** Admin: create promo codes that unlock places 3, 2 and 1 for free, and watch their use. */
export function AdminPromoCodes() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const codes = useQuery({ queryKey: ["admin", "promo-codes"], queryFn: getAdminPromoCodes });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "promo-codes"] });

  const create = useMutation({
    mutationFn: () =>
      createAdminPromoCode({
        code: code.trim() || undefined,
        note: note.trim(),
        maxUses: maxUses ? Number(maxUses) : null,
        // End of the chosen day, Israel time, so "until the 31st" includes the 31st.
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59+03:00`).toISOString() : null,
      }),
    onSuccess: ({ code: created }) => {
      toast.success(`הקוד ${created.code} נוצר`);
      setCode("");
      setNote("");
      setMaxUses("");
      setExpiresAt("");
      void copy(created.code, "הקוד");
      void refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error, "יצירת הקוד נכשלה")),
  });

  const toggle = useMutation({
    mutationFn: (promo: AdminPromoCode) => setAdminPromoCodeActive(promo.id, !promo.active),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(getErrorMessage(error, "העדכון נכשל")),
  });

  return (
    <div className="space-y-5" dir="rtl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        className="border border-iron/30 bg-card p-5 sm:p-6"
      >
        <p className="font-mono text-xs tracking-wide text-dust uppercase">קוד חדש</p>
        <p className="mt-1 text-sm text-dust">
          קוד פותח את מקומות 3, 2 ו־1 בחינם. מתאים לבדיקות ולמבצעים. מי שכבר הפעיל קוד נשאר פתוח גם
          אם הקוד ייכבה.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-dust">
            קוד (ריק = אקראי)
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              className="input-field mt-1 w-full text-left font-mono"
              dir="ltr"
              placeholder="KK-XXXXXX"
              maxLength={32}
            />
          </label>
          <label className="text-xs text-dust">
            למה הוא (רק אתם רואים)
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="input-field mt-1 w-full"
              placeholder="בדיקות / סטורי 23.10"
              maxLength={200}
            />
          </label>
          <label className="text-xs text-dust">
            מספר שימושים (ריק = ללא הגבלה)
            <input
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value.replace(/\D/g, ""))}
              className="input-field mt-1 w-full font-mono"
              inputMode="numeric"
              dir="ltr"
            />
          </label>
          <label className="text-xs text-dust">
            בתוקף עד (ריק = תמיד)
            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="input-field mt-1 w-full"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {create.isPending ? "יוצרים…" : "יצירת קוד"}
        </button>
      </form>

      <div className="border border-iron/30 bg-card">
        {codes.isPending ? (
          <p className="p-5 text-sm text-dust">טוען…</p>
        ) : codes.isError ? (
          <p className="p-5 text-sm text-destructive">
            {getErrorMessage(codes.error, "לא ניתן לטעון את הקודים")}
          </p>
        ) : !codes.data.codes.length ? (
          <p className="p-5 text-sm text-dust">עוד אין קודים.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="border-b border-iron/25 text-xs text-dust">
                <tr>
                  <th className="p-3 font-semibold">קוד</th>
                  <th className="p-3 font-semibold">למה</th>
                  <th className="p-3 font-semibold">שימושים</th>
                  <th className="p-3 font-semibold">תוקף</th>
                  <th className="p-3 font-semibold">מצב</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-iron/20">
                {codes.data.codes.map((promo) => {
                  const state = status(promo);
                  return (
                    <tr key={promo.id}>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => void copy(promo.code, "הקוד")}
                          className="inline-flex items-center gap-1.5 font-mono font-bold text-foreground hover:text-primary"
                          dir="ltr"
                        >
                          {promo.code}
                          <Copy className="h-3.5 w-3.5 text-dust" aria-hidden />
                        </button>
                      </td>
                      <td className="p-3 text-dust">{promo.note || "—"}</td>
                      <td className="p-3 font-mono" dir="ltr">
                        {promo.usedCount}/{promo.maxUses ?? "∞"}
                      </td>
                      <td className="p-3 text-dust">
                        {promo.expiresAt
                          ? new Date(promo.expiresAt).toLocaleDateString("he-IL")
                          : "ללא"}
                      </td>
                      <td className={`p-3 font-semibold ${state.tone}`}>{state.label}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void copy(shareLink(promo.code), "הקישור")}
                            className="rounded-md border border-iron/40 px-2.5 py-1 text-xs text-dust hover:text-foreground"
                          >
                            קישור
                          </button>
                          <button
                            type="button"
                            onClick={() => toggle.mutate(promo)}
                            disabled={toggle.isPending}
                            className="rounded-md border border-iron/40 px-2.5 py-1 text-xs text-dust hover:text-foreground disabled:opacity-50"
                          >
                            {promo.active ? "כיבוי" : "הפעלה"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
