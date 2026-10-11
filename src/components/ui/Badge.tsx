import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "success" | "warning" | "danger";
  className?: string;
}

const badgeVariants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  primary: "bg-accent/10 text-text",
  secondary: "bg-surface-raised text-muted",
  success: "bg-success/10 text-text",
  warning: "bg-warning/10 text-text",
  danger: "bg-danger/10 text-danger-text",
};

export function Badge({
  children,
  variant = "primary",
  className = "",
}: BadgeProps) {
  return (
    <span className={`inline-flex rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}
