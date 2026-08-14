"use client";

import { signOut } from "next-auth/react";

import { BottomTabBar } from "@/components/shell/bottom-tab-bar";
import { TopBar } from "@/components/shell/top-bar";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const handleSignOut = () => void signOut({ redirectTo: "/login" });

  return (
    <div className="flex h-screen flex-col">
      <TopBar onSignOut={handleSignOut} />
      {children}
      <BottomTabBar />
    </div>
  );
}
