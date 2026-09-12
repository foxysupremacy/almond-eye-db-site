import React from "react";
import { getCharacterImageUrl } from "../../lib/api";
import { getCharaIdFromCardId } from "../../lib/affinity-engine";
import type { SlotPrimaryFactors } from "../../lib/factor-decoder";
import { FactorPills } from "./factor-pills";

export interface PedigreeSlotCardProps {
  slotLabel: string;
  cardId?: number | null;
  name: string;
  rank?: number | null;
  factors?: SlotPrimaryFactors | null;
  onClick: () => void;
  isParentSlot?: boolean;
  isBorrow?: boolean;
  className?: string;
  aptitudeWarning?: string;
}

export function PedigreeSlotCard({
  slotLabel,
  cardId,
  name,
  rank,
  factors,
  onClick,
  isParentSlot = false,
  isBorrow,
  className = "",
  aptitudeWarning,
}: PedigreeSlotCardProps) {
  const avatarSize = isParentSlot
    ? "w-16 h-16 sm:w-20 sm:h-20"
    : "w-13 h-13 sm:w-15 sm:h-15";
  const ringColor = isParentSlot
    ? "ring-2 ring-emerald-500/80"
    : "ring-2 ring-zinc-300 dark:ring-zinc-600";

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center cursor-pointer group text-center ${className}`}
    >
      <div
        className={`relative ${avatarSize} rounded-full ${ringColor} overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform duration-200 ease-out-quart`}
      >
        {cardId ? (
          <img
            src={getCharacterImageUrl(getCharaIdFromCardId(cardId), cardId, "01")}
            alt={name}
            className="w-full h-full object-contain object-top"
          />
        ) : (
          <span className="text-sm text-zinc-400 font-bold">{slotLabel}</span>
        )}

        {rank ? (
          <img
            src={`/assets/statusrank/utx_ico_statusrank_${String(rank).padStart(2, "0")}.png`}
            alt=""
            className="absolute -top-0.5 -right-0.5 w-5 h-5 object-contain z-10 filter drop-shadow-xs"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}

        {isBorrow !== undefined ? (
          <span
            className={`absolute bottom-0 inset-x-0 text-[8px] font-black py-0.2 uppercase tracking-tight text-center ${
              isBorrow
                ? "bg-amber-500/90 text-white"
                : "bg-blue-600/90 text-white"
            }`}
          >
            {isBorrow ? "Borrow" : isParentSlot ? "Your Uma" : "Owned"}
          </span>
        ) : null}
      </div>

      <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 truncate w-full mt-1">
        {name || slotLabel}
      </span>

      {aptitudeWarning && (
        <span
          className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 truncate max-w-full mt-0.5"
          title={aptitudeWarning}
        >
          {aptitudeWarning}
        </span>
      )}

      {/* 3 Factor Mini-Pills */}
      <FactorPills factors={factors} />
    </div>
  );
}
