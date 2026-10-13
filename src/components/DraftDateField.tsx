import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

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
const YEARS_AHEAD = 3;

function parse(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate();

/** "בעוד 23 ימים" up close, months further out. */
function countdown(year: number, month: number, day: number, today: Date) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round(
    (new Date(year, month - 1, day).getTime() - start.getTime()) / 86_400_000,
  );
  if (days <= 0) return "היום";
  if (days === 1) return "מחר";
  if (days < 60) return `בעוד ${days} ימים`;
  const months = Math.round(days / 30.44);
  return months === 2 ? "בעוד חודשיים" : `בעוד ${months} חודשים`;
}

/**
 * Draft date as a tear-off calendar readout, a year switch, the months still ahead, and a day grid
 * for the chosen month. Picking a month sets the 1st (or keeps the chosen day) so the date is valid
 * right away; the day grid then makes it exact. Everything is derived from today's date.
 */
export function DraftDateField({ value, onChange, invalid, className = "" }: Props) {
  const reduce = useReducedMotion();
  const switchId = useId();
  const current = parse(value);
  const today = new Date();
  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth() + 1;
  const [pendingYear, setPendingYear] = useState<number | null>(null);
  const year = pendingYear ?? current?.year ?? null;
  const years = [
    ...new Set([
      ...Array.from({ length: YEARS_AHEAD + 1 }, (_, i) => thisYear + i),
      ...(year ? [year] : []),
    ]),
  ].sort((a, b) => a - b);
  // Months already behind us are not offered at all.
  const months = Array.from({ length: 12 }, (_, i) => i + 1).filter(
    (month) => !year || year > thisYear || month >= thisMonth,
  );
  const firstAllowedDay = (y: number, m: number) =>
    y === thisYear && m === thisMonth ? today.getDate() : 1;

  function commit(nextYear: number, month: number, day = current?.day ?? 1) {
    const clamped = Math.max(
      firstAllowedDay(nextYear, month),
      Math.min(day, daysIn(nextYear, month)),
    );
    setPendingYear(null);
    onChange(`${nextYear}-${pad(month)}-${pad(clamped)}`);
  }

  const shownMonth = current && current.year === year ? current.month : null;
  const leading = shownMonth && year ? new Date(year, shownMonth - 1, 1).getDay() : 0;

  return (
    <div className={`space-y-4 text-right ${className}`.trim()} aria-invalid={invalid || undefined}>
      <div
        className={`flex items-center gap-4 border p-3 ${
          current
            ? "border-primary/40 bg-primary/10"
            : invalid
              ? "border-dashed border-destructive/60"
              : "border-dashed border-iron/40"
        }`}
      >
        <div className="w-16 shrink-0 overflow-hidden rounded-sm border border-iron/30 bg-card text-center shadow-sm">
          <div className="bg-primary py-0.5 font-mono text-[11px] font-bold tabular-nums text-primary-foreground">
            {current ? SHORT[current.month - 1] : (year ?? "שנה")}
          </div>
          <motion.div
            key={current ? value : "empty"}
            initial={reduce ? false : { opacity: 0, transform: "translateY(-6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="py-1.5 font-mono text-2xl font-black tabular-nums text-foreground"
          >
            {current ? current.day : "?"}
          </motion.div>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-dust">{current ? "גיוס משוער" : "מתי הגיוס?"}</p>
          <p className="text-xl font-black text-foreground">
            {current
              ? `${current.day} ב${MONTHS[current.month - 1]} ${current.year}`
              : year
                ? "בחרו חודש"
                : "בחרו שנה וחודש"}
          </p>
          {current ? (
            <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              {countdown(current.year, current.month, current.day, today)}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="flex rounded-md border border-iron/30 bg-card p-1"
        role="group"
        aria-label="שנה"
      >
        {years.map((option) => {
          const selected = year === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                current && (option > thisYear || current.month >= thisMonth)
                  ? commit(option, current.month)
                  : setPendingYear(option)
              }
              className={`relative min-h-11 flex-1 rounded-sm py-2 font-mono text-sm font-bold tabular-nums transition-colors duration-150 ${
                selected ? "text-primary-foreground" : "text-dust hover:text-foreground"
              }`}
            >
              {selected ? (
                <motion.span
                  layoutId={`${switchId}-year`}
                  className="absolute inset-0 rounded-sm bg-primary"
                  transition={{ duration: reduce ? 0 : 0.25, ease: [0.23, 1, 0.32, 1] }}
                  aria-hidden
                />
              ) : null}
              <span className="relative">{option}</span>
            </button>
          );
        })}
      </div>

      {year ? (
        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="חודש">
          {months.map((month) => {
            const selected = shownMonth === month;
            return (
              <button
                key={month}
                type="button"
                aria-pressed={selected}
                aria-label={`${MONTHS[month - 1]} ${year}`}
                onClick={() => commit(year, month)}
                className={`min-h-11 rounded-full border py-2 text-xs font-bold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.94] ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-iron/30 bg-card text-dust hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {SHORT[month - 1]}
              </button>
            );
          })}
        </div>
      ) : null}

      {shownMonth && year ? (
        <motion.div
          key={`${year}-${shownMonth}`}
          initial={reduce ? false : { opacity: 0, transform: "translateY(-6px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-md border border-iron/30 bg-card p-3"
        >
          <p className="mb-2 text-xs text-dust">
            יודעים את היום? <span className="text-foreground">{MONTHS[shownMonth - 1]}</span>
          </p>
          <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label="יום">
            {WEEKDAYS.map((label) => (
              <span key={label} className="pb-1 text-[11px] font-bold text-dust" aria-hidden>
                {label}
              </span>
            ))}
            {Array.from({ length: leading }, (_, i) => (
              <span key={`gap-${i}`} aria-hidden />
            ))}
            {Array.from({ length: daysIn(year, shownMonth) }, (_, i) => i + 1).map((day) => {
              const selected = current?.day === day;
              const past = day < firstAllowedDay(year, shownMonth);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${day} ב${MONTHS[shownMonth - 1]} ${year}`}
                  disabled={past}
                  onClick={() => commit(year, shownMonth, day)}
                  className={`aspect-square min-h-9 rounded-full font-mono text-xs font-bold tabular-nums transition-[color,background-color,transform] duration-150 active:scale-[0.92] disabled:cursor-not-allowed disabled:opacity-25 ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-primary/15 hover:text-foreground"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
