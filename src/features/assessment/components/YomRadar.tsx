import { motion, useReducedMotion } from "framer-motion";
import { YOM_HAMEAH_KEYS, YOM_HAMEAH_LABELS_HE, type YomHameahKey } from "@/lib/yom-hameah";
import { dimensionRows } from "../insights";
import type { AssessmentAnswers } from "../types";

// Short names so 11 labels fit around a phone-width chart.
const SHORT: Record<YomHameahKey, string> = {
  technicalActivation: "טכני",
  spatialPerception: "מרחבי",
  dataProcessing: "עיבוד מידע",
  teamwork: "צוות",
  command: "פיקוד",
  instruction: "הדרכה",
  interpersonalCare: "טיפול באדם",
  diligencePersistence: "התמדה",
  managementOrganization: "ארגון",
  frameworkBehavior: "מסגרת",
  maturity: "בגרות",
};

const W = 340;
const H = 300;
const CX = W / 2;
const CY = H / 2;
const R = 95;
const EASE = [0.22, 1, 0.36, 1] as const;

const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / YOM_HAMEAH_KEYS.length;
const point = (i: number, radius: number) =>
  [CX + radius * Math.cos(angle(i)), CY + radius * Math.sin(angle(i))] as const;
const pathFor = (radii: number[]) =>
  radii.map((r, i) => `${i ? "L" : "M"}${point(i, r).map((n) => n.toFixed(1)).join(" ")}`).join(" ") + " Z";

/**
 * 11-axis radar of the מא"ה scores; strongest dimensions are highlighted.
 * `live` re-animates on every change (the input step); otherwise it draws once when scrolled into view.
 */
export function YomRadar({ answers, live = false }: { answers: AssessmentAnswers; live?: boolean }) {
  const reduce = useReducedMotion();
  const { rows, flat } = dimensionRows(answers);
  const top = new Set(flat ? [] : rows.filter((r) => r.top).map((r) => r.key));
  const scores = YOM_HAMEAH_KEYS.map((key) => answers.yomHameah[key] ?? 0);
  const radii = scores.map((s) => (R * Math.max(0, Math.min(5, s))) / 5);
  const collapsed = pathFor(scores.map(() => 0));
  const target = { d: pathFor(radii) };
  const play = live
    ? { animate: target }
    : { whileInView: target, viewport: { once: true, amount: 0.4 } };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto block w-full max-w-sm"
      direction="ltr"
      role="img"
      aria-label={`מפת מא״ה: ${rows.map((r) => `${r.label} ${r.score}`).join(", ")}`}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <path
          key={level}
          d={pathFor(scores.map(() => (R * level) / 5))}
          className={level === 5 ? "fill-card stroke-iron/45" : "fill-none stroke-iron/25"}
          strokeWidth={1}
        />
      ))}
      {YOM_HAMEAH_KEYS.map((key, i) => {
        const [x, y] = point(i, R);
        return <line key={key} x1={CX} y1={CY} x2={x} y2={y} className="stroke-iron/25" strokeWidth={1} />;
      })}

      <motion.path
        initial={reduce ? false : { d: collapsed }}
        {...play}
        transition={{ duration: reduce ? 0 : live ? 0.35 : 0.9, ease: EASE }}
        className="fill-primary/20 stroke-primary"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {YOM_HAMEAH_KEYS.map((key, i) => {
        const [x, y] = point(i, radii[i]);
        const strong = top.has(key);
        return (
          <motion.circle
            key={key}
            initial={reduce ? false : { cx: CX, cy: CY }}
            {...(live
              ? { animate: { cx: x, cy: y } }
              : { whileInView: { cx: x, cy: y }, viewport: { once: true, amount: 0.4 } })}
            transition={{ duration: reduce ? 0 : live ? 0.35 : 0.9, ease: EASE }}
            r={strong ? 5 : 3}
            className={strong ? "fill-primary stroke-background" : "fill-primary/70"}
            strokeWidth={strong ? 2 : 0}
          />
        );
      })}

      {YOM_HAMEAH_KEYS.map((key, i) => {
        const [x, y] = point(i, R + 16);
        const cos = Math.cos(angle(i));
        const sin = Math.sin(angle(i));
        const strong = top.has(key);
        return (
          <text
            key={key}
            x={x}
            y={y + (sin < -0.9 ? -4 : sin > 0.9 ? 6 : 0)}
            textAnchor={cos > 0.2 ? "start" : cos < -0.2 ? "end" : "middle"}
            dominantBaseline="middle"
            className={strong ? "fill-primary text-[12px] font-black" : "fill-dust text-[11px]"}
          >
            <title>{YOM_HAMEAH_LABELS_HE[key]}</title>
            {SHORT[key]}
          </text>
        );
      })}
    </svg>
  );
}
