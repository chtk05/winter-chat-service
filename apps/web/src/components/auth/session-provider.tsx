"use client";

import { SessionProvider } from "next-auth/react";

/**
 * T-026: `useSession` needs this in the tree. It is a client component in its own file so
 * the root layout stays a server component — wrapping the layout itself in `"use client"`
 * would opt the whole app out of server rendering.
 */
export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
