"use client";

import { signOut } from "next-auth/react";

import { TopBar } from "@/components/shell/top-bar";

/**
 * F-004 application shell. The design's `startScreen` prop and `authTabs`
 * switcher are prototype affordances (D-015) — real routing replaces them, so
 * Inbox and Dashboard are routes and the segmented control is navigation.
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // D-039: NextAuth owns sign-out now. `apps/api` sets no cookies, so there is nothing
  // there to clear — the old `POST /auth/logout` call was removed with the route.
  const handleSignOut = () => void signOut({ redirectTo: "/login" });

  return (
    <div className="flex h-screen flex-col">
      <TopBar onSignOut={handleSignOut} />
      {children}
    </div>
  );
}
