import { motion } from "framer-motion";
import { Check } from "lucide-react";

type Option<T extends string> = { value: T; title: string; subtitle: string };

type Props<T extends string> = {
  options: Option<T>[];
  selected: T | "";
  /** Multi-select: every value here shows as chosen (overrides `selected`). */
  selectedValues?: T[];
  onSelect: (value: T) => void;
  columnsClass?: string;
};

export function PreferenceOptionGrid<T extends string>({
  options,
  selected,
  selectedValues,
  onSelect,
  columnsClass = "grid-cols-1 sm:grid-cols-2",
}: Props<T>) {
  return (
    <div className={`grid gap-3 ${columnsClass}`} dir="rtl" role="group">
      {options.map((opt, idx) => {
        const isOn = selectedValues ? selectedValues.includes(opt.value) : selected === opt.value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            aria-pressed={isOn}
            onClick={() => onSelect(opt.value)}
            initial={{ opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ delay: 0.03 + idx * 0.03, duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className={`relative min-h-11 border px-4 py-4 text-right transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98] ${
              isOn
                ? "border-primary bg-primary/10"
                : "border-iron/30 bg-card hover:border-primary/40"
            }`}
          >
            {isOn ? (
              <span
                className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            ) : null}
            <p className="font-semibold text-foreground">{opt.title}</p>
            <p className="mt-1 text-sm text-dust">{opt.subtitle}</p>
          </motion.button>
        );
      })}
    </div>
  );
}
