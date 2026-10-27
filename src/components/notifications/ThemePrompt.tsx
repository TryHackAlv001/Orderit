"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Monitor, Moon, Sun, X } from "lucide-react";
import toast, { useToasterStore } from "react-hot-toast";

type Theme = "light" | "dark" | "system";

const THEME_KEY = "tradeloft-theme";
const PROMPT_FLAG_KEY = "tradeloft-theme-prompt-dismissed";
const PROMPT_ID = "theme-switch-prompt";
const PROMPT_DELAY_MS = 1_000;
const PROMPT_DURATION_MS = 11_000;
const FADE_DURATION_MS = 180;

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readSavedTheme(): Theme | null {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(THEME_KEY);
  } catch (error) {
    console.error("Unable to read the saved theme:", error);
  }
  if (isTheme(saved)) return saved;

  try {
    saved = window.sessionStorage.getItem(THEME_KEY);
  } catch (error) {
    console.error("Unable to read the session theme:", error);
  }
  return isTheme(saved) ? saved : null;
}

function hasPromptFlag(): boolean {
  try {
    const value = window.localStorage.getItem(PROMPT_FLAG_KEY);
    if (value && Number.isFinite(Number(value)) && Number(value) > 0) return true;
  } catch (error) {
    console.error("Unable to read the theme prompt flag:", error);
  }

  try {
    const value = window.sessionStorage.getItem(PROMPT_FLAG_KEY);
    if (value && Number.isFinite(Number(value)) && Number(value) > 0) return true;
  } catch (error) {
    console.error("Unable to read the session theme prompt flag:", error);
  }
  return false;
}

function savePromptFlag() {
  const timestamp = String(Date.now());
  try {
    window.localStorage.setItem(PROMPT_FLAG_KEY, timestamp);
    return;
  } catch (error) {
    console.error("Unable to save the theme prompt flag:", error);
  }

  try {
    window.sessionStorage.setItem(PROMPT_FLAG_KEY, timestamp);
  } catch (error) {
    console.error("Unable to save the session theme prompt flag:", error);
  }
}

function saveTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
    return;
  } catch (error) {
    console.error("Unable to save the theme:", error);
  }

  try {
    window.sessionStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error("Unable to save the session theme:", error);
  }
}

function isPromptExcludedRoute(pathname: string) {
  return [
    "/checkout",
    "/settings",
    "/buyer/settings",
    "/vendor/settings",
    "/login",
    "/register",
    "/sign-in",
    "/signin",
    "/sign-up",
    "/signup",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function ThemePromptCard({ onDismiss }: { onDismiss: () => void }) {
  const { toasts } = useToasterStore();
  const hasOtherToast = toasts.some((item) => item.visible && item.id !== PROMPT_ID);
  const [theme, setTheme] = useState<Theme>("light");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const accumulatedMs = useRef(0);
  const elapsedRef = useRef(0);
  const runningSince = useRef<number | null>(null);
  const paused = isHovered || isFocused;
  const remainingSeconds = Math.max(
    0,
    Math.ceil((PROMPT_DURATION_MS - elapsedMs) / 1_000),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setPrefersReducedMotion(mediaQuery.matches);
    updateReducedMotion();
    mediaQuery.addEventListener("change", updateReducedMotion);
    return () => mediaQuery.removeEventListener("change", updateReducedMotion);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => {
      if (theme === "system") {
        document.documentElement.dataset.theme = mediaQuery.matches ? "dark" : "light";
      }
    };
    applySystemTheme();
    mediaQuery.addEventListener("change", applySystemTheme);
    return () => mediaQuery.removeEventListener("change", applySystemTheme);
  }, [theme]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onDismiss]);

  useEffect(() => {
    if (elapsedMs < PROMPT_DURATION_MS || isFading) return;
    if (prefersReducedMotion) {
      onDismiss();
      return;
    }
    setIsFading(true);
    const timeout = window.setTimeout(onDismiss, FADE_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [elapsedMs, isFading, onDismiss, prefersReducedMotion]);

  useEffect(() => {
    if (paused || elapsedRef.current >= PROMPT_DURATION_MS) {
      if (runningSince.current !== null) {
        accumulatedMs.current += Date.now() - runningSince.current;
        runningSince.current = null;
        elapsedRef.current = Math.min(PROMPT_DURATION_MS, accumulatedMs.current);
        setElapsedMs(elapsedRef.current);
      }
      return;
    }

    if (runningSince.current === null) runningSince.current = Date.now();
    let interval = 0;
    let timeout = 0;
    const updateElapsed = () => {
      const runningMs = Date.now() - (runningSince.current ?? Date.now());
      const elapsed = Math.min(PROMPT_DURATION_MS, accumulatedMs.current + runningMs);
      elapsedRef.current = elapsed;
      setElapsedMs(elapsed);
      if (elapsed >= PROMPT_DURATION_MS) {
        accumulatedMs.current = PROMPT_DURATION_MS;
        runningSince.current = null;
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      }
    };
    interval = window.setInterval(updateElapsed, 50);
    timeout = window.setTimeout(
      updateElapsed,
      Math.max(0, PROMPT_DURATION_MS - accumulatedMs.current),
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [paused]);

  const dismiss = () => {
    onDismiss();
  };

  const chooseTheme = (nextTheme: Theme) => {
    saveTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : nextTheme;
    setTheme(nextTheme);
    dismiss();
  };

  const progressScale = prefersReducedMotion
    ? 1
    : Math.max(0, 1 - elapsedMs / PROMPT_DURATION_MS);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        const target = event.relatedTarget;
        if (!(target instanceof Node) || !event.currentTarget.contains(target)) {
          setIsFocused(false);
        }
      }}
      className={`w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl border border-border bg-surface-raised text-text shadow-soft transition-opacity duration-[180ms] ${
        hasOtherToast ? "invisible pointer-events-none" : ""
      } ${isFading ? "opacity-0" : "opacity-100"} motion-reduce:transition-none`}
      style={{
        marginTop: "calc(var(--mobile-header-height) + var(--mobile-announcement-height))",
      }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Switch theme?</p>
          <p aria-hidden="true" className="mt-1 text-xs text-muted">
            Closing in {remainingSeconds}s
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss theme prompt"
          onClick={dismiss}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2 px-4 pb-3" role="group" aria-label="Choose a theme">
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => chooseTheme(value)}
            className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              theme === value
                ? "border-accent-text bg-accent/10 text-accent-text"
                : "border-border text-text hover:bg-surface"
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>
      <div aria-hidden="true" className="h-1 bg-border/40">
        <div
          className="h-full origin-left bg-accent"
          style={{
            transform: `scaleX(${progressScale})`,
            transition: prefersReducedMotion ? "none" : "transform 50ms linear",
          }}
        />
      </div>
    </div>
  );
}

export function ThemePrompt() {
  const pathname = usePathname();
  const { toasts } = useToasterStore();
  const hasOtherToast = toasts.some((item) => item.visible && item.id !== PROMPT_ID);
  const didInitialize = useRef(false);
  const initialPath = useRef<string | null>(null);
  const delayTimeout = useRef<number | null>(null);
  const didShow = useRef(false);
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    if (!pathname) return;

    if (!didInitialize.current) {
      didInitialize.current = true;
      initialPath.current = pathname;
    } else if (initialPath.current !== pathname) {
      initialPath.current = pathname;
      if (delayTimeout.current !== null) window.clearTimeout(delayTimeout.current);
      if (didShow.current) savePromptFlag();
      toast.remove(PROMPT_ID);
      setIsEligible(false);
      return;
    }

    if (initialPath.current !== pathname || isPromptExcludedRoute(pathname)) return;
    if (delayTimeout.current === null && !didShow.current) {
      delayTimeout.current = window.setTimeout(() => {
        delayTimeout.current = null;
        if (!readSavedTheme() && !hasPromptFlag()) setIsEligible(true);
      }, PROMPT_DELAY_MS);
      return () => {
        if (delayTimeout.current !== null) {
          window.clearTimeout(delayTimeout.current);
          delayTimeout.current = null;
        }
      };
    }
  }, [pathname]);

  useEffect(() => {
    if (!isEligible || hasOtherToast || didShow.current) return;

    toast.custom(() => <ThemePromptCard onDismiss={() => {
      savePromptFlag();
      toast.remove(PROMPT_ID);
      setIsEligible(false);
    }} />, {
      id: PROMPT_ID,
      duration: Infinity,
      ariaProps: { role: "status", "aria-live": "off" },
    });
    didShow.current = true;
  }, [hasOtherToast, isEligible]);

  return null;
}
