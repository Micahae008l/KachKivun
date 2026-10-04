import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  min?: string;
  max?: string;
  invalid?: boolean;
  className?: string;
};

const MONTHS_HE = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];
const WEEKDAYS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** ISO yyyy-mm-dd from local parts, without going through UTC. */
function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseIso(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function todayIso() {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatHebrewDate(s: string) {
  const p = parseIso(s);
  if (!p) return null;
  return new Date(p.y, p.m, p.d, 12).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(s: string) {
  const p = parseIso(s);
  if (!p) return null;
  const now = new Date();
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(p.y, p.m, p.d);
  return Math.round((b - a) / 86_400_000);
}

/** Enlistment date picker: an RTL Hebrew calendar with a month/year jump view and a countdown readout. */
export function DraftDateField({
  value,
  onChange,
  id,
  min = "2000-01-01",
  max = "2038-12-31",
  invalid,
  className = "",
}: Props) {
  const today = todayIso();
  const selected = parseIso(value);
  const start = selected ?? parseIso(today)!;
  const [view, setView] = useState<{ y: number; m: number }>({ y: start.y, m: start.m });
  const [mode, setMode] = useState<"days" | "months">("days");

  const cells = useMemo(() => {
    const lead = new Date(view.y, view.m, 1).getDay(); // Sunday = 0, first column in RTL
    const count = new Date(view.y, view.m + 1, 0).getDate();
    return [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [view]);

  const minP = parseIso(min);
  const maxP = parseIso(max);
  const canPrev = !minP || view.y * 12 + view.m > minP.y * 12 + minP.m;
  const canNext = !maxP || view.y * 12 + view.m < maxP.y * 12 + maxP.m;

  const shift = (months: number) =>
    setView((v) => {
      const t = v.y * 12 + v.m + months;
      return { y: Math.floor(t / 12), m: t % 12 };
    });

  const hebrew = value ? formatHebrewDate(value) : null;
  const left = value ? daysUntil(value) : null;

  const navBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-md text-dust transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

  return (
    // FormField clones `input-field--invalid` onto its child; this component draws its own error state.
    <div className={`max-w-sm space-y-3 text-right ${className.replace("input-field--invalid", "")}`.trim()} dir="rtl">
      <div
        id={id}
        className={`rounded-lg border bg-card p-3 sm:p-4 ${invalid ? "border-destructive" : "border-iron/40"}`}
        aria-invalid={invalid || undefined}
      >
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className={navBtn}
            onClick={() => (mode === "days" ? shift(-1) : setView((v) => ({ ...v, y: v.y - 1 })))}
            disabled={mode === "days" ? !canPrev : Boolean(minP && view.y <= minP.y)}
            aria-label={mode === "days" ? "החודש הקודם" : "השנה הקודמת"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "days" ? "months" : "days")}
            className="rounded-md px-3 py-1.5 text-sm font-bold text-foreground transition hover:bg-secondary"
            aria-label={mode === "days" ? "בחירת חודש ושנה" : "חזרה ללוח הימים"}
          >
            {mode === "days" ? `${MONTHS_HE[view.m]} ${view.y}` : view.y}
          </button>
          <button
            type="button"
            className={navBtn}
            onClick={() => (mode === "days" ? shift(1) : setView((v) => ({ ...v, y: v.y + 1 })))}
            disabled={mode === "days" ? !canNext : Boolean(maxP && view.y >= maxP.y)}
            aria-label={mode === "days" ? "החודש הבא" : "השנה הבאה"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {mode === "days" ? (
          <>
            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-dust">
              {WEEKDAYS_HE.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (d === null) return <span key={`b${i}`} />;
                const date = iso(view.y, view.m, d);
                const isSelected = date === value;
                const isToday = date === today;
                const disabled = date < min || date > max;
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(date)}
                    aria-pressed={isSelected}
                    aria-label={formatHebrewDate(date) ?? date}
                    className={[
                      "h-10 rounded-md text-sm tabular-nums transition",
                      isSelected
                        ? "bg-primary font-bold text-primary-foreground"
                        : "text-foreground hover:bg-secondary",
                      isToday && !isSelected ? "ring-1 ring-inset ring-primary/60" : "",
                      disabled ? "pointer-events-none opacity-25" : "",
                    ].join(" ")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {MONTHS_HE.map((name, m) => {
              const active = view.m === m;
              const hasValue = selected && selected.y === view.y && selected.m === m;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setView((v) => ({ ...v, m }));
                    setMode("days");
                  }}
                  className={[
                    "h-11 rounded-md text-sm transition",
                    hasValue
                      ? "bg-primary font-bold text-primary-foreground"
                      : active
                        ? "bg-secondary font-bold text-foreground"
                        : "text-foreground hover:bg-secondary",
                  ].join(" ")}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {hebrew ? (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="font-medium text-foreground">{hebrew}</span>
          {left !== null && left > 0 ? (
            <span className="ms-auto shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              עוד {left} ימים
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-dust">לא בטוחים ביום המדויק? בחרו תאריך משוער.</p>
      )}
    </div>
  );
}
