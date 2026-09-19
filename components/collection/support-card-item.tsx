"use client";

import type { CardIndexEntry } from "../../lib/api";
import CardTypeIcon from "../card-type-icon";

interface SupportCardItemProps {
  card: CardIndexEntry;
  limitBreak: number | undefined;
  onSetLimitBreak: (cardId: number, lb: number) => void;
  onRemoveCard: (cardId: number) => void;
}

export function SupportCardItem({
  card,
  limitBreak,
  onSetLimitBreak,
  onRemoveCard,
}: SupportCardItemProps) {
  const isOwned = limitBreak !== undefined;
  const lb = limitBreak;

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border p-2.5 transition-all bg-white dark:bg-zinc-900/90 ${
        isOwned
          ? lb === 4
            ? "border-amber-500/50 shadow-xs ring-1 ring-amber-500/20"
            : "border-zinc-200 dark:border-zinc-800 shadow-2xs"
          : "border-dashed border-zinc-200 dark:border-zinc-800/80 grayscale opacity-50 hover:grayscale-0 hover:opacity-100"
      }`}
    >
      <div>
        {/* Card Art / Portrait (1:1 with no border radius) */}
        <div className="relative aspect-square w-full mb-2">
          <img
            src={card.portraitUrl}
            alt={card.nameEn || card.nameJp}
            loading="lazy"
            className="h-full w-full object-contain"
            onError={(e) => {
              // Fallback to art
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

          {/* Ownership / LB Status Badge */}
          <div className="absolute top-1.5 right-1.5">
            {isOwned ? (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide shadow-xs ${
                  lb === 4
                    ? "bg-amber-500 text-black border border-amber-300"
                    : "bg-sky-500/90 text-white"
                }`}
              >
                {lb === 4 ? "MLB" : `${lb}★`}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/60 text-zinc-400 backdrop-blur-xs">
                Unowned
              </span>
            )}
          </div>
        </div>

        {/* Card Title & Character Name */}
        <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
          {card.charName || card.nameEn}
        </h4>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mb-2.5">
          {card.titleEn || card.titleJa || card.nameJp}
        </p>
      </div>

      {/* Limit Break Controls (0★..4★) */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-1">
        <div className="flex items-center gap-0.5">
          {[0, 1, 2, 3, 4].map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => onSetLimitBreak(card.id, step)}
              title={`Set to ${step === 4 ? "MLB (4★)" : `${step}★`}`}
              className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer ${
                isOwned && lb === step
                  ? step === 4
                    ? "bg-amber-500 text-black font-black"
                    : "bg-emerald-500 text-white"
                  : isOwned && lb !== undefined && lb > step
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {step}
            </button>
          ))}
        </div>

        {/* Unown Button */}
        {isOwned && (
          <button
            type="button"
            onClick={() => onRemoveCard(card.id)}
            title="Remove from owned"
            className="text-zinc-400 hover:text-red-500 p-1 text-[11px] cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
