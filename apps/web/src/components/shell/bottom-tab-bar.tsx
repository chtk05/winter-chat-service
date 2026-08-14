"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard } from "lucide-react";

const TABS = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

/**
 * Replaces `TopBar`'s inline Inbox/Dashboard nav below `lg` — a phone-width
 * screen has no room for a segmented control alongside the brand mark, search,
 * and sign-out, and a persistent bottom bar is the platform-native pattern for
 * primary navigation this narrow. `TopBar` hides its own tabs at the same
 * breakpoint rather than showing both.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Console sections"
      className="border-border-default bg-surface flex h-14 flex-none items-stretch border-t lg:hidden"
    >
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href) ?? false;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[13px] font-medium no-underline",
              active ? "text-primary" : "text-text-secondary",
            ].join(" ")}
          >
            <Icon aria-hidden className="h-5 w-5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
