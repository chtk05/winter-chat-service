import NextAuth from "next-auth";
import LINE from "next-auth/providers/line";

import { fetchMembership } from "@/lib/auth/membership";

declare module "next-auth" {
  interface Session {
    lineUserId: string | null;
    member: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    lineUserId?: string;
    member?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [LINE],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, account, profile, trigger }) {
      if (account && profile) {
        const subject: unknown = profile.sub;
        token.lineUserId = typeof subject === "string" ? subject : undefined;
        token.member = false;
      }

      if (trigger === "update" && token.lineUserId) {
        const member = await fetchMembership(token.lineUserId);

        if (member !== null) {
          token.member = member;
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.lineUserId = token.lineUserId ?? null;
      session.member = token.member === true;
      return session;
    },
  },
});
