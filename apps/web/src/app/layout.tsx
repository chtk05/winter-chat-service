import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { AuthSessionProvider } from "@/components/auth/session-provider";
import { Toaster } from "@/components/ui/toast";

import "./globals.css";

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
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
