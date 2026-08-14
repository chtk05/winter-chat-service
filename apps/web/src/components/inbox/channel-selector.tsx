"use client";

export const CHANNELS = [
  { key: "LINE", label: "LINE", enabled: true },
  { key: "Facebook", label: "Facebook", enabled: false },
  { key: "WhatsApp", label: "WhatsApp", enabled: false },
] as const;

export function ChannelSelector() {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-text-secondary text-[12px]">Reply via</span>

      <div
        role="group"
        aria-label="Reply channel"
        className="rounded-control bg-border-subtle flex gap-1 p-[3px]"
      >
        {CHANNELS.map((channel) => (
          <button
            key={channel.key}
            type="button"
            disabled={!channel.enabled}
            aria-pressed={channel.enabled}
            title={
              channel.enabled
                ? `Reply through ${channel.label}`
                : "Not connected yet"
            }
            style={{
              opacity: channel.enabled ? 1 : 0.45,
              cursor: channel.enabled ? "pointer" : "not-allowed",
            }}
            className={[
              "rounded-chip px-2.5 py-1 text-[12px] font-medium whitespace-nowrap",
              channel.enabled
                ? "bg-surface text-text-primary shadow-[0_1px_2px_rgba(9,9,11,0.08)]"
                : "text-text-secondary bg-transparent",
            ].join(" ")}
          >
            {channel.label}
          </button>
        ))}
      </div>

      <span className="text-text-muted text-[11px]">
        More channels can be added later
      </span>
    </div>
  );
}
