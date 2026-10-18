"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { PickerSearchBar } from "@/app/common/ui/controls/picker-search-bar";
import { DownloadIcon } from "@/app/common/ui/primitives/icons";
import { useOwnedCards } from "@/app/common/hooks/use-owned-cards";
import { api, type CardIndexEntry } from "@/lib/api";
import { ImportModal } from "@/features/importer";
import { CardsCollectionTab } from "./components/cards-collection-tab";
import { OwnedFirstToggle } from "./components/owned-first-toggle";
import { filterCollectionCards } from "./model/filters";
import type { CardTypeKey } from "./model/types";

export function SupportsView() {
  const [cards, setCards] = useState<CardIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState<CardTypeKey>("all");
  const [cardRarity, setCardRarity] = useState<number | "all">("all");
  const [ownedFirst, setOwnedFirst] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const { getLimitBreak, setLimitBreak, removeCard, totalOwned, mlbCount } = useOwnedCards();

  useEffect(() => {
    api.listCardIndex().then(setCards).catch((error) => console.error("Failed to load supports:", error)).finally(() => setLoading(false));
  }, []);

  const filteredCards = useMemo(() => filterCollectionCards(cards, query, cardType, cardRarity), [cards, query, cardRarity, cardType]);

  if (loading) return <div className="flex min-h-64 flex-col items-center justify-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" /><p className="text-xs text-zinc-400">Loading support cards...</p></div>;

  return <>
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div><h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Supports</h1><p className="text-xs text-zinc-500 dark:text-zinc-400">Browse every support card and record limit breaks for your own collection.</p></div>
        <AppButton variant="secondary" onPress={() => setIsImportModalOpen(true)} className="flex items-center gap-1.5"><DownloadIcon className="h-4 w-4" /> Sync / Import Data</AppButton>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2"><span className="text-zinc-500">Owned:</span><strong>{totalOwned} / {cards.length}</strong><span className="text-zinc-400">· MLB: {mlbCount}</span></div>
        <OwnedFirstToggle isSelected={ownedFirst} onChange={setOwnedFirst} controls="supports-results" />
      </div>
      <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800/80"><PickerSearchBar value={query} onChange={setQuery} label="Search support cards" placeholder="Search cards by character, title, or Japanese name..." /></div>
      <CardsCollectionTab filteredCards={filteredCards} cardType={cardType} onCardTypeChange={setCardType} cardRarity={cardRarity} onCardRarityChange={setCardRarity} getLimitBreak={getLimitBreak} onSetLimitBreak={setLimitBreak} onRemoveCard={removeCard} ownedFirst={ownedFirst} />
    </section>
    <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
  </>;
}
