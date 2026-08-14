import { designTokens } from "@/lib/design-tokens";
import type { ConversationStatus } from "@/lib/api/types";

/** The design's status pill, coloured from the D-015 table. D-019 fixes the three values. */
export function StatusPill({
  status,
  size = "sm",
}: {
  status: ConversationStatus;
  size?: "sm" | "md";
}) {
  const { bg, fg } = designTokens.status[status];

  return (
    <span
      style={{ background: bg, color: fg }}
      className={
        size === "sm"
          ? "rounded-pill px-[7px] py-px text-[10px] font-medium"
          : "rounded-pill px-2.5 py-[3px] text-[11px] font-medium"
      }
    >
      {status}
    </span>
  );
}
