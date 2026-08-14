import {
  corsHeaders,
  preflightHeaders,
  resolveAllowedOrigin,
} from "@/lib/http/cors";

const ALLOWED = ["https://console.example.com", "http://localhost:3000"];

describe("resolveAllowedOrigin — D-029", () => {
  it("echoes an allow-listed origin exactly", () => {
    expect(resolveAllowedOrigin("http://localhost:3000", ALLOWED)).toBe(
      "http://localhost:3000",
    );
  });

  it.each([
    ["an origin not on the list", "https://evil.example.com"],
    ["a scheme mismatch", "http://console.example.com"],
    ["a port mismatch", "http://localhost:3001"],
    ["a subdomain of an allowed host", "https://a.console.example.com"],
    [
      "a suffix attack on an allowed host",
      "https://console.example.com.evil.io",
    ],
    ["a prefix of an allowed origin", "https://console.example.co"],
    ["a trailing slash", "http://localhost:3000/"],
  ])("refuses %s", (_label, origin) => {
    expect(resolveAllowedOrigin(origin, ALLOWED)).toBeNull();
  });

  it("refuses a missing Origin header", () => {
    expect(resolveAllowedOrigin(null, ALLOWED)).toBeNull();
  });

  it("refuses everything when the allow-list is empty", () => {
    expect(resolveAllowedOrigin("http://localhost:3000", [])).toBeNull();
  });
});

describe("corsHeaders", () => {
  it("returns credentialed headers for an allowed origin", () => {
    expect(corsHeaders("http://localhost:3000", ALLOWED)).toEqual({
      "Access-Control-Allow-Origin": "http://localhost:3000",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    });
  });

  it("never emits a wildcard origin", () => {
    // `*` is invalid alongside Access-Control-Allow-Credentials, and would expose the
    // session to any site on the internet.
    const headers = corsHeaders("http://localhost:3000", ALLOWED);

    expect(headers["Access-Control-Allow-Origin"]).not.toBe("*");
  });

  it("emits no allow-origin for a disallowed origin, but still varies on Origin", () => {
    expect(corsHeaders("https://evil.example.com", ALLOWED)).toEqual({
      Vary: "Origin",
    });
  });

  it("never grants credentials without also naming an origin", () => {
    const headers = corsHeaders("https://evil.example.com", ALLOWED);

    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });
});

describe("preflightHeaders", () => {
  it("adds the methods, headers and max-age for an allowed origin", () => {
    expect(preflightHeaders("http://localhost:3000", ALLOWED)).toEqual({
      "Access-Control-Allow-Origin": "http://localhost:3000",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    });
  });

  it("allows the Content-Type the web client actually sends", () => {
    // client.ts sets Content-Type: application/json on every request with a body, which
    // is what makes the preflight necessary in the first place.
    const headers = preflightHeaders("http://localhost:3000", ALLOWED);

    expect(headers["Access-Control-Allow-Headers"]).toContain("Content-Type");
  });

  it("grants nothing beyond Vary for a disallowed origin", () => {
    expect(preflightHeaders("https://evil.example.com", ALLOWED)).toEqual({
      Vary: "Origin",
    });
  });
});
