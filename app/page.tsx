"use client";

// AlmondEye DB - Deck Builder, Parent Deck Builder & Skill Activation Visualizer.
// Responsive six-view shell. Library groups the two inventory views on mobile.

import { useEffect, useState } from "react";
import { DeckFeature, DeckProvider, ParentDeckFeature, SharedImportDialog, PvpExpiredModal } from "../features/deck";
import { PresetManager } from "../features/deck";
import ThemeToggle from "@/app/components/theme-toggle";
import Footer from "@/app/components/footer";
import GlobalControlsBar from "@/app/components/global-controls-bar";
import { ParentingFeature } from "../features/parenting";
import { VisualizerFeature } from "../features/visualizer";
import { VeteransFeature } from "../features/veterans";
import { ImportModal } from "@/features/importer";
import { SkillScannerDialog } from "@/features/skill-scan";
import { ApplicationSkillInspectorProvider } from "@/app/components/application-skill-inspector-provider";
import { MobileSheet } from "@/app/common/ui/controls/mobile-sheet";
import { AppShellHeader, type RootAppRoute } from "@/app/common/ui/controls/app-shell-header";
import { DeckIcon, LineageIcon, LibraryIcon, TargetIcon, FlagIcon, ScanTextIcon } from "@/app/common/ui/primitives/icons";
import { Link as AriaLink } from "react-aria-components/Link";
import { AppButton } from "@/app/common/ui/controls/app-button";

type Tab = RootAppRoute;

const MOBILE_TABS = [
  { id: "main", label: "Deck", icon: DeckIcon },
  { id: "parent-deck", label: "Parents", icon: TargetIcon },
  { id: "parenting", label: "Lineage", icon: LineageIcon },
  { id: "visualizer", label: "Race", icon: FlagIcon },
  { id: "supports", label: "Supports", icon: LibraryIcon, href: "/supports" },
  { id: "characters", label: "Characters", icon: LibraryIcon, href: "/characters" },
] as const;

export default function Home() {
  const [tab, setTab] = useState<Tab>("main");
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSkillScannerOpen, setIsSkillScannerOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Root tabs are addressable via URL hash. Supports and Characters are
  // canonical App Router pages so their detail links can be refreshed/shared.
  // Unknown hashes (e.g. #share=...) are ignored so share links still work.
  useEffect(() => {
    try {
      if (localStorage.getItem("almond_controls_collapsed") === "true") setIsControlsCollapsed(true);
    } catch {}
    function applyHash() {
      const id = window.location.hash.replace(/^#/, "").split("=")[0];
      if (id === "collection") {
        window.location.replace("/supports");
        return;
      }
      if (["main", "parent-deck", "parenting", "visualizer", "veterans"].includes(id)) setTab(id as Tab);
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const toggleControls = () => {
    setIsControlsCollapsed((previous) => {
      const next = !previous;
      try { localStorage.setItem("almond_controls_collapsed", String(next)); } catch {}
      return next;
    });
  };

  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (window.matchMedia("(max-width: 767px)").matches) window.scrollTo({ top: 0, behavior: "instant" });
    try {
      history.replaceState(null, "", next === "main" ? window.location.pathname : `#${next}`);
    } catch {}
  };

  return (
    <DeckProvider>
      <ApplicationSkillInspectorProvider>
      <div className="app-shell flex min-h-[100dvh] min-w-0 flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[400] focus:rounded-lg focus:bg-emerald-700 focus:p-3 focus:text-white">Skip to content</a>
        <AppShellHeader activeRoute={tab} isControlsCollapsed={isControlsCollapsed} mobileTitle={tab === "veterans" ? "Your library" : tab === "parent-deck" ? "Parent Deck" : tab === "main" ? "Main Deck" : tab === "parenting" ? "Parenting" : "Visualizer"} onToggleControls={toggleControls} onRootRouteChange={handleTabChange} onOpenBuildTools={() => setToolsOpen(true)} />
        <GlobalControlsBar isCollapsed={isControlsCollapsed} onOpenImport={() => setIsImportModalOpen(true)} onOpenSkillScanner={() => setIsSkillScannerOpen(true)} />

        <main id="main-content" className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-3 py-5 sm:px-6 sm:py-8">
          {tab === "main" ? (
            <DeckFeature />
          ) : tab === "parent-deck" ? (
            <ParentDeckFeature onNavigateToParenting={() => handleTabChange("parenting")} />
          ) : tab === "parenting" ? (
            <ParentingFeature onNavigateToParentDeck={() => handleTabChange("parent-deck")} />
          ) : tab === "visualizer" ? (
            <VisualizerFeature />
          ) : (
            <VeteransFeature />
          )}
        </main>

        {/* Page Footer */}
        <Footer />

        <nav aria-label="Mobile navigation" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-zinc-200 bg-white/95 px-1 pt-1 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden">
          {MOBILE_TABS.map((item) => {
            const { id, label, icon: Icon } = item;
            const href = "href" in item ? item.href : undefined;
            const active = tab === (id as Tab);
            return <AriaLink key={id} href={href ?? `#${id}`} aria-current={active ? "page" : undefined} onClick={href ? undefined : (event) => { event.preventDefault(); handleTabChange(id as Tab); }} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors ${active ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}><span className={`grid h-7 w-9 place-items-center rounded-lg ${active ? "bg-emerald-100 dark:bg-emerald-950" : ""}`}><Icon className="h-4 w-4" /></span>{label}</AriaLink>;
          })}
        </nav>

        <MobileSheet open={toolsOpen} onClose={() => setToolsOpen(false)} title="Your build" description="Switch builds, share your deck, or import your collection.">
          <div className="mobile-build-tools space-y-5">
            <PresetManager />
            <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <div className="flex flex-wrap gap-2">
                <AppButton type="button" variant="secondary" size="md" onPress={() => { setToolsOpen(false); setIsImportModalOpen(true); }}>Import game data</AppButton>
                <AppButton type="button" variant="secondary" size="md" onPress={() => { setToolsOpen(false); setIsSkillScannerOpen(true); }}><ScanTextIcon className="h-4 w-4" />Scan skill</AppButton>
              </div>
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

        {/* OCR skill-name scanner → skill source lookup */}
        <SkillScannerDialog isOpen={isSkillScannerOpen} onClose={() => setIsSkillScannerOpen(false)} />

        {/* Expired PvP Event Resolution Modal */}
        <PvpExpiredModal />
      </div>
      </ApplicationSkillInspectorProvider>
    </DeckProvider>
  );
}
