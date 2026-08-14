"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Suspense } from "react";

import { LoginScreen, type AuthGate } from "@/components/auth/login-screen";

/**
 * T-005: wires D-036's two gates to Auth.js. The components take callbacks as props, so
 * this file is the only place that touches `next-auth/react`.
 *
 * D-054: after a successful join, `update()` is called with NO PAYLOAD. The `jwt` callback
 * re-derives membership from `apps/api` — passing `{ member: true }` here would be
 * client-supplied data that the callback is required to ignore anyway.
 */
function LoginFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();

  // Auth.js reports a cancelled or failed LINE round trip on the query string.
  const signInError = searchParams.get("error")
    ? "LINE sign-in did not complete. Please try again."
    : null;

  if (status === "loading") {
    return (
      <div className="bg-surface flex flex-1 items-center justify-center">
        <p className="text-text-secondary text-[13px]">Loading…</p>
      </div>
    );
  }

  const gate: AuthGate = !session
    ? { status: "anonymous" }
    : session.member
      ? { status: "member" }
      : { status: "authenticated", displayName: session.user?.name ?? null };

  return (
    <LoginScreen
      gate={gate}
      signInError={signInError}
      onSignIn={() => void signIn("line")}
      onSignOut={() => void signOut({ redirectTo: "/login" })}
      onJoined={async () => {
        await update();
        router.push("/inbox");
      }}
      onAlreadyMember={() => router.replace("/inbox")}
    />
  );
}

export default function LoginPage() {
  // `useSearchParams` requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <LoginFlow />
    </Suspense>
  );
}
