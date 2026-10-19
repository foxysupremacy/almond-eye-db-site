"use client";

import { AppButton } from "@/app/common/ui/controls/app-button";
import { MobileSheet } from "@/app/common/ui/controls/mobile-sheet";
import { ScanTextIcon } from "@/app/common/ui/primitives/icons";
import { PresetManager } from "@/features/deck";
import { GlobalRaceControls } from "@/app/components/global-track-bar";
import ThemeToggle from "@/app/components/theme-toggle";

interface MobileBuildToolsSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenImport: () => void;
  onOpenSkillScanner: () => void;
}

/** Shared mobile home for target-race, preset, import, scan, and theme controls. */
export function MobileBuildToolsSheet({ open, onClose, onOpenImport, onOpenSkillScanner }: MobileBuildToolsSheetProps) {
  return (
    <MobileSheet open={open} onClose={onClose} title="Your build" description="Choose a target race, switch builds, share your deck, or import your collection.">
      <MobileBuildToolsContent onOpenImport={onOpenImport} onOpenSkillScanner={onOpenSkillScanner} />
    </MobileSheet>
  );
}

/** Content is separate so the shared controls can be rendered and verified without an overlay portal. */
export function MobileBuildToolsContent({ onOpenImport, onOpenSkillScanner }: Pick<MobileBuildToolsSheetProps, "onOpenImport" | "onOpenSkillScanner">) {
  return (
    <div className="mobile-build-tools space-y-5">
      <section aria-labelledby="mobile-target-race-heading" className="space-y-3">
        <h2 id="mobile-target-race-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Target race</h2>
        <GlobalRaceControls />
      </section>
      <PresetManager />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <div className="flex flex-wrap gap-2">
          <AppButton type="button" variant="secondary" size="md" onPress={onOpenImport}>Import game data</AppButton>
          <AppButton type="button" variant="secondary" size="md" onPress={onOpenSkillScanner}><ScanTextIcon className="h-4 w-4" />Scan skill</AppButton>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
