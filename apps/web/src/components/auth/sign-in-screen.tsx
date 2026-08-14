"use client";

import { MarketingPanel } from "./marketing-panel";
import { StepIndicator } from "./step-indicator";
import { BrandMark } from "@/components/shell/brand-mark";

export function SignInScreen({
  onSignIn,
  error,
}: {
  onSignIn: () => void;
  error?: string | null;
}) {
  return (
    <div className="bg-bg flex min-h-0 flex-1 overflow-y-auto max-lg:flex-col">
      <MarketingPanel />

      <div className="p-6 lg:hidden">
        <BrandMark />
      </div>

      <div className="flex min-w-[340px] flex-1 items-center justify-center px-6 py-10">
        <div className="border-border-default bg-surface flex w-full max-w-[400px] flex-col gap-6 rounded-[14px] border p-8 shadow-[0_12px_40px_-16px_rgba(9,9,11,0.16)]">
          <StepIndicator step={1} />

          <div>
            <h1 className="tracking-heading text-[22px] font-semibold">
              Sign in with LINE
            </h1>
            <p className="text-text-secondary mt-1.5 text-[13px] leading-[1.6]">
              WinterChat uses your LINE account to identify you. Nothing is
              posted on your behalf.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-control border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onSignIn}
            className="rounded-control bg-line flex h-12 items-center justify-center gap-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <LineMark />
            Continue with LINE
          </button>

          <p className="text-text-secondary text-[13px] leading-[1.6]">
            After signing in you&apos;ll enter the invite code your admin sent
            you.
          </p>
        </div>
      </div>
    </div>
  );
}

function LineMark() {
  return (
    <span
      aria-hidden
      className="text-line rounded-chip flex h-6 w-6 flex-none items-center justify-center bg-white text-[9px] font-bold"
    >
      LINE
    </span>
  );
}
