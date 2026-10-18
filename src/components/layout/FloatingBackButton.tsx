"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getFloatingBackFallback, isFloatingBackButtonRoute } from "@/constants";

function RouteHistoryTracker({ onRouteChange }: { onRouteChange: (routeKey: string) => void }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;

  useEffect(() => onRouteChange(routeKey), [onRouteChange, routeKey]);
  return null;
}

function hasUnsavedFormChanges() {
  if (document.querySelector('[data-unsaved-form="true"]')) return true;

  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "form input, form textarea, form select",
  );

  return Array.from(fields).some((field) => {
    if (
      field.disabled ||
      ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && field.readOnly)
    ) return false;
    if (field instanceof HTMLInputElement) {
      if (["button", "submit", "reset", "hidden"].includes(field.type)) return false;
      if (field.type === "checkbox" || field.type === "radio") {
        return field.checked !== field.defaultChecked;
      }
    }
    if (field instanceof HTMLSelectElement) {
      return Array.from(field.options).some((option) => option.selected !== option.defaultSelected);
    }
    return field.value !== field.defaultValue;
  });
}

export function FloatingBackButton() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const routeHistory = useRef<string[]>([]);
  const previousRoute = useRef("");
  const hasInitialRoute = useRef(false);
  const isPopNavigation = useRef(false);
  const restorePopNavigation = useRef(false);
  const allowPopNavigation = useRef(false);
  const pendingBack = useRef<(() => void) | null>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (restorePopNavigation.current) {
        restorePopNavigation.current = false;
        isPopNavigation.current = false;
        return;
      }
      if (allowPopNavigation.current) {
        allowPopNavigation.current = false;
        isPopNavigation.current = true;
        return;
      }
      if (!isFloatingBackButtonRoute(pathname)) {
        isPopNavigation.current = true;
        return;
      }
      if (
        pathname === "/checkout" &&
        document.querySelector('[data-checkout-step="payment-options"]') &&
        !document.querySelector('[data-payment-in-progress="true"]')
      ) {
        event.stopImmediatePropagation();
        restorePopNavigation.current = true;
        window.history.forward();
        window.dispatchEvent(new Event("checkout-back-to-details"));
        return;
      }
      if (hasUnsavedFormChanges() || document.querySelector('[data-payment-in-progress="true"]')) {
        event.stopImmediatePropagation();
        restorePopNavigation.current = true;
        pendingBack.current = () => {
          allowPopNavigation.current = true;
          router.back();
        };
        setConfirmOpen(true);
        window.history.forward();
        return;
      }
      isPopNavigation.current = true;
    };
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, [pathname, router]);

  const trackRoute = useCallback((routeKey: string) => {
    if (!hasInitialRoute.current) {
      hasInitialRoute.current = true;
      previousRoute.current = routeKey;
      routeHistory.current = [routeKey];
      return;
    }
    if (previousRoute.current === routeKey) return;
    if (isPopNavigation.current) {
      isPopNavigation.current = false;
      routeHistory.current.pop();
      if (routeHistory.current[routeHistory.current.length - 1] !== routeKey) {
        routeHistory.current.push(routeKey);
      }
    } else {
      routeHistory.current.push(routeKey);
    }
    previousRoute.current = routeKey;
  }, []);

  useEffect(() => {
    if (!confirmOpen) return;
    stayButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmOpen(false);
        pendingBack.current = null;
      } else if (event.key === "Tab") {
        event.preventDefault();
        const buttons = document.querySelectorAll<HTMLButtonElement>("[data-back-confirm-dialog] button");
        const focusedIndex = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement);
        buttons[(focusedIndex + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen]);

  const navigateBack = () => {
    if (routeHistory.current.length > 1) {
      allowPopNavigation.current = true;
      router.back();
      return;
    }
    router.replace(getFloatingBackFallback(pathname));
  };

  const requestBack = () => {
    const checkoutStep = document.querySelector('[data-checkout-step="payment-options"]');
    const paymentInProgress = document.querySelector('[data-payment-in-progress="true"]');
    if (checkoutStep && !paymentInProgress) {
      window.dispatchEvent(new Event("checkout-back-to-details"));
      return;
    }
    if (paymentInProgress || hasUnsavedFormChanges()) {
      pendingBack.current = navigateBack;
      setConfirmOpen(true);
      return;
    }
    navigateBack();
  };

  const confirmBack = () => {
    setConfirmOpen(false);
    pendingBack.current?.();
    pendingBack.current = null;
  };

  const showButton = isFloatingBackButtonRoute(pathname);

  return (
    <>
      <Suspense fallback={null}>
        <RouteHistoryTracker onRouteChange={trackRoute} />
      </Suspense>
      {showButton && (
        <button
          type="button"
          aria-label="Go back"
          onClick={requestBack}
          className="fixed left-3 z-floating-back inline-flex h-[var(--floating-back-size)] w-[var(--floating-back-size)] items-center justify-center rounded-full border border-border bg-surface text-text shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg md:hidden"
          style={{ top: "calc(var(--space-3) + var(--safe-top))", boxShadow: "var(--shadow-soft)" }}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {showButton && confirmOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmOpen(false);
              pendingBack.current = null;
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-page-title"
            data-back-confirm-dialog
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 text-text shadow-xl"
          >
            <h2 id="leave-page-title" className="text-lg font-semibold">Leave this page?</h2>
            <p className="mt-2 text-sm text-muted">
              Your changes or payment setup may not be saved. Are you sure you want to go back?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                ref={stayButtonRef}
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  pendingBack.current = null;
                }}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmBack}
                className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-on hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Leave
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
