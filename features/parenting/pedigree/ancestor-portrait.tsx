import { getCharacterImageUrl } from "@/lib/api";
import { getCharaIdFromCardId } from "@/lib/lineage/affinity-engine";
import type { LoopCandidate } from "@/lib/parenting/loop-planner";
import { CharacterPortrait } from "@/app/common/ui/primitives/character-portrait";

/** §20 ancestor portrait: back / frame / clipped front layers, or the dashed empty ring. */
export function AncestorPortrait({
  candidate,
  className,
  emptyLabel = "Select",
}: {
  candidate: LoopCandidate | null;
  className: string;
  emptyLabel?: string;
}) {
  return candidate ? (
    <CharacterPortrait
      src={getCharacterImageUrl(getCharaIdFromCardId(candidate.cardId), candidate.cardId, "01")}
      className={`${className} shadow-sm transition-transform duration-150 ease-out-quart group-hover/avatar:scale-105`}
    />
  ) : (
    <div className={`${className} flex flex-col flex-none items-center justify-center rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/70 text-zinc-400 transition-colors duration-150 ease-out-quart group-hover/avatar:border-emerald-500 group-hover/avatar:text-emerald-500`}>
      <span className="text-xl font-bold leading-none">+</span>
      <span className="mt-0.5 text-[7px] font-semibold uppercase tracking-wider">{emptyLabel}</span>
    </div>
  );
}
