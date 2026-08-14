import { createHmac } from "node:crypto";

import { isWebhookSignatureValid } from "@/lib/line/signature";

const SECRET = "line-channel-secret";
const BODY = JSON.stringify({ destination: "U123", events: [] });

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

describe("isWebhookSignatureValid — D-012", () => {
  it("accepts a correctly signed body", () => {
    expect(isWebhookSignatureValid(BODY, sign(BODY), SECRET)).toBe(true);
  });

  it("accepts a body containing non-ASCII text", () => {
    // Thai text is the expected case for this product, and a utf8/latin1 mix-up in the
    // HMAC would pass every ASCII test and fail in production.
    const thai = JSON.stringify({ events: [{ text: "สวัสดีครับ" }] });

    expect(isWebhookSignatureValid(thai, sign(thai), SECRET)).toBe(true);
  });

  it("accepts an empty body signed correctly", () => {
    expect(isWebhookSignatureValid("", sign(""), SECRET)).toBe(true);
  });
});

describe("isWebhookSignatureValid — negative cases required by D-012", () => {
  it("rejects a missing signature header", () => {
    expect(isWebhookSignatureValid(BODY, null, SECRET)).toBe(false);
  });

  it("rejects an empty signature header", () => {
    expect(isWebhookSignatureValid(BODY, "", SECRET)).toBe(false);
  });

  it("rejects a wrong signature", () => {
    expect(
      isWebhookSignatureValid(BODY, sign(BODY, "other-secret"), SECRET),
    ).toBe(false);
  });

  it("rejects a TAMPERED body carrying the original signature", () => {
    const signature = sign(BODY);
    const tampered = JSON.stringify({
      destination: "U123",
      events: [{ injected: true }],
    });

    expect(isWebhookSignatureValid(tampered, signature, SECRET)).toBe(false);
  });

  it("rejects a body altered by a single character", () => {
    const body = '{"events":[{"id":"1"}]}';
    const signature = sign(body);

    expect(
      isWebhookSignatureValid('{"events":[{"id":"2"}]}', signature, SECRET),
    ).toBe(false);
  });

  it.each([
    ["not base64 at all", "!!!!not-base64!!!!"],
    ["too short", "YWJj"],
    ["far too long", "a".repeat(200)],
  ])(
    "rejects a signature that is %s, without throwing",
    (_label, signature) => {
      // `timingSafeEqual` throws on a length mismatch; a throw here would become a 500 and
      // tell an attacker their guess had the wrong shape.
      expect(() =>
        isWebhookSignatureValid(BODY, signature, SECRET),
      ).not.toThrow();
      expect(isWebhookSignatureValid(BODY, signature, SECRET)).toBe(false);
    },
  );

  it("rejects everything when the channel secret is empty", () => {
    // Otherwise a deployment missing the secret would accept a forgeable HMAC.
    expect(isWebhookSignatureValid(BODY, sign(BODY, ""), "")).toBe(false);
  });
});
