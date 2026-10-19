"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DeckProvider, PvpExpiredModal, SharedImportDialog } from "@/features/deck";
import { ApplicationSkillInspectorProvider } from "@/app/components/application-skill-inspector-provider";
import { AppShellHeader } from "@/app/common/ui/controls/app-shell-header";
import { AppMobileNavigation } from "@/app/common/ui/controls/app-mobile-navigation";
import Footer from "@/app/components/footer";
import GlobalControlsBar from "@/app/components/global-controls-bar";
import { ImportModal } from "@/features/importer";
import { SkillScannerDialog } from "@/features/skill-scan";

type CollectionRoute = "supports" | "characters";

export function CollectionRouteFrame({ activeRoute, children }: { activeRoute: CollectionRoute; children: ReactNode }) {
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSkillScannerOpen, setIsSkillScannerOpen] = useState(false);
  useEffect(() => {
    try { setIsControlsCollapsed(localStorage.getItem("almond_controls_collapsed") === "true"); } catch {}
  }, []);
  const toggleControls = () => setIsControlsCollapsed((previous) => {
    const next = !previous;
    try { localStorage.setItem("almond_controls_collapsed", String(next)); } catch {}
    return next;
  });

  return (
    <DeckProvider>
      <ApplicationSkillInspectorProvider>
        <div className="app-shell flex min-h-[100dvh] min-w-0 flex-col bg-zinc-50 text-zinc-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
          <a href="#main-content" className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[400] focus:not-sr-only focus:rounded-lg focus:bg-emerald-700 focus:p-3 focus:text-white">Skip to content</a>
          <AppShellHeader activeRoute={activeRoute} isControlsCollapsed={isControlsCollapsed} mobileTitle={activeRoute === "supports" ? "Supports" : "Characters"} onToggleControls={toggleControls} />
          <GlobalControlsBar isCollapsed={isControlsCollapsed} onOpenImport={() => setIsImportModalOpen(true)} onOpenSkillScanner={() => setIsSkillScannerOpen(true)} />
          <main id="main-content" className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-3 py-5 sm:px-6 sm:py-8">{children}</main>
          <Footer />
          <AppMobileNavigation activeRoute={activeRoute} />
          <SharedImportDialog />
          <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
          <SkillScannerDialog isOpen={isSkillScannerOpen} onClose={() => setIsSkillScannerOpen(false)} />
          <PvpExpiredModal />
        </div>
      </ApplicationSkillInspectorProvider>
    </DeckProvider>
  );
}
