"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { PickerSearchBar } from "@/app/common/ui/controls/picker-search-bar";
import { DownloadIcon } from "@/app/common/ui/primitives/icons";
import { useOwnedUmas } from "@/app/common/hooks/use-owned-umas";
import { api, type CharacterIndexEntry } from "@/lib/api";
import { ImportModal } from "@/features/importer";
import { CharactersCollectionTab } from "./components/characters-collection-tab";
import { OwnedFirstToggle } from "./components/owned-first-toggle";
import { filterCollectionCharacters } from "./model/filters";

export function CharactersView() {
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [charaRarity, setCharaRarity] = useState<number | "all">("all");
  const [ownedFirst, setOwnedFirst] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const { getUmaDetails, setUmaDetails, removeUma, totalOwned, fiveStarCount } = useOwnedUmas();

  useEffect(() => {
    api.listCharacters().then(setCharacters).catch((error) => console.error("Failed to load characters:", error)).finally(() => setLoading(false));
  }, []);

  const filteredCharacters = useMemo(() => filterCollectionCharacters(characters, query, charaRarity), [characters, charaRarity, query]);

  if (loading) return <div className="flex min-h-64 flex-col items-center justify-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" /><p className="text-xs text-zinc-400">Loading characters...</p></div>;

  return <>
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div><h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Characters</h1><p className="text-xs text-zinc-500 dark:text-zinc-400">Browse every playable costume and record stars and awakening for your collection.</p></div>
        <AppButton variant="secondary" onPress={() => setIsImportModalOpen(true)} className="flex items-center gap-1.5"><DownloadIcon className="h-4 w-4" /> Sync / Import Data</AppButton>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2"><span className="text-zinc-500">Owned:</span><strong>{totalOwned} / {characters.length}</strong><span className="text-zinc-400">· Max 5★: {fiveStarCount}</span></div>
        <OwnedFirstToggle isSelected={ownedFirst} onChange={setOwnedFirst} controls="characters-results" />
      </div>
      <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800/80"><PickerSearchBar value={query} onChange={setQuery} label="Search characters" placeholder="Search characters by name or costume title..." /></div>
      <CharactersCollectionTab filteredCharacters={filteredCharacters} totalCharactersCount={characters.length} charaRarity={charaRarity} onCharaRarityChange={setCharaRarity} getUmaDetails={getUmaDetails} onSetUmaDetails={setUmaDetails} onRemoveUma={removeUma} ownedFirst={ownedFirst} />
    </section>
    <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
  </>;
}
