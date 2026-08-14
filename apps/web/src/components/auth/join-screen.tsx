"use client";

import { useState } from "react";

import { AccessErrorCard } from "./access-error-card";
import { MarketingPanel } from "./marketing-panel";
import { StepIndicator } from "./step-indicator";
import { toastManager } from "@/components/ui/toast";
import { ApiError, joinWorkspace } from "@/lib/api/client";

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
  signedInAs: string | null;
  onJoined: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<ErrorState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = code.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await joinWorkspace(trimmed);
      await onJoined();
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
    <div className="bg-bg flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
      <MarketingPanel />

      <div className="flex min-w-[340px] flex-1 items-center justify-center px-6">
        <form
          onSubmit={handleSubmit}
          className="border-border-default bg-surface flex w-full max-w-[400px] flex-col gap-2 rounded-[14px] border p-3.5 shadow-[0_12px_40px_-16px_rgba(9,9,11,0.16)]"
        >
          <StepIndicator step={2} />

          <div>
            <h1 className="tracking-heading text-[24px] font-semibold">
              Enter your invite code
            </h1>
            <p className="text-text-secondary mt-1.5 text-[15px]">
              This links your LINE account to the WinterChat workspace.
            </p>
          </div>

          <div className="rounded-control border-border-default bg-bg flex items-center justify-between gap-3 border px-3 py-1">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="bg-line flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
              >
                LINE
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">
                  {signedInAs ?? "your LINE account"}
                </p>
                <p className="text-text-secondary text-[14px]">
                  Signed in with LINE
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-control border-border-default bg-surface hover:bg-border-subtle flex-none border px-3 py-1.5 text-[15px] font-medium"
            >
              Change
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="access-code" className="text-[15px] font-medium">
              Invite code
            </label>
            <input
              id="access-code"
              name="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="rounded-control border-border-default bg-surface focus:border-primary h-10 border px-4 font-mono text-[18px] tracking-[0.08em] uppercase outline-none focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-control bg-primary hover:bg-primary-hover h-10 text-[17px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Checking…" : "Join workspace"}
          </button>

          <p className="text-text-secondary text-[15px] leading-[1.6]">
            No invite code?{" "}
            <button
              type="button"
              onClick={() =>
                toastManager.add({
                  title: "No invite code yet?",
                  description: "Please fill in this code: CDj798",
                  timeout: 8000,
                })
              }
              className="text-primary font-medium hover:underline"
            >
              Ask an admin
            </button>{" "}
            to add your LINE account to the workspace.
          </p>
        </form>
      </div>
    </div>
  );
}
