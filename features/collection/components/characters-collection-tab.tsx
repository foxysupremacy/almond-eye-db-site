"use client";

import { AppSelect } from "@/app/common/ui/controls/app-select";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import type { CharacterIndexEntry } from "@/lib/api";
import { CharacterItem } from "./character-item";
import { orderOwnedFirst } from "@/features/collection/model/filters";

interface CharactersCollectionTabProps {
  filteredCharacters: CharacterIndexEntry[];
  totalCharactersCount: number;
  charaRarity: number | "all";
  onCharaRarityChange: (r: number | "all") => void;
  getUmaDetails: (charaId: number) => [number, number] | undefined;
  onSetUmaDetails: (charaId: number, stars: number, talent: number) => void;
  onRemoveUma: (charaId: number) => void;
  ownedFirst: boolean;
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
  ownedFirst,
}: CharactersCollectionTabProps) {
  const [sortMode, setSortMode] = useState<CharacterSortMode>("release");
  const router = useRouter();

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

  const displayedCharacters = useMemo(
    () => orderOwnedFirst(sortedCharacters, (character) => getUmaDetails(character.id) !== undefined, ownedFirst),
    [getUmaDetails, ownedFirst, sortedCharacters],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Secondary Filters: Initial Stars */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        <ToggleButtonGroup aria-label="Character initial stars" selectionMode="single" disallowEmptySelection selectedKeys={new Set([String(charaRarity)])} onSelectionChange={(keys) => { const key = [...keys][0]; if (key !== undefined) onCharaRarityChange(key === "all" ? "all" : Number(key)); }} className="inline-flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          <span className="text-xs text-zinc-400 px-1">Stars:</span>
          {([
            { r: "all", label: "All" },
            { r: 3, label: "3★" },
            { r: 2, label: "2★" },
            { r: 1, label: "1★" },
          ] as const).map((rItem) => (
            <ToggleButton
              id={String(rItem.r)}
              key={String(rItem.r)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 transition-colors ${
                charaRarity === rItem.r
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-100 font-bold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {rItem.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <div className="flex items-center gap-2">
          <label htmlFor="character-sort" className="text-xs text-zinc-400">Sort:</label>
          <AppSelect
            id="character-sort"
            value={sortMode}
            onValueChange={(value) => setSortMode(value as CharacterSortMode)}
            className=""
           label="Sort characters" options={[{ value: "release", label: "Release: Newest" }, { value: "distance", label: "Distance: Aptitude A" }, { value: "style", label: "Style: Aptitude A" }]} />
          <span className="text-xs text-zinc-400">
            {sortedCharacters.length} / {totalCharactersCount}
          </span>
        </div>
      </div>

      {/* Characters Grid */}
      {filteredCharacters.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
          No characters matched your filter criteria.
        </div>
      ) : (
          <div id="characters-results" className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3.5 md:grid-cols-5 lg:grid-cols-6">
            {displayedCharacters.map((character) => (
              <CharacterItem
                key={character.id}
                character={character}
                details={getUmaDetails(character.id)}
                onSelect={(selected) => router.push(`/characters/${selected.id}`)}
              />
            ))}
          </div>
      )}

    </div>
  );
}
