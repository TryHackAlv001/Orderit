interface StorefrontHeaderProps {
  shopName: string;
  location?: string;
}

export function StorefrontHeader({ shopName, location }: StorefrontHeaderProps) {
  return (
    <header className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{shopName}</h1>
        {location ? <p className="text-sm text-muted">Location: {location}</p> : null}
      </div>
    </header>
  );
}
