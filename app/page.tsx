"use client";

// AlmondEye DB — Deck Builder, Parent Deck Builder & Skill Activation Visualizer.
// Three-tab shell with presets, global track & style controls, and smart recommendations.

import { useState } from "react";
import { DeckProvider } from "../components/store";
import DeckPicker from "../components/deck-picker";
import SkillList from "../components/skill-list";
import ParentDeckPicker from "../components/parent-deck-picker";
import RecommendedShelf from "../components/recommended-shelf";
import ParentSkillList from "../components/parent-skill-list";
import TrackView from "../components/track-view";
import GlobalTrackBar from "../components/global-track-bar";
import PresetManager from "../components/preset-manager";

type Tab = "main" | "parent" | "visualizer";

const TABS: { id: Tab; label: string; badge?: string }[] = [
  { id: "main", label: "Main Deck" },
  { id: "parent", label: "Parent Deck", badge: "Farm" },
  { id: "visualizer", label: "Visualizer" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("main");

  return (
    <DeckProvider>
      <div className="flex min-h-[100dvh] flex-col bg-[#f5f2ec] text-zinc-900">
        <header className="border-b border-zinc-200/70 bg-[#f5f2ec]">
          <div className="mx-auto max-w-5xl px-6 pt-6 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#794016]">
                  AlmondEye DB
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
                  Deck Builder + Skill Zones
                </h1>
              </div>

              {/* Preset Switcher & Management */}
              <PresetManager />
            </div>

            {/* Global Style & Track Bar */}
            <div className="mt-4">
              <GlobalTrackBar />
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="mx-auto flex max-w-5xl gap-1 px-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  tab === t.id
                    ? "border-zinc-200 bg-white text-zinc-900 shadow-2xs font-semibold"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <span>{t.label}</span>
                {t.badge && (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                      tab === t.id ? "bg-amber-100 text-amber-800" : "bg-zinc-200/70 text-zinc-500"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl px-6 py-8">
          {tab === "main" ? (
            <div className="flex flex-col gap-8">
              <DeckPicker />
              <SkillList />
            </div>
          ) : tab === "parent" ? (
            <div className="flex flex-col gap-8">
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
