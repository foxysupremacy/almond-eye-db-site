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

type CharacterSortMode = "release" | "distance" | "style";

const APTITUDE_SORT_GROUPS = {
  distance: [2, 3, 4, 5],
  style: [6, 7, 8, 9],
} as const;

function compareByAptitudeGroup(a: CharacterIndexEntry, b: CharacterIndexEntry, indices: readonly number[]) {
  const key = (character: CharacterIndexEntry) => {
    const grades = indices.map((index) => (character.aptitude?.[index] || "-").toUpperCase());
    const aIndex = grades.findIndex((grade) => grade === "A");
    const bestIndex = aIndex >= 0 ? aIndex : grades.findIndex((grade) => grade !== "-");
    const gradeRank = { S: 0, A: 1, B: 2, C: 3, D: 4 } as Record<string, number>;
    const bestGrade = bestIndex >= 0 ? gradeRank[grades[bestIndex]] ?? 9 : 9;
    return [bestIndex >= 0 ? bestIndex : indices.length, bestGrade] as const;
  };

  const [aIndex, aGrade] = key(a);
  const [bIndex, bGrade] = key(b);
  return aIndex - bIndex || aGrade - bGrade;
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
  const [sortMode, setSortMode] = useState<CharacterSortMode>("release");

  const sortedCharacters = useMemo(() => {
    return [...filteredCharacters].sort((a, b) => {
      if (sortMode === "release") {
        const releaseOrder = (b.release || "").localeCompare(a.release || "");
        return releaseOrder || a.nameEn.localeCompare(b.nameEn) || a.id - b.id;
      }

      const aptitudeOrder = compareByAptitudeGroup(
        a,
        b,
        APTITUDE_SORT_GROUPS[sortMode],
      );
      return aptitudeOrder || (b.release || "").localeCompare(a.release || "") || a.nameEn.localeCompare(b.nameEn);
    });
  }, [filteredCharacters, sortMode]);

  const ownedCharacters = useMemo(() => {
    return sortedCharacters.filter((c) => getUmaDetails(c.id) !== undefined);
  }, [sortedCharacters, getUmaDetails]);

  const unownedCharacters = useMemo(() => {
    return sortedCharacters.filter((c) => getUmaDetails(c.id) === undefined);
  }, [sortedCharacters, getUmaDetails]);

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

        <div className="flex items-center gap-2">
          <label htmlFor="character-sort" className="text-xs text-zinc-400">Sort:</label>
          <select
            id="character-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as CharacterSortMode)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="release">Release: Newest</option>
            <option value="distance">Distance: Aptitude A</option>
            <option value="style">Style: Aptitude A</option>
          </select>
          <span className="text-xs text-zinc-400">
            {sortedCharacters.length} / {totalCharactersCount}
          </span>
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
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3.5 md:grid-cols-5 lg:grid-cols-6">
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
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3.5 md:grid-cols-5 lg:grid-cols-6">
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
