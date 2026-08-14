"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";

import { ChannelSelector } from "./channel-selector";
import { toastManager } from "@/components/ui/toast";
import { ALLOWED_IMAGE_MIME_TYPES } from "@/lib/api/image";

export function Composer({
  contactName,
  onSend,
  onSendImage,
  disabled = false,
}: {
  contactName: string;
  onSend: (text: string, options: { closeAfterSend: boolean }) => void;
  onSendImage?: (file: File) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !disabled;

  const submit = (closeAfterSend: boolean) => {
    if (!canSend) return;
    onSend(trimmed, { closeAfterSend });
    setDraft("");
  };

  const handleFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onSendImage) return;

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
      toastManager.add({
        title: "That file isn't an image",
        description: "Choose a JPEG, PNG, GIF, or WebP image.",
        type: "error",
        timeout: 8000,
      });
      return;
    }

    onSendImage(file);
  };

  return (
    <div className="border-border-default bg-surface flex flex-none flex-col gap-2.5 border-t px-6 pt-3 pb-3.5">
      <ChannelSelector />

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          data-testid="image-file-input"
          accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
          onChange={handleFileChosen}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
        />
        {onSendImage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Attach an image"
            aria-label="Attach an image"
            className="rounded-control border-border-default bg-surface text-text-secondary hover:bg-border-subtle hover:text-text-primary flex h-[38px] w-[38px] flex-none items-center justify-center border disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(false);
            }
          }}
          placeholder={`Reply to ${contactName} on LINE…`}
          aria-label="Reply message"
          className="rounded-control border-border-default bg-surface focus:border-text-muted h-[38px] min-w-[200px] flex-1 basis-60 border px-3.5 text-[14px] outline-none focus:shadow-[0_0_0_3px_rgba(9,9,11,0.06)]"
        />

        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={!canSend}
            className="rounded-control border-border-default bg-surface text-text-primary hover:bg-border-subtle h-[38px] flex-none border px-3.5 text-[13px] font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send &amp; close
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={!canSend}
            className="rounded-control bg-primary hover:bg-primary-hover h-[38px] flex-none px-4 text-[13px] font-medium whitespace-nowrap text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send reply
          </button>
        </div>
      </div>
    </div>
  );
}
