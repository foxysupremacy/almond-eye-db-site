import React, { useState, useRef } from "react";
import { Dialog } from "react-aria-components/Dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { AppPopover } from "@/app/common/ui/controls/app-popover";
import { AlertCircleIcon, XIcon } from "@/app/common/ui/primitives/icons";
import type { FullLineageAffinityBreakdown } from "@/lib/lineage/affinity-engine";
import { Badge } from "@/app/common/ui/primitives/badge";

export interface LineageAffinityHeaderProps {
  affinityBreakdown: FullLineageAffinityBreakdown;
  onOpenInheritedSkills: () => void;
  className?: string;
}

export function LineageAffinityHeader({
  affinityBreakdown,
  onOpenInheritedSkills,
  className = "",
}: LineageAffinityHeaderProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);

  return (
    <div className={`relative z-20 mb-2 grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_auto_1fr] ${className}`}>
      {/* Left Badge */}
      <Badge size="standard" className="bg-zinc-900/85 dark:bg-zinc-800/85 border-zinc-200/20 text-white backdrop-blur-md font-semibold shadow-xs">
        <span>Lineage Planner</span>
      </Badge>

      {/* Center Glowing Compatibility: Affinity : ◎ 383 */}
      <div className="relative col-span-2 row-start-2 flex items-center justify-self-center gap-1.5 sm:col-span-1 sm:row-start-auto">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs sm:text-sm font-bold text-amber-500 dark:text-amber-400">
            Affinity :
          </span>
          <span
            className={`text-xl sm:text-2xl font-black ${affinityBreakdown.rating.textColor} drop-shadow-xs`}
          >
            {affinityBreakdown.rating.symbol}
          </span>
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-amber-500 dark:text-amber-300">
            {affinityBreakdown.totalScore}
          </span>
        </div>

        {/* Info Button for Affinity Breakdown Popover */}
        <span ref={triggerRef}>
          <AppButton variant="quiet" iconOnly aria-label="View affinity score breakdown" aria-haspopup="dialog" aria-expanded={showTooltip} onPress={() => setShowTooltip((open) => !open)}>
            <AlertCircleIcon className="h-4 w-4" />
          </AppButton>
        </span>

        {/* Affinity Breakdown Floating Popover */}
        <AppPopover triggerRef={triggerRef} isOpen={showTooltip} onOpenChange={setShowTooltip} placement="bottom" className="w-64 rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <Dialog aria-label="Affinity breakdown" className="space-y-1.5 p-3 text-xs outline-none">
            <div className="flex items-center justify-between font-bold border-b border-zinc-200 dark:border-zinc-800 pb-1">
              <span>Affinity Breakdown</span>
              <AppButton
                variant="quiet"
                onPress={() => setShowTooltip(false)}
                iconOnly
                aria-label="Close affinity breakdown"
                className="text-zinc-400 hover:text-zinc-600"
              >
                <XIcon className="h-3.5 w-3.5" />
              </AppButton>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Trainee ↔ Parent 1:</span>
              <strong className="text-emerald-600">
                +{affinityBreakdown.p1Affinity?.total ?? 0}
              </strong>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Trainee ↔ Parent 2:</span>
              <strong className="text-emerald-600">
                +{affinityBreakdown.p2Affinity?.total ?? 0}
              </strong>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Parent 1 ↔ Parent 2:</span>
              <strong className="text-blue-600">
                +{affinityBreakdown.pairAffinity?.total ?? 0}
              </strong>
            </div>
            <div className="flex justify-between text-[11px] border-t border-zinc-100 dark:border-zinc-800 pt-1 font-semibold">
              <span>Rating:</span>
              <span className={affinityBreakdown.rating.textColor}>
                {affinityBreakdown.rating.symbol} ({affinityBreakdown.rating.label})
              </span>
            </div>
          </Dialog>
        </AppPopover>
      </div>

      {/* Right Button: Inherited Skills */}
      <AppButton
        variant="primary"
        onPress={onOpenInheritedSkills}
        className="flex min-h-10 items-center justify-self-end gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-500 active:scale-[0.98]"
      >
        <span>Inherited Skills</span>
      </AppButton>
    </div>
  );
}
