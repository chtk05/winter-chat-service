"use client";

export function PanelToggle({
  label,
  pressed,
  onToggle,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-control border-border-default flex h-8 items-center gap-2 border px-3">
      <span className="text-text-secondary text-[14px] whitespace-nowrap">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={pressed}
        aria-label={
          pressed
            ? `Hide ${label.toLowerCase()}`
            : `Show ${label.toLowerCase()}`
        }
        title={
          pressed
            ? `Hide ${label.toLowerCase()}`
            : `Show ${label.toLowerCase()}`
        }
        onClick={onToggle}
        style={{ background: pressed ? "#2563eb" : "#cbd5e1" }}
        className="rounded-pill relative h-[18px] w-[34px] flex-none p-0"
      >
        <span
          aria-hidden
          style={{ left: pressed ? "18px" : "2px" }}
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_2px_rgba(9,9,11,0.3)] transition-[left] duration-150"
        />
      </button>
    </div>
  );
}
