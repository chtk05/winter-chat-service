import NextAuth from "next-auth";
import LINE from "next-auth/providers/line";

import { fetchMembership } from "@/lib/auth/membership";

/**
 * T-026: Auth.js v5 configuration (D-037, D-043 — `next-auth@5.0.0-beta.32`, pinned).
 *
 * D-039: NextAuth lives HERE, in `apps/web`. `apps/api` is a stateless resource server
 * that sets no cookies and knows nothing about Auth.js.
 * D-035: the identity provider is LINE Login — a DIFFERENT channel from the Messaging API
 * channel, with its own credentials. `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN`
 * belong to the Messaging API channel and must not be reused here.
 *
 * Environment variables are the ones the installed package actually reads, checked in
 * `@auth/core/lib/utils/env.js` rather than assumed (D-033): `AUTH_SECRET`, and
 * `AUTH_LINE_ID` / `AUTH_LINE_SECRET` inferred from the provider id `line`.
 *
 * D-042 leaves the default `basePath` of `/api/auth` untouched; the proxy lives at
 * `/gateway/*` and never sits beside it.
 */

/** D-036's three states, carried in the token. D-045: no role — membership is the whole of it. */
declare module "next-auth" {
  interface Session {
    lineUserId: string | null;
    member: boolean;
  }
}

// Augmented on `@auth/core/jwt`, which is where the `JWT` interface is actually declared.
// `next-auth/jwt` re-exports it but is not resolvable as an augmentation target under this
// app's module resolution — verified by the compiler, not assumed.
declare module "@auth/core/jwt" {
  interface JWT {
    lineUserId?: string;
    member?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [LINE],

  // D-039/D-041: the session is a JWT this app holds. `apps/api` never sees it.
  session: { strategy: "jwt" },

  pages: {
    // T-005's two-gate entry point. Auth.js's own sign-in page is not used.
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, account, profile, trigger }) {
      if (account && profile) {
        // First sign-in. LINE's OIDC `sub` is the LINE user id (D-035, D-050).
        const subject: unknown = profile.sub;
        token.lineUserId = typeof subject === "string" ? subject : undefined;
        // D-036: authenticated is NOT member. A newly authenticated user has not passed
        // the join gate, and starts false every time.
        token.member = false;
      }

      if (trigger === "update" && token.lineUserId) {
        // D-054: re-derive from apps/api. The update PAYLOAD IS DELIBERATELY IGNORED —
        // `trigger: "update"` fires for a browser calling `useSession().update()`, so
        // trusting it would let any LINE user grant themselves membership.
        const member = await fetchMembership(token.lineUserId);

        // Fail closed: a failed read leaves membership where it was rather than granting it.
        if (member !== null) {
          token.member = member;
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.lineUserId = token.lineUserId ?? null;
      // Defaults to false, never true. A token missing the claim is not a member.
      session.member = token.member === true;
      return session;
    },
  },
});
