"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("almond_theme") as Theme | null;
    if (saved && (saved === "light" || saved === "dark" || saved === "system")) {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme(t: Theme) {
      const isDark = t === "dark" || (t === "system" && mediaQuery.matches);
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    applyTheme(theme);
    localStorage.setItem("almond_theme", theme);

    function onMediaChange() {
      if (theme === "system") {
        applyTheme("system");
      }
    }

    mediaQuery.addEventListener("change", onMediaChange);
    return () => mediaQuery.removeEventListener("change", onMediaChange);
  }, [theme, mounted]);

  function cycleTheme() {
    setTheme((curr) => {
      if (curr === "system") return "dark";
      if (curr === "dark") return "light";
      return "system";
    });
  }

  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-lg border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
    );
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs transition-colors cursor-pointer"
      title={`Current theme: ${theme} (click to toggle)`}
      aria-label={`Current theme: ${theme}. Click to switch theme.`}
    >
      {theme === "light" && (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
      {theme === "dark" && (
        <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
      {theme === "system" && (
        <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      )}
    </button>
  );
}
