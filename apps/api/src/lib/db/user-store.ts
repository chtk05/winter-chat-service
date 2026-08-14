import type { MemberStore } from "@/lib/services/auth-service";

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
      const existing = await users.findUnique({
        where: { lineUserId },
        select: { member: true },
      });

      const alreadyMember = existing?.member === true;
      const joinedAt = now();

      await users.upsert({
        where: { lineUserId },
        create: { lineUserId, member: true, joinedAt },
        update: alreadyMember ? { member: true } : { member: true, joinedAt },
      });

      return { alreadyMember };
    },

    async isMember(lineUserId: string) {
      const existing = await users.findUnique({
        where: { lineUserId },
        select: { member: true },
      });

      return existing?.member === true;
    },
  };
}
