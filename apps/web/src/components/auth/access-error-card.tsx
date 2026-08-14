/**
 * The design's "Access error" card, kept as visual treatment per D-017.
 *
 * Removed against the design, all per D-017:
 *  - "expired, already used, or not linked to this LINE account"
 *  - "Codes are single-use and last 7 days"
 *  - the "Signed in as Aom M. on LINE" account block
 *  - the "Message an admin" button — F-001 records no such action, so shipping
 *    it would mean inventing a feature (§3.2)
 *
 * The reference line is rendered from the real D-021 error body, never from the
 * design's fixture ("error INVITE_INVALID · ref 4471-A").
 */
export function AccessErrorCard({
  code,
  message,
  reference,
  onRetry,
}: {
  code: string;
  message: string;
  reference?: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-border-default bg-surface flex w-full max-w-[460px] flex-col gap-[18px] rounded-[14px] border p-8 shadow-[0_12px_40px_-16px_rgba(9,9,11,0.16)]"
    >
      <div
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#fef2f2] text-[20px] font-semibold text-[#b91c1c]"
      >
        !
      </div>

      <div>
        <h2 className="tracking-heading text-[20px] font-semibold">
          That access code didn&apos;t work
        </h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-pretty text-[#475569]">
          {message}
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-control bg-primary hover:bg-primary-hover h-10 flex-1 basis-40 text-[14px] font-medium text-[#f8fafc]"
        >
          Try another code
        </button>
      </div>

      <div className="text-text-muted font-mono text-[11px]">
        error {code}
        {reference ? ` · ref ${reference}` : ""}
      </div>
    </div>
  );
}
