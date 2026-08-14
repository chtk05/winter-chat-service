"use client";

import { useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Suspense } from "react";

import { LoginScreen, type AuthGate } from "@/components/auth/login-screen";

function goToInbox() {
  window.location.assign("/inbox");
}

function LoginFlow() {
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();

  const signInError = searchParams.get("error")
    ? "LINE sign-in did not complete. Please try again."
    : null;

  if (status === "loading") {
    return (
      <div className="bg-surface flex flex-1 items-center justify-center">
        <p className="text-text-secondary text-[15px]">Loading…</p>
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
        await update({});
        goToInbox();
      }}
      onAlreadyMember={goToInbox}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFlow />
    </Suspense>
  );
}
