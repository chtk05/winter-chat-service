"use client";

import { useState } from "react";

import { AccessErrorCard } from "./access-error-card";
import { MarketingPanel } from "./marketing-panel";
import { ApiError, joinWorkspace } from "@/lib/api/client";

/**
 * T-005, gate TWO of D-036's two: the person has proved *who* they are with LINE Login;
 * this decides *whether they are allowed in*.
 *
 * This is the screen that used to be the whole of sign-in under D-002/D-009. D-036 did not
 * delete it — it moved it behind LINE Login. The monospace uppercase field, the error card
 * and the split layout all survive unchanged (D-017's visual guidance).
 *
 * What changed is the copy. D-017 banned LINE-account language because D-002 created no
 * such identity; D-035 does, so "Signed in as … on LINE" is now ACCURATE rather than a
 * fabrication, and the "Signed in" interstitial D-017 dropped has a reason to exist —
 * it is the thing that tells the user gate one succeeded and gate two remains.
 *
 * D-042: the code posts to `/gateway/auth/join`.
 */

interface ErrorState {
  code: string;
  message: string;
  reference?: string;
}

export function JoinScreen({
  signedInAs,
  onJoined,
  onSignOut,
}: {
  /** The LINE display name, or null when the profile carried none. */
  signedInAs: string | null;
  onJoined: () => void;
  onSignOut: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<ErrorState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = code.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Negative case: an empty or whitespace-only code never reaches the network.
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await joinWorkspace(trimmed);
      onJoined();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError({
          code: caught.code,
          message: caught.message,
          reference: caught.ref,
        });
      } else {
        setError({
          code: "NETWORK_ERROR",
          message: "Could not reach the server. Please try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="bg-bg flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
        <AccessErrorCard
          code={error.code}
          message={error.message}
          reference={error.reference}
          onRetry={() => {
            setError(null);
            setCode("");
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-surface flex min-h-0 flex-1 overflow-y-auto max-lg:flex-col">
      <MarketingPanel />

      <div className="flex min-w-[340px] flex-1 items-center justify-center px-8 py-10">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-[380px] flex-col gap-5"
        >
          <div>
            <h1 className="tracking-heading text-[22px] font-semibold">
              Enter the WinterChat workspace
            </h1>
            <p className="text-text-secondary mt-1.5 text-[13px]">
              Enter the workspace access code your admin gave you.
            </p>
          </div>

          {/*
            D-036's interstitial: gate one is done, gate two is not. Accurate under D-035 —
            this really is the LINE account that just authenticated.
          */}
          <div className="rounded-control border-border-default bg-bg flex items-center justify-between gap-3 border px-4 py-3">
            <p className="text-text-secondary text-[13px]">
              Signed in as{" "}
              <span className="text-text-primary font-medium">
                {signedInAs ?? "your LINE account"}
              </span>{" "}
              on LINE
            </p>
            <button
              type="button"
              onClick={onSignOut}
              className="text-primary text-[13px] font-medium hover:underline"
            >
              Not you?
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            <label htmlFor="access-code" className="text-[13px] font-medium">
              Access code
            </label>
            <input
              id="access-code"
              name="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="rounded-control border-border-default bg-surface focus:border-primary h-[46px] border px-4 font-mono text-[16px] tracking-[0.08em] uppercase outline-none focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-control bg-primary hover:bg-primary-hover h-12 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Checking…" : "Enter workspace"}
          </button>

          <p className="text-text-secondary text-[13px] leading-[1.6]">
            No access code? Ask an admin for one.
          </p>
        </form>
      </div>
    </div>
  );
}
