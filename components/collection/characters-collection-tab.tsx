"use client";

import { useMemo, useState } from "react";
import type { CharacterIndexEntry } from "../../lib/api";
import { CharacterItem } from "./character-item";
import { CharacterDetailSheet } from "./character-detail-sheet";
import { Badge } from "../shared/badge";

interface CharactersCollectionTabProps {
  filteredCharacters: CharacterIndexEntry[];
  totalCharactersCount: number;
  charaRarity: number | "all";
  onCharaRarityChange: (r: number | "all") => void;
  getUmaDetails: (charaId: number) => [number, number] | undefined;
  onSetUmaDetails: (charaId: number, stars: number, talent: number) => void;
  onRemoveUma: (charaId: number) => void;
}

export function CharactersCollectionTab({
  filteredCharacters,
  totalCharactersCount,
  charaRarity,
  onCharaRarityChange,
  getUmaDetails,
  onSetUmaDetails,
  onRemoveUma,
}: CharactersCollectionTabProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterIndexEntry | null>(null);

  const ownedCharacters = useMemo(() => {
    return filteredCharacters.filter((c) => getUmaDetails(c.id) !== undefined);
  }, [filteredCharacters, getUmaDetails]);

  const unownedCharacters = useMemo(() => {
    return filteredCharacters.filter((c) => getUmaDetails(c.id) === undefined);
  }, [filteredCharacters, getUmaDetails]);

  return (
    <div className="flex flex-col gap-4">
      {/* Secondary Filters: Initial Stars */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-400 mr-1">Initial Stars:</span>
          {([
            { r: "all", label: "All" },
            { r: 3, label: "3★" },
            { r: 2, label: "2★" },
            { r: 1, label: "1★" },
          ] as const).map((rItem) => (
            <button
              key={String(rItem.r)}
              type="button"
              onClick={() => onCharaRarityChange(rItem.r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                charaRarity === rItem.r
                  ? "bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {rItem.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-zinc-400">
          Showing {filteredCharacters.length} of {totalCharactersCount} characters
        </div>
      </div>

      {/* Characters Grid */}
      {filteredCharacters.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
          No characters matched your filter criteria.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Owned Characters Section */}
          {ownedCharacters.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {ownedCharacters.map((chara) => (
                <CharacterItem
                  key={chara.id}
                  character={chara}
                  details={getUmaDetails(chara.id)}
                  onSelect={setSelectedCharacter}
                />
              ))}
            </div>
          )}

          {/* Divider between Owned and Unowned */}
          {ownedCharacters.length > 0 && unownedCharacters.length > 0 && (
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-dashed border-zinc-300 dark:border-zinc-700/80" />
              </div>
              <div className="relative flex justify-center">
                <Badge size="comfortable" tone="neutral" className="bg-white dark:bg-zinc-900 font-semibold shadow-2xs">
                  Unowned Characters ({unownedCharacters.length})
                </Badge>
              </div>
            </div>
          )}

          {/* Unowned Characters Section */}
          {unownedCharacters.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {unownedCharacters.map((chara) => (
                <CharacterItem
                  key={chara.id}
                  character={chara}
                  details={getUmaDetails(chara.id)}
                  onSelect={setSelectedCharacter}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Character Detail Sheet Modal */}
      <CharacterDetailSheet
        character={selectedCharacter}
        isOpen={selectedCharacter !== null}
        onClose={() => setSelectedCharacter(null)}
        details={selectedCharacter ? getUmaDetails(selectedCharacter.id) : undefined}
        onSetUmaDetails={onSetUmaDetails}
        onRemoveUma={onRemoveUma}
      />
    </div>
  );
}
