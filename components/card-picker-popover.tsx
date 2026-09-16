"use client";

// Popover listing ALL support cards for one deck slot, with search + sort by
// recommendation score (for parent farming), rarity (SSR/SR/R), or type.
// Rendered absolutely and layered above everything (z-[100]) so it never gets clipped.

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type CardIndexEntry, type SkillDetail } from "../lib/api";
import { useDeck } from "./store";
import { recommendCardsForParent, type CardRecommendation } from "../lib/recommendation-engine";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import {
  EFFECT_CATEGORIES,
  classifySkillEffects,
  type SkillEffectCategory,
} from "../lib/skill-effects";
import { useBodyScrollLock } from "../lib/use-body-scroll-lock";
import { useOwnedCards } from "../lib/use-owned-cards";
import CardSkillsSheet from "./card-skills-sheet";
import { getPvpRaceParameters } from "../lib/pvp-events";
import { useParentingSetup } from "../lib/parenting-state";
import { cardCharacterKey } from "../lib/deck/card-constraints";
import { charactersByCharId, skillsById } from "../lib/data/registry";
import { getInheritableSkillForGold, RARITY_META, GOLD_TO_WHITE_MAP, getSkillRarityStyle } from "../lib/skill-rarity";
import { getDefaultChoiceIndex } from "../lib/deck/event-choices";
import { evaluateSkillActivation } from "../lib/parenting/skill-evaluator";
import SkillIcon from "./skill-icon";
import { TargetIcon, CheckIcon, XIcon, ChevronDownIcon } from "./icons";

// Rarity label + chip colors. Rarity: 3 = SSR, 2 = SR, 1 = R.
type SortKey = "recommended" | "release" | "rarity" | "type" | "targetSkills";
type TypeKey =
  | "all"
  | "speed"
  | "stamina"
  | "power"
  | "guts"
  | "intelligence"
  | "friend"
  | "group";

const TYPES: TypeKey[] = ["all", "speed", "stamina", "power", "guts", "intelligence", "friend", "group"];
const TYPE_ORDER: Record<TypeKey, number> = {
  all: 0,
  speed: 1,
  stamina: 2,
  power: 3,
  guts: 4,
  intelligence: 5,
  friend: 6,
  group: 7,
};

function cardLabel(card: CardIndexEntry) {
  return card.nameEn || card.nameJp;
}

export default function CardPickerPopover({
  onPick,
  onClose,
  mode = "main",
  slotIndex,
}: {
  onPick: (card: CardIndexEntry) => void;
  onClose: () => void;
  mode?: "main" | "parent";
  slotIndex?: number | null;
}) {
  const {
    mainSkillIdSet,
    mainSlots,
    parentSlots,
    course,
    runningStyle,
    distance,
    surface,
    activePvpEvent,
    activePreset,
  } = useDeck();

  const [cards, setCards] = useState<CardIndexEntry[] | null>(null);
  const [skills, setSkills] = useState<SkillDetail[] | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>(mode === "parent" ? "recommended" : "rarity");
  const [type, setType] = useState<TypeKey>("all");
  const [selectedEffects, setSelectedEffects] = useState<SkillEffectCategory[]>([]);
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [inspectCard, setInspectCard] = useState<CardIndexEntry | null>(null);

  // Multi-skill filter states for Parent Deck
  const [selectedSkills, setSelectedSkills] = useState<SkillDetail[]>([]);
  const [skillMatchMode, setSkillMatchMode] = useState<"OR" | "AND">("OR");
  const [skillQuery, setSkillQuery] = useState("");
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);
  const [isSkillPanelOpen, setIsSkillPanelOpen] = useState(true);
  const skillSearchBoxRef = useRef<HTMLInputElement>(null);
  const skillDropdownRef = useRef<HTMLDivElement>(null);

  const { getLimitBreak, isOwned, totalOwned } = useOwnedCards();
  const searchBoxRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while popover is shown
  useBodyScrollLock(true);

  // Close skill dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        skillDropdownRef.current &&
        !skillDropdownRef.current.contains(event.target as Node) &&
        skillSearchBoxRef.current &&
        !skillSearchBoxRef.current.contains(event.target as Node)
      ) {
        setIsSkillDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load the full card index and skills once
  useEffect(() => {
    api.listCardIndex().then(setCards).catch(() => setCards([]));
    api.listSkills().then(setSkills).catch(() => setSkills([]));
  }, []);

  // Focus search box on open only on fine-pointer (desktop) devices to avoid popping soft keyboard on mobile
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
      searchBoxRef.current?.focus();
    }
  }, []);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Main & Parent cards presence sets
  const mainCardIdSet = useMemo(() => {
    return new Set(mainSlots.filter(Boolean).map((c) => c!.id));
  }, [mainSlots]);

  const parentCardIdSet = useMemo(() => {
    return new Set(parentSlots.filter(Boolean).map((c) => c!.id));
  }, [parentSlots]);

  // Character-identity occupancy within the CURRENT deck only: charKey -> equipped
  // card ids. Main and Parent decks are independent, so the other deck never
  // constrains this picker. A card is unpickable when its uma is occupied here by
  // a DIFFERENT card. The open slot's current occupant is excluded so replacing a
  // card never conflicts with itself.
  const occupiedCharMap = useMemo(() => {
    const map = new Map<string, Set<number>>();
    const slots = mode === "parent" ? parentSlots : mainSlots;
    slots.forEach((c, i) => {
      if (!c) return;
      if (i === slotIndex) return;
      const key = cardCharacterKey(c);
      const ids = map.get(key);
      if (ids) ids.add(c.id);
      else map.set(key, new Set([c.id]));
    });
    return map;
  }, [mainSlots, parentSlots, mode, slotIndex]);

  const { setup } = useParentingSetup();
  const targetChara = useMemo(() => {
    if (!setup.targetCharaId) return null;
    return charactersByCharId.get(setup.targetCharaId) || null;
  }, [setup.targetCharaId]);

  // Recommendations map for both parent and main deck modes
  const raceParams = useMemo(() => getPvpRaceParameters(activePvpEvent), [activePvpEvent]);

  const recommendationsMap = useMemo(() => {
    const isParent = mode === "parent";
    const recs = recommendCardsForParent({
      mainDeckSkillIds: isParent ? mainSkillIdSet : new Set(),
      equippedParentCardIds: isParent
        ? parentSlots.map((c) => c?.id ?? null)
        : mainSlots.map((c) => c?.id ?? null),
      course,
      style: runningStyle,
      distance,
      surface,
      limit: 600, // wider pool for search & sort
      raceParams,
      chainChoicesMap: isParent ? activePreset.parentChainChoices : activePreset.mainChainChoices,
    });
    return new Map<number, CardRecommendation>(recs.map((r) => [r.cardId, r]));
  }, [mode, mainSkillIdSet, parentSlots, mainSlots, course, runningStyle, distance, surface, raceParams, activePreset.parentChainChoices, activePreset.mainChainChoices]);

  interface EvaluatedTargetSkill {
    id: number;
    nameEn: string;
    nameJp: string;
    source: "hint" | "event";
    eventMeta?: {
      eventNameEn?: string;
      eventNameJp?: string;
      choiceIndex?: number;
    };
    categories: SkillEffectCategory[];
  }

  // Precompute evaluated target skills for parent deck mode:
  // - Gathers hint skills and selected event chain choice skills
  // - Rejects skills already owned in the main deck
  // - Converts Gold skills to inheritable White skills (rejects uninheritable)
  // - Verifies activation via evaluateSkillActivation (rejects style/rank traps and dead activations)
  const parentCardTargetSkillsMap = useMemo(() => {
    const map = new Map<number, EvaluatedTargetSkill[]>();
    if (!cards || mode !== "parent" || !course) return map;

    const activationCache = new Map<number, boolean>();
    const checkActivation = (sid: number) => {
      let cached = activationCache.get(sid);
      if (cached !== undefined) return cached;
      const res = evaluateSkillActivation(sid, course, runningStyle, raceParams);
      activationCache.set(sid, res.activates);
      return res.activates;
    };

    const parentChoices = activePreset.parentChainChoices;

    for (const c of cards) {
      const cardSkills: EvaluatedTargetSkill[] = [];
      const seenSids = new Set<number>();

      // 1. Hint skills
      for (const rawSid of c.hintSkills || []) {
        let sid = rawSid;
        const rawSkill = skillsById.get(rawSid);
        if (rawSkill?.rarity === 2) {
          const mapped = getInheritableSkillForGold(rawSid);
          if (!mapped) continue;
          sid = mapped.whiteId;
        }
        if (seenSids.has(sid) || mainSkillIdSet.has(sid)) continue;
        seenSids.add(sid);

        if (!checkActivation(sid)) continue;

        const resolvedSkill = skillsById.get(sid) || rawSkill;
        const cats = resolvedSkill ? classifySkillEffects(resolvedSkill) : ["other" as SkillEffectCategory];
        cardSkills.push({
          id: sid,
          nameEn: resolvedSkill?.nameEn || `Skill #${sid}`,
          nameJp: resolvedSkill?.nameJp || "",
          source: "hint",
          categories: cats,
        });
      }

      // 2. Event skills (respecting chosen/default event branch)
      const handledEventSkillIds = new Set<number>();
      if (c.eventDetails && c.eventDetails.length > 0) {
        for (const ev of c.eventDetails) {
          let chosenChoiceIndex = 1;
          if (ev.choices.length > 1) {
            const choiceKey = `${c.id}:${ev.eventId}`;
            chosenChoiceIndex =
              parentChoices?.[choiceKey] ??
              parentChoices?.[String(c.id)] ??
              getDefaultChoiceIndex(ev, (sid) => skillsById.get(sid)?.rarity ?? 1);
          }

          for (const ch of ev.choices) {
            for (const sId of ch.skillIds) handledEventSkillIds.add(sId);
          }

          const chosenChoice = ev.choices.find((ch) => ch.index === chosenChoiceIndex) ?? ev.choices[0];
          if (chosenChoice) {
            for (const rawSid of chosenChoice.skillIds) {
              let sid = rawSid;
              const rawSkill = skillsById.get(rawSid);
              if (rawSkill?.rarity === 2) {
                const mapped = getInheritableSkillForGold(rawSid);
                if (!mapped) continue;
                sid = mapped.whiteId;
              }
              if (seenSids.has(sid) || mainSkillIdSet.has(sid)) continue;
              seenSids.add(sid);

              if (!checkActivation(sid)) continue;

              const resolvedSkill = skillsById.get(sid) || rawSkill;
              const cats = resolvedSkill ? classifySkillEffects(resolvedSkill) : ["other" as SkillEffectCategory];
              cardSkills.push({
                id: sid,
                nameEn: resolvedSkill?.nameEn || `Skill #${sid}`,
                nameJp: resolvedSkill?.nameJp || "",
                source: "event",
                eventMeta: {
                  eventNameEn: ev.nameEn,
                  eventNameJp: ev.nameJp,
                  choiceIndex: chosenChoice.index,
                },
                categories: cats,
              });
            }
          }
        }
      }

      // 3. Fallback: Loose event skills not in eventDetails
      for (const rawSid of c.eventSkills || []) {
        if (handledEventSkillIds.has(rawSid)) continue;
        let sid = rawSid;
        const rawSkill = skillsById.get(rawSid);
        if (rawSkill?.rarity === 2) {
          const mapped = getInheritableSkillForGold(rawSid);
          if (!mapped) continue;
          sid = mapped.whiteId;
        }
        if (seenSids.has(sid) || mainSkillIdSet.has(sid)) continue;
        seenSids.add(sid);

        if (!checkActivation(sid)) continue;

        const resolvedSkill = skillsById.get(sid) || rawSkill;
        const cats = resolvedSkill ? classifySkillEffects(resolvedSkill) : ["other" as SkillEffectCategory];
        cardSkills.push({
          id: sid,
          nameEn: resolvedSkill?.nameEn || `Skill #${sid}`,
          nameJp: resolvedSkill?.nameJp || "",
          source: "event",
          categories: cats,
        });
      }

      map.set(c.id, cardSkills);
    }

    return map;
  }, [cards, mode, course, runningStyle, raceParams, activePreset.parentChainChoices, mainSkillIdSet]);

  // Precompute skill effect categories and names per card
  const { cardEffectMap, cardSkillNamesMap } = useMemo(() => {
    const effectMap = new Map<number, Set<SkillEffectCategory>>();
    const nameMap = new Map<number, string>();

    if (cards && skills) {
      const skillsByIdMap = new Map<number, SkillDetail>(skills.map((s) => [s.id, s]));
      const skillCatLookup = new Map<number, SkillEffectCategory[]>(
        skills.map((s) => [s.id, classifySkillEffects(s)])
      );

      for (const c of cards) {
        const cats = new Set<SkillEffectCategory>();
        const skillNames: string[] = [];

        const allSids = [...(c.eventSkills || []), ...(c.hintSkills || [])];
        for (const sid of allSids) {
          const sCats = skillCatLookup.get(sid);
          if (sCats) {
            for (const cat of sCats) cats.add(cat);
          }
          const s = skillsByIdMap.get(sid);
          if (s) {
            if (s.nameEn) skillNames.push(s.nameEn.toLowerCase());
            if (s.nameJp) skillNames.push(s.nameJp.toLowerCase());
          }
        }

        effectMap.set(c.id, cats);
        nameMap.set(c.id, skillNames.join(" "));
      }
    }

    return { cardEffectMap: effectMap, cardSkillNamesMap: nameMap };
  }, [cards, skills]);

  // Reverse map from White skill ID to all Gold skill IDs that map to it
  const whiteToGoldsMap = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const [goldIdStr, mapped] of Object.entries(GOLD_TO_WHITE_MAP)) {
      const gId = Number(goldIdStr);
      const existing = map.get(mapped.whiteId);
      if (existing) existing.push(gId);
      else map.set(mapped.whiteId, [gId]);
    }
    return map;
  }, []);

  // Set of equivalent IDs for each selected skill (including self, gold <-> white)
  const selectedSkillEquivMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const s of selectedSkills) {
      const equiv = new Set<number>([s.id]);
      const goldMapped = GOLD_TO_WHITE_MAP[String(s.id)];
      if (goldMapped) equiv.add(goldMapped.whiteId);
      const reverseGolds = whiteToGoldsMap.get(s.id);
      if (reverseGolds) {
        for (const gId of reverseGolds) equiv.add(gId);
      }
      map.set(s.id, equiv);
    }
    return map;
  }, [selectedSkills, whiteToGoldsMap]);

  // Pre-index granted skill IDs for each card (hints + events)
  const cardGrantedSkillsMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    if (!cards) return map;
    for (const c of cards) {
      const sids = new Set<number>();
      if (c.hintSkills) {
        for (const sid of c.hintSkills) sids.add(sid);
      }
      if (c.eventSkills) {
        for (const sid of c.eventSkills) sids.add(sid);
      }
      map.set(c.id, sids);
    }
    return map;
  }, [cards]);

  // Map of matched selected skills for each card
  const cardMatchedSelectedSkillsMap = useMemo(() => {
    const map = new Map<number, { matchedSkills: SkillDetail[]; count: number }>();
    if (!cards || mode !== "parent" || selectedSkills.length === 0) return map;

    for (const c of cards) {
      const granted = cardGrantedSkillsMap.get(c.id);
      if (!granted || granted.size === 0) {
        map.set(c.id, { matchedSkills: [], count: 0 });
        continue;
      }

      const matched: SkillDetail[] = [];
      for (const s of selectedSkills) {
        const equiv = selectedSkillEquivMap.get(s.id);
        if (!equiv) continue;
        let hasSkill = false;
        for (const sid of equiv) {
          if (granted.has(sid)) {
            hasSkill = true;
            break;
          }
        }
        if (hasSkill) matched.push(s);
      }
      map.set(c.id, { matchedSkills: matched, count: matched.length });
    }
    return map;
  }, [cards, mode, selectedSkills, selectedSkillEquivMap, cardGrantedSkillsMap]);

  // All skill IDs granted across all cards in index
  const allCardGrantedSkillIds = useMemo(() => {
    const set = new Set<number>();
    if (cards) {
      for (const c of cards) {
        if (c.hintSkills) for (const sid of c.hintSkills) set.add(sid);
        if (c.eventSkills) for (const sid of c.eventSkills) set.add(sid);
      }
    }
    return set;
  }, [cards]);

  // Filter available skills for autocomplete search
  const searchedSkills = useMemo(() => {
    if (!skills || !skillQuery.trim()) return [];
    const q = skillQuery.trim().toLowerCase();
    const selectedIds = new Set(selectedSkills.map((s) => s.id));

    const results: SkillDetail[] = [];
    for (const s of skills) {
      if (selectedIds.has(s.id)) continue;
      const equivGolds = whiteToGoldsMap.get(s.id);
      const goldMapped = GOLD_TO_WHITE_MAP[String(s.id)];
      const hasCardGrant =
        allCardGrantedSkillIds.has(s.id) ||
        Boolean(goldMapped && allCardGrantedSkillIds.has(goldMapped.whiteId)) ||
        Boolean(equivGolds && equivGolds.some((gid) => allCardGrantedSkillIds.has(gid)));

      if (!hasCardGrant) continue;

      const match =
        (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
        (s.nameJp && s.nameJp.toLowerCase().includes(q)) ||
        (s.descEn && s.descEn.toLowerCase().includes(q));

      if (match) {
        results.push(s);
        if (results.length >= 20) break;
      }
    }
    return results;
  }, [skills, skillQuery, selectedSkills, whiteToGoldsMap, allCardGrantedSkillIds]);

  const filtered = useMemo(() => {
    if (!cards) return [];
    const q = query.trim().toLowerCase();
    let list = cards.filter((c) => {
      // Owned filter
      if (onlyOwned && !isOwned(c.id)) return false;

      // Type filter
      if (type !== "all" && c.type !== type) return false;

      // Multi-select Specific Skills filter (Parent mode only)
      if (mode === "parent" && selectedSkills.length > 0) {
        const matchInfo = cardMatchedSelectedSkillsMap.get(c.id);
        const count = matchInfo?.count ?? 0;
        if (skillMatchMode === "AND") {
          if (count < selectedSkills.length) return false;
        } else {
          if (count === 0) return false;
        }
      }

      // Multi-select Effect Category filter
      if (selectedEffects.length > 0) {
        if (mode === "parent") {
          const cardTargetSkills = parentCardTargetSkillsMap.get(c.id) ?? [];
          const hasMatchingSkill = cardTargetSkills.some((s) =>
            s.categories.some((cat) => selectedEffects.includes(cat))
          );
          if (!hasMatchingSkill) return false;
        } else {
          const cardCats = cardEffectMap.get(c.id);
          if (!cardCats || !selectedEffects.some((cat) => cardCats.has(cat))) return false;
        }
      }

      // Query (Card Name OR Granted Skill Names)
      if (q) {
        const cardNameMatch = `${c.nameEn} ${c.nameJp}`.toLowerCase().includes(q);
        const skillNameMatch = cardSkillNamesMap.get(c.id)?.includes(q);
        if (!cardNameMatch && !skillNameMatch) return false;
      }

      return true;
    });

    if (mode === "parent" && selectedSkills.length > 0) {
      list = [...list].sort((a, b) => {
        const countA = cardMatchedSelectedSkillsMap.get(a.id)?.count ?? 0;
        const countB = cardMatchedSelectedSkillsMap.get(b.id)?.count ?? 0;
        if (countA !== countB) return countB - countA;

        // Fallback to active sort when match counts are equal
        if (sort === "recommended") {
          const recA = recommendationsMap.get(a.id);
          const recB = recommendationsMap.get(b.id);
          const scoreA = recA?.score ?? -1;
          const scoreB = recB?.score ?? -1;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return b.rarity - a.rarity || (a.type ?? "").localeCompare(b.type ?? "");
        } else if (sort === "release") {
          const relA = a.release || "";
          const relB = b.release || "";
          if (relB !== relA) return relB.localeCompare(relA);
          return b.rarity - a.rarity || b.id - a.id;
        } else if (sort === "rarity") {
          return b.rarity - a.rarity || (a.type ?? "").localeCompare(b.type ?? "");
        } else if (sort === "targetSkills") {
          const skillsListA = parentCardTargetSkillsMap.get(a.id) ?? [];
          const skillsListB = parentCardTargetSkillsMap.get(b.id) ?? [];
          return skillsListB.length - skillsListA.length || b.rarity - a.rarity;
        } else if (sort === "type") {
          return (TYPE_ORDER[a.type as TypeKey] ?? 99) - (TYPE_ORDER[b.type as TypeKey] ?? 99) || b.rarity - a.rarity;
        }
        return 0;
      });
      return list;
    }

    if (sort === "recommended") {
      list = [...list].sort((a, b) => {
        const recA = recommendationsMap.get(a.id);
        const recB = recommendationsMap.get(b.id);
        const scoreA = recA?.score ?? -1;
        const scoreB = recB?.score ?? -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b.rarity - a.rarity || (a.type ?? "").localeCompare(b.type ?? "");
      });
    } else if (sort === "release") {
      list = [...list].sort((a, b) => {
        const relA = a.release || "";
        const relB = b.release || "";
        if (relB !== relA) return relB.localeCompare(relA);
        return b.rarity - a.rarity || b.id - a.id;
      });
    } else if (sort === "rarity") {
      list = [...list].sort((a, b) => b.rarity - a.rarity || (a.type ?? "").localeCompare(b.type ?? ""));
    } else if (sort === "targetSkills") {
      // Sort by the count of active target skills matching the current effect filter
      const countFor = (id: number) => {
        const skillsList = parentCardTargetSkillsMap.get(id) ?? [];
        if (selectedEffects.length > 0) {
          return skillsList.filter((s) => s.categories.some((cat) => selectedEffects.includes(cat))).length;
        }
        return skillsList.length;
      };
      list = [...list].sort(
        (a, b) =>
          countFor(b.id) - countFor(a.id) || b.rarity - a.rarity || (a.type ?? "").localeCompare(b.type ?? ""),
      );
    } else if (sort === "type") {
      list = [...list].sort(
        (a, b) => (TYPE_ORDER[a.type as TypeKey] ?? 99) - (TYPE_ORDER[b.type as TypeKey] ?? 99) || b.rarity - a.rarity,
      );
    }
    return list;
  }, [cards, query, type, selectedEffects, cardEffectMap, cardSkillNamesMap, parentCardTargetSkillsMap, sort, mode, recommendationsMap, onlyOwned, isOwned, selectedSkills, skillMatchMode, cardMatchedSelectedSkillsMap]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200 ease-out-quart touch-none overscroll-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pick Support Card"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88dvh] max-h-[92dvh] sm:h-[90vh] sm:max-h-[860px] w-full sm:max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-[250ms] ease-out-expo text-left overscroll-contain touch-pan-y"
      >
        {/* Mobile drag handle */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* Search + Sort Header */}
        <div className="border-b border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <input
              ref={searchBoxRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards by English or Japanese name…"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-emerald-500 dark:focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-[13px] text-zinc-700 dark:text-zinc-200 outline-none cursor-pointer"
            >
              <option value="recommended">Sort: Recommended</option>
              {mode === "parent" && <option value="targetSkills">Sort: Target Skills</option>}
              <option value="release">Sort: Release Date</option>
              <option value="rarity">Sort: Rarity</option>
              <option value="type">Sort: Type</option>
            </select>

            {totalOwned > 0 && (
              <button
                type="button"
                onClick={() => setOnlyOwned(!onlyOwned)}
                className={`rounded-md border px-2 py-1 text-[13px] font-semibold transition-colors cursor-pointer ${
                  onlyOwned
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-300"
                    : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {onlyOwned ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckIcon className="h-3 w-3" />
                    <span>Owned Only</span>
                  </span>
                ) : (
                  "Filter: All Cards"
                )}
              </button>
            )}

            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium ml-auto">
              {mode === "parent" ? "Parent Deck Mode" : "Support Deck Mode"}
            </span>
          </div>

          {/* Type Filter Pills */}
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 sm:px-2 py-1 sm:py-0.5 text-[12px] sm:text-[11px] min-h-[28px] sm:min-h-0 font-medium transition-colors cursor-pointer shrink-0 ${
                  type === t
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs font-semibold"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {t !== "all" && <CardTypeIcon type={t} className="h-3 w-3 object-contain" />}
                <span className="capitalize">{formatCardType(t)}</span>
              </button>
            ))}
          </div>

          {/* Skill Effect Filter Chips */}
          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedEffects([])}
              className={`rounded-full px-2.5 sm:px-2 py-1 sm:py-0.5 text-[11px] sm:text-[10px] min-h-[28px] sm:min-h-0 font-semibold transition-colors cursor-pointer shrink-0 ${
                selectedEffects.length === 0
                  ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              All Effects
            </button>
            {EFFECT_CATEGORIES.map((cat) => {
              const isSelected = selectedEffects.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedEffects((prev) =>
                      prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                    );
                  }}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 sm:px-2 py-1 sm:py-0.5 text-[11px] sm:text-[10px] min-h-[28px] sm:min-h-0 font-semibold transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-2xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                  title={cat.description}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cat.dotColor} ${isSelected ? "ring-1 ring-white" : ""}`} />
                  <span>{cat.label}</span>
                  {isSelected && <span className="text-[10px] ml-0.5 font-bold">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Multi-Skill Filter (Parent Mode only - Flat layout, no nested box) */}
          {mode === "parent" && (
            <div className="pt-2.5 mt-2 border-t border-zinc-200/70 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 shrink-0">
                    <TargetIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Filter by Skills</span>
                  </span>
                  {selectedSkills.length > 0 && (
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 shrink-0">
                      {selectedSkills.length} selected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedSkills.length > 1 && (
                    <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setSkillMatchMode("OR")}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                          skillMatchMode === "OR"
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                        title="Show cards granting ANY of the selected skills"
                      >
                        ANY (OR)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkillMatchMode("AND")}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                          skillMatchMode === "AND"
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                        title="Show cards granting ALL of the selected skills"
                      >
                        ALL (AND)
                      </button>
                    </div>
                  )}

                  {selectedSkills.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSkills([])}
                      className="text-[11px] font-semibold text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsSkillPanelOpen(!isSkillPanelOpen)}
                    className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    aria-label={isSkillPanelOpen ? "Collapse skill panel" : "Expand skill panel"}
                  >
                    <ChevronDownIcon
                      className={`h-3.5 w-3.5 transform transition-transform ${isSkillPanelOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {isSkillPanelOpen && (
                <div className="mt-2 space-y-2">
                  {/* Skill Search Input & Autocomplete Dropdown */}
                  <div className="relative">
                    <input
                      ref={skillSearchBoxRef}
                      value={skillQuery}
                      onChange={(e) => {
                        setSkillQuery(e.target.value);
                        setIsSkillDropdownOpen(true);
                      }}
                      onFocus={() => setIsSkillDropdownOpen(true)}
                      placeholder="Search skill to filter (e.g. Arc Maestro, Tail Flare)…"
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-emerald-500 dark:focus:border-emerald-500"
                    />
                    {skillQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSkillQuery("");
                          setIsSkillDropdownOpen(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                        aria-label="Clear skill query"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Autocomplete Dropdown */}
                    {isSkillDropdownOpen && searchedSkills.length > 0 && (
                      <div
                        ref={skillDropdownRef}
                        className="absolute left-0 right-0 top-full z-[120] mt-1 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl divide-y divide-zinc-100 dark:divide-zinc-800"
                      >
                        {searchedSkills.map((s) => {
                          const rarityStyle = getSkillRarityStyle(s.rarity);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedSkills((prev) => [...prev, s]);
                                setSkillQuery("");
                                setIsSkillDropdownOpen(false);
                              }}
                              className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              <SkillIcon iconId={s.iconId} name={s.nameEn} size={18} className="h-4 w-4 object-contain shrink-0" />
                              <span className={`px-1 py-0.2 rounded text-[9px] font-bold shrink-0 ${rarityStyle.badgeClass}`}>
                                {rarityStyle.badgeLabel}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                  {s.nameEn || s.nameJp}
                                </p>
                                {s.nameJp && s.nameEn && (
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                                    {s.nameJp}
                                  </p>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                + Add
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Selected Skill Tags */}
                  {selectedSkills.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {selectedSkills.map((s) => {
                        const rarityStyle = getSkillRarityStyle(s.rarity);
                        return (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 shadow-2xs"
                          >
                            <SkillIcon iconId={s.iconId} name={s.nameEn} size={14} className="h-3.5 w-3.5 object-contain shrink-0" />
                            <span className={`px-1 py-0.2 rounded text-[8px] font-bold ${rarityStyle.badgeClass}`}>
                              {rarityStyle.badgeLabel}
                            </span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px] sm:max-w-[200px]">
                              {s.nameEn || s.nameJp}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedSkills((prev) => prev.filter((item) => item.id !== s.id))}
                              className="ml-0.5 p-0.5 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                              title="Remove skill"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cards List */}
        <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {!cards ? (
            <p className="p-4 text-[13px] text-zinc-400 dark:text-zinc-500">Loading cards…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-[13px] text-zinc-400 dark:text-zinc-500">{query ? "No matches found." : "No cards."}</p>
          ) : (
            <ul>
              {filtered.map((c) => {
                const isInMain = mainCardIdSet.has(c.id);
                const isInParent = parentCardIdSet.has(c.id);

                // Target skills: only valid activating skills that match selected effect filter (or all if none selected)
                const cardTargetSkills = parentCardTargetSkillsMap.get(c.id) ?? [];
                const displaySkills = selectedEffects.length > 0
                  ? cardTargetSkills.filter((s) => s.categories.some((cat) => selectedEffects.includes(cat)))
                  : cardTargetSkills;
                const targetSkillsCount = displaySkills.length;

                const isTraineeCard = Boolean(
                  targetChara &&
                  (c.nameEn?.toLowerCase() === targetChara.nameEn?.toLowerCase() ||
                   c.nameJp === targetChara.nameJp)
                );
                // Trainee cards are only prohibited in the Main Deck (the trainee
                // cannot equip their own card); the Parent Deck targets P1/P2, so
                // a trainee-character card is fine there.
                const isTraineeBlocked = isTraineeCard && mode === "main";
                const occupantIds = occupiedCharMap.get(cardCharacterKey(c));
                const isCharConflict = Boolean(occupantIds && !occupantIds.has(c.id));
                const isDisabled = isTraineeBlocked || isCharConflict;
                const targetSkillsTitle = displaySkills
                  .map(
                    (s) =>
                      `• ${s.nameEn}${
                        s.eventMeta
                          ? ` (${s.eventMeta.eventNameEn || s.eventMeta.eventNameJp}${s.eventMeta.choiceIndex ? ` - Choice ${s.eventMeta.choiceIndex}` : ""})`
                          : ` (Hint)`
                      }`,
                  )
                  .join("\n");
                const showTargetSkills = mode === "parent" && targetSkillsCount > 0;
                const matchedInfo = cardMatchedSelectedSkillsMap.get(c.id);
                const hasMatchedSkills = Boolean(mode === "parent" && selectedSkills.length > 0 && matchedInfo && matchedInfo.count > 0);

                return (
                  <li
                    key={c.id}
                    className={`transition-colors ${
                      isTraineeBlocked
                        ? "bg-rose-50/40 dark:bg-rose-950/20 opacity-60 border-l-2 border-rose-500"
                        : isCharConflict
                        ? "opacity-60"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex w-full items-center gap-3 px-3 sm:px-3.5 py-2.5">
                      {/* 1. Card Portrait (Click to pick) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isDisabled) return;
                          onPick(c);
                        }}
                        disabled={isDisabled}
                        className={`shrink-0 focus:outline-hidden ${
                          isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                        aria-label={
                          isTraineeBlocked
                            ? `Cannot select Trainee card ${cardLabel(c)}`
                            : isCharConflict
                            ? `${cardLabel(c)} unavailable: this uma is already equipped on another card`
                            : `Select ${cardLabel(c)}`
                        }
                      >
                        <img
                          src={c.portraitUrl || c.imgUrl}
                          alt=""
                          className="h-10 w-10 object-contain shrink-0"
                          loading="lazy"
                        />
                      </button>

                      {/* 2. Middle & Right: 2-Row Stack */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Left: Rarity + Name + Badges | Right: Type Icon + Skills ↗ */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isDisabled) return;
                              onPick(c);
                            }}
                            disabled={isDisabled}
                            className={`flex flex-1 min-w-0 items-center gap-1.5 text-left flex-wrap focus:outline-hidden ${
                              isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                            }`}
                          >
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase shrink-0 ${
                                RARITY_META[c.rarity]?.chip ?? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              }`}
                            >
                              {RARITY_META[c.rarity]?.label ?? "R"}
                            </span>
                            <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {cardLabel(c)}
                            </span>
                            {isTraineeBlocked && (
                              <span className="rounded bg-rose-500/20 dark:bg-rose-950/80 px-1.5 py-0.2 text-[10px] font-bold text-rose-700 dark:text-rose-300 border border-rose-500/40 shrink-0">
                                Trainee Card (Prohibited)
                              </span>
                            )}
                            {isInMain && (
                              <span className="rounded bg-amber-200/90 dark:bg-amber-950/80 px-1 py-0.2 text-[10px] font-bold text-amber-950 dark:text-amber-100 border border-amber-400/80 dark:border-amber-700 shrink-0">
                                In Main
                              </span>
                            )}
                            {isInParent && (
                              <span className="rounded bg-zinc-200 dark:bg-zinc-800 px-1 py-0.2 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                                Equipped
                              </span>
                            )}
                          </button>

                          {/* Top Right (desktop): Matched skills + Target skills + Same Uma + Ownership + Type Icon + Skills ↗ */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasMatchedSkills && (
                              <span
                                className="hidden sm:inline-flex items-center gap-1 rounded bg-emerald-600 dark:bg-emerald-500 text-white px-1.5 py-0.2 text-[11px] font-bold shadow-2xs shrink-0"
                                title={matchedInfo?.matchedSkills.map((s) => `• ${s.nameEn || s.nameJp}`).join("\n")}
                              >
                                <CheckIcon className="h-3 w-3" />
                                <span>{matchedInfo!.count}/{selectedSkills.length} Skills</span>
                              </span>
                            )}
                            {showTargetSkills && (
                              <span
                                className="hidden sm:inline-flex rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                title={targetSkillsTitle}
                              >
                                +{targetSkillsCount} target skill{targetSkillsCount > 1 ? "s" : ""}
                              </span>
                            )}
                            {isCharConflict && (
                              <span
                                className="hidden sm:inline-flex rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-400/60 dark:border-zinc-600 shrink-0"
                                title="This uma is already equipped on another card in your decks — two different cards of the same uma cannot be active at once."
                              >
                                Same Uma
                              </span>
                            )}
                            {(() => {
                              const lb = getLimitBreak(c.id);
                              // Fixed width (fits "Unowned", the widest state) so the
                              // ownership column — and the target-skills badge to its
                              // left — aligns across every row.
                              if (lb === undefined) {
                                return (
                                  <span className="inline-flex w-11 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 py-0.2 text-[10px] font-medium text-zinc-400 shrink-0">
                                    Unowned
                                  </span>
                                );
                              }
                              if (lb === 4) {
                                return (
                                  <span className="inline-flex w-11 items-center justify-center rounded bg-amber-500/20 py-0.2 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-500/40 shrink-0">
                                    MLB
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex w-11 items-center justify-center rounded bg-sky-500/20 py-0.2 text-[10px] font-bold text-sky-800 dark:text-sky-300 border border-sky-500/30 shrink-0">
                                  {lb} LB
                                </span>
                              );
                            })()}
                            <span
                              className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400 capitalize"
                              title={`${formatCardType(c.type)} type`}
                            >
                              <CardTypeIcon type={c.type} className="h-4 w-4 object-contain" />
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectCard(c);
                              }}
                              className="rounded-lg border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-0.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 shadow-2xs transition-all cursor-pointer"
                              title="Quickly inspect all skills and events from this card"
                            >
                              Skills ↗
                            </button>
                          </div>
                        </div>

                        {/* Mobile-only line: Matched skills + Target skills (parent) + Same Uma */}
                        {(hasMatchedSkills || showTargetSkills || isCharConflict) && (
                          <div className="flex items-center gap-1.5 mt-1.5 sm:hidden">
                            {hasMatchedSkills && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-600 dark:bg-emerald-500 text-white px-1.5 py-0.2 text-[10px] font-bold shadow-2xs shrink-0">
                                <CheckIcon className="h-2.5 w-2.5" />
                                <span>{matchedInfo!.count}/{selectedSkills.length} Skills</span>
                              </span>
                            )}
                            {showTargetSkills && (
                              <span
                                className="inline-flex rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                title={targetSkillsTitle}
                              >
                                +{targetSkillsCount} target skill{targetSkillsCount > 1 ? "s" : ""}
                              </span>
                            )}
                            {isCharConflict && (
                              <span
                                className="inline-flex rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-400/60 dark:border-zinc-600 shrink-0"
                                title="This uma is already equipped on another card in your decks — two different cards of the same uma cannot be active at once."
                              >
                                Same Uma
                              </span>
                            )}
                          </div>
                        )}

                        {/* Matched skills pill row (Parent mode when filtering by skills) */}
                        {hasMatchedSkills && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {matchedInfo!.matchedSkills.map((s) => (
                              <span
                                key={s.id}
                                className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 text-[10px] font-semibold"
                              >
                                <SkillIcon iconId={s.iconId} name={s.nameEn} size={12} className="h-3 w-3 object-contain shrink-0" />
                                <span className="truncate max-w-[130px] sm:max-w-[200px]">{s.nameEn || s.nameJp}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Row 2: Left: Japanese descriptor | Right: Release date */}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (isDisabled) return;
                              onPick(c);
                            }}
                            disabled={isDisabled}
                            className={`text-[12px] text-zinc-400 dark:text-zinc-500 truncate text-left flex-1 focus:outline-hidden ${
                              isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                            }`}
                          >
                            {c.nameJp}
                          </button>
                          {c.release && (
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono shrink-0">
                              Release: {c.release}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Card Skills Sheet Modal */}
      {inspectCard && (
        <CardSkillsSheet
          card={inspectCard}
          isOpen={Boolean(inspectCard)}
          onClose={() => setInspectCard(null)}
          mode={mode}
          onPick={(picked) => {
            setInspectCard(null);
            onPick(picked);
          }}
        />
      )}
    </div>
  );
}
