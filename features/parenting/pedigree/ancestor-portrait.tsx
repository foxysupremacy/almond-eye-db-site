import { getCharacterImageUrl } from "@/lib/api";
import { getCharaIdFromCardId } from "@/lib/lineage/affinity-engine";
import type { LoopCandidate } from "@/lib/parenting/loop-planner";

const portraitImageClass = "absolute inset-0 h-full w-full object-contain object-top drop-shadow-xs scale-[1.65] origin-top -translate-y-[17%]";

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
    <div className={`relative ${className} flex-none overflow-visible rounded-full shadow-sm transition-transform duration-150 ease-out-quart group-hover/avatar:scale-105`}>
      <div data-portrait-layer="back" aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden rounded-full">
        <img
          src={getCharacterImageUrl(getCharaIdFromCardId(candidate.cardId), candidate.cardId, "01")}
          alt=""
          className={portraitImageClass}
        />
      </div>
      <div
        data-portrait-layer="frame"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-full ring-[2.5px] ring-amber-400/95 dark:ring-amber-400/80"
      />
      <div
        aria-hidden="true"
        data-portrait-layer="front"
        className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        style={{
          // Circle-relative top 90° sector, bounded by the left/right tangents.
          // Extend above the circle so the enlarged portrait can pop out.
          clipPath: "polygon(0 -100%, 100% -100%, 100% 0, 50% 50%, 0 0)",
        }}
      >
        <img
          src={getCharacterImageUrl(getCharaIdFromCardId(candidate.cardId), candidate.cardId, "01")}
          alt=""
          className={portraitImageClass}
        />
      </div>
    </div>
  ) : (
    <div className={`${className} flex flex-col flex-none items-center justify-center rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/70 text-zinc-400 transition-colors duration-150 ease-out-quart group-hover/avatar:border-emerald-500 group-hover/avatar:text-emerald-500`}>
      <span className="text-xl font-bold leading-none">+</span>
      <span className="mt-0.5 text-[7px] font-semibold uppercase tracking-wider">{emptyLabel}</span>
    </div>
  );
}
