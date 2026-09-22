"use client";
import { MobileFilters } from "./shared/mobile-filters";

import { useMemo, useState, useEffect } from "react";
import { useDeck } from "./store";
import type { DeckSkill, ParentDeckSkill } from "../lib/deck/types";
import { useParentingSetup } from "../lib/parenting-state";
import { useLineageSkills, type DisplayParentSkill } from "../lib/use-lineage-skills";
import {
  matchesRarityFilter,
  getSkillRarityStyle,
  type RarityFilterKey,
} from "../lib/skill-rarity";
import SkillIcon from "./skill-icon";
import SkillHoverCard from "./skill-hover-card";
import SkillItem from "./skill-item";
import { getCharacterImageUrl } from "../lib/api";
import { getCharaIdFromCardId } from "../lib/affinity-engine";
import { isSkillBanned, getPvpRaceParameters } from "../lib/pvp-events";
import { evaluateSkillActivation, type SkillActivationResult } from "../lib/parenting/skill-evaluator";
import { deriveSkillsForDeck } from "../lib/deck/skill-resolver";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import { RARITY_META } from "../lib/skill-rarity";
import DuplicateSkillBadge from "./duplicate-skill-badge";
import { SkillIndicatorGroup, SkillSourceIcons } from "./shared/skill-badges";
import { Badge } from "./shared/badge";
import { buildDuplicateSkillIndex, getDuplicateSkillIds } from "../lib/skill-duplicates";
import EventChainAttribution from "./event-chain-attribution";

type FilterTab = "all" | "inherit_only" | "unique" | "duplicate" | "parent_duplicate" | "hint" | "event" | "parent_unique" | "factor";
type SourceFilter = "all" | "cards" | "lineage";

export type { DisplayParentSkill };


interface ParentSkillListProps {
  onNavigateToParenting?: () => void;
}

function ParentSkillStatusIndicators({
  banned = false,
  evolved = false,
  evolutionAvailable = false,
  uniqueTarget = false,
  canActivate = true,
  activationReason,
  inMainDeck = false,
  inheritOnly = false,
  density = "compact",
}: {
  banned?: boolean;
  evolved?: boolean;
  evolutionAvailable?: boolean;
  uniqueTarget?: boolean;
  canActivate?: boolean;
  activationReason?: string;
  inMainDeck?: boolean;
  inheritOnly?: boolean;
  density?: "compact" | "standard";
}) {
  return <SkillIndicatorGroup density={density} indicators={[
    ...(banned ? [{ kind: "banned" as const, title: "Banned by Special Rule (No Debuffs) - this skill cannot be used and will not activate" }] : []),
    ...(evolved ? [{ kind: "evolved-inherit" as const, title: "Evolved Inherit: Enhanced succession skill (+0.15 Speed, +0.20 Accel) unlocked via direct Parent" }] : []),
    ...(evolutionAvailable ? [{ kind: "evolution-available" as const, title: "Evolves to enhanced inherit skill (+0.15 Speed, +0.20 Accel) when placed as direct Parent (P1/P2) and owning this character" }] : []),
    ...(uniqueTarget ? [{ kind: "unique-target" as const }] : []),
    ...(!canActivate ? [{ kind: "no-activation" as const, label: activationReason?.toLowerCase().includes("rank") ? "Rank Trap" : undefined, title: activationReason || "This skill cannot activate on the selected course or running style" }] : []),
    ...(inMainDeck ? [{ kind: "in-main-deck" as const }] : []),
    ...(inheritOnly ? [{ kind: "inherit-only" as const, title: "Inherit Only: Cannot be obtained from any Support Card in your decks; only inherited from Uma lineage" }] : []),
  ]} />;
}

export default function ParentSkillList({ onNavigateToParenting }: ParentSkillListProps) {
  const {
    parentSkills,
    parentSlots,
    mainSlots,
    loading,
    activePvpEvent,
    activePreset,
    skillsByCard,
    mainSkillIdSet,
    course,
    runningStyle,
  } = useDeck();
  const { setup } = useParentingSetup();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");
  const [viewMode, setViewMode] = useState<"list" | "card" | "parent">("list");
  // Remember the skill view mode (Unified List / Group by Card / Group by Parent) across visits
  useEffect(() => {
    try {
      const stored = localStorage.getItem("almond_skill_view_mode");
      if (stored === "card" || stored === "parent" || stored === "list") {
        setViewMode(stored);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("almond_skill_view_mode", viewMode);
    } catch {}
  }, [viewMode]);
  const [hideParentDupes, setHideParentDupes] = useState(false);
  const [search, setSearch] = useState("");

  const {
    lineageUniqueSkills,
    bloodlineFactorSkills,
    pedigreeSkills,
    pedigreeSlots,
    charaByCardIdMap,
    p1Chara,
    p2Chara,
  } = useLineageSkills();

  // Map each parent card slot to its exact granted skills (respecting chosen chain branches & white downgrade)
  const parentCardSkillsMap = useMemo(() => {
    const map = new Map<number, DeckSkill[]>();
    parentSlots.forEach((card) => {
      if (!card) return;
      const cSkills = deriveSkillsForDeck(
        [card],
        true,
        skillsByCard,
        activePreset.parentChainChoices
      );
      map.set(card.id, cSkills);
    });
    return map;
  }, [parentSlots, skillsByCard, activePreset.parentChainChoices]);

  // Map skillId -> all parent cards that provide this skill
  const parentDuplicateCardsMap = useMemo(() => {
    return buildDuplicateSkillIndex(
      parentSlots.flatMap((card) => {
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
          grants: (parentCardSkillsMap.get(card.id) || []).map((s) => ({
            id: s.id,
            source: s.source,
            eventMeta: s.grants?.find((g) => g.cardId === card.id)?.eventMeta ?? null,
            originalGoldSkill: s.grants?.find((g) => g.cardId === card.id)?.originalGoldSkill,
          })),
        }];
      })
    );
  }, [parentSlots, parentCardSkillsMap]);

  // Track skills appearing in more than one parent support card
  const parentCardDuplicateSkillIdSet = useMemo(() => {
    return getDuplicateSkillIds(parentDuplicateCardsMap);
  }, [parentDuplicateCardsMap]);

  // Combine All Skills (Support Cards + Full Pedigree Umas + Bloodline Factors)
  const unifiedSkillList: DisplayParentSkill[] = useMemo(() => {
    const byId = new Map<number, DisplayParentSkill>();

    // 1. Support Cards
    parentSkills.forEach((s) => {
      byId.set(s.id, {
        id: s.id,
        nameEn: s.nameEn,
        nameJp: s.nameJp,
        descEn: s.descEn,
        rarity: s.rarity,
        iconId: s.iconId,
        source: s.source === "event" ? "event" : "hint",
        sourceLabel: `Card (${s.cardName})`,
        isUniqueToParent: s.isUniqueToParent,
        isDuplicateInMain: s.isDuplicateInMain,
        isInheritOnly: false,
        parentDuplicateCount: s.parentDuplicateCount,
        originalGoldSkill: s.originalGoldSkill,
        grants: s.grants,
        mainCardGrants: s.mainCardGrants,
      });
    });

    // 2. Pedigree Umas (Uniques, Innate, Awakening, Event skills, Bloodline Factors)
    pedigreeSkills.forEach((ps) => {
      const existing = byId.get(ps.id);
      if (!existing) {
        byId.set(ps.id, { ...ps });
      } else {
        existing.isInheritOnly = false;
        const combinedGrants = [...(existing.grants ?? [])];
        for (const g of ps.grants ?? []) {
          if (!combinedGrants.some((cg) => cg.cardName === g.cardName && cg.source === g.source)) {
            combinedGrants.push(g);
          }
        }
        existing.grants = combinedGrants;
        existing.parentDuplicateCount = combinedGrants.length;
        if (!existing.originalUniqueSkill && ps.originalUniqueSkill) {
          existing.originalUniqueSkill = ps.originalUniqueSkill;
        }
      }
    });

    return Array.from(byId.values());
  }, [parentSkills, pedigreeSkills]);

  const raceParams = useMemo(() => getPvpRaceParameters(activePvpEvent), [activePvpEvent]);

  // Precompute activation results for all parent & lineage skills under current course & style
  const activationMap = useMemo(() => {
    const map = new Map<number, SkillActivationResult>();
    const checkSkill = (id: number) => {
      if (!map.has(id)) {
        map.set(id, evaluateSkillActivation(id, course, runningStyle, raceParams));
      }
    };
    unifiedSkillList.forEach((s) => checkSkill(s.id));
    parentCardSkillsMap.forEach((skills) => skills.forEach((s) => checkSkill(s.id)));
    return map;
  }, [unifiedSkillList, parentCardSkillsMap, course, runningStyle, raceParams]);

  const isSkillUniqueTarget = (s: { id: number; isUniqueToParent?: boolean; isDuplicateInMain?: boolean }) => {
    if (s.isDuplicateInMain) return false;
    if (s.isUniqueToParent === false) return false;
    const act = activationMap.get(s.id);
    return act ? act.activates : true;
  };

  const hasParentDeck = parentSlots.some(Boolean);
  const hasLineage = Boolean(setup.parent1 || setup.parent2);

  const inheritOnlyCount = useMemo(
    () => unifiedSkillList.filter((s) => s.isInheritOnly).length,
    [unifiedSkillList],
  );
  const uniqueCount = useMemo(
    () => unifiedSkillList.filter((s) => isSkillUniqueTarget(s)).length,
    [unifiedSkillList, activationMap],
  );
  const duplicateCount = useMemo(
    () => unifiedSkillList.filter((s) => s.isDuplicateInMain).length,
    [unifiedSkillList],
  );
  const parentDupeCount = useMemo(
    () => unifiedSkillList.filter((s) => parentCardDuplicateSkillIdSet.has(s.id)).length,
    [unifiedSkillList, parentCardDuplicateSkillIdSet],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unifiedSkillList.filter((s) => {
      // Hide Parent Deck duplicates
      if (hideParentDupes && parentCardDuplicateSkillIdSet.has(s.id)) return false;

      // Source Filter (Cards vs Lineage)
      if (sourceFilter === "cards" && (s.source === "unique" || s.source === "factor")) return false;
      if (sourceFilter === "lineage" && (s.source === "hint" || s.source === "event")) return false;

      // Tab Filter
      if (filter === "inherit_only" && !s.isInheritOnly) return false;
      if (filter === "unique" && !isSkillUniqueTarget(s)) return false;
      if (filter === "duplicate" && !s.isDuplicateInMain) return false;
      if (filter === "parent_duplicate" && !parentCardDuplicateSkillIdSet.has(s.id)) return false;
      if (filter === "hint" && s.source !== "hint") return false;
      if (filter === "event" && s.source !== "event") return false;
      if (filter === "parent_unique" && s.source !== "unique") return false;
      if (filter === "factor" && s.source !== "factor") return false;

      if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;

      if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [unifiedSkillList, filter, sourceFilter, rarityFilter, hideParentDupes, parentCardDuplicateSkillIdSet, search, activationMap]);

  return (
    <section className="mt-8">
      <div className="mb-3 md:hidden">
        <h2 className="mb-2 text-lg font-semibold">Inheritable skills <span className="text-sm font-normal text-zinc-500">({unifiedSkillList.length})</span></h2>
        <input aria-label="Search skills" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search skills…" className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
      <MobileFilters count={Number(sourceFilter !== "all") + Number(filter !== "all") + Number(hideParentDupes)} summary={`${filtered.length} skills · ${viewMode === "card" ? "by card" : "unified list"}`}>
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              All Possible Skills <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">({unifiedSkillList.length})</span>
            </h2>
            <Badge size="compact" tone="emerald" className="font-bold">
              Cards + Lineage
            </Badge>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {hasParentDeck || hasLineage ? (
              <>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{uniqueCount} total targets</span> to farm ·{" "}
                <span className="font-semibold text-amber-700 dark:text-amber-400">{duplicateCount} overlapping</span> with Main Deck.
              </>
            ) : (
              "Add support cards or plan parent characters to view all possible inheritable skills."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all skills…"
            className="hidden md:block w-36 sm:w-44 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-2xs"
          />

          {/* Hide Parent Deck Dupes Toggle */}
          <button
            type="button"
            onClick={() => setHideParentDupes(!hideParentDupes)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              hideParentDupes
                ? "bg-violet-500/20 border-violet-500/50 text-violet-800 dark:text-violet-300 shadow-2xs"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
            title="Hide skills that appear multiple times across your Parent Support Cards"
          >
            {hideParentDupes ? "✓ Hiding Parent Dupes" : "Hide Parent Dupes"}
          </button>

          {/* Source Toggle */}
          <div className="flex flex-wrap md:flex-nowrap rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs scrollbar-none">
            <button
              onClick={() => setSourceFilter("all")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                sourceFilter === "all"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter("cards")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                sourceFilter === "cards"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Cards Only
            </button>
            <button
              onClick={() => setSourceFilter("lineage")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                sourceFilter === "lineage"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Parents Only
            </button>
          </div>

          {/* View Mode Toggle (Unified List vs Group by Card vs Group by Parent) */}
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Unified List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                viewMode === "card"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Group by Card
            </button>
            <button
              type="button"
              onClick={() => setViewMode("parent")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                viewMode === "parent"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Group by Parent
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            All ({unifiedSkillList.length})
          </button>
          <button
            onClick={() => setFilter("inherit_only")}
            className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
              filter === "inherit_only"
                ? "bg-indigo-600 text-white font-semibold shadow-xs"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Inherit Only ({inheritOnlyCount})
          </button>
          <button
            onClick={() => setFilter("unique")}
            className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
              filter === "unique"
                ? "bg-emerald-600 text-white font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Unique Targets ({uniqueCount})
          </button>
          <button
            onClick={() => setFilter("duplicate")}
            className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
              filter === "duplicate"
                ? "bg-amber-600 text-white font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            In Main Deck ({duplicateCount})
          </button>
          {parentDupeCount > 0 && (
            <button
              onClick={() => setFilter("parent_duplicate")}
              className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
                filter === "parent_duplicate"
                  ? "bg-violet-600 text-white font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Parent Dupes ({parentDupeCount})
            </button>
          )}
          <button
            onClick={() => setFilter("hint")}
            className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
              filter === "hint"
                ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Card Hints
          </button>
          <button
            onClick={() => setFilter("event")}
            className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
              filter === "event"
                ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Card Events
          </button>
          {lineageUniqueSkills.length > 0 && (
            <button
              onClick={() => setFilter("parent_unique")}
              className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
                filter === "parent_unique"
                  ? "bg-amber-500 text-white font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Parent Unique ({lineageUniqueSkills.length})
            </button>
          )}
          {bloodlineFactorSkills.length > 0 && (
            <button
              onClick={() => setFilter("factor")}
              className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
                filter === "factor"
                  ? "bg-sky-600 text-white font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Bloodline Factors ({bloodlineFactorSkills.length})
            </button>
          )}
        </div>
      </div>

      </MobileFilters>
      {/* Skill List Body */}
      {loading && !hasParentDeck && !hasLineage ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">Loading skills…</p>
      ) : unifiedSkillList.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-400 dark:text-zinc-500">
          No skills in pool yet. Add cards above or configure parents in Parenting to view all possible skills.
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">No skills match the selected filter.</p>
      ) : viewMode === "card" || viewMode === "parent" ? (
        <div className="mt-4 space-y-6">
          {/* Helper blocks for Cards Section & Lineage Section */}
          {(() => {
            const cardsSection = sourceFilter !== "lineage" && (
              <div className="space-y-4">
                {parentSlots.map((card, slotIdx) => {
                  if (!card) return null;
                  const allCardSkills = parentCardSkillsMap.get(card.id) || [];
                  const cFiltered = allCardSkills.filter((s) => {
                    if (hideParentDupes && parentCardDuplicateSkillIdSet.has(s.id)) return false;
                    const act = activationMap.get(s.id) ?? evaluateSkillActivation(s.id, course, runningStyle, raceParams);
                    const canAct = act.activates;
                    const isDupe = mainSkillIdSet.has(s.id);
                    if (filter === "unique" && (isDupe || !canAct)) return false;
                    if (filter === "duplicate" && !isDupe) return false;
                    if (filter === "parent_duplicate" && !parentCardDuplicateSkillIdSet.has(s.id)) return false;
                    if (filter === "hint" && s.source !== "hint") return false;
                    if (filter === "event" && s.source !== "event") return false;
                    if (filter === "parent_unique" || filter === "factor") return false;
                    if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;
                    const q = search.trim().toLowerCase();
                    if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) {
                      return false;
                    }
                    return true;
                  });

                  const cardLabel = card.nameEn || card.nameJp;

                  return (
                    <div
                      key={`parent-slot-${card.id}-${slotIdx}`}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs"
                    >
                      {/* Card Slot Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-zinc-50/75 dark:bg-zinc-900/90 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <img
                            src={card.portraitUrl || card.imgUrl}
                            alt=""
                            className="h-10 w-10 object-contain shrink-0 rounded-lg bg-zinc-50 dark:bg-zinc-800 p-0.5"
                            loading="lazy"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                Slot {slotIdx + 1}: {cardLabel}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                  RARITY_META[card.rarity]?.chip ?? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                }`}
                              >
                                {RARITY_META[card.rarity]?.label ?? "R"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                                <CardTypeIcon type={card.type} className="h-3.5 w-3.5 object-contain" />
                                <span>{formatCardType(card.type)}</span>
                              </span>
                              {card.nameJp && (
                                <>
                                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                                  <span className="text-[11px] text-zinc-400">{card.nameJp}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <Badge size="standard" tone="emerald" className="font-bold">
                            {cFiltered.length} skills granted
                          </Badge>
                        </div>
                      </div>

                      {/* Card Skills List */}
                      {cFiltered.length === 0 ? (
                        <p className="text-xs text-zinc-400 p-3">No skills match current filter for this card.</p>
                      ) : (
                        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                          {cFiltered.map((s) => {
                            const isBanned = isSkillBanned(s.id, activePvpEvent);
                            const isDupeInMain = mainSkillIdSet.has(s.id);
                            const isDupeInParent = parentCardDuplicateSkillIdSet.has(s.id);
                            const activation = activationMap.get(s.id) ?? evaluateSkillActivation(s.id, course, runningStyle, raceParams);
                            const canActivate = activation.activates;
                            const isUniqueTarget = !isDupeInMain && canActivate;

                            return (
                              <li
                                key={`${card.id}-${s.id}-${s.source}`}
                                className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 ${
                                  isBanned
                                    ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10"
                                    : !canActivate
                                      ? "opacity-75 bg-zinc-50/40 dark:bg-zinc-900/40"
                                      : isDupeInMain
                                        ? "bg-amber-50/20 dark:bg-amber-950/10"
                                        : ""
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <SkillItem
                                    skill={{ ...s, cardName: cardLabel, cardId: card.id }}
                                    size="sm"
                                    isBanned={isBanned}
                                    isParentMode={true}
                                    trailing={
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <ParentSkillStatusIndicators
                                          banned={isBanned}
                                          evolved={"isEvolInherit" in s && Boolean((s as { isEvolInherit?: boolean }).isEvolInherit)}
                                          evolutionAvailable={"evolSkillAvailable" in s && Boolean((s as { evolSkillAvailable?: boolean }).evolSkillAvailable)}
                                          uniqueTarget={isUniqueTarget}
                                          canActivate={canActivate}
                                          activationReason={activation.reason}
                                          inMainDeck={isDupeInMain}
                                        />

                                        {isDupeInParent && (
                                          <DuplicateSkillBadge
                                            cards={parentDuplicateCardsMap.get(s.id) || []}
                                            currentCardId={card.id}
                                            skillName={s.nameEn}
                                            variant="sky"
                                          />
                                        )}
                                      </div>
                                    }
                                  >
                                    {s.descEn && (
                                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                                        {s.descEn}
                                      </p>
                                    )}
                                    <div className="mt-1">
                                      <SkillSourceIcons sources={[{ kind: "card", cardId: card.id, name: cardLabel }]} />
                                    </div>
                                  </SkillItem>

                                  {/* Event Choice guidance */}
                                  {s.grants
                                    ?.filter((g) => g.eventMeta)
                                    .map((g, eventIdx) => {
                                      return (
                                        <div key={eventIdx} className="mt-1"><EventChainAttribution eventMeta={g.eventMeta!} /></div>
                                      );
                                    })}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            );

            const lineageSection = sourceFilter !== "cards" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                      Granted via Parents (Lineage & Bloodline Factors)
                    </h3>
                    <Badge size="compact" tone="violet" className="font-bold">
                      Inherited Uniques & Sparks
                    </Badge>
                  </div>
                  {onNavigateToParenting && (
                    <button
                      onClick={onNavigateToParenting}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Configure in Parenting →
                    </button>
                  )}
                </div>

                {!pedigreeSlots.some((s) => s.cardId && s.vet) ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      No Parent Characters Configured
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                      Assign Parent 1 and Parent 2 above or in the Parenting tab to evaluate their inheritable Unique Skills (white inherit) and sparkable Bloodline Factors.
                    </p>
                    {onNavigateToParenting && (
                      <button
                        onClick={onNavigateToParenting}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        Configure in Parenting →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pedigreeSlots.map((slot) => {
                      if (!slot.cardId || !slot.vet) return null;
                      const chara = charaByCardIdMap.get(slot.cardId);
                      const charaId = chara ? chara.charId : getCharaIdFromCardId(slot.cardId);
                      const avatarUrl = getCharacterImageUrl(charaId, slot.cardId);
                      const charaName = chara?.nameEn || chara?.nameJp || `${slot.slotLabel} Character`;

                      const parentSkillsList = pedigreeSkills
                        .filter((s) => s.grants?.some((g) => g.slotLabel === slot.slotLabel))
                        .filter((s) => {
                          if (hideParentDupes && parentCardDuplicateSkillIdSet.has(s.id)) return false;
                          const act = activationMap.get(s.id) ?? evaluateSkillActivation(s.id, course, runningStyle, raceParams);
                          const canAct = act.activates;
                          const isDupe = mainSkillIdSet.has(s.id);
                          if (filter === "unique" && (isDupe || !canAct)) return false;
                          if (filter === "duplicate" && !isDupe) return false;
                          if (filter === "parent_duplicate" && !parentCardDuplicateSkillIdSet.has(s.id)) return false;
                          if (filter === "hint" && s.source !== "hint") return false;
                          if (filter === "event" && s.source !== "event") return false;
                          if (filter === "parent_unique" && s.source !== "unique") return false;
                          if (filter === "factor" && s.source !== "factor") return false;
                          if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;
                          const q = search.trim().toLowerCase();
                          if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) {
                            return false;
                          }
                          return true;
                        });

                      const isP1 = slot.tag.startsWith("P1");

                      return (
                        <div
                          key={slot.tag}
                          className={`rounded-xl border overflow-hidden shadow-2xs ${
                            isP1
                              ? "border-emerald-200/70 dark:border-emerald-900/50 bg-white dark:bg-zinc-900"
                              : "border-blue-200/70 dark:border-blue-900/50 bg-white dark:bg-zinc-900"
                          }`}
                        >
                          {/* Parent Header */}
                          <div
                            className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b ${
                              isP1
                                ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40"
                                : "bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={avatarUrl}
                                alt=""
                                className="h-10 w-10 object-contain shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700"
                                loading="lazy"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                    {slot.slotLabel}: {charaName}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                                      isP1
                                        ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/80"
                                        : "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200/80 dark:border-blue-800/80"
                                    }`}
                                  >
                                    {slot.isParent ? "Direct Parent" : "Grandparent"} ({slot.tag})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    {slot.isParent
                                      ? "Inherits unique skill, innate/awakening, events & bloodline factors"
                                      : "Inherits unique skill & bloodline factors"}
                                  </span>
                                  {chara?.nameJp && (
                                    <>
                                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                                      <span className="text-[11px] text-zinc-400">{chara.nameJp}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                              <Badge size="standard" tone={isP1 ? "emerald" : "blue"} className="font-bold">
                                {parentSkillsList.length} skills inherited
                              </Badge>
                            </div>
                          </div>

                          {/* Inherited Skills List */}
                          {parentSkillsList.length === 0 ? (
                            <p className="text-xs text-zinc-400 p-3">No skills match current filter for this parent.</p>
                          ) : (
                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                              {parentSkillsList.map((s, idx) => {
                                const isBanned = isSkillBanned(s.id, activePvpEvent);
                                const isDupeInMain = mainSkillIdSet.has(s.id);
                                const activation = activationMap.get(s.id) ?? evaluateSkillActivation(s.id, course, runningStyle, raceParams);
                                const canActivate = activation.activates;
                                const isUniqueTarget = !isDupeInMain && canActivate;
                                const slotGrant = s.grants?.find((g) => g.slotLabel === slot.slotLabel);
                                const otherGrants =
                                  s.grants?.filter((g) => g.slotLabel !== slot.slotLabel) ?? [];
                                const otherGrantsBySlot = otherGrants.reduce<
                                  Map<string, {
                                    slotLabel: string;
                                    slotTag?: string;
                                    cardId?: number;
                                    charId?: number;
                                    avatarUrl?: string;
                                    cardName: string;
                                    sources: string[];
                                  }>
                                >((map, g) => {
                                  const key = g.slotTag || g.slotLabel || g.cardName;
                                  const existing = map.get(key);
                                  if (!existing) {
                                    map.set(key, {
                                      slotLabel: g.slotLabel || "",
                                      slotTag: g.slotTag,
                                      cardId: g.cardId,
                                      charId: g.charId,
                                      avatarUrl: g.avatarUrl,
                                      cardName: g.cardName,
                                      sources: [g.source],
                                    });
                                  } else {
                                    if (!existing.sources.includes(g.source)) {
                                      existing.sources.push(g.source);
                                    }
                                  }
                                  return map;
                                }, new Map());
                                const uniqueOtherGrants = Array.from(otherGrantsBySlot.values());

                                return (
                                  <li
                                    key={`${slot.tag}-${s.id}-${s.source}-${idx}`}
                                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 ${
                                      isBanned
                                        ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10"
                                        : !canActivate
                                          ? "opacity-75 bg-zinc-50/40 dark:bg-zinc-900/40"
                                          : isDupeInMain
                                            ? "bg-amber-50/20 dark:bg-amber-950/10"
                                            : ""
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <SkillItem
                                        skill={{ ...s, cardName: slotGrant ? `Via: ${slotGrant.source}` : s.sourceLabel }}
                                        size="sm"
                                        isBanned={isBanned}
                                        isParentMode={true}
                                        trailing={
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <ParentSkillStatusIndicators
                                              banned={isBanned}
                                              evolved={Boolean(s.isEvolInherit || slotGrant?.isEvolInherit)}
                                              evolutionAvailable={Boolean(s.evolSkillAvailable || slotGrant?.evolSkillAvailable)}
                                              uniqueTarget={isUniqueTarget}
                                              canActivate={canActivate}
                                              activationReason={activation.reason}
                                              inMainDeck={isDupeInMain}
                                              inheritOnly={Boolean(s.isInheritOnly)}
                                            />
                                          </div>
                                        }
                                      >
                                        {s.descEn && (
                                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                                            {s.descEn}
                                          </p>
                                        )}
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
                                          <SkillSourceIcons
                                            sources={[slotGrant, ...uniqueOtherGrants].filter(Boolean).map((grant) => ({
                                              kind: "character" as const,
                                              cardId: grant?.cardId,
                                              charId: grant?.charId,
                                              name: grant?.cardName ?? s.sourceLabel,
                                              label: grant?.slotLabel,
                                            }))}
                                          />
                                          <span>· #{s.id}</span>
                                        </div>
                                      </SkillItem>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );

            if (viewMode === "parent") {
              return (
                <>
                  {lineageSection}
                  {cardsSection}
                </>
              );
            }

            return (
              <>
                {cardsSection}
                {lineageSection}
              </>
            );
          })()}
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((s, idx) => {
            const rStyle = getSkillRarityStyle(s.rarity);
            const isBanned = isSkillBanned(s.id, activePvpEvent);
            const activation = activationMap.get(s.id) ?? evaluateSkillActivation(s.id, course, runningStyle, raceParams);
            const canActivate = activation.activates;
            const isUniqueTarget = s.isUniqueToParent && !s.isDuplicateInMain && canActivate;

            return (
              <li
                key={`${s.id}-${s.source}-${idx}`}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                  rStyle.borderClass
                } ${
                  isBanned
                    ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50"
                    : !canActivate
                      ? "opacity-75 bg-zinc-50/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800"
                      : s.isDuplicateInMain
                        ? "bg-amber-50/20 dark:bg-amber-950/10"
                        : rStyle.bgClass ?? ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <SkillItem
                    skill={{ ...s, cardName: s.sourceLabel }}
                    size="md"
                    isBanned={isBanned}
                    isParentMode={true}
                    trailing={
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SkillIndicatorGroup density="standard" indicators={[
                          ...(isBanned ? [{ kind: "banned" as const, title: "Banned by Special Rule (No Debuffs) - this skill cannot be used and will not activate" }] : []),
                          ...(s.isEvolInherit ? [{ kind: "evolved-inherit" as const, title: "Evolved Inherit: Enhanced succession skill (+0.15 Speed, +0.20 Accel) unlocked via direct Parent" }] : []),
                          ...(s.evolSkillAvailable ? [{ kind: "evolution-available" as const, title: "Evolves to enhanced inherit skill (+0.15 Speed, +0.20 Accel) when placed as direct Parent (P1/P2) and owning this character" }] : []),
                          ...(isUniqueTarget ? [{ kind: "unique-target" as const }] : []),
                          ...(!canActivate ? [{ kind: "no-activation" as const, label: activation.reason?.toLowerCase().includes("rank") ? "Rank Trap" : undefined, title: activation.reason || "This skill cannot activate on the selected course or running style" }] : []),
                          ...(s.isDuplicateInMain ? [{ kind: "in-main-deck" as const }] : []),
                          ...(s.isInheritOnly ? [{ kind: "inherit-only" as const, title: "Inherit Only: Cannot be obtained from any Support Card in your decks; only inherited from Uma lineage" }] : []),
                        ]} />
                        {s.parentDuplicateCount && s.parentDuplicateCount > 1 ? (
                          <DuplicateSkillBadge
                            cards={parentDuplicateCardsMap.get(s.id) || []}
                            skillName={s.nameEn}
                            variant="sky"
                          />
                        ) : null}
                      </div>
                    }
                  >
                    {/* Description */}
                    {s.descEn && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{s.descEn}</p>
                    )}

                    {/* Source Attribution */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <SkillSourceIcons
                        sources={(s.grants ?? []).map((grant) => ({
                          kind: (grant as { charId?: number }).charId ? "character" as const : "card" as const,
                          cardId: grant.cardId,
                          charId: (grant as { charId?: number }).charId,
                          name: grant.cardName,
                          label: (grant as { slotLabel?: string }).slotLabel,
                        }))}
                      />

                      {/* Event Choice Guidance */}
                      {s.grants
                        ?.filter((g) => g.eventMeta)
                        .map((g, eventIdx) => {
                          return <EventChainAttribution key={eventIdx} eventMeta={g.eventMeta!} />;
                        })}

                      {s.isDuplicateInMain && s.mainCardGrants && s.mainCardGrants.length > 0 && (
                        <SkillSourceIcons
                          sources={s.mainCardGrants.map((grant) => ({ kind: "card" as const, cardId: grant.cardId, name: grant.cardName, label: "Main Deck" }))}
                          className="border-l border-amber-300/60 pl-2 dark:border-amber-800/70"
                        />
                      )}

                      <span>· #{s.id}</span>
                    </div>
                  </SkillItem>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
