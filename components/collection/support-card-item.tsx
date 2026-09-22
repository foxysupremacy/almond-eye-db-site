"use client";

import type { CardIndexEntry } from "../../lib/api";
import CardTypeIcon from "../card-type-icon";

interface SupportCardItemProps {
  card: CardIndexEntry;
  limitBreak: number | undefined;
  onSelect: (card: CardIndexEntry) => void;
}

const LB_LABELS = ["0 LB", "1 LB", "2 LB", "3 LB", "MLB"] as const;

export function SupportCardItem({
  card,
  limitBreak,
  onSelect,
}: SupportCardItemProps) {
  const isOwned = limitBreak !== undefined;
  const lb = limitBreak;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(card)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(card);
        }
      }}
      className={`group flex flex-col justify-between rounded-2xl border p-2 sm:p-2.5 transition-all cursor-pointer select-none bg-white dark:bg-zinc-900/90 active:scale-[0.98] ${
        isOwned
          ? lb === 4
            ? "border-amber-500/50 shadow-xs ring-1 ring-amber-500/20 hover:border-amber-500 hover:shadow-md"
            : "border-zinc-200 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md"
          : "border-dashed border-zinc-200 dark:border-zinc-800/80 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:border-emerald-500/50 hover:shadow-md"
      }`}
    >
      <div>
        {/* Card Art / Portrait (1:1 with overflow hidden) */}
        <div className="relative aspect-square w-full mb-2 overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
          <img
            src={card.portraitUrl}
            alt={card.nameEn || card.nameJp}
            loading="lazy"
            className="h-full w-full object-contain filter drop-shadow-xs group-hover:scale-105 transition-transform duration-200 ease-out-expo"
            onError={(e) => {
              if (e.currentTarget.src !== card.imgUrl) {
                e.currentTarget.src = card.imgUrl;
              }
            }}
          />

          {/* Rarity & Type Badge */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
            <span
              className={`px-1.5 py-0.2 text-[10px] font-black rounded ${
                card.rarity === 3
                  ? "bg-amber-400 text-amber-950"
                  : card.rarity === 2
                    ? "bg-sky-400 text-sky-950"
                    : "bg-zinc-300 text-zinc-800"
              }`}
            >
              {card.rarity === 3 ? "SSR" : card.rarity === 2 ? "SR" : "R"}
            </span>
            <span className="p-0.5 rounded bg-black/60 backdrop-blur-xs">
              <CardTypeIcon type={card.type} className="h-3.5 w-3.5 text-white" />
            </span>
          </div>

          {/* Ownership / LB Status Badge (Strict adherence to DESIGN.md section 4) */}
          <div className="absolute top-1.5 right-1.5">
            {isOwned ? (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-xs inline-flex items-center justify-center ${
                  lb === 4
                    ? "bg-amber-500 text-black border border-amber-300 font-black"
                    : "bg-sky-500/90 text-white font-bold"
                }`}
              >
                {lb !== undefined ? LB_LABELS[lb] : "Unowned"}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-black/60 text-zinc-400 backdrop-blur-xs">
                Unowned
              </span>
            )}
          </div>
        </div>

        {/* Card Title & Character Name */}
        <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {card.charName || card.nameEn}
        </h4>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mb-1">
          {card.titleEn || card.titleJa || card.nameJp}
        </p>
      </div>

      {/* Bottom Inspection Indicator */}
      <div className="mt-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
        <span className="text-[10px] font-medium">
          {isOwned && lb !== undefined ? LB_LABELS[lb] : "Tap to inspect"}
        </span>
        <span className="text-xs font-bold opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
          Skills & Stats ↗
        </span>
      </div>
    </div>
  );
}
