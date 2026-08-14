import { readFileSync } from "node:fs";
import { join } from "node:path";

import { designTokens, statusStyle } from "@/lib/design-tokens";

/**
 * T-002 verification: "token values match D-015 exactly (unit test asserting the
 * resolved theme object)" and, as the negative case, "theme has no undefined token".
 *
 * The expected values below are re-transcribed from DECISIONS.md D-015 rather than
 * imported, so the test fails if the module drifts from the decision.
 */

const D015_COLORS: Record<string, string> = {
  bg: "#f8fafc",
  surface: "#ffffff",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  borderSubtle: "#f1f5f9",
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  accent: "#db2777",
  activeRow: "#eef2ff",
  line: "#06c755",
};

describe("D-015 design tokens", () => {
  it("matches the D-015 colour table exactly", () => {
    expect(designTokens.color).toEqual(D015_COLORS);
  });

  it("carries no extra colour token beyond the D-015 table", () => {
    expect(Object.keys(designTokens.color).sort()).toEqual(
      Object.keys(D015_COLORS).sort(),
    );
  });

  it("matches the D-015 status palette for all three D-019 statuses", () => {
    expect(designTokens.status).toEqual({
      Open: { bg: "#dcfce7", fg: "#15803d" },
      Pending: { bg: "#fef3c7", fg: "#854d0e" },
      Closed: { bg: "#fee2e2", fg: "#b91c1c" },
    });
  });

  it("matches the D-015 radius scale", () => {
    expect(designTokens.radius).toEqual({
      chip: "6px",
      control: "8px",
      card: "12px",
      pill: "999px",
      bubble: "16px",
      bubbleTail: "4px",
    });
  });

  it("matches the D-015 letter-spacing scale", () => {
    expect(designTokens.letterSpacing).toEqual({
      body: "-0.01em",
      heading: "-0.02em",
      headingLarge: "-0.03em",
    });
  });

  it("uses the Geist families D-015 records", () => {
    expect(designTokens.font.sans).toBe("Geist");
    expect(designTokens.font.mono).toBe("Geist Mono");
    expect(designTokens.font.sansWeights).toEqual([400, 500, 600]);
    expect(designTokens.font.monoWeights).toEqual([400, 500]);
  });

  // Negative case (T-002): no token resolves to undefined, empty, or a stray value.
  it("has no undefined, null, or empty token anywhere in the tree", () => {
    const walk = (node: unknown, path: string): void => {
      if (node === undefined || node === null || node === "") {
        throw new Error(`token ${path} is empty: ${String(node)}`);
      }
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`));
        return;
      }
      if (typeof node === "object") {
        for (const [k, v] of Object.entries(node as object)) {
          walk(v, `${path}.${k}`);
        }
      }
    };

    expect(() => walk(designTokens, "designTokens")).not.toThrow();
  });

  it("expresses every colour as a 6-digit hex value", () => {
    for (const [name, value] of Object.entries(designTokens.color)) {
      expect(`${name}=${value}`).toMatch(/=#[0-9a-f]{6}$/);
    }
  });

  describe("statusStyle", () => {
    it.each(["Open", "Pending", "Closed"] as const)(
      "returns the D-015 pair for %s",
      (status) => {
        expect(statusStyle(status)).toEqual(designTokens.status[status]);
      },
    );
  });
});

describe("globals.css", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  // Rules only — comments discuss what was deliberately left out, so matching
  // against them would assert on prose rather than on the stylesheet.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Every token in the module must actually appear in the stylesheet, so the two
  // cannot silently diverge.
  it.each(Object.entries(D015_COLORS))(
    "declares the %s colour (%s)",
    (_name, value) => {
      expect(css).toContain(value);
    },
  );

  it.each(Object.values(designTokens.status).flatMap((s) => [s.bg, s.fg]))(
    "declares the status colour %s",
    (value) => {
      expect(css).toContain(value);
    },
  );

  // Negative case: the design records no dark palette, so none may be invented.
  it("declares no dark-mode block", () => {
    expect(rules).not.toContain(".dark");
    expect(rules).not.toContain("prefers-color-scheme");
  });

  // Negative case: the stock shadcn oklch tokens must be gone, not layered under.
  it("carries no leftover scaffold oklch tokens", () => {
    expect(rules).not.toContain("oklch(");
  });
});
