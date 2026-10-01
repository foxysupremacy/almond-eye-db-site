"use client";

import { useEffect, useState } from "react";
import { HEADER_ICON_ACTION_CLASS } from "@/app/common/ui/primitives/header-action";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { MonitorIcon, MoonIcon, SunIcon } from "@/app/common/ui/primitives/icons";

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
      <div className={HEADER_ICON_ACTION_CLASS} aria-hidden="true" />
    );
  }

  return (
    <AppButton
      type="button"
      onPress={cycleTheme}
      variant="secondary"
      iconOnly
      className={HEADER_ICON_ACTION_CLASS}
      title={`Current theme: ${theme} (click to toggle)`}
      aria-label={`Current theme: ${theme}. Click to switch theme.`}
    >
      {theme === "light" && <SunIcon />}
      {theme === "dark" && <MoonIcon className="h-4 w-4 text-amber-400" />}
      {theme === "system" && <MonitorIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
    </AppButton>
  );
}
