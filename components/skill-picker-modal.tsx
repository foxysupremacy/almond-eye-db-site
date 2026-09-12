"use client";

// Skill Picker Modal: Search and filter skills by gameplay effects (Target Speed, Current Speed,
// Acceleration, Heal, Debuff, Passive, Other), inspect granting support cards, and equip directly to Parent Deck.

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type SkillDetail, type CharacterIndexEntry, getCharacterImageUrl } from "../lib/api";
import { useDeck } from "./store";
import { useParentingSetup } from "../lib/parenting-state";
import { canPlaceCard, findCharConflict } from "../lib/deck/card-constraints";
import type { KyumaruVeteranItem } from "../lib/kyumaru-types";
import {
  EFFECT_CATEGORIES,
  classifySkillEffects,
  type SkillEffectCategory,
} from "../lib/skill-effects";
import {
  getCardsGrantingSkill,
  getCharactersGrantingSkill,
  type GrantingCardInfo,
  type GrantingCharacterInfo,
} from "../lib/data/skill-grants";
import SkillIcon from "./skill-icon";
import SkillItem from "./skill-item";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import { RARITY_META } from "../lib/skill-rarity";
import { SearchIcon, XIcon, CheckIcon } from "./icons";
import { useBodyScrollLock } from "../lib/use-body-scroll-lock";
import { PickerSearchBar } from "./shared/picker-search-bar";

type SourceFilter = "all" | "event" | "hint" | "lineage";

export default function SkillPickerModal({
  isOpen,
  onClose,
  initialSlotIndex = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialSlotIndex?: number | null;
}) {
  const { allCards, parentSlots, parentSkills, setParentCard, setChainChoice } = useDeck();
  const { setup, setParent1, setParent2 } = useParentingSetup();
  useBodyScrollLock(isOpen);

  const [skills, setSkills] = useState<SkillDetail[] | null>(null);
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SkillEffectCategory | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [hideInParentDeck, setHideInParentDeck] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load skills and characters list once
  useEffect(() => {
    if (!isOpen) return;
    api.listSkills().then(setSkills).catch(() => setSkills([]));
    api.listCharacters().then(setCharacters).catch(() => setCharacters([]));
  }, [isOpen]);

  // Focus search input on open only on fine-pointer (desktop) devices
  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [isOpen, onClose]);

  // Skills lookup map
  const skillsByIdMap = useMemo(() => {
    return new Map<number, SkillDetail>(skills ? skills.map((s) => [s.id, s]) : []);
  }, [skills]);

  // Skills already in current Parent Deck
  const parentDeckSkillIdSet = useMemo(() => {
    return new Set(parentSkills.map((s) => s.id));
  }, [parentSkills]);

  // Lineage unique skill IDs from all characters
  const lineageSkillIdSet = useMemo(() => {
    const set = new Set<number>();
    for (const c of characters) {
      if (c.uniqueSkillId) {
        set.add(c.uniqueSkillId);
        set.add(c.uniqueSkillId - 90000);
        set.add(c.uniqueSkillId - 99000);
      }
    }
    return set;
  }, [characters]);

  // Index card-to-skills sets for fast source filtering
  const { eventSkillIdSet, hintSkillIdSet, allGrantingSkillIds } = useMemo(() => {
    const eventSet = new Set<number>();
    const hintSet = new Set<number>();
    const allSet = new Set<number>();

    if (allCards) {
      for (const card of allCards) {
        if (card.eventSkills) {
          for (const sid of card.eventSkills) {
            eventSet.add(sid);
            allSet.add(sid);
          }
        }
        if (card.hintSkills) {
          for (const sid of card.hintSkills) {
            hintSet.add(sid);
            allSet.add(sid);
          }
        }
      }
    }
    // Also include lineage unique skills in the general pool
    for (const sid of lineageSkillIdSet) {
      allSet.add(sid);
    }

    return { eventSkillIdSet: eventSet, hintSkillIdSet: hintSet, allGrantingSkillIds: allSet };
  }, [allCards, lineageSkillIdSet]);

  // Pre-classify skills for fast filtering
  const skillCategoryMap = useMemo(() => {
    const map = new Map<number, SkillEffectCategory[]>();
    if (skills) {
      for (const s of skills) {
        map.set(s.id, classifySkillEffects(s));
      }
    }
    return map;
  }, [skills]);

  // Filter skills
  const filteredSkills = useMemo(() => {
    if (!skills) return [];

    const q = query.trim().toLowerCase();

    return skills.filter((s) => {
      // Must be granted by at least one card or parent in the game
      if (!allGrantingSkillIds.has(s.id)) return false;

      // Duplicate filter: hide skills already acquired in Parent Deck
      if (hideInParentDeck && parentDeckSkillIdSet.has(s.id)) return false;

      // Source filter
      if (sourceFilter === "event" && !eventSkillIdSet.has(s.id)) return false;
      if (sourceFilter === "hint" && !hintSkillIdSet.has(s.id)) return false;
      if (sourceFilter === "lineage" && !lineageSkillIdSet.has(s.id)) return false;

      // Category filter
      if (category !== "all") {
        const cats = skillCategoryMap.get(s.id) || [];
        if (!cats.includes(category)) return false;
      }

      // Query search
      if (q) {
        const matchName =
          (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
          (s.nameJp && s.nameJp.toLowerCase().includes(q)) ||
          (s.descEn && s.descEn.toLowerCase().includes(q));
        if (!matchName) return false;
      }

      return true;
    });
  }, [
    skills,
    allGrantingSkillIds,
    hideInParentDeck,
    parentDeckSkillIdSet,
    sourceFilter,
    eventSkillIdSet,
    hintSkillIdSet,
    lineageSkillIdSet,
    category,
    skillCategoryMap,
    query,
  ]);

  // Granting cards for selected skill
  const grantingCards = useMemo<GrantingCardInfo[]>(() => {
    if (!selectedSkillId || !allCards) return [];
    return getCardsGrantingSkill(selectedSkillId, allCards);
  }, [selectedSkillId, allCards]);

  // Granting characters for selected skill (lineage unique skills)
  const grantingCharacters = useMemo<GrantingCharacterInfo[]>(() => {
    if (!selectedSkillId || characters.length === 0) return [];
    return getCharactersGrantingSkill(selectedSkillId, characters, skillsByIdMap);
  }, [selectedSkillId, characters, skillsByIdMap]);

  const selectedSkill = useMemo(() => {
    if (!selectedSkillId || !skills) return null;
    return skills.find((s) => s.id === selectedSkillId) ?? null;
  }, [selectedSkillId, skills]);

  function handleEquip(cardInfo: GrantingCardInfo, slotIndex: number) {
    if (!canPlaceCard(parentSlots, slotIndex, cardInfo.card)) {
      const conflict = findCharConflict(parentSlots, slotIndex, cardInfo.card);
      const conflictName = conflict ? conflict.nameEn || conflict.nameJp : "";
      const cardTitle = cardInfo.card.nameEn || cardInfo.card.nameJp;
      setToastMessage(`Cannot equip "${cardTitle}" — same uma as "${conflictName}". Only one card per uma in the Parent Deck.`);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    setParentCard(slotIndex, cardInfo.card);

    // If it's a specific event choice, apply choice index automatically
    if (cardInfo.source === "event" && cardInfo.choiceIndex && cardInfo.card.eventDetails) {
      for (const ev of cardInfo.card.eventDetails) {
        if (ev.choices?.some((ch) => ch.skillIds?.includes(selectedSkillId!))) {
          setChainChoice("parent", cardInfo.card.id, ev.eventId, cardInfo.choiceIndex);
          break;
        }
      }
    }

    const cardTitle = cardInfo.card.nameEn || cardInfo.card.nameJp;
    setToastMessage(`Equipped "${cardTitle}" into Parent Slot ${slotIndex + 1}`);
    setTimeout(() => setToastMessage(null), 3500);
  }

  function handleSetParent(chara: CharacterIndexEntry, slot: 1 | 2) {
    const stub: KyumaruVeteranItem = {
      card_id: chara.id,
      trained_chara_id: chara.id,
      name: chara.nameEn || chara.nameJp,
      rank: 0,
      rarity: 3,
      speed: 0,
      stamina: 0,
      power: 0,
      guts: 0,
      wiz: 0,
      rank_score: 0,
      win_saddle_id_array: [],
      factor_info_array: [],
      succession_chara_array: [],
    };
    if (slot === 1) {
      setParent1(stub);
    } else {
      setParent2(stub);
    }
    const charaTitle = chara.nameEn || chara.nameJp;
    setToastMessage(`Assigned "${charaTitle}" as Parent ${slot}`);
    setTimeout(() => setToastMessage(null), 3500);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200 ease-out-quart touch-none overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label="Search Cards by Skill"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92dvh] max-h-[750px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl animate-in zoom-in-95 duration-200 ease-out-expo text-left overscroll-contain"
      >
        {/* Modal Header */}
        <div className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Search Support Cards by Skill
                </span>
                <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  Parent Deck
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Pick an effect or search by skill name to find support cards that grant it via events or hints.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="mt-3 flex items-center gap-2">
            <PickerSearchBar
              inputRef={searchInputRef}
              value={query}
              onChange={setQuery}
              placeholder="Search by skill name in English or Japanese, or skill effect keyword…"
            />

            {/* Source Filter Dropdown */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 outline-none cursor-pointer shrink-0"
            >
              <option value="all">Source: All (Cards & Parents)</option>
              <option value="event">Source: Card Events Only</option>
              <option value="hint">Source: Card Hints Only</option>
              <option value="lineage">Source: Parent Inherits (White)</option>
            </select>

            {/* Hide Skills in Parent Deck Toggle */}
            <button
              type="button"
              onClick={() => setHideInParentDeck(!hideInParentDeck)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                hideInParentDeck
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-300 shadow-2xs"
                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
              title="Filter out skills that are already granted by cards in your Parent Deck"
            >
              {hideInParentDeck ? "✓ Hiding Parent Deck Skills" : "Hide in Parent Deck"}
            </button>
          </div>

          {/* Effect Category Filter Chips */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                category === "all"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs"
                  : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              All Effects
            </button>
            {EFFECT_CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs"
                      : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                  title={cat.description}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cat.dotColor}`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top-2 duration-200 ease-out-expo">
            <span className="flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{toastMessage}</span>
            </span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-100 hover:text-white cursor-pointer"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Body: Split View (Skills list on left, Granting cards on right on larger screens) */}
        <div className="flex flex-1 flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-zinc-200/80 dark:divide-zinc-800">
          {/* Left Column: Skills List */}
          <div className="w-full md:w-1/2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/40 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Matching Skills ({filteredSkills.length})</span>
              <span>Click a skill to view granting cards</span>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-zinc-100 dark:divide-zinc-800/60 p-2 space-y-1">
              {!skills ? (
                <p className="p-4 text-xs text-zinc-400">Loading skills database…</p>
              ) : filteredSkills.length === 0 ? (
                <p className="p-4 text-xs text-zinc-400">No matching skills found.</p>
              ) : (
                filteredSkills.map((s) => {
                  const isSelected = selectedSkillId === s.id;
                  const cats = skillCategoryMap.get(s.id) || [];

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSkillId(s.id)}
                      className={`w-full rounded-xl p-2.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/50 shadow-2xs"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border border-transparent"
                      }`}
                    >
                      <SkillItem
                        skill={s}
                        size="md"
                        interactive={false}
                        trailing={
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                s.rarity === 2
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                                  : "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              }`}
                            >
                              {s.rarity === 2 ? "Gold" : "White"}
                            </span>
                            {parentDeckSkillIdSet.has(s.id) && (
                              <span className="rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold">
                                In Parent Deck
                              </span>
                            )}
                            {lineageSkillIdSet.has(s.id) && (
                              <span className="rounded bg-pink-500/15 text-pink-800 dark:text-pink-300 border border-pink-500/30 px-1.5 py-0.2 text-[9px] font-bold">
                                Parent Inherit
                              </span>
                            )}
                            {cats.slice(0, 2).map((catId) => (
                              <span
                                key={catId}
                                className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 text-[9px] text-zinc-500 dark:text-zinc-400"
                              >
                                {catId.replace("_", " ")}
                              </span>
                            ))}
                          </div>
                        }
                      >
                        {s.descEn && (
                          <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                            {s.descEn}
                          </p>
                        )}
                      </SkillItem>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Granting Support Cards & Lineage Characters */}
          <div className="w-full md:w-1/2 flex flex-col overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/30">
            {selectedSkill ? (
              <>
                <div className="p-3.5 border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <SkillItem
                    skill={selectedSkill}
                    size="md"
                    interactive={false}
                    trailing={
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {grantingCards.length} support cards · {grantingCharacters.length} parent characters
                      </p>
                    }
                  />
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
                  {grantingCards.length === 0 && grantingCharacters.length === 0 ? (
                    <p className="text-xs text-zinc-400 p-4">No cards or characters found for this skill.</p>
                  ) : null}

                  {/* Lineage Characters Section */}
                  {grantingCharacters.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-pink-700 dark:text-pink-400">
                          Parent Bloodline Characters ({grantingCharacters.length})
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Inherits as White Unique
                        </span>
                      </div>
                      <div className="space-y-2">
                        {grantingCharacters.map(({ character: chara }) => {
                          const isP1 = setup.parent1?.card_id === chara.id;
                          const isP2 = setup.parent2?.card_id === chara.id;
                          const charTitle = chara.nameEn || chara.nameJp;

                          return (
                            <div
                              key={`chara-${chara.id}`}
                              className="rounded-xl border border-pink-200/80 dark:border-pink-900/60 bg-gradient-to-r from-pink-50/40 to-white dark:from-pink-950/20 dark:to-zinc-900 p-3 shadow-2xs space-y-2.5"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative h-11 w-11 shrink-0 rounded-full overflow-hidden bg-white dark:bg-zinc-800 ring-2 ring-pink-500/60 flex items-center justify-center">
                                  <img
                                    src={getCharacterImageUrl(chara.charId, chara.id)}
                                    alt=""
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                      {charTitle}
                                    </span>
                                    <span className="rounded bg-pink-100 dark:bg-pink-950/80 px-1.5 py-0.2 text-[9px] font-bold text-pink-800 dark:text-pink-300">
                                      Parent
                                    </span>
                                  </div>
                                  {chara.titleEn && (
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                      {chara.titleEn}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="pt-2 border-t border-pink-100 dark:border-pink-900/40 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                  Assign to:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSetParent(chara, 1)}
                                    className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                                      isP1
                                        ? "bg-blue-600 text-white shadow-2xs font-bold"
                                        : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300"
                                    }`}
                                  >
                                    {isP1 ? "✓ Parent 1" : "Set as Parent 1"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetParent(chara, 2)}
                                    className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                                      isP2
                                        ? "bg-pink-600 text-white shadow-2xs font-bold"
                                        : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-pink-50 dark:hover:bg-pink-950/50 hover:text-pink-700 dark:hover:text-pink-300"
                                    }`}
                                  >
                                    {isP2 ? "✓ Parent 2" : "Set as Parent 2"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Support Cards Section */}
                  {grantingCards.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Support Cards ({grantingCards.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {grantingCards.map((info, idx) => {
                      const card = info.card;
                      const cardTitle = card.nameEn || card.nameJp;

                      return (
                        <div
                          key={`${card.id}-${info.source}-${idx}`}
                          className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={card.portraitUrl || card.imgUrl}
                              alt=""
                              className="h-12 w-12 object-contain shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                  {cardTitle}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                    RARITY_META[card.rarity]?.chip ?? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                  }`}
                                >
                                  {RARITY_META[card.rarity]?.label ?? "R"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 capitalize">
                                  <CardTypeIcon type={card.type} className="h-3.5 w-3.5 object-contain" />
                                  <span>{formatCardType(card.type)}</span>
                                </span>
                                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                    info.source === "event"
                                      ? "bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200"
                                      : "bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200"
                                  }`}
                                >
                                  {info.source === "event" ? "Event Skill" : "Hint Skill"}
                                </span>
                              </div>

                              {info.eventName && (
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                                  Event: <span className="font-semibold">{info.eventName}</span>
                                  {info.choiceIndex && (
                                    <span> (Choice {info.choiceIndex}: {info.choiceText})</span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Equip to Parent Deck Slot Picker */}
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              Equip to:
                            </span>
                            <div className="flex items-center gap-1 overflow-x-auto">
                              {Array.from({ length: 6 }, (_, sIdx) => {
                                const currentSlotCard = parentSlots[sIdx];
                                const isCurrentCard = currentSlotCard?.id === card.id;

                                return (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => handleEquip(info, sIdx)}
                                    className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                                      isCurrentCard
                                        ? "bg-emerald-600 text-white shadow-2xs font-bold"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 hover:text-emerald-800 dark:hover:text-emerald-300"
                                    }`}
                                    title={
                                      currentSlotCard
                                        ? `Slot ${sIdx + 1}: Currently has ${currentSlotCard.nameEn || currentSlotCard.nameJp}`
                                        : `Slot ${sIdx + 1}: Empty`
                                    }
                                  >
                                    Slot {sIdx + 1}
                                    {isCurrentCard && <CheckIcon className="inline h-3 w-3 ml-1" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-zinc-400">
                <SearchIcon className="h-8 w-8 text-zinc-400 dark:text-zinc-600 mb-2" />
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  No skill selected
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">
                  Choose a skill on the left to see all support cards that grant it and equip them to your Parent Deck.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-5 py-3">
          <span className="text-[11px] text-zinc-400">
            Parent Deck: {parentSlots.filter(Boolean).length}/6 equipped
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-1.5 text-xs font-bold cursor-pointer hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
