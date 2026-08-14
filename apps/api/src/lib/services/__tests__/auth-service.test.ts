import {
  joinWorkspace,
  type JoinDependencies,
  type MemberStore,
} from "@/lib/services/auth-service";

const ACCESS_CODE = "CORRECT-JOIN-CODE";
const LINE_USER_ID = "U8f2c000000000000000000000000004471";

function createStore(alreadyMember = false): MemberStore & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    async grantMembership(lineUserId: string) {
      calls.push(lineUserId);
      return { alreadyMember };
    },
    async isMember() {
      return alreadyMember;
    },
  };
}

function dependencies(store: MemberStore): JoinDependencies {
  return { config: { accessCode: ACCESS_CODE }, store };
}

describe("joinWorkspace — positive cases (D-036, D-038)", () => {
  it("grants membership for the correct code", async () => {
    const store = createStore();

    await expect(
      joinWorkspace(
        { code: ACCESS_CODE, lineUserId: LINE_USER_ID },
        dependencies(store),
      ),
    ).resolves.toEqual({ outcome: "joined", alreadyMember: false });

    expect(store.calls).toEqual([LINE_USER_ID]);
  });

  it("trims the submitted code before comparing", async () => {
    const store = createStore();

    await expect(
      joinWorkspace(
        { code: `  ${ACCESS_CODE}  `, lineUserId: LINE_USER_ID },
        dependencies(store),
      ),
    ).resolves.toMatchObject({ outcome: "joined" });
  });

  it("is idempotent — a second join by the same user still succeeds", async () => {
    const store = createStore(true);

    await expect(
      joinWorkspace(
        { code: ACCESS_CODE, lineUserId: LINE_USER_ID },
        dependencies(store),
      ),
    ).resolves.toEqual({ outcome: "joined", alreadyMember: true });
  });

  it("grants membership to the subject from the token, never one from the body", async () => {
    const store = createStore();

    await joinWorkspace(
      // A body-supplied id must not be honoured: it would let any authenticated caller
      // grant membership to someone else's LINE account.
      {
        code: ACCESS_CODE,
        lineUserId: LINE_USER_ID,
        ...({ sub: "Uattacker" } as object),
      },
      dependencies(store),
    );

    expect(store.calls).toEqual([LINE_USER_ID]);
  });
});

describe("joinWorkspace — negative cases required by T-004", () => {
  it("rejects a wrong code without touching the store", async () => {
    const store = createStore();

    await expect(
      joinWorkspace(
        { code: "WRONG-CODE", lineUserId: LINE_USER_ID },
        dependencies(store),
      ),
    ).resolves.toEqual({ outcome: "rejected" });

    expect(store.calls).toEqual([]);
  });

  it("treats an empty code as an invalid request, not a rejection", async () => {
    // 400, not 401 — the distinction openapi.yaml draws for the code check.
    const store = createStore();

    await expect(
      joinWorkspace(
        { code: "", lineUserId: LINE_USER_ID },
        dependencies(store),
      ),
    ).resolves.toEqual({ outcome: "invalid-request" });

    expect(store.calls).toEqual([]);
  });

  it("treats a whitespace-only code as an invalid request", async () => {
    const store = createStore();

    await expect(
      joinWorkspace(
        { code: "   ", lineUserId: LINE_USER_ID },
        dependencies(store),
      ),
    ).resolves.toEqual({ outcome: "invalid-request" });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 12345],
    ["a boolean", true],
    ["an object", { code: "CORRECT-JOIN-CODE" }],
    ["an array", ["CORRECT-JOIN-CODE"]],
  ])("treats a code that is %s as an invalid request", async (_label, code) => {
    const store = createStore();

    await expect(
      joinWorkspace({ code, lineUserId: LINE_USER_ID }, dependencies(store)),
    ).resolves.toEqual({ outcome: "invalid-request" });

    expect(store.calls).toEqual([]);
  });

  it("rejects a code longer than the contract's 128 characters", async () => {
    const store = createStore();

    await expect(
      joinWorkspace(
        { code: "a".repeat(129), lineUserId: LINE_USER_ID },
        dependencies(store),
      ),
    ).resolves.toEqual({ outcome: "invalid-request" });
  });

  it("never succeeds when the configured code is empty", async () => {
    // Otherwise a server missing ACCESS_CODE would admit everyone. config.ts refuses to
    // boot in that state, but this use case must not depend on its caller for that.
    const store = createStore();

    await expect(
      joinWorkspace(
        { code: "anything", lineUserId: LINE_USER_ID },
        { config: { accessCode: "" }, store },
      ),
    ).resolves.toEqual({ outcome: "rejected" });
  });
});
