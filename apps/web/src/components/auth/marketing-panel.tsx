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
    <div className="border-border-default bg-active-row flex min-w-[340px] flex-1 flex-col justify-between gap-8 border-r p-10 max-lg:hidden">
      <BrandMark />

      <div className="flex max-w-[460px] flex-col gap-[26px]">
        <div className="tracking-heading-lg text-[36px] leading-[1.12] font-semibold text-balance">
          Every channel your customers use,{" "}
          <span className="text-accent">one shared inbox</span>.
        </div>

        <div
          aria-hidden
          className="border-border-default bg-surface flex flex-col gap-3 rounded-2xl border p-4 shadow-[0_18px_40px_-20px_rgba(37,99,235,0.45)]"
        >
          <div className="border-border-subtle flex items-center gap-2.5 border-b pb-3">
            <div className="bg-primary flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-medium text-white">
              PS
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">Ploy Sirichai</div>
              <div className="text-text-muted text-[11px]">Open</div>
            </div>
            <span className="rounded-chip bg-line flex h-5 w-5 items-center justify-center text-[7px] font-bold text-white">
              LINE
            </span>
          </div>

          {SAMPLE_THREAD.map((message) => (
            <div
              key={message.text}
              className={
                message.from === "us"
                  ? "bg-primary max-w-[82%] self-end rounded-[14px_14px_4px_14px] px-[13px] py-[9px] text-[13px] leading-[1.5] text-white"
                  : "bg-border-subtle max-w-[82%] self-start rounded-[4px_14px_14px_14px] px-[13px] py-[9px] text-[13px] leading-[1.5]"
              }
            >
              {message.text}
            </div>
          ))}

          <div className="border-border-subtle flex items-center gap-2 border-t pt-2.5">
            <div className="rounded-control border-border-default bg-bg text-text-muted flex h-[30px] flex-1 items-center border px-2.5 text-[12px]">
              Reply on LINE…
            </div>
            <div className="rounded-control bg-accent flex h-[30px] w-[30px] items-center justify-center text-[13px] text-white">
              ↑
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-text-secondary text-[12px]">Channels</div>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_CHIPS.map((chip) => (
              <span
                key={chip.label}
                className={
                  chip.live
                    ? "rounded-pill border-border-default bg-surface text-text-primary flex items-center gap-[7px] border px-[11px] py-[5px] text-[12px] font-medium"
                    : "rounded-pill bg-surface text-text-secondary flex items-center gap-[7px] border border-dashed border-[#cbd5e1] px-[11px] py-[5px] text-[12px]"
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
      <div className="text-text-secondary text-[12px]">
        Access-code only · no public sign-ups
      </div>
    </div>
  );
}
