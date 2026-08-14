/**
 * The design's stat card.
 *
 * D-020 / §3.5: no card may display a placeholder or fabricated number. Empty
 * data renders a zero, so `value` is a required number — there is no "—" state
 * and no way to pass one. The design's comparison sub-lines ("+4 vs yesterday")
 * are dropped: F-003 produces no prior-period figure to compare against.
 */
export function StatCard({
  label,
  value,
  accent = false,
  caption,
}: {
  label: string;
  value: number;
  accent?: boolean;
  caption?: string;
}) {
  return (
    <div className="rounded-card border border-border-default bg-surface p-4">
      <div className="text-[13px] text-text-secondary">{label}</div>
      <div
        data-testid="stat-value"
        style={accent ? { color: "#db2777" } : undefined}
        className="mt-1.5 text-[28px] font-semibold tracking-heading"
      >
        {value}
      </div>
      {caption && (
        <div className="mt-1 text-[12px] text-text-secondary">{caption}</div>
      )}
    </div>
  );
}
