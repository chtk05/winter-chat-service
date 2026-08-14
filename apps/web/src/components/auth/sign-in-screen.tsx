"use client";

import { MarketingPanel } from "./marketing-panel";

/**
 * T-005, gate ONE of D-036's two: establish *who* the person is, with LINE Login (D-035).
 *
 * `onSignIn` is injected rather than importing `signIn` here, so this component renders
 * against a double in tests (D-022) and never drags Auth.js into the component layer. The
 * page wires the real `signIn("line")`.
 *
 * D-017's visual treatment stands — the split layout and `#eef2ff` marketing panel. Its
 * copy rules do not: LINE-account language is now accurate rather than a fabrication,
 * because D-035 makes LINE the actual identity provider.
 */
export function SignInScreen({
  onSignIn,
  error,
}: {
  onSignIn: () => void;
  /** Set when LINE returned an error, or the user cancelled at LINE's consent screen. */
  error?: string | null;
}) {
  return (
    <div className="bg-surface flex min-h-0 flex-1 overflow-y-auto max-lg:flex-col">
      <MarketingPanel />

      <div className="flex min-w-[340px] flex-1 items-center justify-center px-8 py-10">
        <div className="flex w-full max-w-[380px] flex-col gap-5">
          <div>
            <h1 className="tracking-heading text-[22px] font-semibold">
              Sign in to WinterChat
            </h1>
            <p className="text-text-secondary mt-1.5 text-[13px]">
              Sign in with your LINE account to continue.
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
            className="rounded-control bg-primary hover:bg-primary-hover h-12 text-[15px] font-semibold text-white"
          >
            Sign in with LINE
          </button>

          <p className="text-text-secondary text-[13px] leading-[1.6]">
            You will need a join code from an admin after signing in.
          </p>
        </div>
      </div>
    </div>
  );
}
