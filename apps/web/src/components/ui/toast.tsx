"use client";

import { Toast } from "@base-ui/react/toast";

export const toastManager = Toast.createToastManager();

export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className="pointer-events-none fixed inset-x-0 top-5 z-50 flex flex-col items-center gap-2">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="rounded-control border-border-default bg-surface pointer-events-auto flex w-[320px] items-start gap-2.5 border px-4 py-3 shadow-[0_4px_12px_rgba(9,9,11,0.12)] data-[type=error]:border-[#fecaca] data-[type=error]:bg-[#fee2e2] data-[type=success]:border-[#bbf7d0] data-[type=success]:bg-[#dcfce7]"
    >
      <div className="min-w-0 flex-1">
        {toast.title && (
          <Toast.Title className="text-[13px] font-semibold text-[#0f172a] data-[type=error]:text-[#b91c1c] data-[type=success]:text-[#15803d]" />
        )}
        {toast.description && (
          <Toast.Description className="text-text-secondary mt-0.5 text-[12px]" />
        )}
      </div>
      <Toast.Close
        aria-label="Dismiss"
        className="text-text-muted hover:text-text-secondary flex-none text-[13px] leading-none"
      >
        ✕
      </Toast.Close>
    </Toast.Root>
  ));
}
