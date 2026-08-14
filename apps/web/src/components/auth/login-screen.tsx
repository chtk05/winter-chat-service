"use client";

import { JoinScreen } from "./join-screen";
import { SignInScreen } from "./sign-in-screen";

/**
 * T-005: D-036's two gates, in sequence.
 *
 * The THREE states this must distinguish (D-036, and the place a security bug would
 * appear): anonymous, authenticated-but-not-joined, and joined. Treating "has a valid
 * session" as "is a member" would admit any LINE user on the platform.
 *
 * Session state arrives as props rather than through `useSession`, so this renders against
 * a double (D-022) and the routing logic is testable without Auth.js in the tree.
 */
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
  onJoined: () => void;
  /** A member who lands here has nothing to do — send them on. */
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
