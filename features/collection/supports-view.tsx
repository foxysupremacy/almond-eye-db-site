"use client";

import { AppButton } from "@/app/common/ui/controls/app-button";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { PickerSearchBar } from "@/app/common/ui/controls/picker-search-bar";
import { DownloadIcon } from "@/app/common/ui/primitives/icons";
import { ImportModal } from "@/features/importer";
import { CardsCollectionTab } from "./components/cards-collection-tab";
import { OwnedFirstToggle } from "./components/owned-first-toggle";
import { useSupportsCollectionViewModel } from "./view-models/use-supports-collection-view-model";

export function SupportsView() {
  const { state, commands } = useSupportsCollectionViewModel();
  const {
    cards,
    loading,
    query,
    cardType,
    cardRarity,
    ownedFirst,
    isImportModalOpen,
    filteredCards,
    totalOwned,
    mlbCount,
    getLimitBreak,
  } = state;

  const {
    setQuery,
    setCardType,
    setCardRarity,
    setOwnedFirst,
    openImportModal,
    closeImportModal,
    setLimitBreak,
    removeCard,
  } = commands;

  return (
    <>
      <div className="relative">
        {!loading && (
          <section className="flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Supports</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Browse every support card and record limit breaks for your own collection.
              </p>
            </div>
            <AppButton variant="secondary" onPress={openImportModal} className="flex items-center gap-1.5">
              <DownloadIcon className="h-4 w-4" /> Sync / Import Data
            </AppButton>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Owned:</span>
              <strong>{totalOwned} / {cards.length}</strong>
              <span className="text-zinc-400">· MLB: {mlbCount}</span>
            </div>
            <OwnedFirstToggle isSelected={ownedFirst} onChange={setOwnedFirst} controls="supports-results" />
          </div>

          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
            <PickerSearchBar
              value={query}
              onChange={setQuery}
              label="Search support cards"
              placeholder="Search cards by character, title, or Japanese name..."
            />
          </div>

          <CardsCollectionTab
            filteredCards={filteredCards}
            cardType={cardType}
            onCardTypeChange={setCardType}
            cardRarity={cardRarity}
            onCardRarityChange={setCardRarity}
            getLimitBreak={getLimitBreak}
            onSetLimitBreak={setLimitBreak}
            onRemoveCard={removeCard}
            ownedFirst={ownedFirst}
          />
          </section>
        )}
        <LoadingAnimation active={loading} label="Loading support cards..." />
      </div>

      <ImportModal isOpen={isImportModalOpen} onClose={closeImportModal} />
    </>
  );
}
