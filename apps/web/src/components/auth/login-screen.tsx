"use client";

import { useState } from "react";

import { AccessErrorCard } from "./access-error-card";
import { MarketingPanel } from "./marketing-panel";
import { ApiError, login } from "@/lib/api/client";

/**
 * F-001 sign-in, in the design's split layout (D-015) with D-017's copy.
 *
 * Changed against the design, all per D-017:
 *  - "Invite code" → "Access code"; "Join workspace" → "Enter workspace"
 *  - no single-use or 7-day-expiry claim about the code (the 7 days in D-008 is
 *    the *session* lifetime)
 *  - no LINE-account linking language anywhere
 *  - no "Signed in" interstitial — a correct code goes straight to the inbox
 *
 * The design's placeholder "WC-2026" and its "Try WC-2026 · anything else shows
 * the error state" hint are prototype fixtures (§3.5) and are not reproduced;
 * printing a real-looking access code in the UI would also be a poor idea on a
 * public repo (D-001).
 */

interface ErrorState {
  code: string;
  message: string;
  reference?: string;
}

export function LoginScreen({
  onAuthenticated,
}: {
  onAuthenticated: () => void;
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
      await login(trimmed);
      onAuthenticated();
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
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-bg px-6 py-10">
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
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-surface max-lg:flex-col">
      <MarketingPanel />

      <div className="flex min-w-[340px] flex-1 items-center justify-center px-8 py-10">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-[380px] flex-col gap-5"
        >
          <div>
            <h1 className="text-[22px] font-semibold tracking-heading">
              Enter the WinterChat workspace
            </h1>
            <p className="mt-1.5 text-[13px] text-text-secondary">
              Enter the workspace access code your admin gave you.
            </p>
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
              className="h-[46px] rounded-control border border-border-default bg-surface px-4 font-mono text-[16px] uppercase tracking-[0.08em] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 rounded-control bg-primary text-[15px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Checking…" : "Enter workspace"}
          </button>

          <p className="text-[13px] leading-[1.6] text-text-secondary">
            No access code? Ask an admin for one.
          </p>
        </form>
      </div>
    </div>
  );
}
