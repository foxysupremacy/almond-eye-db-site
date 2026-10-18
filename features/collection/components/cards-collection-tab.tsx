"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import type { CardIndexEntry } from "@/lib/api";
import CardTypeIcon, { formatCardType } from "@/app/common/ui/cards/card-type-icon";
import { CARD_TYPES, type CardTypeKey } from "@/features/collection/model/types";
import { SupportCardItem } from "./support-card-item";
import { orderOwnedFirst } from "@/features/collection/model/filters";

interface CardsCollectionTabProps {
  filteredCards: CardIndexEntry[];
  cardType: CardTypeKey;
  onCardTypeChange: (t: CardTypeKey) => void;
  cardRarity: number | "all";
  onCardRarityChange: (r: number | "all") => void;
  getLimitBreak: (cardId: number) => number | undefined;
  onSetLimitBreak: (cardId: number, lb: number) => void;
  onRemoveCard: (cardId: number) => void;
  ownedFirst: boolean;
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
  ownedFirst,
}: CardsCollectionTabProps) {
  const router = useRouter();
  const displayedCards = useMemo(
    () => orderOwnedFirst(filteredCards, (card) => getLimitBreak(card.id) !== undefined, ownedFirst),
    [filteredCards, getLimitBreak, ownedFirst],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Secondary Filters: Type & Rarity */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        {/* Card Type Pills */}
        <ToggleButtonGroup aria-label="Support card type" selectionMode="single" disallowEmptySelection selectedKeys={new Set([cardType])} onSelectionChange={(keys) => { const key = [...keys][0]; if (key !== undefined) onCardTypeChange(String(key) as CardTypeKey); }} className="flex flex-wrap items-center gap-1">
          {CARD_TYPES.map((t) => (
            <ToggleButton
              id={t}
              key={t}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 transition-colors ${
                cardType === t
                  ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              {t !== "all" && <CardTypeIcon type={t} className="h-3.5 w-3.5" />}
              <span>{t === "all" ? "All Types" : formatCardType(t)}</span>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* Rarity filter */}
        <ToggleButtonGroup aria-label="Support card rarity" selectionMode="single" disallowEmptySelection selectedKeys={new Set([String(cardRarity)])} onSelectionChange={(keys) => { const key = [...keys][0]; if (key !== undefined) onCardRarityChange(key === "all" ? "all" : Number(key)); }} className="flex items-center gap-1">
          {([
            { r: "all", label: "All" },
            { r: 3, label: "SSR" },
            { r: 2, label: "SR" },
            { r: 1, label: "R" },
          ] as const).map((rItem) => (
            <ToggleButton
              id={String(rItem.r)}
              key={String(rItem.r)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 transition-colors ${
                cardRarity === rItem.r
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {rItem.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      {/* Grid Content */}
      {filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
          No cards matched your filter criteria.
        </div>
      ) : (
          <div id="supports-results" className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3.5 md:grid-cols-5 lg:grid-cols-6">
            {displayedCards.map((card) => (
              <SupportCardItem
                key={card.id}
                card={card}
                limitBreak={getLimitBreak(card.id)}
                onSelect={(selected) => router.push(`/supports/${selected.id}`)}
              />
            ))}
          </div>
      )}

    </div>
  );
}
