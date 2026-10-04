import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, ChevronLeft, Trash2, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  deleteMatchHistory,
  getMatchHistory,
  type MatchHistoryItem,
  type MatchedRole,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { matchHistoryQueryOptions } from "@/lib/queries";
import { ARIA } from "@/lib/a11y";
import { getErrorMessage } from "@/lib/api-errors";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Props = {
  onSelect: (roles: MatchedRole[], meta: MatchHistoryItem) => void;
  activeId?: string | null;
};

export function MatchHistoryPanel({ onSelect, activeId }: Props) {
  const token = getToken();
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data, isPending, isError, error } = useQuery(matchHistoryQueryOptions(token));
  const loading = isPending && !data;

  const deleteMutation = useMutation({
    mutationFn: deleteMatchHistory,
    onSuccess: () => {
      toast.success("נמחק מההיסטוריה");
      void queryClient.invalidateQueries({ queryKey: ["match-history"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e, "שגיאה במחיקה")),
  });

  if (!token) return null;

  const generations = data?.generations ?? [];

  async function openGeneration(item: MatchHistoryItem) {
    setLoadingId(item.id);
    try {
      const { generation } = await getMatchHistory(item.id);
      onSelect(generation.roles, generation);
      toast.success("נטענה התאמה קודמת");
    } catch (e) {
      toast.error(getErrorMessage(e, "לא ניתן לטעון את ההיסטוריה"));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section
      className="border border-iron/30 bg-card p-4 sm:p-5"
      aria-labelledby="match-history-heading"
      dir="rtl"
    >
      <div className="mb-3 flex items-center justify-start gap-2 text-right">
        <History className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <h2 id="match-history-heading" className="font-mono text-xs tracking-widest text-dust uppercase">
          {ARIA.matchHistory}
        </h2>
      </div>

      {loading ? (
        <p className="text-right text-sm text-dust">טוען היסטוריה…</p>
      ) : isError ? (
        <p className="text-right text-sm text-destructive">
          {getErrorMessage(error, "לא ניתן לטעון את היסטוריית ההתאמות")}
        </p>
      ) : generations.length === 0 ? (
        <p className="text-right text-sm text-dust">
          עדיין אין התאמות שמורות. לחצו «התאמת תפקידים» כדי ליצור את הראשונה — אחר כך תוכלו לפתוח אותן כאן.
        </p>
      ) : (
        <ul className="space-y-2">
          {generations.map((g) => {
            const title = g.topRole || "התאמת תפקידים";
            const isActive = activeId === g.id;
            const isOpening = loadingId === g.id;
            return (
              <li
                key={g.id}
                className={`flex items-center gap-2 border bg-background/50 px-3 py-2.5 transition ${
                  isActive ? "border-primary/50" : "border-iron/20 hover:border-primary/30"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void openGeneration(g)}
                  disabled={!!loadingId}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-right disabled:opacity-60"
                  dir="rtl"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 truncate text-xs text-dust">
                      <Clock className="mb-0.5 ml-0.5 inline h-3 w-3" aria-hidden />
                      {formatWhen(g.createdAt)}
                      {g.roleCount ? ` · ${g.roleCount} תפקידים` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2" dir="ltr">
                    {g.topMatch != null ? (
                      <span className="font-mono text-sm font-bold tabular-nums text-primary">
                        {g.topMatch}%
                      </span>
                    ) : null}
                    {isOpening ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                    ) : (
                      <ChevronLeft className="h-4 w-4 text-primary" aria-hidden />
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(g.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 rounded p-1 text-dust transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  aria-label={ARIA.deleteMatch(title)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
