/**
 * D-015 design tokens.
 *
 * Every value below is transcribed verbatim from the observed-token table in
 * `DECISIONS.md` D-015, which was itself read from the Claude design project
 * `c04b9cb8-39f8-45e9-b0bd-18e5878fbb20` → `Web Chat LINE Relay.dc.html`.
 *
 * This module is the single source of truth for `globals.css`. If a value here
 * and a value there disagree, this file wins and the CSS is wrong.
 *
 * Nothing may be added to this object that is not in the D-015 table (§3.2).
 * The design file uses Tailwind's own slate scale for intermediate shades
 * (#475569 = slate-600, #cbd5e1 = slate-300), so those need no token here —
 * they are reached through Tailwind's built-in palette.
 */

export const designTokens = {
  font: {
    sans: "Geist",
    mono: "Geist Mono",
    sansWeights: [400, 500, 600],
    monoWeights: [400, 500],
  },

  color: {
    /** Page background. */
    bg: "#f8fafc",
    /** Card / panel surface. */
    surface: "#ffffff",

    textPrimary: "#0f172a",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",

    border: "#e2e8f0",
    borderSubtle: "#f1f5f9",

    primary: "#2563eb",
    primaryHover: "#1d4ed8",

    /** Unread dot, active-row accent, today's bar. */
    accent: "#db2777",

    /** Selected conversation row, and the sign-in marketing panel. */
    activeRow: "#eef2ff",

    /** LINE brand green — badges and the connected-channel dot. */
    line: "#06c755",
  },

  status: {
    Open: { bg: "#dcfce7", fg: "#15803d" },
    Pending: { bg: "#fef3c7", fg: "#854d0e" },
    Closed: { bg: "#fee2e2", fg: "#b91c1c" },
  },

  radius: {
    /** Channel tags and small chips. */
    chip: "6px",
    /** Inputs, selects, buttons. */
    control: "8px",
    /** Cards. */
    card: "12px",
    /** Filter pills and toggles. */
    pill: "999px",
    /** Message bubbles: 16px, with a 4px tail corner. */
    bubble: "16px",
    bubbleTail: "4px",
  },

  letterSpacing: {
    body: "-0.01em",
    heading: "-0.02em",
    headingLarge: "-0.03em",
  },
} as const;

export type ConversationStatusToken = keyof typeof designTokens.status;

/** Status pill colours for a conversation status (D-019 enum). */
export function statusStyle(status: ConversationStatusToken) {
  return designTokens.status[status];
}
