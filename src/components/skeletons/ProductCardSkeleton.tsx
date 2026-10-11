interface ProductCardSkeletonProps {
  variant?: "default" | "home";
}

export function ProductCardSkeleton({ variant = "default" }: ProductCardSkeletonProps) {
  return (
    <article className="min-w-0" aria-hidden="true">
      <div className={`aspect-square animate-pulse ${variant === "home" ? "rounded-md" : "rounded-lg"} bg-surface-raised`}></div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-4/5 animate-pulse rounded bg-surface-raised"></div>
        <div className="flex items-center justify-between">
          <div className="h-5 w-2/5 animate-pulse rounded bg-surface-raised"></div>
          <div className="h-9 w-9 animate-pulse rounded-full bg-surface-raised"></div>
        </div>
        {variant !== "home" && <div className="h-3 w-1/3 animate-pulse rounded bg-surface-raised"></div>}
      </div>
    </article>
  );
}