import type { ReactNode } from "react";

interface SidebarProps {
  children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="w-full max-w-sm shrink-0 rounded-lg border border-border bg-surface p-6 shadow-sm sm:w-80">
      {children}
    </aside>
  );
}
