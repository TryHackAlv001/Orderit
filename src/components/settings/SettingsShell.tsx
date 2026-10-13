"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isFloatingBackButtonRoute } from "@/constants";

export function SettingsShell({
  title,
  children,
  backHref = "/settings",
}: {
  title: string;
  children: ReactNode;
  backHref?: string;
}) {
  const pathname = usePathname();
  const hasFloatingBackButton = isFloatingBackButtonRoute(pathname ?? "");

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <header className={`relative flex min-h-14 items-center justify-center border-b border-border bg-bg px-14 ${hasFloatingBackButton ? "" : "pt-[var(--safe-top)]"} ${hasFloatingBackButton ? "md:mt-0" : "md:mt-2"} md:border-0 md:pt-0`}>
        {!hasFloatingBackButton && (
          <Link
            href={backHref}
            aria-label="Back"
            className="absolute left-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
        <h1 className="truncate text-lg font-semibold text-text">{title}</h1>
      </header>
      <div className="pb-[calc(var(--space-4)+var(--safe-bottom))] md:pb-8">{children}</div>
    </div>
  );
}

export function SettingsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-5 p-4" aria-label="Loading settings">
      <div className="h-28 rounded-xl bg-surface-raised" />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="h-14 rounded-lg bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}

export function SettingsLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="m-4 rounded-xl border border-danger bg-danger/10 p-4 text-sm text-danger-text">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-danger px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Try again
      </button>
    </div>
  );
}

export function SignOutDialog({
  onClose,
  onConfirm,
  busy,
}: {
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-out-title"
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl"
      >
        <h2 id="sign-out-title" className="text-lg font-semibold text-text">
          Sign out of Tradeloft?
        </h2>
        <p className="mt-2 text-sm text-muted">You can sign in again at any time.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-lg bg-danger px-4 text-sm font-semibold text-accent-on hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>
    </div>
  );
}
