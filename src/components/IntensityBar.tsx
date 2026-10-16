export function IntensityBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const pct = Math.round((Math.min(5, Math.max(1, value)) / 5) * 100);
  return (
    <div className="space-y-1 text-right">
      <div className="flex items-center justify-between gap-3 text-xs" dir="rtl">
        <span className="text-dust">{label}</span>
        <span className="font-mono tabular-nums text-dust">{value}/5</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-iron/25">
        <div className="h-full bg-primary/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
