import {
  createPrismaMemberStore,
  type UserDelegate,
} from "@/lib/db/user-store";

const LINE_USER_ID = "U8f2c000000000000000000000000004471";
const NOW = new Date("2026-08-13T09:00:00.000Z");

interface RecordedUpsert {
  where: { lineUserId: string };
  create: { lineUserId: string; member: boolean; joinedAt: Date };
  update: { member: boolean; joinedAt?: Date };
}

function createDelegate(existing: { member: boolean } | null): UserDelegate & {
  upserts: RecordedUpsert[];
} {
  const upserts: RecordedUpsert[] = [];

  return {
    upserts,
    async findUnique() {
      return existing;
    },
    async upsert(args) {
      upserts.push(args);
      return null;
    },
  };
}

describe("createPrismaMemberStore (D-046, D-050)", () => {
  it("creates the User row on a first join and reports it as new", async () => {
    const delegate = createDelegate(null);
    const store = createPrismaMemberStore(delegate, () => NOW);

    await expect(store.grantMembership(LINE_USER_ID)).resolves.toEqual({
      alreadyMember: false,
    });

    expect(delegate.upserts).toHaveLength(1);
    expect(delegate.upserts[0].create).toEqual({
      lineUserId: LINE_USER_ID,
      member: true,
      joinedAt: NOW,
    });
  });

  it("upserts on the LINE user id, not an internal id (D-050)", async () => {
    const delegate = createDelegate(null);
    await createPrismaMemberStore(delegate, () => NOW).grantMembership(
      LINE_USER_ID,
    );

    expect(delegate.upserts[0].where).toEqual({ lineUserId: LINE_USER_ID });
  });

  it("promotes an existing non-member from false to true (D-046)", async () => {
    const delegate = createDelegate({ member: false });
    const store = createPrismaMemberStore(delegate, () => NOW);

    await expect(store.grantMembership(LINE_USER_ID)).resolves.toEqual({
      alreadyMember: false,
    });

    expect(delegate.upserts[0].update).toEqual({ member: true, joinedAt: NOW });
  });

  it("is idempotent for an existing member, and reports it as already joined", async () => {
    const delegate = createDelegate({ member: true });
    const store = createPrismaMemberStore(delegate, () => NOW);

    await expect(store.grantMembership(LINE_USER_ID)).resolves.toEqual({
      alreadyMember: true,
    });
  });

  it("does not overwrite `joinedAt` when the user is already a member", async () => {
    const delegate = createDelegate({ member: true });
    const later = new Date("2026-09-01T00:00:00.000Z");

    await createPrismaMemberStore(delegate, () => later).grantMembership(
      LINE_USER_ID,
    );

    expect(delegate.upserts[0].update).toEqual({ member: true });
    expect(delegate.upserts[0].update).not.toHaveProperty("joinedAt");
  });

  it("always ends at `member: true`, whichever branch of the upsert runs", async () => {
    for (const existing of [null, { member: false }, { member: true }]) {
      const delegate = createDelegate(existing);
      await createPrismaMemberStore(delegate, () => NOW).grantMembership(
        LINE_USER_ID,
      );

      expect(delegate.upserts[0].create.member).toBe(true);
      expect(delegate.upserts[0].update.member).toBe(true);
    }
  });
});
