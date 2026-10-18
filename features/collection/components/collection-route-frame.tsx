"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Link as AriaLink } from "react-aria-components/Link";
import { DeckProvider, PvpExpiredModal, SharedImportDialog } from "@/features/deck";
import { ApplicationSkillInspectorProvider } from "@/app/components/application-skill-inspector-provider";
import { AppShellHeader } from "@/app/common/ui/controls/app-shell-header";
import { DeckIcon, FlagIcon, LibraryIcon, LineageIcon, TargetIcon } from "@/app/common/ui/primitives/icons";
import Footer from "@/app/components/footer";
import GlobalControlsBar from "@/app/components/global-controls-bar";
import { ImportModal } from "@/features/importer";
import { SkillScannerDialog } from "@/features/skill-scan";

type CollectionRoute = "supports" | "characters";

const mobileItems = [
  { href: "/#main", label: "Deck", icon: DeckIcon },
  { href: "/#parent-deck", label: "Parents", icon: TargetIcon },
  { href: "/#parenting", label: "Lineage", icon: LineageIcon },
  { href: "/#visualizer", label: "Race", icon: FlagIcon },
  { href: "/supports", label: "Supports", icon: LibraryIcon, route: "supports" },
  { href: "/characters", label: "Characters", icon: LibraryIcon, route: "characters" },
] as const;

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
          <nav aria-label="Mobile navigation" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-zinc-200 bg-white/95 px-1 pt-1 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden">
            {mobileItems.map((item) => {
              const { href, label, icon: Icon } = item;
              const active = "route" in item && item.route === activeRoute;
              return <AriaLink key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium ${active ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}><span className={`grid h-7 w-9 place-items-center rounded-lg ${active ? "bg-emerald-100 dark:bg-emerald-950" : ""}`}><Icon className="h-4 w-4" /></span>{label}</AriaLink>;
            })}
          </nav>
          <SharedImportDialog />
          <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
          <SkillScannerDialog isOpen={isSkillScannerOpen} onClose={() => setIsSkillScannerOpen(false)} />
          <PvpExpiredModal />
        </div>
      </ApplicationSkillInspectorProvider>
    </DeckProvider>
  );
}
