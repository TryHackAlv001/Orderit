export function CategoryCardSkeleton() {
  return (
    <article className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 animate-pulse rounded-full bg-surface-raised"></div>
        <div className="space-y-2">
          <div className="h-5 w-24 animate-pulse rounded bg-surface-raised"></div>
          <div className="h-4 w-20 animate-pulse rounded bg-surface-raised"></div>
        </div>
      </div>
    </article>
  );
}