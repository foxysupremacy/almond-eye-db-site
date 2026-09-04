"use client";

// AlmondEye DB - Deck Builder, Parent Deck Builder & Skill Activation Visualizer.
// Three-tab shell with presets, global track & style controls, and smart recommendations.

import { useEffect, useState } from "react";
import { DeckProvider } from "../components/store";
import DeckPicker from "../components/deck-picker";
import SkillList from "../components/skill-list";
import ParentDeckPicker from "../components/parent-deck-picker";
import RecommendedShelf from "../components/recommended-shelf";
import ParentSkillList from "../components/parent-skill-list";
import TrackView from "../components/track-view";
import GlobalTrackBar from "../components/global-track-bar";
import PresetManager from "../components/preset-manager";
import ThemeToggle from "../components/theme-toggle";

type Tab = "main" | "parent" | "visualizer";

const TABS: { id: Tab; label: string; badge?: string }[] = [
  { id: "main", label: "Main Deck" },
  { id: "parent", label: "Parent Deck", badge: "Farm" },
  { id: "visualizer", label: "Visualizer" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("main");
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("almond_header_collapsed");
      if (saved === "true") setIsHeaderCollapsed(true);
    } catch {}
  }, []);

  const toggleHeaderCollapse = () => {
    setIsHeaderCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("almond_header_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  return (
    <DeckProvider>
      <div className="flex min-h-[100dvh] flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <header className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md sticky top-0 z-40 transition-colors">
          {/* Collapsible Header Upper Content (Title, Presets, Theme, Track Bar) */}
          {!isHeaderCollapsed && (
            <div className="mx-auto max-w-5xl px-3 sm:px-6 pt-4 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    AlmondEye DB
                  </p>
                  <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Deck Builder + Skill Zones
                  </h1>
                </div>

                {/* Preset Switcher, Management & Theme Toggle */}
                <div className="flex items-center gap-2">
                  <PresetManager />
                  <ThemeToggle />
                </div>
              </div>

              {/* Global Style & Track Bar */}
              <div className="mt-3">
                <GlobalTrackBar />
              </div>
            </div>
          )}

          {/* Navigation Bar: Tabs + Collapse/Expand Toggle */}
          <div className={`mx-auto flex max-w-5xl items-end justify-between px-3 sm:px-6 ${isHeaderCollapsed ? "pt-1.5" : ""}`}>
            <nav className="flex gap-1 overflow-x-auto scrollbar-none" aria-label="Tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-t-xl border border-b-0 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0 ${
                    tab === t.id
                      ? "border-zinc-200/90 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                      : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  <span>{t.label}</span>
                  {t.badge && (
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                        tab === t.id
                          ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                          : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Collapse / Expand Header Controls Button */}
            <div className="mb-1.5 shrink-0 pl-2">
              <button
                type="button"
                onClick={toggleHeaderCollapse}
                className="flex items-center gap-1 rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-2xs cursor-pointer transition-all active:scale-[0.98]"
                title={isHeaderCollapsed ? "Expand header controls (Track, Presets, Settings)" : "Collapse header controls"}
                aria-label={isHeaderCollapsed ? "Expand header" : "Collapse header"}
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${isHeaderCollapsed ? "" : "rotate-180"}`}
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
                <span className="hidden sm:inline text-[11px]">
                  {isHeaderCollapsed ? "Expand" : "Collapse"}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-3 sm:px-6 py-6 sm:py-8 flex-1">
          {tab === "main" ? (
            <div className="flex flex-col gap-6 sm:gap-8">
              <DeckPicker />
              <SkillList />
            </div>
          ) : tab === "parent" ? (
            <div className="flex flex-col gap-6 sm:gap-8">
              <ParentDeckPicker />
              <RecommendedShelf />
              <ParentSkillList />
            </div>
          ) : (
            <TrackView />
          )}
        </main>
      </div>
    </DeckProvider>
  );
}
