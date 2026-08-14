"use client";

import { JoinScreen } from "./join-screen";
import { SignInScreen } from "./sign-in-screen";

export type AuthGate =
  | { status: "anonymous" }
  | { status: "authenticated"; displayName: string | null }
  | { status: "member" };

export function LoginScreen({
  gate,
  signInError,
  onSignIn,
  onSignOut,
  onJoined,
  onAlreadyMember,
}: {
  gate: AuthGate;
  signInError?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onJoined: () => Promise<void>;
  onAlreadyMember: () => void;
}) {
  if (gate.status === "member") {
    onAlreadyMember();
    return null;
  }

  if (gate.status === "authenticated") {
    return (
      <JoinScreen
        signedInAs={gate.displayName}
        onJoined={onJoined}
        onSignOut={onSignOut}
      />
    );
  }

  return <SignInScreen onSignIn={onSignIn} error={signInError} />;
}
