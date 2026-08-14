import Link from "next/link";

import { BrandMark } from "@/components/shell/brand-mark";

/**
 * F-004 / design conflict C-8: the 404 page is adopted from the design.
 *
 * The design prints "error PAGE_NOT_FOUND · ref 9F13-C". The code is real and
 * kept; the ref is design fixture data (§3.5). A `ref` is minted by the server
 * for an actual API failure (D-021) — a statically rendered 404 has no server
 * response behind it, so no reference is fabricated here.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <div className="flex flex-none items-center gap-2.5 border-b border-border-default px-6 py-[18px]">
        <BrandMark />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[460px] flex-col items-center gap-5 text-center">
          <div className="font-mono text-[72px] font-medium leading-none tracking-[-0.04em] text-border-default">
            404
          </div>

          <div>
            <h1 className="text-[22px] font-semibold tracking-heading">
              This page isn&apos;t here
            </h1>
            <p className="mt-2 text-[14px] leading-[1.6] text-[#475569] text-pretty">
              The conversation may have been closed and archived, or the link
              was mistyped. Nothing was lost — every thread is still in the
              inbox.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            <Link
              href="/inbox"
              className="flex h-10 items-center rounded-control bg-primary px-[18px] text-[14px] font-medium text-[#f8fafc] no-underline hover:bg-primary-hover"
            >
              Back to inbox
            </Link>
            <Link
              href="/login"
              className="flex h-10 items-center rounded-control border border-border-default bg-surface px-[18px] text-[14px] font-medium text-text-primary no-underline hover:bg-border-subtle"
            >
              Go to sign in
            </Link>
          </div>

          <div className="font-mono text-[11px] text-text-muted">
            error PAGE_NOT_FOUND
          </div>
        </div>
      </div>
    </div>
  );
}
