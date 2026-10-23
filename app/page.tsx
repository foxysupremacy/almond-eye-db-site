"use client";

// AlmondEye DB - Deck Builder, Parent Deck Builder & Skill Activation Visualizer.
// Shared app shell. Library groups inventory views in the six-item mobile navigation.

import { lazy, Suspense, useEffect, useState } from "react";
import { DeckFeature, DeckProvider, ParentDeckFeature, SharedImportDialog, PvpExpiredModal } from "../features/deck";
import Footer from "@/app/components/footer";
import GlobalControlsBar from "@/app/components/global-controls-bar";
import { MobileBuildToolsSheet } from "@/app/components/mobile-build-tools-sheet";
import { isRootAppRoute, type Tab } from "@/app/tabs";
import { ApplicationSkillInspectorProvider } from "@/app/components/application-skill-inspector-provider";
import { AppShellHeader } from "@/app/common/ui/controls/app-shell-header";
import { AppMobileNavigation } from "@/app/common/ui/controls/app-mobile-navigation";
import { TabSkeleton } from "@/app/components/tab-skeleton";

const ParentingFeature = lazy(() =>
  import("../features/parenting").then((m) => ({ default: m.ParentingFeature }))
);
const VisualizerFeature = lazy(() =>
  import("../features/visualizer").then((m) => ({ default: m.VisualizerFeature }))
);
const RankingsFeature = lazy(() =>
  import("@/features/rankings").then((m) => ({ default: m.RankingsFeature }))
);
const VeteransFeature = lazy(() =>
  import("../features/veterans").then((m) => ({ default: m.VeteransFeature }))
);
const ImportModal = lazy(() =>
  import("@/features/importer").then((m) => ({ default: m.ImportModal }))
);
const SkillScannerDialog = lazy(() =>
  import("@/features/skill-scan").then((m) => ({ default: m.SkillScannerDialog }))
);

export default function Home() {
  const [tab, setTab] = useState<Tab>("main");
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSkillScannerOpen, setIsSkillScannerOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Root tabs, including Rankings, are addressable via URL hash. Supports
  // and Characters keep their canonical App Router pages and detail links.
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
      if (isRootAppRoute(id)) setTab(id);
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
        <AppShellHeader activeRoute={tab} isControlsCollapsed={isControlsCollapsed} mobileTitle={tab === "veterans" ? "Your library" : tab === "parent-deck" ? "Parent Deck" : tab === "main" ? "Main Deck" : tab === "parenting" ? "Parenting" : tab === "rankings" ? "Rankings" : "Visualizer"} onToggleControls={toggleControls} onRootRouteChange={handleTabChange} onOpenBuildTools={() => setToolsOpen(true)} />
        <GlobalControlsBar isCollapsed={isControlsCollapsed} onOpenImport={() => setIsImportModalOpen(true)} onOpenSkillScanner={() => setIsSkillScannerOpen(true)} />

        <main id="main-content" className={`mx-auto w-full min-w-0 ${tab === "parenting" ? "max-w-6xl xl:max-w-7xl" : "max-w-5xl"} flex-1 px-3 py-5 sm:px-6 sm:py-8 transition-all duration-200`}>
          <Suspense fallback={<TabSkeleton />}>
            {tab === "main" ? (
              <DeckFeature />
            ) : tab === "parent-deck" ? (
              <ParentDeckFeature onNavigateToParenting={() => handleTabChange("parenting")} />
            ) : tab === "parenting" ? (
              <ParentingFeature onNavigateToParentDeck={() => handleTabChange("parent-deck")} />
            ) : tab === "rankings" ? (
              <RankingsFeature />
            ) : tab === "visualizer" ? (
              <VisualizerFeature />
            ) : (
              <VeteransFeature />
            )}
          </Suspense>
        </main>

        {/* Page Footer */}
        <Footer />

        <AppMobileNavigation activeRoute={tab} onRootRouteChange={handleTabChange} />

        <MobileBuildToolsSheet
          open={toolsOpen}
          onClose={() => setToolsOpen(false)}
          onOpenImport={() => { setToolsOpen(false); setIsImportModalOpen(true); }}
          onOpenSkillScanner={() => { setToolsOpen(false); setIsSkillScannerOpen(true); }}
        />

        {/* URL Share Import Dialog */}
        <SharedImportDialog />

        {/* Kyumaru Game Data Import Modal */}
        {isImportModalOpen && (
          <Suspense fallback={null}>
            <ImportModal
              isOpen={isImportModalOpen}
              onClose={() => setIsImportModalOpen(false)}
            />
          </Suspense>
        )}

        {/* OCR skill-name scanner → skill source lookup */}
        {isSkillScannerOpen && (
          <Suspense fallback={null}>
            <SkillScannerDialog
              isOpen={isSkillScannerOpen}
              onClose={() => setIsSkillScannerOpen(false)}
            />
          </Suspense>
        )}

        {/* Expired PvP Event Resolution Modal */}
        <PvpExpiredModal />
      </div>
      </ApplicationSkillInspectorProvider>
    </DeckProvider>
  );
}
