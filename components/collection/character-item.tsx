"use client";

import { type CharacterIndexEntry, getCharacterImageUrl } from "../../lib/api";

interface CharacterItemProps {
  character: CharacterIndexEntry;
  details: [number, number] | undefined;
  onSelect: (character: CharacterIndexEntry) => void;
}

export function CharacterItem({
  character,
  details,
  onSelect,
}: CharacterItemProps) {
  const isOwned = details !== undefined;
  const [currentStars, currentTalent] = details || [character.rarity, 1];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(character)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(character);
        }
      }}
      className={`group flex flex-col justify-between rounded-2xl border p-2 sm:p-2.5 transition-all cursor-pointer select-none bg-white dark:bg-zinc-900/90 active:scale-[0.98] ${
        isOwned
          ? currentStars === 5
            ? "border-sky-500/50 shadow-xs ring-1 ring-sky-500/20 hover:border-sky-500 hover:shadow-md"
            : "border-zinc-200 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md"
          : "border-dashed border-zinc-200 dark:border-zinc-800/80 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:border-emerald-500/50 hover:shadow-md"
      }`}
    >
      <div>
        {/* Avatar from CDN with True Frame Alignment */}
        <div className="relative aspect-square w-full mb-1 overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
          <img
            src={character.imgUrl}
            alt={character.nameEn}
            loading="lazy"
            className="h-full w-full object-contain filter drop-shadow-xs group-hover:scale-105 transition-transform duration-200 ease-out-expo"
            onError={(e) => {
              // Fallback if avatar is not yet cached
              e.currentTarget.src = getCharacterImageUrl(character.charId, character.id, "01");
            }}
          />

        </div>

        {/* Name & Costume Title */}
        <div className="mb-0.5 text-[10px] font-bold tracking-wide text-amber-500 dark:text-amber-400">
          {"★".repeat(isOwned ? currentStars : character.rarity)}
        </div>
        <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {character.nameEn}
        </h4>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
          {character.titleEn || character.titleJp || character.nameJp}
        </p>
      </div>

      {/* Bottom Inspection Indicator */}
      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
        <span className="text-[10px] font-medium">
          {isOwned ? `${currentStars}★ · Lv ${currentTalent}` : "Tap to inspect"}
        </span>
        <span className="text-xs font-bold opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
          Skills ↗
        </span>
      </div>
    </div>
  );
}
