import React, { useState } from "react";
import type { FullLineageAffinityBreakdown } from "../../lib/affinity-engine";

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

  return (
    <div className={`relative z-20 flex items-center justify-between gap-2 mb-2 ${className}`}>
      {/* Left Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/85 dark:bg-zinc-800/85 backdrop-blur-md border border-zinc-200/20 text-white text-xs font-semibold shadow-xs">
        <span>Lineage Planner</span>
      </div>

      {/* Center Glowing Compatibility: Affinity : ◎ 383 */}
      <div className="relative flex items-center gap-1.5">
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
        <button
          type="button"
          onClick={() => setShowTooltip(!showTooltip)}
          className="w-5 h-5 rounded-full bg-amber-400/20 hover:bg-amber-400/40 text-amber-600 dark:text-amber-300 text-[11px] font-bold flex items-center justify-center border border-amber-400/40 cursor-pointer transition-colors"
          title="View affinity score breakdown"
        >
          ⓘ
        </button>

        {/* Affinity Breakdown Floating Popover */}
        {showTooltip && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-xl text-xs z-50 text-zinc-800 dark:text-zinc-200 space-y-1.5">
            <div className="flex items-center justify-between font-bold border-b border-zinc-200 dark:border-zinc-800 pb-1">
              <span>Affinity Breakdown</span>
              <button
                type="button"
                onClick={() => setShowTooltip(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
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
          </div>
        )}
      </div>

      {/* Right Button: Inherited Skills */}
      <button
        type="button"
        onClick={onOpenInheritedSkills}
        className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs active:scale-[0.98] cursor-pointer transition-all"
      >
        <span>Inherited Skills</span>
      </button>
    </div>
  );
}
