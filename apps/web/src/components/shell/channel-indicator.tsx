/**
 * D-018: "1 of 4 channels live" is a **hardcoded string, not a computed value**.
 * LINE is the only integration; Facebook, WhatsApp and the Web widget are inert
 * chrome, so there is nothing to count and nothing that could change this number.
 */
export const CHANNELS_LIVE_LABEL = "1 of 4 channels live";

export function ChannelIndicator() {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-[13px] text-text-secondary">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-[#22c55e]"
      />
      {CHANNELS_LIVE_LABEL}
    </div>
  );
}
