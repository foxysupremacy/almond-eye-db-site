"use client";

import { AppSelect } from "@/app/common/ui/controls/app-select";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { PickerSearchBar } from "@/app/common/ui/controls/picker-search-bar";
import { FileTrigger } from "react-aria-components/FileTrigger";
import { DownloadIcon, LineageIcon, TrophyIcon } from "@/app/common/ui/primitives/icons";

import { useState, useEffect, useMemo, useTransition } from "react";
import { api, type CharacterIndexEntry } from "@/lib/api";
import { getAllVeterans, saveVeterans, clearVeterans } from "@/lib/IndexDB/veterans-db";
import { type KyumaruVeteranItem } from "@/lib/veterans/types";
import { calculateLineageBlueStars } from "@/lib/lineage/factor-decoder";
import { calculateAffinity } from "@/lib/lineage/affinity-engine";
import { useParentingSetup } from "@/features/parenting/hooks";
import { useDeck } from "@/features/deck/state";
import { getPvpRaceParameters } from "@/lib/pvp/events";
import {
  isRankInParentRange,
  loadParentManualOverrides,
  saveParentManualOverrides,
  getVeteranKey,
  extractActiveParentTargetSkills,
  evaluateVeteranTargetFactors,
  type VeteranTargetFactorMatch,
} from "@/lib/lineage/parent-factor-matcher";
import { ImportModal } from "@/features/importer";
import TrainedUmaModal from "@/features/veterans/components/trained-uma-modal";
import { TrainedUmaCard } from "@/features/veterans/components/trained-uma-card";
import { Badge } from "@/app/common/ui/primitives/badge";

type SortOption =
  | "newest"
  | "rank_score"
  | "affinity"
  | "speed"
  | "stamina"
  | "power"
  | "blue_stars"
  | "target_factors";

export default function VeteransView() {
  const [veterans, setVeterans] = useState<KyumaruVeteranItem[]>([]);
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [minBlueStars, setMinBlueStars] = useState<number>(0);
  const [onlyParents, setOnlyParents] = useState(false);
  const [parentOverrides, setParentOverrides] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const { setup } = useParentingSetup();
  const { parentSkills, course, runningStyle, activeRaceParameters } = useDeck();

  const [selectedVeteran, setSelectedVeteran] = useState<KyumaruVeteranItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [vets, charas] = await Promise.all([getAllVeterans(), api.listCharacters()]);
      setVeterans(vets);
      setCharacters(charas);
    } catch (err) {
      console.error("Failed to load veterans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setParentOverrides(loadParentManualOverrides());

    const handleUpdate = () => {
      startTransition(() => {
        loadData();
      });
    };

    window.addEventListener("almondeye_veterans_updated", handleUpdate);
    return () => {
      window.removeEventListener("almondeye_veterans_updated", handleUpdate);
    };
  }, []);

  const isParent = (vet: KyumaruVeteranItem): boolean => {
    const key = getVeteranKey(vet);
    if (parentOverrides[key] !== undefined) {
      return parentOverrides[key];
    }
    return isRankInParentRange(vet.rank, vet.rank_score);
  };

  const handleToggleParent = (vet: KyumaruVeteranItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = getVeteranKey(vet);
    const currentlyParent = isParent(vet);
    setParentOverrides((prev) => {
      const next = { ...prev, [key]: !currentlyParent };
      saveParentManualOverrides(next);
      return next;
    });
  };

  const raceParams = activeRaceParameters;

  const activeTargetSkillsMap = useMemo(() => {
    return extractActiveParentTargetSkills(parentSkills, course, runningStyle, raceParams);
  }, [parentSkills, course, runningStyle, raceParams]);

  const hasTargetSkills = activeTargetSkillsMap.size > 0;

  const targetFactorMatchMap = useMemo(() => {
    const map = new Map<string, VeteranTargetFactorMatch>();
    if (activeTargetSkillsMap.size === 0) return map;
    for (const vet of veterans) {
      const key = getVeteranKey(vet);
      map.set(key, evaluateVeteranTargetFactors(vet, activeTargetSkillsMap));
    }
    return map;
  }, [veterans, activeTargetSkillsMap]);

  const parentCount = useMemo(() => {
    return veterans.filter(isParent).length;
  }, [veterans, parentOverrides]);

  // Character Map for O(1) lookup
  const charaMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
  }, [characters]);

  // Filter and sort individual veteran runs (default: newest trained first)
  const filteredVeterans = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = veterans.filter((vet) => {
      if (onlyParents && !isParent(vet)) {
        return false;
      }

      const chara = charaMap.get(vet.card_id);
      const nameEn = (chara?.nameEn || vet.name || "").toLowerCase();
      const nameJp = (chara?.nameJp || "").toLowerCase();
      const titleEn = (chara?.titleEn || chara?.titleJp || "").toLowerCase();

      if (q && !nameEn.includes(q) && !nameJp.includes(q) && !titleEn.includes(q)) {
        return false;
      }

      if (minBlueStars > 0) {
        const lineage = calculateLineageBlueStars(vet);
        if (lineage.total < minBlueStars) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (sortBy === "target_factors") {
        const keyA = getVeteranKey(a);
        const keyB = getVeteranKey(b);
        const matchA = targetFactorMatchMap.get(keyA)?.count || 0;
        const matchB = targetFactorMatchMap.get(keyB)?.count || 0;
        return matchB - matchA || (b.rank_score || 0) - (a.rank_score || 0);
      }

      if (sortBy === "newest") {
        const timeA = a.create_time ? new Date(a.create_time.replace(" ", "T")).getTime() : 0;
        const timeB = b.create_time ? new Date(b.create_time.replace(" ", "T")).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.trained_chara_id || 0) - (a.trained_chara_id || 0);
      }

      if (sortBy === "affinity" && setup.targetCharaId) {
        const aAff = calculateAffinity(a, setup.targetCharaId).total;
        const bAff = calculateAffinity(b, setup.targetCharaId).total;
        return bAff - aAff || (b.rank_score || 0) - (a.rank_score || 0);
      }

      if (sortBy === "blue_stars") {
        const aStars = calculateLineageBlueStars(a).total;
        const bStars = calculateLineageBlueStars(b).total;
        return bStars - aStars || (b.rank_score || 0) - (a.rank_score || 0);
      }

      if (sortBy === "speed") return b.speed - a.speed;
      if (sortBy === "stamina") return b.stamina - a.stamina;
      if (sortBy === "power") return b.power - a.power;

      return (b.rank_score || 0) - (a.rank_score || 0);
    });

    return filtered;
  }, [
    veterans,
    charaMap,
    query,
    sortBy,
    minBlueStars,
    setup.targetCharaId,
    onlyParents,
    parentOverrides,
    targetFactorMatchMap,
  ]);

  const handleInspectVeteran = (vet: KyumaruVeteranItem) => {
    setSelectedVeteran(vet);
    setIsDetailModalOpen(true);
  };

  // Handle direct file drag & drop into empty view
  const handleFileDrop = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await saveVeterans(parsed as KyumaruVeteranItem[]);
        loadData();
      } else {
        alert("Expected a valid veterans.json file.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Failed to read JSON: " + message);
    }
  };

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear all uploaded veteran horses?")) {
      await clearVeterans();
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Loading trained veteran horses from local database...</p>
      </div>
    );
  }

  // 1. Empty State (No Veterans uploaded yet)
  if (veterans.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <Badge size="comfortable" tone="emerald" uppercase className="font-bold">
            Hall of Fame
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-2 mb-1">
            Trained Umas (Veterans)
          </h2>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Upload your <code>veterans.json</code> dump generated by the Kyumaru in-game plugin to track and search your Hall of Fame horses.
          </p>
        </div>

        {/* Drag & Drop Card */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleFileDrop(e.dataTransfer.files[0]);
          }}
          className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-10 text-center shadow-xs hover:border-emerald-500 transition-colors cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 text-3xl shadow-2xs">
            <TrophyIcon className="h-8 w-8" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            Drag & Drop veterans.json here
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            Located at <code>%USERPROFILE%\Documents\Kyumaru\veterans.json</code> on your PC.
          </p>

          <div className="flex items-center justify-center gap-3">
            <FileTrigger acceptedFileTypes={[".json"]} onSelect={(files) => { const file = files?.[0]; if (file) handleFileDrop(file); }}>
              <AppButton variant="primary">Select File</AppButton>
            </FileTrigger>

            <AppButton
              variant="secondary"
              onPress={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Open Sync Modal
            </AppButton>
          </div>
        </div>

        {/* Feature Preview Banner */}
        <div className="mt-8 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 text-left text-xs text-zinc-500 space-y-2">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
            What you can do with Trained Umas:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
            <li>Review final stats (Speed, Stamina, Power, Guts, Wit) and evaluation scores.</li>
            <li>Filter by high Blue Stat sparks (3★ Speed / 9★ total blue lineage).</li>
            <li>Inspect acquired skills and inheritance compatibility for future Parent Deck builds.</li>
          </ul>
        </div>

        <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      </div>
    );
  }

  // 2. Active Roster View
  const highestScore = Math.max(...veterans.map((v) => v.rank_score || 0));

  return (
    <section className="flex flex-col gap-6">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Trained Umas (Hall of Fame)
            </h2>
            <Badge size="compact" tone="emerald" className="font-bold">
              {veterans.length} Horses
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Locally stored veteran characters with complete 44 attributes, lineage, and inheritance sparks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AppButton
            variant="secondary"
            onPress={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-950/70 shadow-2xs cursor-pointer transition-colors"
          >
            <DownloadIcon className="h-4 w-4" /> Sync / Upload
          </AppButton>
          <AppButton
            variant="secondary"
            onPress={handleClear}
            className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-red-500 text-xs font-medium cursor-pointer transition-colors"
            title="Clear all trained umas"
          >
            Clear Roster
          </AppButton>
        </div>
      </div>

      {/* Roster Toolbar & Stats Shelf */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 p-3.5 shadow-2xs backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search */}
          <div className="w-full sm:flex-1">
            <PickerSearchBar value={query} onChange={setQuery} placeholder="Search veterans by character name or costume..." />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <span className="text-xs text-zinc-400 shrink-0">Sort:</span>
            <AppSelect
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortOption)}
              className="w-full sm:w-auto"
             label="Sort trained Umas" options={[{ value: "newest", label: "Newest Trained First" }, ...(hasTargetSkills ? [{ value: "target_factors", label: "Target Factors (High to Low)" }] : []), { value: "rank_score", label: "Score (High to Low)" }, ...(setup.targetCharaId ? [{ value: "affinity", label: "Compatibility Affinity (High to Low)" }] : []), { value: "blue_stars", label: "Lineage Blue Stars (High to Low)" }, ...["speed", "stamina", "power"].map(value => ({ value, label: `${value[0].toUpperCase()}${value.slice(1)} (High to Low)` }))]} />
          </div>

          {/* Parent Filter Toggle */}
          <AppButton
            variant="secondary"
            aria-pressed={onlyParents}
            onPress={() => setOnlyParents((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              onlyParents
                ? "bg-emerald-600 text-white shadow-xs"
                : "border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-emerald-500/50"
            }`}
            title="Filter roster to show only Parent candidates (Default rank UF–UC9)"
          >
            <LineageIcon className="h-4 w-4" /> Only Parents
            <span
              className="contents"
            >
              <Badge size="compact" tone={onlyParents ? "emerald" : "neutral"} emphasis={onlyParents ? "solid" : "soft"} className="font-bold">
                {parentCount}
              </Badge>
            </span>
          </AppButton>

          {/* Blue Stars Filter */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
            <span className="text-xs text-zinc-400 mr-1">Lineage Blue:</span>
            {([0, 3, 6, 8, 9] as const).map((stars) => (
              <AppButton
                key={stars}
                aria-pressed={minBlueStars === stars}
                variant="secondary"
                onPress={() => setMinBlueStars(stars)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  minBlueStars === stars
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {stars === 0 ? "All" : `${stars}★+`}
              </AppButton>
            ))}
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong>{filteredVeterans.length}</strong> of <strong>{veterans.length}</strong> Trained Umas
            </span>
            {hasTargetSkills && (
              <Badge size="compact" tone="emerald" className="font-semibold">
                {activeTargetSkillsMap.size} Target Skills in Parent Deck
              </Badge>
            )}
          </div>
          <span>
            Top Evaluation:{" "}
            <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
              {highestScore.toLocaleString()} pts
            </strong>
          </span>
        </div>
      </div>

      {/* Veterans Grid */}
      {filteredVeterans.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
          No trained umas matched your filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {filteredVeterans.map((vet) => {
            const key = getVeteranKey(vet);
            return (
              <TrainedUmaCard
                key={key}
                veteran={vet}
                character={charaMap.get(vet.card_id)}
                onClick={() => handleInspectVeteran(vet)}
                isParent={isParent(vet)}
                onToggleParent={(e) => handleToggleParent(vet, e)}
                targetFactorMatch={targetFactorMatchMap.get(key)}
                hasTargetSkills={hasTargetSkills}
              />
            );
          })}
        </div>
      )}

      {/* Import Modal */}
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      {/* Trained Uma Detail Inspection Modal */}
      <TrainedUmaModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedVeteran(null);
        }}
        veteran={selectedVeteran}
        character={selectedVeteran ? charaMap.get(selectedVeteran.card_id) : null}
      />
    </section>
  );
}
