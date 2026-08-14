export function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5">
        <div aria-hidden className="bg-primary h-1 flex-1 rounded-full" />
        <div
          aria-hidden
          className={`h-1 flex-1 rounded-full ${
            step === 2 ? "bg-primary" : "bg-border-default"
          }`}
        />
      </div>
      <p className="text-text-muted font-mono text-[13px] tracking-[0.08em] uppercase">
        Step {step} of 2
      </p>
    </div>
  );
}
