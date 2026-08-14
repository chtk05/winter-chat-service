import Link from "next/link";

import { BrandMark } from "@/components/shell/brand-mark";

export default function NotFound() {
  return (
    <div className="bg-surface flex min-h-full flex-1 flex-col">
      <div className="border-border-default flex flex-none items-center gap-2.5 border-b px-6 py-[18px]">
        <BrandMark />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[460px] flex-col items-center gap-5 text-center">
          <div className="text-border-default font-mono text-[74px] leading-none font-medium tracking-[-0.04em]">
            404
          </div>

          <div>
            <h1 className="tracking-heading text-[24px] font-semibold">
              This page isn&apos;t here
            </h1>
            <p className="mt-2 text-[16px] leading-[1.6] text-pretty text-[#475569]">
              The conversation may have been closed and archived, or the link
              was mistyped. Nothing was lost — every thread is still in the
              inbox.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            <Link
              href="/inbox"
              className="rounded-control bg-primary hover:bg-primary-hover flex h-10 items-center px-[18px] text-[16px] font-medium text-[#f8fafc] no-underline"
            >
              Back to inbox
            </Link>
            <Link
              href="/login"
              className="rounded-control border-border-default bg-surface text-text-primary hover:bg-border-subtle flex h-10 items-center border px-[18px] text-[16px] font-medium no-underline"
            >
              Go to sign in
            </Link>
          </div>

          <div className="text-text-muted font-mono text-[13px]">
            error PAGE_NOT_FOUND
          </div>
        </div>
      </div>
    </div>
  );
}
