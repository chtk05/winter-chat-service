export function BrandMark({ showName = true }: { showName?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        aria-hidden
        className="rounded-chip bg-primary flex h-6 w-6 flex-none items-center justify-center text-[12px] font-semibold text-[#f8fafc]"
      >
        W
      </div>
      {showName && (
        <div className="text-[14px] font-medium whitespace-nowrap">
          WinterChat
        </div>
      )}
    </div>
  );
}
