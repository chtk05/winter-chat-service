"use client";

/**
 * T-012 / D-018: the composer's "Reply via" selector.
 *
 * LINE is the only enabled option. Facebook and WhatsApp render exactly as the
 * design renders them — disabled, 0.45 opacity, `not-allowed` cursor, "Not
 * connected yet" title — as **static presentational chrome**. There is no
 * channel abstraction, no adapter interface, and no second integration behind
 * them (D-018), and clicking one must fire nothing.
 */

export const CHANNELS = [
  { key: "LINE", label: "LINE", enabled: true },
  { key: "Facebook", label: "Facebook", enabled: false },
  { key: "WhatsApp", label: "WhatsApp", enabled: false },
] as const;

export function ChannelSelector() {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-[12px] text-text-secondary">Reply via</span>

      <div
        role="group"
        aria-label="Reply channel"
        className="flex gap-1 rounded-control bg-border-subtle p-[3px]"
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
              "whitespace-nowrap rounded-chip px-2.5 py-1 text-[12px] font-medium",
              channel.enabled
                ? "bg-surface text-text-primary shadow-[0_1px_2px_rgba(9,9,11,0.08)]"
                : "bg-transparent text-text-secondary",
            ].join(" ")}
          >
            {channel.label}
          </button>
        ))}
      </div>

      <span className="text-[11px] text-text-muted">
        More channels can be added later
      </span>
    </div>
  );
}
