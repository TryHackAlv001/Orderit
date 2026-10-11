import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  children: ReactNode;
}

export function Modal({ title, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
