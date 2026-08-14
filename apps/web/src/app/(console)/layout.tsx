"use client";

import { useRouter } from "next/navigation";

import { TopBar } from "@/components/shell/top-bar";
import { logout } from "@/lib/api/client";

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
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      // D-008: logout clears the cookie. Route to login either way — a failed
      // clear must not strand the admin inside the console.
      router.push("/login");
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <TopBar onSignOut={handleSignOut} />
      {children}
    </div>
  );
}
