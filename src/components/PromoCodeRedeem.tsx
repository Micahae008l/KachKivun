import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ticket } from "lucide-react";
import { redeemPromoCode } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-errors";

/**
 * "יש לי קוד": unlocks the paid places with a promo code instead of paying. A link like
 * /checkout?code=KK-ABC123 opens it already filled in, for codes shared in stories or DMs.
 */
export function PromoCodeRedeem() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("code");
    if (fromLink) {
      setCode(fromLink.toUpperCase());
      setOpen(true);
    }
  }, []);

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      const result = await redeemPromoCode(code);
      toast.success(
        result.status === "already_unlocked"
          ? "המקומות כבר פתוחים אצלכם"
          : "הקוד הופעל. מקומות 3, 2 ו־1 פתוחים",
      );
      await Promise.all(
        ["recommendation", "match-history", "match-extras", "dashboard"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      void navigate({ to: "/ai-counselor" });
    } catch (error) {
      toast.error(getErrorMessage(error, "הקוד לא הופעל. נסו שוב."));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <Ticket className="h-4 w-4" aria-hidden />
        יש לי קוד הטבה
      </button>
    );
  }

  return (
    <form onSubmit={redeem} className="mt-5 border border-primary/40 bg-primary/5 p-3">
      <label className="block text-xs font-semibold text-foreground" htmlFor="promo-code">
        קוד הטבה
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="promo-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className="input-field min-w-0 flex-1 text-left font-mono"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="KK-XXXXXX"
          maxLength={32}
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          aria-busy={busy}
          className="inline-flex min-h-11 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "בודקים…" : "הפעלה"}
        </button>
      </div>
    </form>
  );
}
