export const CHANNELS_LIVE_LABEL = "1 of 4 channels live";

export function ChannelIndicator() {
  return (
    <div className="text-text-secondary flex items-center gap-2 text-[13px] whitespace-nowrap">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
      {CHANNELS_LIVE_LABEL}
    </div>
  );
}
