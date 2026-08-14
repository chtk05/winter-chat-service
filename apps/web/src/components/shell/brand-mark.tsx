export function BrandMark({
  showName = true,
  size = "default",
}: {
  showName?: boolean;
  size?: "default" | "lg";
}) {
  const isLg = size === "lg";

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        aria-hidden
        className={[
          "rounded-chip bg-primary flex flex-none items-center justify-center font-semibold text-[#f8fafc]",
          isLg ? "h-8 w-8 text-[16px]" : "h-6 w-6 text-[14px]",
        ].join(" ")}
      >
        W
      </div>
      {showName && (
        <div
          className={[
            "font-medium whitespace-nowrap",
            isLg ? "text-[19px]" : "text-[16px]",
          ].join(" ")}
        >
          WinterChat
        </div>
      )}
    </div>
  );
}
