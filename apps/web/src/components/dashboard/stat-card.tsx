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
    <div className="rounded-card border-border-default bg-surface border p-4">
      <div className="text-text-secondary text-[15px]">{label}</div>
      <div
        data-testid="stat-value"
        style={accent ? { color: "#db2777" } : undefined}
        className="tracking-heading mt-1.5 text-[30px] font-semibold"
      >
        {value}
      </div>
      {caption && (
        <div className="text-text-secondary mt-1 text-[14px]">{caption}</div>
      )}
    </div>
  );
}
