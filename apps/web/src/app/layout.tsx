import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthSessionProvider } from "@/components/auth/session-provider";

import "./globals.css";

// D-015: Geist 400/500/600 and Geist Mono 400/500.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "WinterChat — admin console",
  description: "Read and reply to messages sent to the LINE Official Account.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* T-026: D-036's three states are read from here by every consumer. */}
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
