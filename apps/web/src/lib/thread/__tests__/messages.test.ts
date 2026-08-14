import {
  applyRealtimeChange,
  isMessagePayload,
  markFailed,
  mergeOlderPage,
  optimisticMessage,
  upsertMessage,
  type RealtimeChange,
} from "../messages";
import type { Message } from "@/lib/api/types";

/**
 * T-009 verification: unit tests over **synthetic** change payloads. D-005 puts
 * realtime *delivery* at integration level (phase 3), so nothing here opens a
 * socket or touches Supabase.
 */

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    conversationId: "c1",
    direction: "inbound",
    messageType: "text",
    text: "Hello",
    createdAt: "2026-08-12T09:00:00+07:00",
    ...overrides,
  };
}

function change(
  eventType: RealtimeChange["eventType"],
  payload: unknown,
): RealtimeChange {
  return { eventType, new: payload };
}

describe("optimisticMessage", () => {
  it("builds an outbound text message in `sending`, keyed by clientId", () => {
    const now = new Date("2026-08-12T10:00:00+07:00");
    const optimistic = optimisticMessage({
      conversationId: "c1",
      text: "On the 12th.",
      clientId: "uuid-1",
      now,
    });

    expect(optimistic).toEqual({
      id: "uuid-1",
      conversationId: "c1",
      clientId: "uuid-1",
      direction: "outbound",
      messageType: "text",
      text: "On the 12th.",
      deliveryStatus: "sending",
      createdAt: now.toISOString(),
    });
  });
});

describe("upsertMessage", () => {
  it("appends a new message in timestamp order", () => {
    const older = message({ id: "m1", createdAt: "2026-08-12T09:00:00+07:00" });
    const newer = message({ id: "m2", createdAt: "2026-08-12T09:05:00+07:00" });

    expect(upsertMessage([newer], older).map((m) => m.id)).toEqual([
      "m1",
      "m2",
    ]);
  });

  it("reconciles an optimistic bubble in place, by clientId", () => {
    const optimistic = message({
      id: "uuid-1",
      clientId: "uuid-1",
      direction: "outbound",
      deliveryStatus: "sending",
    });
    const server = message({
      id: "server-1",
      clientId: "uuid-1",
      direction: "outbound",
      deliveryStatus: "sent",
      sentVia: "reply",
    });

    const result = upsertMessage([optimistic], server);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("server-1");
    expect(result[0].deliveryStatus).toBe("sent");
  });

  // Negative case: a duplicate payload does not duplicate a row in state.
  it("does not duplicate when the same id arrives twice", () => {
    const first = message({ id: "m1" });
    const again = message({ id: "m1", text: "Hello (edited)" });

    const result = upsertMessage(upsertMessage([], first), again);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Hello (edited)");
  });

  // Negative case: out-of-order arrival still lands in timestamp order.
  it("orders out-of-order arrivals by createdAt", () => {
    const t1 = message({ id: "m1", createdAt: "2026-08-12T09:00:00+07:00" });
    const t2 = message({ id: "m2", createdAt: "2026-08-12T09:01:00+07:00" });
    const t3 = message({ id: "m3", createdAt: "2026-08-12T09:02:00+07:00" });

    const result = [t3, t1, t2].reduce(
      (acc, next) => upsertMessage(acc, next),
      [] as Message[],
    );

    expect(result.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });
});

describe("mergeOlderPage", () => {
  it("prepends older messages without gaps or reordering", () => {
    const loaded = [
      message({ id: "m3", createdAt: "2026-08-12T09:02:00+07:00" }),
    ];
    const older = [
      message({ id: "m1", createdAt: "2026-08-12T09:00:00+07:00" }),
      message({ id: "m2", createdAt: "2026-08-12T09:01:00+07:00" }),
    ];

    expect(mergeOlderPage(loaded, older).map((m) => m.id)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
  });

  // Negative case: an overlapping page must not duplicate rows.
  it("drops messages already loaded when pages overlap", () => {
    const loaded = [message({ id: "m2" }), message({ id: "m3" })];
    const older = [message({ id: "m1" }), message({ id: "m2" })];

    expect(mergeOlderPage(loaded, older).map((m) => m.id)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
  });

  it("is a no-op for an empty page beyond the end", () => {
    const loaded = [message({ id: "m1" })];
    expect(mergeOlderPage(loaded, [])).toHaveLength(1);
  });
});

describe("markFailed", () => {
  it("fails only the bubble with the matching clientId", () => {
    const a = message({
      id: "uuid-1",
      clientId: "uuid-1",
      direction: "outbound",
    });
    const b = message({
      id: "uuid-2",
      clientId: "uuid-2",
      direction: "outbound",
    });

    const result = markFailed([a, b], "uuid-1", "Not delivered");

    expect(result[0].deliveryStatus).toBe("failed");
    expect(result[0].failureReason).toBe("Not delivered");
    expect(result[1].deliveryStatus).toBeUndefined();
  });

  it("is a no-op when no bubble matches", () => {
    const a = message({ id: "uuid-1", clientId: "uuid-1" });
    expect(markFailed([a], "missing", "x")).toEqual([a]);
  });
});

describe("isMessagePayload", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "message"],
    ["a number", 7],
    ["an empty object", {}],
    [
      "a missing id",
      {
        conversationId: "c1",
        direction: "inbound",
        messageType: "text",
        createdAt: "x",
      },
    ],
    [
      "a bad direction",
      {
        id: "m1",
        conversationId: "c1",
        direction: "sideways",
        messageType: "text",
        createdAt: "x",
      },
    ],
    [
      "a numeric id",
      {
        id: 1,
        conversationId: "c1",
        direction: "inbound",
        messageType: "text",
        createdAt: "x",
      },
    ],
  ])("rejects %s", (_label, value) => {
    expect(isMessagePayload(value)).toBe(false);
  });

  it("accepts a well-formed message", () => {
    expect(isMessagePayload(message())).toBe(true);
  });
});

describe("applyRealtimeChange", () => {
  it("inserts a message for the open conversation", () => {
    const result = applyRealtimeChange([], change("INSERT", message()), "c1");
    expect(result.map((m) => m.id)).toEqual(["m1"]);
  });

  it("applies an update in place", () => {
    const existing = message({
      id: "server-1",
      direction: "outbound",
      deliveryStatus: "sending",
    });
    const update = message({
      id: "server-1",
      direction: "outbound",
      deliveryStatus: "sent",
      sentVia: "reply",
    });

    const result = applyRealtimeChange(
      [existing],
      change("UPDATE", update),
      "c1",
    );

    expect(result).toHaveLength(1);
    expect(result[0].deliveryStatus).toBe("sent");
  });

  // Negative case: duplicate payload does not duplicate a row in state.
  it("ignores a redelivered insert", () => {
    const payload = change("INSERT", message());
    const once = applyRealtimeChange([], payload, "c1");
    const twice = applyRealtimeChange(once, payload, "c1");

    expect(twice).toHaveLength(1);
  });

  // Negative case: payload for a conversation not currently loaded.
  it("ignores a payload for another conversation", () => {
    const result = applyRealtimeChange(
      [],
      change("INSERT", message({ conversationId: "c2" })),
      "c1",
    );
    expect(result).toEqual([]);
  });

  it("ignores every payload when no conversation is open", () => {
    const result = applyRealtimeChange([], change("INSERT", message()), null);
    expect(result).toEqual([]);
  });

  // Negative case: malformed payload is dropped, not crashed on.
  it.each([
    ["null", null],
    ["a string", "oops"],
    ["a partial row", { id: "m1" }],
    ["an array", []],
  ])("drops a malformed payload (%s) without throwing", (_label, payload) => {
    const existing = [message()];
    expect(() =>
      applyRealtimeChange(existing, change("INSERT", payload), "c1"),
    ).not.toThrow();
    expect(applyRealtimeChange(existing, change("INSERT", payload), "c1")).toBe(
      existing,
    );
  });

  it("ignores DELETE events, which the thread does not model", () => {
    const existing = [message()];
    expect(
      applyRealtimeChange(
        existing,
        { eventType: "DELETE", old: message() },
        "c1",
      ),
    ).toBe(existing);
  });

  // Negative case: out-of-order realtime arrival still sorts correctly.
  it("keeps timestamp order when payloads arrive out of order", () => {
    const later = message({ id: "m2", createdAt: "2026-08-12T09:05:00+07:00" });
    const earlier = message({
      id: "m1",
      createdAt: "2026-08-12T09:00:00+07:00",
    });

    let state = applyRealtimeChange([], change("INSERT", later), "c1");
    state = applyRealtimeChange(state, change("INSERT", earlier), "c1");

    expect(state.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});
