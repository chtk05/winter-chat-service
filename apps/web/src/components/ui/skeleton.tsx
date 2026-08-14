export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`bg-border-subtle animate-pulse rounded-md ${className}`}
    />
  );
}
