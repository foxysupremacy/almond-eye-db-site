"use client";

import GlobalTrackBar from "@/app/components/global-track-bar";
import ThemeToggle from "@/app/components/theme-toggle";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { HEADER_ACTION_CLASS } from "@/app/common/ui/primitives/header-action";
import { DownloadIcon, ScanTextIcon } from "@/app/common/ui/primitives/icons";
import { PresetManager } from "@/features/deck";

interface GlobalControlsBarProps {
  isCollapsed: boolean;
  onOpenImport: () => void;
  onOpenSkillScanner: () => void;
}

/** Shared desktop control bar for every application route. */
export default function GlobalControlsBar({ isCollapsed, onOpenImport, onOpenSkillScanner }: GlobalControlsBarProps) {
  if (isCollapsed) return null;

  return (
    <section id="global-controls" aria-label="Global controls" className="hidden border-b border-zinc-200/80 bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/70 lg:block">
      <div className="mx-auto max-w-5xl px-3 py-2.5 sm:px-6">
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <AppButton type="button" onPress={onOpenImport} className={HEADER_ACTION_CLASS} title="Sync or Import Kyumaru Game Data" variant="secondary">
            <DownloadIcon className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>Sync Data</span>
          </AppButton>
          <AppButton type="button" onPress={onOpenSkillScanner} className={HEADER_ACTION_CLASS} title="Scan a Japanese skill name to find its sources" variant="secondary">
            <ScanTextIcon className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>Scan Skill</span>
          </AppButton>
          <PresetManager />
          <ThemeToggle />
        </div>
        <GlobalTrackBar />
      </div>
    </section>
  );
}
