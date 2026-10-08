import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PreferenceOptionGrid } from "@/components/PreferenceOptionGrid";
import { DraftDateField } from "@/components/DraftDateField";
import { getDashboardStats, updateProfile, type DashboardResponse } from "@/lib/api";
import {
  COMBAT_PREFERENCE_OPTIONS,
  FITNESS_PREFERENCE_OPTIONS,
  FOCUS_PREFERENCE_OPTIONS,
  type CombatPreferenceValue,
  type FitnessPreferenceValue,
  type FocusPreferenceValue,
} from "@/lib/profile-preference-data";
import {
  coerceCombat,
  coerceFitness,
  coerceFocus,
  draftDateToYmd,
} from "@/lib/profile-resume";
import { ARIA } from "@/lib/a11y";

const DAPAR_SCORES = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
const MEDICAL_SCORES = [21, 45, 64, 72, 82, 97] as const;

type ScoreChipRowProps = {
  scores: readonly number[];
  selected: number | null;
  onSelect: (n: number) => void;
};

/** RTL row: lowest score on the right (reading start), highest on the left */
function ScoreChipRow({ scores, selected, onSelect }: ScoreChipRowProps) {
  return (
    <div className="flex flex-wrap justify-start gap-2" dir="rtl">
      {scores.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect(n)}
          aria-pressed={selected === n}
          aria-label={ARIA.scoreChip(n, selected === n)}
          className={`rounded-sm border px-3 py-2 font-mono text-sm font-bold tabular-nums transition ${
            selected === n
              ? "border-primary bg-primary/10 text-primary"
              : "border-iron/30 hover:border-primary/40"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

type Props = {
  data: DashboardResponse;
};

export function DashboardAccountPreferences({ data }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  const [preferredName, setPreferredName] = useState("");
  const [combat, setCombat] = useState<CombatPreferenceValue | "">("");
  const [focus, setFocus] = useState<FocusPreferenceValue | "">("");
  const [fitness, setFitness] = useState<FitnessPreferenceValue | "">("");
  const [draftDate, setDraftDate] = useState("");
  const [dapar, setDapar] = useState<number | null>(null);
  const [medical, setMedical] = useState<number | null>(null);

  useEffect(() => {
    setPreferredName(data.user.preferredName?.trim() ?? "");
    setCombat(coerceCombat(data.preferences?.combatPreference));
    setFocus(coerceFocus(data.preferences?.focus));
    setFitness(coerceFitness(data.preferences?.physicalActivityLevel));
    setDraftDate(draftDateToYmd(data.stats?.draftDate));
    setDapar(data.stats?.daparScore ?? null);
    setMedical(data.stats?.medicalProfile ?? null);
  }, [data]);

  async function save() {
    if (!combat || !focus || !fitness) {
      toast.error("בחרו כיוון שירות, מיקוד ורמת כושר");
      return;
    }
    if (data.user.status === "Pre-Draft" && !draftDate.trim()) {
      toast.error("הזינו תאריך גיוס משוער");
      return;
    }
    if (dapar == null || medical == null) {
      toast.error('הזינו דפ"ר ופרופיל רפואי');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        user: { preferredName: preferredName.trim() || undefined },
        preferences: {
          combatPreference: combat,
          focus,
          physicalActivityLevel: fitness,
          schedule: data.preferences?.schedule ?? "Any",
          location: data.preferences?.location ?? "Anywhere",
        },
        stats: {
          daparScore: dapar,
          medicalProfile: medical,
          ...(data.user.status === "Pre-Draft" && draftDate
            ? { draftDate: new Date(draftDate).toISOString() }
            : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("ההעדפות נשמרו");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="border border-iron/30 bg-card text-right"
      dir="rtl"
      aria-labelledby="account-preferences-heading"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right transition hover:bg-secondary/40 sm:px-6"
        aria-expanded={open}
        aria-controls="account-preferences-panel"
        aria-label={open ? "סגור העדפות חשבון" : "פתח העדפות חשבון"}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Settings2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="text-right">
            <p className="font-mono text-[10px] tracking-widest text-primary uppercase">חשבון</p>
            <h2 id="account-preferences-heading" className="text-base font-bold text-foreground sm:text-lg">
              העדפות ופרטים אישיים
            </h2>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-dust transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
            id="account-preferences-panel"
          >
            <div className="space-y-8 border-t border-iron/20 px-5 py-6 sm:px-6 sm:py-8">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">שם תצוגה</label>
                <input
                  type="text"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="איך לקרוא לכם בדשבורד"
                  className="input-field max-w-md text-right"
                  dir="rtl"
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">כיוון שירות</p>
                <PreferenceOptionGrid options={COMBAT_PREFERENCE_OPTIONS} selected={combat} onSelect={setCombat} />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">מיקוד תפקידי</p>
                <PreferenceOptionGrid
                  options={FOCUS_PREFERENCE_OPTIONS}
                  selected={focus}
                  onSelect={setFocus}
                  columnsClass="grid-cols-1 sm:grid-cols-2"
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">רמת כושר (הערכה עצמית)</p>
                <PreferenceOptionGrid
                  options={FITNESS_PREFERENCE_OPTIONS}
                  selected={fitness}
                  onSelect={setFitness}
                  columnsClass="grid-cols-1 sm:grid-cols-3"
                />
              </div>

              {data.user.status === "Pre-Draft" && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">תאריך גיוס משוער</label>
                  <DraftDateField value={draftDate} onChange={setDraftDate} />
                </div>
              )}

              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">דפ&quot;ר ופרופיל רפואי</p>
                <div className="space-y-2">
                  <p className="text-xs text-dust">דפ&quot;ר</p>
                  <ScoreChipRow scores={DAPAR_SCORES} selected={dapar} onSelect={setDapar} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-dust">פרופיל רפואי</p>
                  <ScoreChipRow scores={MEDICAL_SCORES} selected={medical} onSelect={setMedical} />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-3 border-t border-iron/20 pt-4">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  aria-busy={saving}
                  className="inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-70"
                >
                  {saving ? (
                    <span className="h-4 w-24 animate-pulse rounded-sm bg-primary-foreground/30" aria-hidden />
                  ) : (
                    "שמירת העדפות"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
