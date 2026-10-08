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
const SHORT = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

function parse(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

function countdown(year: number, month: number) {
  const now = new Date();
  const months = (year - now.getFullYear()) * 12 + month - 1 - now.getMonth();
  if (months <= 0) return "החודש";
  if (months === 1) return "בעוד חודש";
  if (months === 2) return "בעוד חודשיים";
  return `בעוד ${months} חודשים`;
}

/**
 * Draft date as a tear-off calendar readout, a year switch and a month grid. Teens usually know
 * the draft month, not the day, so the day is kept if one exists (clamped) and defaults to the 1st.
 */
export function DraftDateField({ value, onChange, invalid, className = "" }: Props) {
  const reduce = useReducedMotion();
  const switchId = useId();
  const current = parse(value);
  const now = new Date();
  const thisYear = now.getFullYear();
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
            {current?.year ?? year ?? "שנה"}
          </div>
          <motion.div
            key={current ? `${current.year}-${current.month}` : "empty"}
            initial={reduce ? false : { opacity: 0, transform: "translateY(-6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="py-2 text-lg font-black text-foreground"
          >
            {current ? SHORT[current.month - 1] : "?"}
          </motion.div>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-dust">{current ? "גיוס משוער" : "מתי הגיוס?"}</p>
          <p className="text-xl font-black text-foreground">
            {current ? `${MONTHS[current.month - 1]} ${current.year}` : year ? "בחרו חודש" : "בחרו שנה וחודש"}
          </p>
          {current ? (
            <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              {countdown(current.year, current.month)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex rounded-md border border-iron/30 bg-card p-1" role="group" aria-label="שנה">
        {years.map((option) => {
          const selected = year === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => (current ? commit(option, current.month) : setPendingYear(option))}
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

      <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="חודש">
        {SHORT.map((label, index) => {
          const month = index + 1;
          const selected = Boolean(current && current.year === year && current.month === month);
          const past = year === thisYear && month < now.getMonth() + 1;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              aria-label={`${MONTHS[index]}${year ? ` ${year}` : ""}`}
              disabled={!year || past}
              onClick={() => year && commit(year, month)}
              className={`min-h-11 rounded-full border py-2 text-xs font-bold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30 ${
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
    </div>
  );
}
