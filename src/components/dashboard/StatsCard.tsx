import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string;
  icon?: ReactNode;
}

export function StatsCard({ title, value, icon }: StatsCardProps) {
  return (
    <article className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">{title}</p>
        {icon && <div className="text-muted">{icon}</div>}
      </div>
      <p className="font-display text-3xl font-semibold text-text">{value}</p>
    </article>
  );
}
