"use client";

// AlmondEye DB - Deck Builder, Parent Deck Builder & Skill Activation Visualizer.
// Responsive six-view shell. Library groups the two inventory views on mobile.

import { useEffect, useState } from "react";
import { DeckProvider } from "../components/store";
import DeckPicker from "../components/deck-picker";
import SkillList from "../components/skill-list";
import ParentDeckView from "../components/parent-deck-view";
import TrackView from "../components/track/track-view";
import GlobalTrackBar from "../components/global-track-bar";
import PresetManager from "../components/preset-manager";
import ThemeToggle from "../components/theme-toggle";
import Footer from "../components/footer";
import SharedImportDialog from "../components/shared-import-dialog";
import CollectionView from "../components/collection/collection-view";
import ParentingView from "../components/parenting/parenting-view";
import VeteransView from "../components/veterans-view";
import ImportModal from "../components/import-modal";
import { PvpExpiredModal } from "../components/pvp-expired-modal";
import { SkillInspectorProvider } from "../components/skill-hover-card";
import { MobileSheet } from "../components/shared/mobile-sheet";
import { Badge } from "../components/shared/badge";
import { DeckIcon, LineageIcon, LibraryIcon, TargetIcon, FlagIcon, FilterIcon } from "../components/icons";

type Tab = "main" | "parent-deck" | "parenting" | "visualizer" | "collection" | "veterans";

const TABS: { id: Tab; label: string; badge?: string }[] = [
  { id: "main", label: "Main Deck" },
  { id: "parent-deck", label: "Parent Deck", badge: "Deck & Skills" },
  { id: "parenting", label: "Parenting", badge: "Inheritance" },
  { id: "visualizer", label: "Visualizer" },
  { id: "collection", label: "Collection" },
  { id: "veterans", label: "Trained Umas", badge: "Beta" },
];

const MOBILE_TABS = [
  { id: "main", label: "Deck", icon: DeckIcon },
  { id: "parent-deck", label: "Parents", icon: TargetIcon },
  { id: "parenting", label: "Lineage", icon: LineageIcon },
  { id: "visualizer", label: "Race", icon: FlagIcon },
  { id: "collection", label: "Collection", icon: LibraryIcon },
] as const;

export default function Home() {
  const [tab, setTab] = useState<Tab>("main");
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Tabs are addressable via URL hash (#main, #parent-deck, #parenting,
  // #visualizer, #collection, #veterans) so any view can be linked directly.
  // Unknown hashes (e.g. #share=...) are ignored so share links still work.
  useEffect(() => {
    try {
      if (localStorage.getItem("almond_header_collapsed") === "true") setIsHeaderCollapsed(true);
    } catch {}
    function applyHash() {
      const id = window.location.hash.replace(/^#/, "").split("=")[0];
      if (TABS.some((t) => t.id === id)) setTab(id as Tab);
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (window.matchMedia("(max-width: 767px)").matches) window.scrollTo({ top: 0, behavior: "instant" });
    try {
      history.replaceState(null, "", next === "main" ? window.location.pathname : `#${next}`);
    } catch {}
  };

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
      <SkillInspectorProvider>
      <div className="app-shell flex min-h-[100dvh] min-w-0 flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[400] focus:rounded-lg focus:bg-emerald-700 focus:p-3 focus:text-white">Skip to content</a>
        <header className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="flex h-14 items-center justify-between gap-3 px-4 lg:hidden">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">AlmondEye DB</p>
              <h1 className="truncate text-base font-semibold">{tab === "collection" || tab === "veterans" ? "Your library" : TABS.find((item) => item.id === tab)?.label}</h1>
            </div>
            <button type="button" aria-label="Build settings" aria-haspopup="dialog" onClick={() => setToolsOpen(true)} className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"><FilterIcon className="h-5 w-5" />Build</button>
          </div>
          {/* Collapsible Header Upper Content (Title, Presets, Theme, Track Bar) */}
        <div className={`mx-auto max-w-5xl px-3 pb-2 md:px-6 md:pt-4 md:pb-3 ${isHeaderCollapsed ? "lg:hidden" : ""}`}>
          <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    AlmondEye DB
                  </p>
                  <p className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Deck Builder + Skill Zones
                  </p>
                </div>

                {/* Preset Switcher, Management, Sync & Theme Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-2xs cursor-pointer transition-colors"
                    title="Sync or Import Kyumaru Game Data"
                  >
                    <span>📥</span>
                    <span className="hidden sm:inline">Sync Data</span>
                  </button>
                  <PresetManager />
                  <ThemeToggle />
                </div>
              </div>

              {/* Global Style & Track Bar */}
              <div className="md:mt-3">
                <GlobalTrackBar />
              </div>
            </div>

          {/* Navigation Bar: Tabs + Collapse/Expand Toggle */}
          <div className={`mx-auto hidden max-w-5xl items-end justify-between px-3 lg:flex sm:px-6 ${isHeaderCollapsed ? "pt-1.5" : ""}`}>
            <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Tabs">
              {TABS.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  aria-current={tab === t.id ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTabChange(t.id);
                  }}
                  className={`flex items-center gap-1.5 rounded-t-xl border border-b-0 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0 ${
                    tab === t.id
                      ? "border-zinc-200/90 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                      : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  <span>{t.label}</span>
                  {t.badge && (
                    <Badge
                      size="compact"
                      uppercase
                      tone={tab === t.id ? "emerald" : "neutral"}
                      className={tab === t.id ? "" : "opacity-70"}
                    >
                      {t.badge}
                    </Badge>
                  )}
                </a>
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
                  className={`h-3.5 w-3.5 transition-transform duration-200 ease-in-out-cubic ${isHeaderCollapsed ? "" : "rotate-180"}`}
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

        <main id="main-content" className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-3 py-5 sm:px-6 sm:py-8">
          {(tab === "collection" || tab === "veterans") && <nav aria-label="Collection" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-200/60 p-1 dark:bg-zinc-800 lg:hidden">
            {([['collection', 'Collection'], ['veterans', 'Trained Umas']] as const).map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => handleTabChange(id)} className={`min-h-11 rounded-lg text-sm font-medium ${tab === id ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>{label}</button>)}
          </nav>}
          {tab === "main" ? (
            <div className="flex flex-col gap-6 sm:gap-8">
              <DeckPicker />
              <SkillList />
            </div>
          ) : tab === "parent-deck" ? (
            <ParentDeckView onNavigateToParenting={() => handleTabChange("parenting")} />
          ) : tab === "parenting" ? (
            <ParentingView onNavigateToParentDeck={() => handleTabChange("parent-deck")} />
          ) : tab === "visualizer" ? (
            <TrackView />
          ) : tab === "collection" ? (
            <CollectionView />
          ) : (
            <VeteransView />
          )}
        </main>

        {/* Page Footer */}
        <Footer />

        <nav aria-label="Mobile navigation" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-200 bg-white/95 px-2 pt-1 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden">
          {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id || (id === "collection" && tab === "veterans");
            return <a key={id} href={`#${id}`} aria-current={active ? "page" : undefined} onClick={(event) => { event.preventDefault(); handleTabChange(id === "collection" && tab === "veterans" ? "veterans" : id); }} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors ${active ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}><span className={`grid h-7 w-11 place-items-center rounded-lg ${active ? "bg-emerald-100 dark:bg-emerald-950" : ""}`}><Icon className="h-5 w-5" /></span>{label}</a>;
          })}
        </nav>

        <MobileSheet open={toolsOpen} onClose={() => setToolsOpen(false)} title="Your build" description="Switch builds, share your deck, or import your collection.">
          <div className="mobile-build-tools space-y-5">
            <PresetManager />
            <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <button type="button" onClick={() => { setToolsOpen(false); setIsImportModalOpen(true); }} className="min-h-11 rounded-xl border border-zinc-200 px-4 text-sm font-medium dark:border-zinc-700">Import game data</button>
              <ThemeToggle />
            </div>
          </div>
        </MobileSheet>

        {/* URL Share Import Dialog */}
        <SharedImportDialog />

        {/* Kyumaru Game Data Import Modal */}
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
        />

        {/* Expired PvP Event Resolution Modal */}
        <PvpExpiredModal />
      </div>
      </SkillInspectorProvider>
    </DeckProvider>
  );
}
