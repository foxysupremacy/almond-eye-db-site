"use client";

import { Button } from "react-aria-components/Button";

import type { CardIndexEntry } from "@/lib/api";
import CardTypeIcon from "@/app/common/ui/cards/card-type-icon";

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
    <Button
      onPress={() => onSelect(card)}
      className={`group text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 flex flex-col justify-between rounded-2xl border p-2 sm:p-2.5 transition-all cursor-pointer select-none bg-white dark:bg-zinc-900/90 active:scale-[0.98] ${
        isOwned
          ? lb === 4
            ? "border-amber-500/50 shadow-xs ring-1 ring-amber-500/20 hover:border-amber-500 hover:shadow-md"
            : "border-zinc-200 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md"
        : "border-zinc-200 dark:border-zinc-800 shadow-2xs hover:border-emerald-500/50 hover:shadow-md"
      }`}
    >
      <div>
        {/* Card Art / Portrait (1:1 with overflow hidden) */}
        <div className="relative mb-2 aspect-square w-full overflow-hidden bg-zinc-50 dark:bg-zinc-800/50">
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

          {/* Type marker sits flush at the artwork's top-right corner without a badge. */}
          <CardTypeIcon
            type={card.type}
            className="absolute right-0 top-0 h-6 w-6 object-contain drop-shadow-md"
          />

          {/* Keep limit-break information for owned cards; omit the unowned state. */}
          {isOwned && (
            <div className="absolute left-2 top-2">
              <span
                className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] font-bold shadow-xs ${
                  lb === 4
                    ? "bg-amber-500 text-black border border-amber-300 font-black"
                    : "bg-sky-500/90 text-white font-bold"
                }`}
              >
                {lb !== undefined ? LB_LABELS[lb] : null}
              </span>
            </div>
          )}
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
      <div className="mt-1 flex min-h-8 items-center border-t border-zinc-100 pt-2 text-[10px] font-semibold text-zinc-400 transition-colors group-hover:text-emerald-600 dark:border-zinc-800/80 dark:group-hover:text-emerald-400">
        <span className="truncate">
          {isOwned && lb !== undefined ? `${LB_LABELS[lb]} · ` : "Inspect · "}Skills & Stats ↗
        </span>
      </div>
    </Button>
  );
}
