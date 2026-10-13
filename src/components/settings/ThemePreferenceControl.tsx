"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import toast from "react-hot-toast";

type Theme = "light" | "dark" | "system";

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function ThemePreferenceControl() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let savedTheme: Theme = "system";
    try {
      const saved = window.localStorage.getItem("tradeloft-theme");
      if (saved === "light" || saved === "dark" || saved === "system") savedTheme = saved;
    } catch (error) {
      console.error("Unable to load theme preference:", error);
    }
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => {
      document.documentElement.dataset.theme = mediaQuery.matches ? "dark" : "light";
    };
    applySystemTheme();
    mediaQuery.addEventListener("change", applySystemTheme);
    return () => mediaQuery.removeEventListener("change", applySystemTheme);
  }, [theme]);

  const selectTheme = (nextTheme: Theme) => {
    try {
      window.localStorage.setItem("tradeloft-theme", nextTheme);
    } catch (error) {
      console.error("Unable to save theme preference:", error);
      toast.error("Your theme preference could not be saved.");
      return;
    }
    document.documentElement.dataset.theme = nextTheme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : nextTheme;
    setTheme(nextTheme);
  };

  return (
    <section className="border-b-[6px] border-bg bg-surface py-2" aria-labelledby="settings-theme-title">
      <h2 id="settings-theme-title" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Theme
      </h2>
      <div className="flex min-h-14 items-center justify-center gap-4 border-b border-border px-4">
        <div className="flex gap-2" role="group" aria-label="Theme preference">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              disabled={theme === null}
              onClick={() => selectTheme(value)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                theme === value
                  ? "border-accent-text bg-accent/10 font-semibold text-accent-text"
                  : "border-border text-text hover:bg-surface-raised"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
