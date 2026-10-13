import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  className?: string;
};

const MONTHS = [
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
const SHORT = [
  "ינו׳",
  "פבר׳",
  "מרץ",
  "אפר׳",
  "מאי",
  "יוני",
  "יולי",
  "אוג׳",
  "ספט׳",
  "אוק׳",
  "נוב׳",
  "דצמ׳",
];
const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
// The server accepts 2000-2038; around today covers both the already-drafted and the very young.
const YEARS_BACK = 6;
const YEARS_AHEAD = 8;

function parse(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate();

/** "בעוד 23 ימים" / "לפני 5 חודשים": days up close, months further out, either direction. */
function relative(year: number, month: number, day: number, today: Date) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round(
    (new Date(year, month - 1, day).getTime() - start.getTime()) / 86_400_000,
  );
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  if (days === -1) return "אתמול";
  const abs = Math.abs(days);
  const amount =
    abs < 60
      ? `${abs} ימים`
      : Math.round(abs / 30.44) === 2
        ? "חודשיים"
        : `${Math.round(abs / 30.44)} חודשים`;
  return days > 0 ? `בעוד ${amount}` : `לפני ${amount}`;
}

/**
 * Draft date in three compact rows: the date with a year switcher, a month grid, and a swipeable
 * strip of that month's days. Any year around today works (already drafted or years away); picking a
 * month alone already gives a valid date (the 1st, or the day chosen before).
 */
export function DraftDateField({ value, onChange, invalid, className = "" }: Props) {
  const current = parse(value);
  const today = new Date();
  const thisYear = today.getFullYear();
  const minYear = Math.max(2000, thisYear - YEARS_BACK);
  const maxYear = Math.min(2038, thisYear + YEARS_AHEAD);
  const [pendingYear, setPendingYear] = useState<number | null>(null);
  const year = pendingYear ?? current?.year ?? thisYear;
  const shownMonth = current && current.year === year ? current.month : null;
  const strip = useRef<HTMLDivElement>(null);

  function commit(nextYear: number, month: number, day = current?.day ?? 1) {
    setPendingYear(null);
    onChange(`${nextYear}-${pad(month)}-${pad(Math.min(day, daysIn(nextYear, month)))}`);
  }

  function stepYear(delta: number) {
    const next = Math.min(maxYear, Math.max(minYear, year + delta));
    if (current) commit(next, current.month);
    else setPendingYear(next);
  }

  // Keep the chosen day in view inside the strip without moving the page.
  useEffect(() => {
    strip.current
      ?.querySelector<HTMLElement>("[aria-pressed='true']")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [value]);

  return (
    <div
      className={`min-w-0 space-y-2.5 text-right ${className}`.trim()}
      aria-invalid={invalid || undefined}
    >
      <div
        className={`flex items-center justify-between gap-3 border px-3 py-2 ${
          current
            ? "border-primary/40 bg-primary/10"
            : invalid
              ? "border-dashed border-destructive/60"
              : "border-dashed border-iron/40"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-base font-black text-foreground">
            {current
              ? `${current.day} ב${MONTHS[current.month - 1]} ${current.year}`
              : "בחרו חודש ויום"}
          </p>
          {current ? (
            <p className="text-[11px] font-bold text-primary">
              {relative(current.year, current.month, current.day, today)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center" role="group" aria-label="שנה">
          <button
            type="button"
            onClick={() => stepYear(-1)}
            disabled={year <= minYear}
            aria-label="שנה קודמת"
            className="flex h-9 w-9 items-center justify-center rounded-sm text-dust transition hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <span className="w-14 text-center font-mono text-base font-bold tabular-nums text-foreground">
            {year}
          </span>
          <button
            type="button"
            onClick={() => stepYear(1)}
            disabled={year >= maxYear}
            aria-label="שנה הבאה"
            className="flex h-9 w-9 items-center justify-center rounded-sm text-dust transition hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="חודש">
        {SHORT.map((label, index) => {
          const month = index + 1;
          const selected = shownMonth === month;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              aria-label={`${MONTHS[index]} ${year}`}
              onClick={() => commit(year, month)}
              className={`h-9 rounded-full border text-xs font-bold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.94] ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-iron/30 bg-card text-dust hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {shownMonth ? (
        <div
          ref={strip}
          className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]"
          role="group"
          aria-label={`יום ב${MONTHS[shownMonth - 1]}`}
        >
          {Array.from({ length: daysIn(year, shownMonth) }, (_, i) => i + 1).map((day) => {
            const selected = current?.day === day;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                aria-label={`${day} ב${MONTHS[shownMonth - 1]} ${year}`}
                onClick={() => commit(year, shownMonth, day)}
                className={`flex h-12 w-10 shrink-0 flex-col items-center justify-center rounded-md border transition-[color,background-color,border-color] duration-150 ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-iron/30 bg-card text-foreground/80 hover:border-primary/40"
                }`}
              >
                <span className={`text-[10px] ${selected ? "" : "text-dust"}`}>
                  {WEEKDAYS[new Date(year, shownMonth - 1, day).getDay()]}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums">{day}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
