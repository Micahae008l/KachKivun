import { useState } from "react";
import { Calendar } from "lucide-react";

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

function parse(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Draft date as year chips + a month grid. Teens usually know the draft month, not the day,
 * so the day is kept if one exists (clamped to the month) and defaults to the 1st.
 */
export function DraftDateField({ value, onChange, invalid, className = "" }: Props) {
  const current = parse(value);
  const thisYear = new Date().getFullYear();
  const [pendingYear, setPendingYear] = useState<number | null>(null);
  const year = pendingYear ?? current?.year ?? null;
  const years = [
    ...new Set([thisYear, thisYear + 1, thisYear + 2, thisYear + 3, ...(year ? [year] : [])]),
  ].sort((a, b) => a - b);

  function commit(nextYear: number, month: number) {
    const daysInMonth = new Date(nextYear, month, 0).getDate();
    const day = Math.min(current?.day ?? 1, daysInMonth);
    setPendingYear(null);
    onChange(`${nextYear}-${pad(month)}-${pad(day)}`);
  }

  const chip = (selected: boolean) =>
    `rounded-sm border px-3 py-2 text-sm font-semibold tabular-nums transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] ${
      selected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-iron/30 bg-card text-dust hover:border-primary/40 hover:text-foreground"
    }`;

  return (
    <div className={`space-y-4 text-right ${className}`.trim()} aria-invalid={invalid || undefined}>
      <fieldset>
        <legend className="mb-2 text-xs font-bold text-dust">שנה</legend>
        <div className="flex flex-wrap gap-2">
          {years.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={year === option}
              onClick={() => (current ? commit(option, current.month) : setPendingYear(option))}
              className={chip(year === option)}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={!year} className="disabled:opacity-40">
        <legend className="mb-2 text-xs font-bold text-dust">חודש</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MONTHS.map((label, index) => {
            const month = index + 1;
            const selected = Boolean(current && current.year === year && current.month === month);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                onClick={() => year && commit(year, month)}
                className={chip(selected)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p
        className={`flex items-center gap-2 text-sm ${current ? "text-foreground" : invalid ? "text-destructive" : "text-dust"}`}
      >
        <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {current
          ? `גיוס משוער: ${MONTHS[current.month - 1]} ${current.year}`
          : year
            ? "עכשיו בחרו חודש"
            : "בחרו שנה וחודש. אפשר לעדכן בהמשך."}
      </p>
    </div>
  );
}
