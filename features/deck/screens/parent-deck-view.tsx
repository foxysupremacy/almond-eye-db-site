"use client";

// Dedicated Parent Deck Tab:
// 1. Minimal Parent Lineage Summary Strip at the top (Trainee, P1, P2, compatibility rating, and unique skills).
// 2. 6-slot Parent Support Card Deck for farming parent skills.
// 3. All Possible Skills List (Card Hint, Card Event, Parent Unique, Bloodline Factors).

import { getCharacterImageUrl } from "@/lib/api";
import { getCharaIdFromCardId } from "@/lib/lineage/affinity-engine";
import ParentDeckPicker from "@/features/deck/components/parent-deck-picker";
import { ParentSkillList } from "@/features/parenting";
import AceComplementFinder from "@/features/deck/components/ace-complement-finder";
import { Badge } from "@/app/common/ui/primitives/badge";
import { useParentDeckViewModel } from "@/features/deck/view-models/use-parent-deck-view-model";

interface ParentDeckViewProps {
  onNavigateToParenting: () => void;
}

export default function ParentDeckView({ onNavigateToParenting }: ParentDeckViewProps) {
  const { state, commands } = useParentDeckViewModel(onNavigateToParenting);
  const {
    targetChara,
    p1Chara,
    p2Chara,
    affinityBreakdown,
    hasLineage,
    setup,
  } = state;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* 1. Minimal Parent Lineage Summary Strip */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Lineage preview (Trainee + P1 + P2) */}
          <div className="flex flex-wrap items-center gap-3">
            {hasLineage ? (
              <>
                {/* Trainee Chip */}
                <div className="flex items-center gap-2 pr-3 border-r border-zinc-200 dark:border-zinc-800">
                  <div className="relative w-9 h-9 shrink-0 rounded-full overflow-hidden bg-white dark:bg-zinc-800 ring-2 ring-emerald-500/80 shadow-xs flex items-center justify-center">
                    {targetChara ? (
                      <img
                        src={getCharacterImageUrl(targetChara.charId, targetChara.id)}
                        alt={targetChara.nameEn}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs">🐴</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Trainee
                    </span>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[110px]">
                      {targetChara?.nameEn || "Not picked"}
                    </p>
                  </div>
                </div>

                {/* Compatibility Badge */}
                <Badge size="comfortable" tone="amber" className="font-black">
                  <span>相性:</span>
                  <span className={affinityBreakdown.rating.textColor}>
                    {affinityBreakdown.rating.symbol}
                  </span>
                  <span>+{affinityBreakdown.totalScore}</span>
                </Badge>

                {/* Parent 1 */}
                <div className="flex items-center gap-2">
                  <div className="relative w-8 h-8 shrink-0 rounded-full overflow-hidden bg-white dark:bg-zinc-800 ring-2 ring-blue-500/80 shadow-xs flex items-center justify-center">
                    {setup.parent1 ? (
                      <img
                        src={getCharacterImageUrl(getCharaIdFromCardId(setup.parent1.card_id), setup.parent1.card_id)}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-zinc-400">P1</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      Parent 1
                    </span>
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[100px]">
                      {p1Chara?.nameEn || setup.parent1?.name || "None"}
                    </p>
                  </div>
                </div>

                {/* Parent 2 */}
                <div className="flex items-center gap-2">
                  <div className="relative w-8 h-8 shrink-0 rounded-full overflow-hidden bg-white dark:bg-zinc-800 ring-2 ring-pink-500/80 shadow-xs flex items-center justify-center">
                    {setup.parent2 ? (
                      <img
                        src={getCharacterImageUrl(getCharaIdFromCardId(setup.parent2.card_id), setup.parent2.card_id)}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-zinc-400">P2</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400">
                      Parent 2
                    </span>
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[100px]">
                      {p2Chara?.nameEn || setup.parent2?.name || "None"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="text-base">🧬</span>
                <span>
                  No parent bloodline configured yet. Plan Trainee & Parents in the Parenting tab to preview inherited skills.
                </span>
              </div>
            )}
          </div>

          {/* Right: Manage Lineage Button */}
          <button
            type="button"
            onClick={commands.navigateToParenting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-500/40 bg-white dark:bg-zinc-900 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 shadow-2xs cursor-pointer transition-all ease-out-quart duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Manage Lineage ↗</span>
          </button>
        </div>
      </div>

      {/* 2. The 6-Slot Support Card Deck */}
      <ParentDeckPicker />

      {/* 3. Ace Complement Finder: List A (activating ace+lineage skills) & cards farming missing speed skills */}
      <AceComplementFinder />

      {/* 4. Unified All Possible Skills List */}
      <ParentSkillList onNavigateToParenting={commands.navigateToParenting} />
    </div>
  );
}
