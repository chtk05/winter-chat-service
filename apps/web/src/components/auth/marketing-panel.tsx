import { BrandMark } from "@/components/shell/brand-mark";

const SAMPLE_THREAD = [
  { from: "them", text: "Hi — is the walnut desk lamp back in stock?" },
  { from: "us", text: "It lands on the 12th — want me to hold one for you?" },
  { from: "them", text: "Yes please, one in walnut 🙏" },
] as const;

export function MarketingPanel() {
  return (
    <div className="border-border-default bg-active-row flex min-w-[340px] flex-1 flex-col border-r p-10 max-lg:hidden">
      <BrandMark />

      <div className="flex flex-1 items-center justify-center">
        <div className="flex max-w-[440px] flex-col gap-8">
          <div className="flex flex-col gap-3">
            <div className="tracking-heading-lg text-[36px] leading-[1.12] font-semibold text-balance">
              Every channel your customers use,{" "}
              <span className="text-accent">one shared inbox</span>.
            </div>
            <p className="text-text-secondary max-w-[38ch] text-[14px] leading-[1.55]">
              See every conversation the moment it comes in, and reply without
              switching apps.
            </p>
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

          <div className="text-text-secondary flex items-center gap-2 text-[12px]">
            <span
              aria-hidden
              className="bg-line h-1.5 w-1.5 flex-none rounded-full"
            />
            <span className="text-text-primary font-medium">Live on LINE</span>
            <span aria-hidden className="text-[#cbd5e1]">
              ·
            </span>
            <span>Facebook, WhatsApp and web chat are coming soon</span>
          </div>
        </div>
      </div>

      <div className="text-text-muted mx-auto max-w-[440px] text-center text-[12px]">
        Access-code only · no public sign-ups
      </div>
    </div>
  );
}
