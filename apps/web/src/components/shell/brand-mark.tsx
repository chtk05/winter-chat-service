/**
 * The design's 24px rounded square wordmark, used in the top bar, the sign-in
 * marketing panel, and the 404 header.
 */
export function BrandMark({ showName = true }: { showName?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        aria-hidden
        className="flex h-6 w-6 flex-none items-center justify-center rounded-chip bg-primary text-[12px] font-semibold text-[#f8fafc]"
      >
        W
      </div>
      {showName && (
        <div className="whitespace-nowrap text-[14px] font-medium">
          WinterChat
        </div>
      )}
    </div>
  );
}
