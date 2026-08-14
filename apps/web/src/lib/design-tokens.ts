export const designTokens = {
  font: {
    sans: "Geist",
    mono: "Geist Mono",
    sansWeights: [400, 500, 600],
    monoWeights: [400, 500],
  },

  color: {
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
  },

  status: {
    Open: { bg: "#dcfce7", fg: "#15803d" },
    Pending: { bg: "#fef3c7", fg: "#854d0e" },
    Closed: { bg: "#fee2e2", fg: "#b91c1c" },
  },

  radius: {
    chip: "6px",
    control: "8px",
    card: "12px",
    pill: "999px",
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

export function statusStyle(status: ConversationStatusToken) {
  return designTokens.status[status];
}
