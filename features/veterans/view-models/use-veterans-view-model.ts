"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import { api, type CharacterIndexEntry } from "@/lib/api";
import { getAllVeterans, saveVeterans, clearVeterans } from "@/lib/IndexDB/veterans-db";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import { calculateLineageBlueStars } from "@/lib/lineage/factor-decoder";
import { calculateAffinity } from "@/lib/lineage/affinity-engine";
import { useParentingSetup } from "@/features/parenting/hooks";
import { useDeckTrack, useDeckSlots } from "@/features/deck/state";
import {
  isRankInParentRange,
  loadParentManualOverrides,
  saveParentManualOverrides,
  getVeteranKey,
  extractActiveParentTargetSkills,
  evaluateVeteranTargetFactors,
  type VeteranTargetFactorMatch,
} from "@/lib/lineage/parent-factor-matcher";

export type VeteranSortOption =
  | "newest"
  | "rank_score"
  | "affinity"
  | "speed"
  | "stamina"
  | "power"
  | "blue_stars"
  | "target_factors";

export interface VeteransViewModelState {
  readonly loading: boolean;
  readonly veterans: KyumaruVeteranItem[];
  readonly characters: CharacterIndexEntry[];
  readonly charaMap: Map<number, CharacterIndexEntry>;
  readonly filteredVeterans: KyumaruVeteranItem[];
  readonly query: string;
  readonly sortBy: VeteranSortOption;
  readonly minBlueStars: number;
  readonly onlyParents: boolean;
  readonly parentCount: number;
  readonly hasTargetSkills: boolean;
  readonly targetFactorMatchMap: Map<string, VeteranTargetFactorMatch>;
  readonly selectedVeteran: KyumaruVeteranItem | null;
  readonly isDetailModalOpen: boolean;
  readonly isImportModalOpen: boolean;
  readonly isParent: (vet: KyumaruVeteranItem) => boolean;
}

export interface VeteransViewModelCommands {
  readonly setQuery: (q: string) => void;
  readonly setSortBy: (sort: VeteranSortOption) => void;
  readonly setMinBlueStars: (stars: number) => void;
  readonly setOnlyParents: (only: boolean | ((prev: boolean) => boolean)) => void;
  readonly toggleParent: (vet: KyumaruVeteranItem, e?: React.MouseEvent) => void;
  readonly inspectVeteran: (vet: KyumaruVeteranItem) => void;
  readonly closeDetailModal: () => void;
  readonly openImportModal: () => void;
  readonly closeImportModal: () => void;
  readonly handleFileDrop: (file: File) => Promise<void>;
  readonly handleClear: () => Promise<void>;
  readonly reload: () => Promise<void>;
}

export interface VeteransViewModel {
  readonly state: VeteransViewModelState;
  readonly commands: VeteransViewModelCommands;
}

export function useVeteransViewModel(): VeteransViewModel {
  const [veterans, setVeterans] = useState<KyumaruVeteranItem[]>([]);
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<VeteranSortOption>("newest");
  const [minBlueStars, setMinBlueStars] = useState<number>(0);
  const [onlyParents, setOnlyParents] = useState(false);
  const [parentOverrides, setParentOverrides] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const { setup } = useParentingSetup();
  const { parentSkills } = useDeckSlots();
  const { course, runningStyle, activeRaceParameters } = useDeckTrack();

  const [selectedVeteran, setSelectedVeteran] = useState<KyumaruVeteranItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [vets, charas] = await Promise.all([getAllVeterans(), api.listCharacters()]);
      setVeterans(vets);
      setCharacters(charas);
    } catch (err) {
      console.error("Failed to load veterans:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [loadData]);

  const isParent = useCallback((vet: KyumaruVeteranItem): boolean => {
    const key = getVeteranKey(vet);
    if (parentOverrides[key] !== undefined) {
      return parentOverrides[key];
    }
    return isRankInParentRange(vet.rank, vet.rank_score);
  }, [parentOverrides]);

  const toggleParent = useCallback((vet: KyumaruVeteranItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const key = getVeteranKey(vet);
    const currentlyParent = isParent(vet);
    setParentOverrides((prev) => {
      const next = { ...prev, [key]: !currentlyParent };
      saveParentManualOverrides(next);
      return next;
    });
  }, [isParent]);

  const activeTargetSkillsMap = useMemo(() => {
    return extractActiveParentTargetSkills(parentSkills, course, runningStyle, activeRaceParameters);
  }, [parentSkills, course, runningStyle, activeRaceParameters]);

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
  }, [veterans, isParent]);

  const charaMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
  }, [characters]);

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
    isParent,
    targetFactorMatchMap,
  ]);

  const inspectVeteran = useCallback((vet: KyumaruVeteranItem) => {
    setSelectedVeteran(vet);
    setIsDetailModalOpen(true);
  }, []);

  const closeDetailModal = useCallback(() => {
    setIsDetailModalOpen(false);
  }, []);

  const openImportModal = useCallback(() => {
    setIsImportModalOpen(true);
  }, []);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
  }, []);

  const handleFileDrop = useCallback(async (file: File) => {
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
  }, [loadData]);

  const handleClear = useCallback(async () => {
    if (confirm("Are you sure you want to clear all uploaded veteran horses?")) {
      await clearVeterans();
      loadData();
    }
  }, [loadData]);

  return {
    state: {
      loading,
      veterans,
      characters,
      charaMap,
      filteredVeterans,
      query,
      sortBy,
      minBlueStars,
      onlyParents,
      parentCount,
      hasTargetSkills,
      targetFactorMatchMap,
      selectedVeteran,
      isDetailModalOpen,
      isImportModalOpen,
      isParent,
    },
    commands: {
      setQuery,
      setSortBy,
      setMinBlueStars,
      setOnlyParents,
      toggleParent,
      inspectVeteran,
      closeDetailModal,
      openImportModal,
      closeImportModal,
      handleFileDrop,
      handleClear,
      reload: loadData,
    },
  };
}
