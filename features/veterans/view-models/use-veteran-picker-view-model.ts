"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { CharacterIndexEntry } from "@/lib/api";
import { getCharacterImageUrl } from "@/lib/api";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import {
  calculateAffinity,
  countSharedG1Wins,
  getCharaIdFromCardId,
} from "@/lib/lineage/affinity-engine";
import { calculateLineageBlueStars } from "@/lib/lineage/factor-decoder";
import type { LegacyUniqueEval } from "@/lib/parenting/types";
import { getParentInheritedUnique } from "@/lib/parenting/unique-effect-filter";
import { getCareerG1Saddles } from "@/lib/parenting/career-engine";
import { useOwnedUmas } from "@/app/common/hooks/use-owned-umas";
import { useDeckTrack } from "@/features/deck/state";
import {
  type VeteranPickerSort,
  type WhiteUniqueInfo,
} from "@/features/veterans/model/picker-utils";
import {
  projectCharacterTemplates,
  projectOwnedUmaEntries,
  projectVeteranGroups,
  type OwnedUmaEntry,
} from "@/features/veterans/model/picker-projections";
import { usePickerController } from "@/app/common/hooks/use-picker-controller";
import {
  veteranPickerAdapter,
  type VeteranPickerTab,
  type VeteranPickerInput,
} from "@/features/veterans/model/picker-state";
import { queryVeteranEvaluation } from "../workers/veteran-evaluation-client";
import type { Course } from "@/lib/skill-engine/types";
import type { RunningStyle } from "@/lib/deck/types";

export interface ActiveTabProjection {
  eligibleCardIds: Set<number>;
  uniqueEvalByCardId: Map<number, LegacyUniqueEval>;
  ownedUmaEntries: OwnedUmaEntry[];
  unifiedVeterans: ReturnType<typeof projectVeteranGroups>;
  processedTemplates: CharacterIndexEntry[];
}

export const EMPTY_ACTIVE_TAB_PROJECTION: ActiveTabProjection = {
  eligibleCardIds: new Set(),
  uniqueEvalByCardId: new Map(),
  ownedUmaEntries: [],
  unifiedVeterans: [],
  processedTemplates: [],
};

const SORT_STORAGE_KEY = "almond_parent_picker_sort";
const TAB_STORAGE_KEY = "almond_parent_picker_tab";

function loadSort(minmaxEnabled = false): VeteranPickerSort {
  try {
    const v = localStorage.getItem(SORT_STORAGE_KEY);
    if (v === "minmax" && minmaxEnabled) return v;
    if (
      v === "affinity" ||
      v === "rank_score" ||
      v === "blue_stars" ||
      v === "skill_effect" ||
      v === "unique_tier"
    ) {
      return v;
    }
  } catch {}
  return minmaxEnabled ? "minmax" : "affinity";
}

function loadTab(): VeteranPickerTab {
  try {
    const v = localStorage.getItem(TAB_STORAGE_KEY);
    if (v === "recommended" || v === "owned" || v === "veterans" || v === "templates") {
      return v;
    }
  } catch {}
  return "veterans";
}

function activeTabEvaluationKey({
  activeTab,
  targetCharaId,
  excludedCharId,
  contextParent,
  courseId,
  runningStyle,
  veterans,
  characters,
  ownedUmas,
}: {
  activeTab: VeteranPickerTab;
  targetCharaId: number | null;
  excludedCharId?: number | null;
  contextParent?: KyumaruVeteranItem | null;
  courseId?: number;
  runningStyle: unknown;
  veterans: KyumaruVeteranItem[];
  characters: CharacterIndexEntry[];
  ownedUmas: Record<string, unknown>;
}): string {
  const contextId = contextParent?.card_id ?? "none";
  const excluded = excludedCharId ?? "none";
  const target = targetCharaId ?? "none";
  const course = courseId ?? "none";
  const style = runningStyle ?? "none";

  if (activeTab === "veterans") {
    return `tab=veterans|target=${target}|ex=${excluded}|ctx=${contextId}|course=${course}|style=${style}|len=${veterans.length}`;
  }
  if (activeTab === "owned") {
    const ownedKeys = Object.keys(ownedUmas).sort().join(",");
    return `tab=owned|target=${target}|ex=${excluded}|ctx=${contextId}|course=${course}|style=${style}|owned=${ownedKeys}`;
  }
  if (activeTab === "templates") {
    return `tab=templates|target=${target}|ex=${excluded}|ctx=${contextId}|course=${course}|style=${style}|chars=${characters.length}`;
  }
  return `tab=recommended|target=${target}|ex=${excluded}|ctx=${contextId}|course=${course}|style=${style}`;
}

const MAX_PROJECTION_CACHE_ENTRIES = 12;

function cacheProjection<T>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_PROJECTION_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

function resolveWhiteUnique(cardId: number, characterMap: Map<number, CharacterIndexEntry>): WhiteUniqueInfo | null {
  const character = characterMap.get(cardId);
  const skill = getParentInheritedUnique(character?.uniqueSkillId);
  if (!skill) return null;
  return {
    skillId: skill.id,
    nameEn: skill.nameEn || skill.nameJp,
    nameJp: skill.nameJp,
    rarity: skill.rarity,
    iconId: skill.iconId ?? null,
  };
}

export interface UseVeteranPickerViewModelOptions {
  isOpen: boolean;
  targetCharaId: number | null;
  excludedCharId?: number | null;
  contextParent?: KyumaruVeteranItem | null;
  veterans: KyumaruVeteranItem[];
  characters: CharacterIndexEntry[];
  minmaxEnabled?: boolean;
  initialTab?: VeteranPickerTab;
}

export interface VeteranPickerViewModelState {
  readonly activeTab: VeteranPickerTab;
  readonly sortBy: VeteranPickerSort;
  readonly search: string;
  readonly normalizedSearch: string;
  readonly activeTabProjection: ActiveTabProjection;
  readonly isProjectionReady: boolean;
  readonly evaluationError: string | null;
  readonly charaMap: Map<number, CharacterIndexEntry>;
  readonly course: Course | null;
  readonly runningStyle: RunningStyle | null;
  readonly expandedCharId: number | null;
}

export interface VeteranPickerViewModelCommands {
  readonly setActiveTab: (tab: VeteranPickerTab) => void;
  readonly setSortBy: (sort: VeteranPickerSort) => void;
  readonly setSearch: (search: string) => void;
  readonly setExpandedCharId: (id: number | null | ((prev: number | null) => number | null)) => void;
}

export interface VeteranPickerViewModel {
  readonly state: VeteranPickerViewModelState;
  readonly commands: VeteranPickerViewModelCommands;
}

export function useVeteranPickerViewModel({
  isOpen,
  targetCharaId,
  excludedCharId,
  contextParent,
  veterans,
  characters,
  minmaxEnabled = false,
  initialTab,
}: UseVeteranPickerViewModelOptions): VeteranPickerViewModel {
  const initialPickerInput = useMemo<VeteranPickerInput>(() => ({
    initialTab: initialTab ?? (minmaxEnabled ? "recommended" : loadTab()),
    initialSort: loadSort(minmaxEnabled),
    recommendationsAvailable: true,
  }), [initialTab, minmaxEnabled]);

  const { state: pickerState, dispatch } = usePickerController(veteranPickerAdapter, initialPickerInput);
  const { activeTab, sortBy, search } = pickerState;
  const normalizedSearch = useMemo(() => search.trim().toLowerCase(), [search]);

  useEffect(() => {
    if (!isOpen || !initialTab) return;
    dispatch({ type: "tabSelected", tab: initialTab });
  }, [isOpen, initialTab, dispatch]);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, pickerState.activeTab);
    } catch {}
  }, [pickerState.activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, pickerState.sortBy);
    } catch {}
  }, [pickerState.sortBy]);

  const { course, runningStyle } = useDeckTrack();
  const { ownedUmas } = useOwnedUmas();
  const [expandedCharId, setExpandedCharId] = useState<number | null>(null);

  const charaMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
  }, [characters]);

  const projectionDependencies = useMemo(() => ({
    getCharaIdFromCardId,
    getCareerG1Saddles,
    calculateAffinity: (veteran: { card_id: number; win_saddle_id_array?: number[] }, targetId: number) =>
      calculateAffinity(veteran, targetId),
    countSharedG1Wins,
    calculateBlueStars: (veteran: KyumaruVeteranItem) => calculateLineageBlueStars(veteran).total,
    getCharacterImageUrl,
    resolveWhiteUnique: (cardId: number) => resolveWhiteUnique(cardId, charaMap),
  }), [charaMap]);

  const evaluationCacheRef = useRef(new Map<string, Pick<ActiveTabProjection, "eligibleCardIds" | "uniqueEvalByCardId">>());
  const projectionCacheRef = useRef(new Map<string, ActiveTabProjection>());

  const evaluationKey = useMemo(() => {
    if (!isOpen || activeTab === "recommended") return null;
    return activeTabEvaluationKey({
      activeTab,
      targetCharaId,
      excludedCharId,
      contextParent,
      courseId: course?.id,
      runningStyle,
      veterans,
      characters,
      ownedUmas,
    });
  }, [isOpen, activeTab, targetCharaId, excludedCharId, contextParent, course?.id, runningStyle, veterans, characters, ownedUmas]);

  const projectionKey = evaluationKey === null ? null : `${evaluationKey}|${sortBy}|${normalizedSearch}`;
  const activeCardIds = useMemo(() => activeTab === "veterans" ? veterans.map((vet) => vet.card_id)
    : activeTab === "owned" ? Object.keys(ownedUmas).map(Number)
    : activeTab === "templates" ? characters.map((character) => character.id)
    : [], [activeTab, veterans, ownedUmas, characters]);

  const [readyEvaluationKey, setReadyEvaluationKey] = useState<string | null>(null);
  const [evaluationError, setEvaluationError] = useState<{ key: string; message: string } | null>(null);
  const isProjectionReady = evaluationKey !== null && readyEvaluationKey === evaluationKey;

  // Uses persistent Worker singleton instead of spawning new Worker()
  useEffect(() => {
    if (!evaluationKey) {
      setReadyEvaluationKey(null);
      setEvaluationError(null);
      return;
    }
    setEvaluationError(null);
    const cached = evaluationCacheRef.current.get(evaluationKey);
    if (cached) {
      const frame = window.requestAnimationFrame(() => setReadyEvaluationKey(evaluationKey));
      return () => window.cancelAnimationFrame(frame);
    }

    const cancel = queryVeteranEvaluation(
      {
        cardIds: activeCardIds,
        course: course ?? null,
        runningStyle,
      },
      {
        onResult: ({ eligibleCardIds, uniqueEvals }) => {
          cacheProjection(evaluationCacheRef.current, evaluationKey, {
            eligibleCardIds: new Set(eligibleCardIds),
            uniqueEvalByCardId: new Map(uniqueEvals),
          });
          setReadyEvaluationKey(evaluationKey);
        },
        onError: (err) => {
          setEvaluationError({ key: evaluationKey, message: err });
        },
      },
    );

    return () => {
      cancel();
    };
  }, [evaluationKey, activeCardIds, course, runningStyle]);

  const activeTabProjection = useMemo(() => {
    if (!projectionKey || !isProjectionReady) return EMPTY_ACTIVE_TAB_PROJECTION;
    const cached = projectionCacheRef.current.get(projectionKey);
    if (cached) return cached;

    const evaluation = evaluationCacheRef.current.get(evaluationKey!);
    if (!evaluation) return EMPTY_ACTIVE_TAB_PROJECTION;

    const base: ActiveTabProjection = {
      ...evaluation,
      ownedUmaEntries: [],
      unifiedVeterans: [],
      processedTemplates: [],
    };
    if (activeTab === "owned") {
      base.ownedUmaEntries = projectOwnedUmaEntries({
        ownedUmas,
        charactersByCardId: charaMap,
        veterans,
        targetCharaId,
        excludedCharId,
        contextParent,
        search: normalizedSearch,
        sortBy,
        uniqueEvalByCardId: base.uniqueEvalByCardId,
        eligibleCardIds: base.eligibleCardIds,
        dependencies: projectionDependencies,
      });
    } else if (activeTab === "veterans") {
      base.unifiedVeterans = projectVeteranGroups({
        veterans,
        charactersByCardId: charaMap,
        targetCharaId,
        excludedCharId,
        search: normalizedSearch,
        sortBy,
        uniqueEvalByCardId: base.uniqueEvalByCardId,
        eligibleCardIds: base.eligibleCardIds,
        dependencies: projectionDependencies,
      });
    } else if (activeTab === "templates") {
      base.processedTemplates = projectCharacterTemplates({
        characters,
        targetCharaId,
        excludedCharId,
        search: normalizedSearch,
        sortBy,
        uniqueEvalByCardId: base.uniqueEvalByCardId,
        eligibleCardIds: base.eligibleCardIds,
        calculateAffinity: (cardId, targetId) => calculateAffinity({ card_id: cardId }, targetId).total,
      });
    }

    cacheProjection(projectionCacheRef.current, projectionKey, base);
    return base;
  }, [
    projectionKey,
    isProjectionReady,
    evaluationKey,
    activeTab,
    ownedUmas,
    charaMap,
    veterans,
    targetCharaId,
    excludedCharId,
    contextParent,
    normalizedSearch,
    sortBy,
    characters,
    projectionDependencies,
  ]);

  const setActiveTab = useCallback((tab: VeteranPickerTab) => {
    dispatch({ type: "tabSelected", tab });
  }, [dispatch]);

  const setSortBy = useCallback((sort: VeteranPickerSort) => {
    dispatch({ type: "sortChanged", value: sort });
  }, [dispatch]);

  const setSearch = useCallback((query: string) => {
    dispatch({ type: "searchChanged", value: query });
  }, [dispatch]);

  return {
    state: {
      activeTab,
      sortBy,
      search,
      normalizedSearch,
      activeTabProjection,
      isProjectionReady,
      evaluationError: evaluationError?.message ?? null,
      charaMap,
      course,
      runningStyle,
      expandedCharId,
    },
    commands: {
      setActiveTab,
      setSortBy,
      setSearch,
      setExpandedCharId,
    },
  };
}
