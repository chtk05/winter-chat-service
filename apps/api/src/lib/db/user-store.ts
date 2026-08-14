import type { MemberStore } from "@/lib/services/auth-service";

/**
 * The Prisma-backed `MemberStore` (D-044, D-046, D-050).
 *
 * Written against a narrow structural delegate rather than `PrismaClient` itself, so the
 * use case's tests never need a database and this adapter stays the only place that knows
 * Prisma's call shape (AGENTS.md: `lib/db/**` owns Prisma).
 */
export interface UserDelegate {
  findUnique(args: {
    where: { lineUserId: string };
    select: { member: true };
  }): Promise<{ member: boolean } | null>;

  upsert(args: {
    where: { lineUserId: string };
    create: { lineUserId: string; member: boolean; joinedAt: Date };
    update: { member: boolean; joinedAt?: Date };
  }): Promise<unknown>;
}

export function createPrismaMemberStore(
  users: UserDelegate,
  now: () => Date,
): MemberStore {
  return {
    async grantMembership(lineUserId: string) {
      // Read first, purely to report whether this call was the one that granted
      // membership. The write below is unconditional, so the read cannot cause a lost
      // update: two concurrent joins both end at `member: true`, which is the only state
      // that matters. `alreadyMember` is observational, and a race would at worst report
      // a first join twice — never grant or withhold membership incorrectly.
      const existing = await users.findUnique({
        where: { lineUserId },
        select: { member: true },
      });

      const alreadyMember = existing?.member === true;
      const joinedAt = now();

      // D-050: upsert on the LINE user id, so a first join creates the `User` row and a
      // repeat join is idempotent by construction rather than by a read-then-write race.
      await users.upsert({
        where: { lineUserId },
        create: { lineUserId, member: true, joinedAt },
        // `joinedAt` is omitted for an existing member so a repeat join does not
        // overwrite when they actually joined. Prisma treats an absent key as "leave it".
        update: alreadyMember ? { member: true } : { member: true, joinedAt },
      });

      return { alreadyMember };
    },

    async isMember(lineUserId: string) {
      const existing = await users.findUnique({
        where: { lineUserId },
        select: { member: true },
      });

      // A LINE user id present only in `contacts` has no `users` row (D-044), so this is
      // false for them — which is the correct answer, not a missing case.
      return existing?.member === true;
    },
  };
}
