"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { BrandMark } from "./brand-mark";
import { ChannelIndicator } from "./channel-indicator";
import { GlobalSearch } from "./global-search";

const TABS = [
  { href: "/inbox", label: "Inbox" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

/**
 * The inline Inbox/Dashboard nav below `lg` is redundant with `BottomTabBar`
 * (mounted alongside this in the console layout, visible only below `lg`) —
 * hidden here rather than duplicated. `ChannelIndicator` and the "admin
 * console" chip are decorative and hidden below `lg` purely to leave room;
 * nothing they show is unavailable, they just do not fit a phone-width bar
 * next to the brand mark, search, and sign-out.
 */
export function TopBar({ onSignOut }: { onSignOut?: () => void }) {
  const pathname = usePathname();

  return (
    <header className="border-border-default bg-surface flex h-14 flex-none items-center justify-between gap-6 border-b px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <BrandMark />
        <div className="rounded-chip border-border-default text-text-secondary border px-1.5 py-0.5 font-mono text-[13px] whitespace-nowrap max-lg:hidden">
          admin console
        </div>
      </div>

      <nav
        aria-label="Console sections"
        className="rounded-control bg-border-subtle flex flex-none items-center gap-1 p-1 max-lg:hidden"
      >
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href) ?? false;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-chip px-3.5 py-1.5 text-[15px] font-medium whitespace-nowrap no-underline",
                active
                  ? "bg-surface text-text-primary shadow-[0_1px_2px_rgba(9,9,11,0.08)]"
                  : "text-text-secondary bg-transparent",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-none items-center gap-3">
        <div className="max-lg:hidden">
          <ChannelIndicator />
        </div>
        <GlobalSearch />
        <button
          type="button"
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="border-border-default bg-border-subtle hover:bg-border-default flex h-7 w-7 items-center justify-center rounded-full border text-[#475569]"
        >
          <LogOut aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
