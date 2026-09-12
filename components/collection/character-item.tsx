"use client";

import { type CharacterIndexEntry, getCharacterImageUrl } from "../../lib/api";

interface CharacterItemProps {
  character: CharacterIndexEntry;
  details: [number, number] | undefined;
  onSetUmaDetails: (charaId: number, stars: number, talent: number) => void;
  onRemoveUma: (charaId: number) => void;
}

export function CharacterItem({
  character,
  details,
  onSetUmaDetails,
  onRemoveUma,
}: CharacterItemProps) {
  const isOwned = details !== undefined;
  const [currentStars, currentTalent] = details || [character.rarity, 1];

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border p-2.5 transition-all bg-white dark:bg-zinc-900/90 ${
        isOwned
          ? currentStars === 5
            ? "border-sky-500/50 shadow-xs ring-1 ring-sky-500/20"
            : "border-zinc-200 dark:border-zinc-800 shadow-2xs"
          : "border-dashed border-zinc-200 dark:border-zinc-800/80 opacity-60 hover:opacity-100"
      }`}
    >
      <div>
        {/* Avatar from CDN with True Frame Alignment */}
        <div className="relative aspect-square w-full mb-1">
          <img
            src={character.imgUrl}
            alt={character.nameEn}
            loading="lazy"
            className="h-full w-full object-contain filter drop-shadow-xs"
            onError={(e) => {
              // Fallback if avatar is not yet cached
              e.currentTarget.src = getCharacterImageUrl(character.charId, character.id, "01");
            }}
          />

          {/* Stars Pill (Aligned to true frame top-left below ears) */}
          <div className="absolute top-[16%] left-[6%] pointer-events-none">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/70 text-amber-300 backdrop-blur-xs shadow-xs border border-white/10">
              {"★".repeat(isOwned ? currentStars : character.rarity)}
            </span>
          </div>

          {/* Ownership status (Aligned to true frame top-right below ears) */}
          <div className="absolute top-[16%] right-[6%] pointer-events-none">
            {isOwned ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600/90 text-white shadow-xs border border-emerald-400/30">
                Lv {currentTalent}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/70 text-zinc-400 backdrop-blur-xs border border-white/10">
                Unowned
              </span>
            )}
          </div>
        </div>

        {/* Name & Costume Title */}
        <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
          {character.nameEn}
        </h4>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mb-2">
          {character.titleEn || character.titleJp || character.nameJp}
        </p>
      </div>

      {/* Star & Talent Editor */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        {isOwned ? (
          <div className="space-y-1.5">
            {/* Star Stepper (1..5★) */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Stars:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSetUmaDetails(character.id, s, currentTalent)}
                    className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center cursor-pointer transition-colors ${
                      s <= currentStars
                        ? "bg-amber-400 text-amber-950"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Talent Stepper (Lv 1..7) */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">Awakening:</span>
              <div className="flex items-center gap-1">
                <select
                  value={currentTalent}
                  onChange={(e) =>
                    onSetUmaDetails(character.id, currentStars, Number(e.target.value))
                  }
                  className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-900 dark:text-zinc-100 font-semibold"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Lv {lvl}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => onRemoveUma(character.id)}
                  title="Remove from owned"
                  className="text-zinc-400 hover:text-red-500 p-0.5 text-[10px] ml-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSetUmaDetails(character.id, character.rarity, 5)}
            className="w-full py-1 text-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
          >
            + Add to Owned
          </button>
        )}
      </div>
    </div>
  );
}
