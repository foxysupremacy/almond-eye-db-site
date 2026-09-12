"use client";

import { useMemo, useState, useEffect } from "react";
import { useDeck, type ParentDeckSkill, type DeckSkill } from "./store";
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
import { StarIcon, AlertTriangleIcon } from "./icons";
import { getCharacterImageUrl } from "../lib/api";
import { getCharaIdFromCardId } from "../lib/affinity-engine";
import { isSkillBanned } from "../lib/pvp-events";
import { deriveSkillsForDeck } from "../lib/deck/skill-resolver";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import { RARITY_META } from "./card-picker-popover";
import DuplicateSkillBadge, { type DuplicateCardEntry } from "./duplicate-skill-badge";

type FilterTab = "all" | "unique" | "duplicate" | "parent_duplicate" | "hint" | "event" | "parent_unique" | "factor";
type SourceFilter = "all" | "cards" | "lineage";

export type { DisplayParentSkill };

function sourceBadge(source: DisplayParentSkill["source"]) {
  switch (source) {
    case "event":
      return (
        <span className="rounded bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/80">
          Card Event
        </span>
      );
    case "hint":
      return (
        <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
          Card Hint
        </span>
      );
    case "unique":
      return (
        <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
          Parent Unique
        </span>
      );
    case "factor":
      return (
        <span className="rounded bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
          Bloodline Factor
        </span>
      );
  }
}

function rarityBadge(rarity?: number) {
  const meta = getSkillRarityStyle(rarity);
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeClass}`}>
      {meta.badgeLabel}
    </span>
  );
}

interface ParentSkillListProps {
  onNavigateToParenting?: () => void;
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
  } = useDeck();
  const { setup } = useParentingSetup();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");
  const [viewMode, setViewMode] = useState<"list" | "card">(() => {
    if (typeof window === "undefined") return "list";
    try {
      return localStorage.getItem("almond_skill_view_mode") === "card" ? "card" : "list";
    } catch {
      return "list";
    }
  });
  // Remember the skill view mode (Unified List / Group by Card) across visits
  useEffect(() => {
    try {
      localStorage.setItem("almond_skill_view_mode", viewMode);
    } catch {}
  }, [viewMode]);
  const [hideParentDupes, setHideParentDupes] = useState(false);
  const [search, setSearch] = useState("");

  const { lineageUniqueSkills, bloodlineFactorSkills, p1Chara, p2Chara } = useLineageSkills();

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
    const map = new Map<number, DuplicateCardEntry[]>();
    parentSlots.forEach((card) => {
      if (!card) return;
      const cSkills = parentCardSkillsMap.get(card.id) || [];
      cSkills.forEach((s) => {
        const existing = map.get(s.id) || [];
        if (!existing.some((e) => e.cardId === card.id)) {
          existing.push({
            cardId: card.id,
            cardName: card.nameEn || card.nameJp || `Card #${card.id}`,
            cardNameJp: card.nameJp,
            rarity: card.rarity,
            type: card.type,
            portraitUrl: card.portraitUrl,
            imgUrl: card.imgUrl,
            source: s.source,
            eventMeta: s.grants?.find((g) => g.cardId === card.id)?.eventMeta ?? null,
            originalGoldSkill: s.grants?.find((g) => g.cardId === card.id)?.originalGoldSkill ?? undefined,
          });
          map.set(s.id, existing);
        }
      });
    });
    return map;
  }, [parentSlots, parentCardSkillsMap]);

  // Track skills appearing in more than one parent support card
  const parentCardDuplicateSkillIdSet = useMemo(() => {
    const dupes = new Set<number>();
    parentDuplicateCardsMap.forEach((cards, id) => {
      if (cards.length > 1) dupes.add(id);
    });
    return dupes;
  }, [parentDuplicateCardsMap]);

  // Combine All Skills (Support Cards + Parent Uniques + Bloodline Factors)
  const unifiedSkillList: DisplayParentSkill[] = useMemo(() => {
    const cardSkillsMapped: DisplayParentSkill[] = parentSkills.map((s) => ({
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
      parentDuplicateCount: s.parentDuplicateCount,
      originalGoldSkill: s.originalGoldSkill,
      grants: s.grants,
      mainCardGrants: s.mainCardGrants,
    }));

    return [...cardSkillsMapped, ...lineageUniqueSkills, ...bloodlineFactorSkills];
  }, [parentSkills, lineageUniqueSkills, bloodlineFactorSkills]);

  const hasParentDeck = parentSlots.some(Boolean);
  const hasLineage = Boolean(setup.parent1 || setup.parent2);

  const uniqueCount = useMemo(() => unifiedSkillList.filter((s) => s.isUniqueToParent).length, [unifiedSkillList]);
  const duplicateCount = useMemo(() => unifiedSkillList.filter((s) => s.isDuplicateInMain).length, [unifiedSkillList]);
  const parentDupeCount = useMemo(() => unifiedSkillList.filter((s) => parentCardDuplicateSkillIdSet.has(s.id)).length, [unifiedSkillList, parentCardDuplicateSkillIdSet]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unifiedSkillList.filter((s) => {
      // Hide Parent Deck duplicates
      if (hideParentDupes && parentCardDuplicateSkillIdSet.has(s.id)) return false;

      // Source Filter (Cards vs Lineage)
      if (sourceFilter === "cards" && (s.source === "unique" || s.source === "factor")) return false;
      if (sourceFilter === "lineage" && (s.source === "hint" || s.source === "event")) return false;

      // Tab Filter
      if (filter === "unique" && !s.isUniqueToParent) return false;
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
  }, [unifiedSkillList, filter, sourceFilter, rarityFilter, hideParentDupes, parentCardDuplicateSkillIdSet, search]);

  return (
    <section className="mt-8">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              All Possible Skills <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">({unifiedSkillList.length})</span>
            </h2>
            <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.2 text-[10px] font-bold">
              Cards + Lineage
            </span>
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
            className="w-36 sm:w-44 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-2xs"
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
          <div className="flex overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs scrollbar-none">
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

          {/* View Mode Toggle (Unified List vs Group by Card) */}
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

      {/* Skill List Body */}
      {loading && !hasParentDeck && !hasLineage ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">Loading skills…</p>
      ) : unifiedSkillList.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-400 dark:text-zinc-500">
          No skills in pool yet. Add cards above or configure parents in Parenting to view all possible skills.
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">No skills match the selected filter.</p>
      ) : viewMode === "card" ? (
        <div className="mt-4 space-y-6">
          {/* 1. Support Cards (Slot 1..6) */}
          {sourceFilter !== "lineage" && (
            <div className="space-y-4">
              {parentSlots.map((card, slotIdx) => {
                if (!card) return null;
                const allCardSkills = parentCardSkillsMap.get(card.id) || [];
                const cFiltered = allCardSkills.filter((s) => {
                  if (hideParentDupes && parentCardDuplicateSkillIdSet.has(s.id)) return false;
                  if (filter === "unique" && mainSkillIdSet.has(s.id)) return false;
                  if (filter === "duplicate" && !mainSkillIdSet.has(s.id)) return false;
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
                        <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold px-2.5 py-0.5 text-xs">
                          {cFiltered.length} skills granted
                        </span>
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
                          const mappedGold = s.grants?.find((g) => g.originalGoldSkill)?.originalGoldSkill;

                          return (
                            <li
                              key={`${card.id}-${s.id}-${s.source}`}
                              className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 ${
                                isBanned ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10" : isDupeInMain ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
                              }`}
                            >
                              <div className="mt-0.5 flex flex-col gap-1 flex-none">
                                {isBanned && (
                                  <span
                                    className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs text-center"
                                    title="Banned by Special Rule (No Debuffs)"
                                  >
                                    BANNED
                                  </span>
                                )}
                                {rarityBadge(s.rarity)}
                                {sourceBadge(s.source)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <SkillItem
                                  skill={{ ...s, cardName: cardLabel }}
                                  size="sm"
                                  isBanned={isBanned}
                                  isParentMode={true}
                                  trailing={
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {!isDupeInMain ? (
                                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                                          <StarIcon className="h-2.5 w-2.5" />
                                          <span>Unique Target</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-100 border border-amber-400 dark:border-amber-700">
                                          <AlertTriangleIcon className="h-2.5 w-2.5" />
                                          <span>In Main Deck</span>
                                        </span>
                                      )}

                                      {isDupeInParent && (
                                        <DuplicateSkillBadge
                                          cards={parentDuplicateCardsMap.get(s.id) || []}
                                          currentCardId={card.id}
                                          skillName={s.nameEn}
                                          variant="sky"
                                        />
                                      )}

                                      {mappedGold && (
                                        <span className="rounded bg-amber-200/90 dark:bg-amber-950/80 px-1.5 py-0.2 text-[9px] font-bold text-amber-950 dark:text-amber-100 border border-amber-400/80 dark:border-amber-700">
                                          via {mappedGold.nameEn} (Gold)
                                        </span>
                                      )}
                                    </div>
                                  }
                                >
                                  {s.descEn && (
                                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                                      {s.descEn}
                                    </p>
                                  )}
                                </SkillItem>

                                {/* Event Choice guidance */}
                                {s.grants
                                  ?.filter((g) => g.eventMeta)
                                  .map((g, eventIdx) => {
                                    const em = g.eventMeta!;
                                    const eventTitle = em.eventNameEn || em.eventNameJp;
                                    const choiceText = em.choiceTextEn || em.choiceTextJp;
                                    return (
                                      <div key={eventIdx} className="mt-1">
                                        <span className="inline-flex items-center gap-1 rounded bg-violet-50 dark:bg-violet-950/50 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/80">
                                          <span className="font-bold">{eventTitle}</span>
                                          <span className="text-violet-400 dark:text-violet-600">•</span>
                                          <span>
                                            Choice {em.choiceIndex}: <span className="font-semibold text-violet-900 dark:text-violet-200">{choiceText}</span>
                                          </span>
                                        </span>
                                      </div>
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
          )}

          {/* 2. Parent Lineage Section (Parent 1 & Parent 2) */}
          {sourceFilter !== "cards" && (
            <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                    Granted via Parents (Lineage & Bloodline Factors)
                  </h3>
                  <span className="rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 px-2 py-0.2 text-[10px] font-bold">
                    Inherited Uniques & Sparks
                  </span>
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

              {!setup.parent1 && !setup.parent2 ? (
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
                  {[
                    { label: "Parent 1", tag: "P1", vet: setup.parent1, chara: p1Chara },
                    { label: "Parent 2", tag: "P2", vet: setup.parent2, chara: p2Chara },
                  ].map(({ label, tag, vet, chara }) => {
                    if (!vet) return null;
                    const charaId = chara ? chara.charId : getCharaIdFromCardId(vet.card_id);
                    const avatarUrl = getCharacterImageUrl(charaId, vet.card_id);
                    const charaName = chara?.nameEn || chara?.nameJp || `${label} Character`;

                    const parentSkillsList = [
                      ...lineageUniqueSkills.filter((s) => s.sourceLabel.startsWith(label)),
                      ...bloodlineFactorSkills.filter((s) => s.sourceLabel.includes(tag)),
                    ].filter((s) => {
                      if (filter === "unique" && !s.isUniqueToParent) return false;
                      if (filter === "duplicate" && !s.isDuplicateInMain) return false;
                      if (filter === "parent_duplicate") return false;
                      if (filter === "hint" || filter === "event") return false;
                      if (filter === "parent_unique" && s.source !== "unique") return false;
                      if (filter === "factor" && s.source !== "factor") return false;
                      if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;
                      const q = search.trim().toLowerCase();
                      if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) {
                        return false;
                      }
                      return true;
                    });

                    return (
                      <div
                        key={label}
                        className="rounded-xl border border-violet-200/70 dark:border-violet-900/50 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs"
                      >
                        {/* Parent Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-violet-50/40 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900/40">
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
                                  {label}: {charaName}
                                </span>
                                <span className="rounded bg-violet-100 dark:bg-violet-900/60 px-1.5 py-0.2 text-[9px] font-bold text-violet-800 dark:text-violet-200 uppercase">
                                  Lineage
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  Inherits unique skill & sparkable factors
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
                            <span className="rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold px-2.5 py-0.5 text-xs">
                              {parentSkillsList.length} skills inherited
                            </span>
                          </div>
                        </div>

                        {/* Inherited Skills List */}
                        {parentSkillsList.length === 0 ? (
                          <p className="text-xs text-zinc-400 p-3">No skills match current filter for this parent.</p>
                        ) : (
                          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                            {parentSkillsList.map((s, idx) => {
                              const isBanned = isSkillBanned(s.id, activePvpEvent);

                              return (
                                <li
                                  key={`${label}-${s.id}-${s.source}-${idx}`}
                                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 ${
                                    isBanned ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10" : ""
                                  }`}
                                >
                                  <div className="mt-0.5 flex flex-col gap-1 flex-none">
                                    {isBanned && (
                                      <span
                                        className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs text-center"
                                        title="Banned by Special Rule"
                                      >
                                        BANNED
                                      </span>
                                    )}
                                    {rarityBadge(s.rarity)}
                                    {sourceBadge(s.source)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <SkillItem
                                      skill={{ ...s, cardName: s.sourceLabel }}
                                      size="sm"
                                      isBanned={isBanned}
                                      isParentMode={true}
                                      trailing={
                                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                                          <StarIcon className="h-2.5 w-2.5" />
                                          <span>Unique Target</span>
                                        </span>
                                      }
                                    >
                                      {s.descEn && (
                                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                                          {s.descEn}
                                        </p>
                                      )}
                                      <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400">
                                        <span>{s.sourceLabel}</span>
                                        <span>·</span>
                                        <span>#{s.id}</span>
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
          )}
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((s, idx) => {
            const rStyle = getSkillRarityStyle(s.rarity);
            const mappedGold = s.originalGoldSkill;
            const mappedUnique = s.originalUniqueSkill;
            const isBanned = isSkillBanned(s.id, activePvpEvent);

            return (
              <li
                key={`${s.id}-${s.source}-${idx}`}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                  rStyle.borderClass
                } ${isBanned ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50" : s.isDuplicateInMain ? "bg-amber-50/20 dark:bg-amber-950/10" : rStyle.bgClass ?? ""}`}
              >
                <div className="mt-0.5 flex flex-col gap-1 flex-none">
                  {isBanned && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs text-center"
                      title="Banned by Special Rule (No Debuffs) - this skill cannot be used and will not activate"
                    >
                      BANNED
                    </span>
                  )}
                  {rarityBadge(s.rarity)}
                  {sourceBadge(s.source)}
                </div>

                <div className="min-w-0 flex-1">
                  <SkillItem
                    skill={{ ...s, cardName: s.sourceLabel }}
                    size="md"
                    isBanned={isBanned}
                    isParentMode={true}
                    trailing={
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.isUniqueToParent ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                            <StarIcon className="h-2.5 w-2.5" />
                            <span>Unique Target</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-100 border border-amber-400 dark:border-amber-700">
                            <AlertTriangleIcon className="h-2.5 w-2.5" />
                            <span>In Main Deck</span>
                          </span>
                        )}

                        {s.parentDuplicateCount && s.parentDuplicateCount > 1 ? (
                          <DuplicateSkillBadge
                            cards={parentDuplicateCardsMap.get(s.id) || []}
                            skillName={s.nameEn}
                            variant="sky"
                          />
                        ) : null}

                        {mappedGold && (
                          <span className="rounded bg-amber-200/90 dark:bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 dark:text-amber-100 border border-amber-400/80 dark:border-amber-700" title={`In game, this card grants Gold skill ${mappedGold.nameEn}, which downgrades to ${s.nameEn} for inheritance factor farming.`}>
                            via {mappedGold.nameEn} (Gold)
                          </span>
                        )}

                        {mappedUnique && (
                          <span className="rounded bg-pink-100 dark:bg-pink-950/80 px-1.5 py-0.5 text-[10px] font-bold text-pink-950 dark:text-pink-100 border border-pink-300/80 dark:border-pink-700/80" title={`This is the white INHERIT version of the unique skill ${mappedUnique.nameEn} — unique skills downgrade when passed through a lineage tree. Only the ace's own unique keeps its full form.`}>
                            via {mappedUnique.nameEn} (Unique)
                          </span>
                        )}
                      </div>
                    }
                  >
                    {/* Description */}
                    {s.descEn && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{s.descEn}</p>
                    )}

                    {/* Source Attribution */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>
                        Source:{" "}
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                          {s.sourceLabel}
                        </span>
                      </span>

                      {/* Event Choice Guidance */}
                      {s.grants
                        ?.filter((g) => g.eventMeta)
                        .map((g, eventIdx) => {
                          const em = g.eventMeta!;
                          const eventTitle = em.eventNameEn || em.eventNameJp;
                          const choiceText = em.choiceTextEn || em.choiceTextJp;
                          return (
                            <span
                              key={eventIdx}
                              className="inline-flex items-center gap-1 rounded bg-violet-50 dark:bg-violet-950/50 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/80"
                              title={`Event: ${em.eventNameJp} (${em.eventNameEn})\nChoice ${em.choiceIndex}: ${em.choiceTextJp}`}
                            >
                              <span className="font-bold">{eventTitle}</span>
                              <span className="text-violet-400 dark:text-violet-600">•</span>
                              <span>
                                Choice {em.choiceIndex}: <span className="font-semibold text-violet-900 dark:text-violet-200">{choiceText}</span>
                              </span>
                            </span>
                          );
                        })}

                      {s.isDuplicateInMain && s.mainCardGrants && s.mainCardGrants.length > 0 && (
                        <span className="text-amber-950 dark:text-amber-200 font-medium">
                          (Also in Main: {s.mainCardGrants.map((g) => g.cardName).join(", ")})
                        </span>
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
