"use client";

import { AppButton } from "@/app/common/ui/controls/app-button";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { PickerSearchBar } from "@/app/common/ui/controls/picker-search-bar";
import { DownloadIcon } from "@/app/common/ui/primitives/icons";
import { ImportModal } from "@/features/importer";
import { CharactersCollectionTab } from "./components/characters-collection-tab";
import { OwnedFirstToggle } from "./components/owned-first-toggle";
import { useCharactersCollectionViewModel } from "./view-models/use-characters-collection-view-model";

export function CharactersView() {
  const { state, commands } = useCharactersCollectionViewModel();
  const {
    characters,
    loading,
    query,
    charaRarity,
    ownedFirst,
    isImportModalOpen,
    filteredCharacters,
    totalOwned,
    fiveStarCount,
    getUmaDetails,
  } = state;

  const {
    setQuery,
    setCharaRarity,
    setOwnedFirst,
    openImportModal,
    closeImportModal,
    setUmaDetails,
    removeUma,
  } = commands;

  return (
    <>
      <div className="relative">
        {!loading && (
          <section className="flex flex-col gap-6">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <div>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Characters</h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Browse every playable costume and record stars and awakening for your collection.
                </p>
              </div>
              <AppButton variant="secondary" onPress={openImportModal} className="flex items-center gap-1.5">
                <DownloadIcon className="h-4 w-4" /> Sync / Import Data
              </AppButton>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Owned:</span>
                <strong>{totalOwned} / {characters.length}</strong>
                <span className="text-zinc-400">· Max 5★: {fiveStarCount}</span>
              </div>
              <OwnedFirstToggle isSelected={ownedFirst} onChange={setOwnedFirst} controls="characters-results" />
            </div>

            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
              <PickerSearchBar
                value={query}
                onChange={setQuery}
                label="Search characters"
                placeholder="Search characters by name or costume title..."
              />
            </div>

            <CharactersCollectionTab
              filteredCharacters={filteredCharacters}
              totalCharactersCount={characters.length}
              charaRarity={charaRarity}
              onCharaRarityChange={setCharaRarity}
              getUmaDetails={getUmaDetails}
              onSetUmaDetails={setUmaDetails}
              onRemoveUma={removeUma}
              ownedFirst={ownedFirst}
            />
          </section>
        )}
        <LoadingAnimation active={loading} label="Loading characters..." />
      </div>

      <ImportModal isOpen={isImportModalOpen} onClose={closeImportModal} />
    </>
  );
}
