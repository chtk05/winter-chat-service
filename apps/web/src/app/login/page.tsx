"use client";

import { useRouter } from "next/navigation";

import { LoginScreen } from "@/components/auth/login-screen";

/** D-017: a correct code goes straight to the inbox — no "Signed in" interstitial. */
export default function LoginPage() {
  const router = useRouter();
  return <LoginScreen onAuthenticated={() => router.push("/inbox")} />;
}
