import { BrandMark } from "@/components/shell/brand-mark";

/**
 * The design's left-hand sign-in panel (#eef2ff), adopted verbatim as visual
 * treatment per D-017.
 *
 * The sample thread inside it is illustrative chrome, not product data — it is
 * the design's own marketing artwork. It carries no real contact and reaches no
 * API. The one edit against the design: its subtitle read "Open · assigned to
 * Aom", and D-019 removed assignment, so the assignment clause is dropped.
 */

const SAMPLE_THREAD = [
  { from: "them", text: "Hi — is the walnut desk lamp back in stock?" },
  { from: "us", text: "It lands on the 12th — want me to hold one for you?" },
  { from: "them", text: "Yes please, one in walnut 🙏" },
] as const;

const CHANNEL_CHIPS = [
  { label: "LINE · live", live: true },
  { label: "Facebook · soon", live: false },
  { label: "WhatsApp · soon", live: false },
  { label: "Web widget · soon", live: false },
] as const;

export function MarketingPanel() {
  return (
    <div className="flex min-w-[340px] flex-1 flex-col justify-between gap-8 border-r border-border-default bg-active-row p-10 max-lg:hidden">
      <BrandMark />

      <div className="flex max-w-[460px] flex-col gap-[26px]">
        <div className="text-balance text-[36px] font-semibold leading-[1.12] tracking-heading-lg">
          Every channel your customers use,{" "}
          <span className="text-accent">one shared inbox</span>.
        </div>

        <div
          aria-hidden
          className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface p-4 shadow-[0_18px_40px_-20px_rgba(37,99,235,0.45)]"
        >
          <div className="flex items-center gap-2.5 border-b border-border-subtle pb-3">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-primary text-[11px] font-medium text-white">
              PS
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">Ploy Sirichai</div>
              <div className="text-[11px] text-text-muted">Open</div>
            </div>
            <span className="flex h-5 w-5 items-center justify-center rounded-chip bg-line text-[7px] font-bold text-white">
              LINE
            </span>
          </div>

          {SAMPLE_THREAD.map((message) => (
            <div
              key={message.text}
              className={
                message.from === "us"
                  ? "max-w-[82%] self-end rounded-[14px_14px_4px_14px] bg-primary px-[13px] py-[9px] text-[13px] leading-[1.5] text-white"
                  : "max-w-[82%] self-start rounded-[4px_14px_14px_14px] bg-border-subtle px-[13px] py-[9px] text-[13px] leading-[1.5]"
              }
            >
              {message.text}
            </div>
          ))}

          <div className="flex items-center gap-2 border-t border-border-subtle pt-2.5">
            <div className="flex h-[30px] flex-1 items-center rounded-control border border-border-default bg-bg px-2.5 text-[12px] text-text-muted">
              Reply on LINE…
            </div>
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-control bg-accent text-[13px] text-white">
              ↑
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-[12px] text-text-secondary">Channels</div>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_CHIPS.map((chip) => (
              <span
                key={chip.label}
                className={
                  chip.live
                    ? "flex items-center gap-[7px] rounded-pill border border-border-default bg-surface px-[11px] py-[5px] text-[12px] font-medium text-text-primary"
                    : "flex items-center gap-[7px] rounded-pill border border-dashed border-[#cbd5e1] bg-surface px-[11px] py-[5px] text-[12px] text-text-secondary"
                }
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    chip.live ? "bg-line" : "bg-[#cbd5e1]"
                  }`}
                />
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/*
        The design reads "Invite-only · no public sign-ups". D-017 removes the
        invite-code model; D-002 keeps the "no public sign-ups" half true.
      */}
      <div className="text-[12px] text-text-secondary">
        Access-code only · no public sign-ups
      </div>
    </div>
  );
}
