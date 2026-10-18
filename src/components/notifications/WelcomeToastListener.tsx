"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

const WELCOME_TOAST_ID = "welcome-back";
const WELCOME_TOAST_EVENT = "tradeloft:welcome-back";
const WELCOME_SESSION_KEY = "tradeloft:welcome-back-until";
const WELCOME_DEDUPE_MS = 30_000;

type WelcomeToastEvent = CustomEvent<unknown>;

function getFirstName(value: unknown) {
  if (typeof value !== "string") return null;

  const cleanedName = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim();
  const firstName = cleanedName.split(/\s+/)[0];
  if (!firstName) return null;

  return firstName.length > 30
    ? `${firstName.slice(0, 29).trimEnd()}…`
    : firstName;
}

export function requestWelcomeToast(fullName: unknown) {
  window.dispatchEvent(
    new CustomEvent(WELCOME_TOAST_EVENT, { detail: fullName }),
  );
}

export function WelcomeToastListener() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const hasHandledRequest = useRef(false);
  const [pendingName, setPendingName] = useState<unknown>(null);
  const [hasPendingWelcome, setHasPendingWelcome] = useState(false);

  useEffect(() => {
    const handleWelcomeRequest = (event: Event) => {
      if (hasHandledRequest.current) return;

      let isDuplicate = false;
      try {
        const expiresAt = Number(sessionStorage.getItem(WELCOME_SESSION_KEY));
        isDuplicate = Number.isFinite(expiresAt) && expiresAt > Date.now();
        if (!isDuplicate) {
          sessionStorage.setItem(
            WELCOME_SESSION_KEY,
            String(Date.now() + WELCOME_DEDUPE_MS),
          );
        }
      } catch (error) {
        console.error("Unable to access the welcome toast session flag:", error);
      }

      if (isDuplicate) return;

      hasHandledRequest.current = true;
      setPendingName((event as WelcomeToastEvent).detail);
      setHasPendingWelcome(true);
    };

    const { data: authSubscription } = createClient().auth.onAuthStateChange(
      (event) => {
        if (event !== "SIGNED_OUT") return;

        hasHandledRequest.current = false;
        setHasPendingWelcome(false);
        setPendingName(null);
        toast.dismiss(WELCOME_TOAST_ID);
        try {
          sessionStorage.removeItem(WELCOME_SESSION_KEY);
        } catch (error) {
          console.error("Unable to clear the welcome toast session flag:", error);
        }
      },
    );

    window.addEventListener(WELCOME_TOAST_EVENT, handleWelcomeRequest);
    return () => {
      window.removeEventListener(WELCOME_TOAST_EVENT, handleWelcomeRequest);
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      toast.dismiss(WELCOME_TOAST_ID);
    }

    if (!hasPendingWelcome || pathname === "/login") return;

    const firstName = getFirstName(pendingName);
    const message = firstName
      ? `Welcome back, ${firstName}`
      : "Welcome back to Tradeloft";

    toast.custom(
      () => (
        <div
          className="flex items-center gap-4 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text shadow-soft"
        >
          <span>{message}</span>
          <button
            type="button"
            aria-label="Dismiss welcome message"
            onClick={() => toast.dismiss(WELCOME_TOAST_ID)}
            className="rounded px-1 text-lg leading-none text-muted hover:text-text"
          >
            ×
          </button>
        </div>
      ),
      {
        id: WELCOME_TOAST_ID,
        duration: 3000,
        ariaProps: { role: "status", "aria-live": "polite" },
      },
    );

    setHasPendingWelcome(false);
    setPendingName(null);
  }, [hasPendingWelcome, pathname, pendingName]);

  return null;
}
