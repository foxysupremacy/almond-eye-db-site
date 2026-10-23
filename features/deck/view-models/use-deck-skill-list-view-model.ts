import { useState, useEffect, useMemo, useCallback } from "react";
import { useDeck } from "@/features/deck/state";
import type { DeckSkill } from "@/lib/deck/types";
import {
  matchesRarityFilter,
  type RarityFilterKey,
} from "@/lib/skills/rarity";
import { deriveSkillsForDeck } from "@/lib/deck/skill-resolver";
import { buildDuplicateSkillIndex, getDuplicateSkillIds } from "@/lib/skills/duplicates";
import type { CardIndexEntry } from "@/lib/api";

export interface GroupedCardSkills {
  readonly card: CardIndexEntry;
  readonly slotIndex: number;
  readonly skills: readonly DeckSkill[];
}

export interface DeckSkillListViewModelState {
  readonly mainSkills: readonly DeckSkill[];
  readonly mainSlots: readonly (CardIndexEntry | null)[];
  readonly loading: boolean;
  readonly runningStyle: number | null;
  readonly sourceFilter: "all" | "event" | "hint";
  readonly rarityFilter: RarityFilterKey;
  readonly viewMode: "list" | "card";
  readonly search: string;
  readonly hasDeck: boolean;
  readonly whiteCount: number;
  readonly goldCount: number;
  readonly uniqueCount: number;
  readonly evolvedCount: number;
  readonly filtered: readonly DeckSkill[];
  readonly cardSkillsMap: ReadonlyMap<number, DeckSkill[]>;
  readonly groupedCards: readonly GroupedCardSkills[];
  readonly duplicateSkillCardsMap: ReturnType<typeof buildDuplicateSkillIndex>;
  readonly duplicateSkillIdSet: ReadonlySet<number>;
}

export interface DeckSkillListViewModelCommands {
  readonly setSourceFilter: (filter: "all" | "event" | "hint") => void;
  readonly setRarityFilter: (filter: RarityFilterKey) => void;
  readonly setViewMode: (mode: "list" | "card") => void;
  readonly setSearch: (query: string) => void;
  readonly setRunningStyle: (style: 1 | 2 | 3 | 4 | 5 | null) => void;
}

export interface DeckSkillListViewModel {
  readonly state: DeckSkillListViewModelState;
  readonly commands: DeckSkillListViewModelCommands;
}

export function useDeckSkillListViewModel(): DeckSkillListViewModel {
  const {
    mainSkills,
    mainSlots,
    loading,
    runningStyle,
    setRunningStyle,
    activePreset,
    skillsByCard,
  } = useDeck();

  const [sourceFilter, setSourceFilter] = useState<"all" | "event" | "hint">("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [search, setSearch] = useState("");

  // Remember the skill view mode (Unified List / Group by Card) across visits
  useEffect(() => {
    try {
      const stored = localStorage.getItem("almond_skill_view_mode");
      if (stored === "card" || stored === "list") setViewMode(stored);
    } catch {}
  }, []);

  const handleSetViewMode = useCallback((mode: "list" | "card") => {
    setViewMode(mode);
    try {
      localStorage.setItem("almond_skill_view_mode", mode);
    } catch {}
  }, []);

  // Map each card slot to its exact granted skills (respecting chosen chain branches)
  const cardSkillsMap = useMemo(() => {
    const map = new Map<number, DeckSkill[]>();
    mainSlots.forEach((card) => {
      if (!card) return;
      const cSkills = deriveSkillsForDeck(
        [card],
        false,
        skillsByCard,
        activePreset.mainChainChoices
      );
      map.set(card.id, cSkills);
    });
    return map;
  }, [mainSlots, skillsByCard, activePreset.mainChainChoices]);

  // Map skillId -> all deck cards that provide this skill
  const duplicateSkillCardsMap = useMemo(() => {
    return buildDuplicateSkillIndex(
      mainSlots.flatMap((card) => {
        if (!card) return [];
        return [{
          card: {
            cardId: card.id,
            cardName: card.nameEn || card.nameJp || `Card #${card.id}`,
            cardNameJp: card.nameJp,
            rarity: card.rarity,
            type: card.type,
            portraitUrl: card.portraitUrl,
            imgUrl: card.imgUrl,
          },
          grants: (cardSkillsMap.get(card.id) || []).map((s) => ({
            id: s.id,
            source: s.source,
            eventMeta: s.grants?.find((g) => g.cardId === card.id)?.eventMeta ?? null,
            originalGoldSkill: s.grants?.find((g) => g.cardId === card.id)?.originalGoldSkill,
          })),
        }];
      })
    );
  }, [mainSlots, cardSkillsMap]);

  // Track skills appearing in more than one support card
  const duplicateSkillIdSet = useMemo(() => {
    return getDuplicateSkillIds(duplicateSkillCardsMap);
  }, [duplicateSkillCardsMap]);

  const whiteCount = useMemo(() => mainSkills.filter((s) => (s.rarity ?? 1) === 1).length, [mainSkills]);
  const goldCount = useMemo(() => mainSkills.filter((s) => s.rarity === 2).length, [mainSkills]);
  const uniqueCount = useMemo(() => mainSkills.filter((s) => [3, 4, 5].includes(s.rarity)).length, [mainSkills]);
  const evolvedCount = useMemo(() => mainSkills.filter((s) => s.rarity === 6).length, [mainSkills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mainSkills.filter((s) => {
      if (sourceFilter !== "all" && s.source !== sourceFilter) return false;
      if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;
      if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mainSkills, sourceFilter, rarityFilter, search]);

  const groupedCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mainSlots.flatMap((card, slotIndex) => {
      if (!card) return [];
      const allCardSkills = cardSkillsMap.get(card.id) || [];
      const cFiltered = allCardSkills.filter((s) => {
        if (sourceFilter !== "all" && s.source !== sourceFilter) return false;
        if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;
        if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      });
      return [{
        card,
        slotIndex,
        skills: cFiltered,
      }];
    });
  }, [mainSlots, cardSkillsMap, sourceFilter, rarityFilter, search]);

  const hasDeck = useMemo(() => mainSlots.some(Boolean), [mainSlots]);

  return {
    state: {
      mainSkills,
      mainSlots,
      loading,
      runningStyle,
      sourceFilter,
      rarityFilter,
      viewMode,
      search,
      hasDeck,
      whiteCount,
      goldCount,
      uniqueCount,
      evolvedCount,
      filtered,
      cardSkillsMap,
      groupedCards,
      duplicateSkillCardsMap,
      duplicateSkillIdSet,
    },
    commands: {
      setSourceFilter,
      setRarityFilter,
      setViewMode: handleSetViewMode,
      setSearch,
      setRunningStyle,
    },
  };
}
