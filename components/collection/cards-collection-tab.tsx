"use client";

import type { CardIndexEntry } from "../../lib/api";
import CardTypeIcon, { formatCardType } from "../card-type-icon";
import { CARD_TYPES, type CardTypeKey } from "./types";
import { SupportCardItem } from "./support-card-item";

interface CardsCollectionTabProps {
  filteredCards: CardIndexEntry[];
  cardType: CardTypeKey;
  onCardTypeChange: (t: CardTypeKey) => void;
  cardRarity: number | "all";
  onCardRarityChange: (r: number | "all") => void;
  getLimitBreak: (cardId: number) => number | undefined;
  onSetLimitBreak: (cardId: number, lb: number) => void;
  onRemoveCard: (cardId: number) => void;
}

export function CardsCollectionTab({
  filteredCards,
  cardType,
  onCardTypeChange,
  cardRarity,
  onCardRarityChange,
  getLimitBreak,
  onSetLimitBreak,
  onRemoveCard,
}: CardsCollectionTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Secondary Filters: Type & Rarity */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        {/* Card Type Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {CARD_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onCardTypeChange(t)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                cardType === t
                  ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              {t !== "all" && <CardTypeIcon type={t} className="h-3.5 w-3.5" />}
              <span>{t === "all" ? "All Types" : formatCardType(t)}</span>
            </button>
          ))}
        </div>

        {/* Rarity filter */}
        <div className="flex items-center gap-1">
          {([
            { r: "all", label: "All" },
            { r: 3, label: "SSR" },
            { r: 2, label: "SR" },
            { r: 1, label: "R" },
          ] as const).map((rItem) => (
            <button
              key={String(rItem.r)}
              type="button"
              onClick={() => onCardRarityChange(rItem.r)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                cardRarity === rItem.r
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {rItem.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      {filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
          No cards matched your filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {filteredCards.map((card) => (
            <SupportCardItem
              key={card.id}
              card={card}
              limitBreak={getLimitBreak(card.id)}
              onSetLimitBreak={onSetLimitBreak}
              onRemoveCard={onRemoveCard}
            />
          ))}
        </div>
      )}
    </div>
  );
}
