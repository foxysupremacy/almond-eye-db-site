"use client";

import { AppSelect } from "@/app/common/ui/controls/app-select";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { PickerSearchBar } from "@/app/common/ui/controls/picker-search-bar";
import { Radio, RadioGroup } from "react-aria-components/RadioGroup";
import { ToggleButton } from "react-aria-components/ToggleButton";
import { ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import { CardTargetSkillSearch } from "./card-target-skill-search";

// Popover listing ALL support cards for one deck slot, with search + sort by
// recommendation score (for parent farming), rarity (SSR/SR/R), or type.
// Composes standard interaction controls inside a custom card-selection layout.

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type CardIndexEntry, type SkillDetail } from "@/lib/api";
import { useDeck } from "@/features/deck/state";
import { recommendCardsForParent, type CardRecommendation } from "@/lib/recommendation/engine";
import CardTypeIcon, { formatCardType } from "@/app/common/ui/cards/card-type-icon";
import { classifySkillEffects, type SkillEffectCategory } from "@/lib/skills/effects";
import { EFFECT_CATEGORIES } from "@/app/common/ui/skills/skill-effects";
import { useOwnedCards } from "@/app/common/hooks/use-owned-cards";
import CardSkillsSheet from "@/features/deck/components/card-skills-sheet";
import { getPvpRaceParameters } from "@/lib/pvp/events";
import { useParentingSetup } from "@/features/parenting/hooks";
import { cardCharacterKey } from "@/lib/deck/card-constraints";
import { charactersByCharId, charactersById, skillsById } from "@/lib/api";
import { resolveTargetCharacter } from "@/lib/parenting/pedigree-resolvers";
import { getInheritableSkillForGold, GOLD_TO_WHITE_MAP } from "@/lib/skills/rarity";
import { getSkillRarityStyle, RARITY_META } from "@/app/common/ui/skills/skill-rarity";
import { getDefaultChoiceIndex } from "@/lib/deck/event-choices";
import { evaluateSkillActivation } from "@/lib/parenting/skill-evaluator";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import { TargetIcon, CheckIcon, XIcon, ChevronDownIcon } from "@/app/common/ui/primitives/icons";
import { Badge } from "@/app/common/ui/primitives/badge";
import {
  CARD_PICKER_TYPES,
  filterAndSortCards,
  type CardPickerSort,
  type CardPickerType,
  type EvaluatedTargetSkill,
} from "./model/card-filter";
import { cardPickerAdapter } from "./model/card-picker-state";
import { usePickerController } from "@/app/common/hooks/use-picker-controller";

function cardLabel(card: CardIndexEntry) {
  return card.nameEn || card.nameJp;
}

// Leave the first frame free for the picker shell to become visibly usable.
const PICKER_WORK_DELAY_MS = 250;

function CardPickerSkeleton({ mode, label }: { mode: "main" | "parent"; label: string }) {
  return (
    <div role="status" aria-label={label} aria-live="polite" className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} aria-hidden="true" className="flex items-center gap-3 px-3 py-2.5 sm:px-3.5 animate-pulse">
          <div className="h-10 w-10 flex-none rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="h-4 w-7 flex-none rounded bg-zinc-200 dark:bg-zinc-800" />
                <span className={`h-3.5 rounded bg-zinc-200 dark:bg-zinc-800 ${index % 3 === 0 ? "w-24 sm:w-36" : "w-20 sm:w-28"}`} />
              </div>
              <div className="flex flex-none items-center gap-2">
                {mode === "parent" && <span className="hidden h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800 sm:block" />}
                <span className="h-4 w-11 rounded bg-zinc-200 dark:bg-zinc-800" />
                <span className="h-5 w-5 rounded bg-zinc-200 dark:bg-zinc-800" />
                <span className="hidden h-5 w-12 rounded bg-zinc-200 dark:bg-zinc-800 sm:block" />
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="h-2.5 w-32 max-w-[55%] rounded bg-zinc-200 dark:bg-zinc-800" />
              <span className="hidden h-2.5 w-24 rounded bg-zinc-200 dark:bg-zinc-800 sm:block" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Rarity label + chip colors. Rarity: 3 = SSR, 2 = SR, 1 = R.

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
    activeRaceParameters,
    activePreset,
  } = useDeck();
  const { state, view, dispatch } = usePickerController(cardPickerAdapter, mode);

  const [cards, setCards] = useState<CardIndexEntry[] | null>(null);
  const [skills, setSkills] = useState<SkillDetail[] | null>(null);
  const { query, sort, type, selectedEffects, onlyOwned, selectedSkills, skillMatchMode, skillQuery, isSkillPanelOpen } = state;
  const [inspectCard, setInspectCard] = useState<CardIndexEntry | null>(null);

  // Multi-skill filter states for Parent Deck

  const { getLimitBreak, isOwned, totalOwned } = useOwnedCards();
  const searchBoxRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);


  // Keep the first picker frame light; loading these cached datasets can
  // immediately trigger a large card list render on the same click.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = window.requestAnimationFrame(() => {
      timer = setTimeout(() => {
        api.listCardIndex()
          .then((result) => { if (!cancelled) setCards(result); })
          .catch(() => { if (!cancelled) setCards([]); });
        api.listSkills()
          .then((result) => { if (!cancelled) setSkills(result); })
          .catch(() => { if (!cancelled) setSkills([]); });
      }, PICKER_WORK_DELAY_MS);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);


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
    return resolveTargetCharacter(setup, charactersById, charactersByCharId);
  }, [setup]);

  // Recommendations map for both parent and main deck modes
  const raceParams = activeRaceParameters;

  const [recommendationsMap, setRecommendationsMap] = useState<Map<number, CardRecommendation> | null>(null);
  useEffect(() => {
    if (sort !== "recommended") return;
    // Course evaluation across the entire card index is expensive. Let the
    // picker frame paint before starting it so the click responds immediately.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = window.requestAnimationFrame(() => {
      timer = setTimeout(() => {
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
        setRecommendationsMap(new Map(recs.map((r) => [r.cardId, r])));
      }, PICKER_WORK_DELAY_MS);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [sort, mode, mainSkillIdSet, parentSlots, mainSlots, course, runningStyle, distance, surface, raceParams, activePreset.parentChainChoices, activePreset.mainChainChoices]);

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
    const q = view.normalizedSkillQuery;
    const selectedIds = view.selectedSkillIds;

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

  const filtered = useMemo(
    () =>
      filterAndSortCards({
        cards,
        query,
        type,
        selectedEffects,
        cardEffectMap,
        cardSkillNamesMap,
        parentCardTargetSkillsMap,
        sort,
        mode,
        recommendationsMap: recommendationsMap ?? new Map(),
        onlyOwned,
        isOwned,
        selectedSkillCount: selectedSkills.length,
        skillMatchMode,
        cardMatchedSelectedSkillsMap,
      }),
    [
      cards,
      query,
      type,
      selectedEffects,
      cardEffectMap,
      cardSkillNamesMap,
      parentCardTargetSkillsMap,
      sort,
      mode,
      recommendationsMap,
      onlyOwned,
      isOwned,
      selectedSkills.length,
      skillMatchMode,
      cardMatchedSelectedSkillsMap,
    ],
  );

  return (
    <>
      <AppDialog
        isOpen
        onOpenChange={(open) => { if (!open) onClose(); }}
        title="Pick Support Card"
        ariaLabel="Pick Support Card"
        size="full"
        dialogRef={panelRef}
        header={<></>}
        bodyClassName="contents"
        className="text-left overscroll-contain touch-pan-y"
      >
        {/* Mobile drag handle */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* Search + Sort Header */}
        <div className="border-b border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <PickerSearchBar
              inputRef={searchBoxRef}
              value={query}
              onChange={(value) => dispatch({ type: "queryChanged", value })}
              placeholder="Search cards by English or Japanese name…"
              label="Search support cards"
              autoFocus
              inputClassName="min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 sm:min-h-0 sm:px-2.5 sm:py-1.5 sm:text-[13px]"
            />
            <AppButton variant="quiet" iconOnly onPress={onClose} aria-label="Close support card picker">
              <XIcon className="h-4 w-4" />
            </AppButton>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AppSelect
              value={sort}
              onValueChange={(value) => dispatch({ type: "sortChanged", value: value as CardPickerSort })}
              className="min-h-11 flex-1 sm:flex-none"
             label="Sort cards" options={[{ value: "recommended", label: "Sort: Recommended" }, ...(mode === "parent" ? [{ value: "targetSkills", label: "Sort: Target Skills" }] : []), { value: "release", label: "Sort: Release Date" }, { value: "rarity", label: "Sort: Rarity" }, { value: "type", label: "Sort: Type" }]} />

            {totalOwned > 0 && (
              <ToggleButton
                isSelected={onlyOwned}
                onChange={() => dispatch({ type: "ownershipToggled" })}
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
              </ToggleButton>
            )}

            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium ml-auto">
              {mode === "parent" ? "Parent Deck Mode" : "Support Deck Mode"}
            </span>
          </div>

          {/* Type Filter Pills */}
          <RadioGroup aria-label="Support card type" value={type} onChange={(value) => dispatch({ type: "typeChanged", value: value as CardPickerType })} orientation="horizontal" className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {CARD_PICKER_TYPES.map((t) => (
              <Radio
                key={t}
                value={t}
                aria-label={formatCardType(t)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 sm:px-2 py-1 sm:py-0.5 text-[12px] sm:text-[11px] min-h-11 sm:min-h-8 font-medium transition-colors cursor-pointer shrink-0 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-emerald-500/70 ${
                  type === t
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs font-semibold"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {t !== "all" && <CardTypeIcon type={t} className="h-3 w-3 object-contain" />}
                <span className="capitalize">{formatCardType(t)}</span>
              </Radio>
            ))}
          </RadioGroup>

          {/* Skill Effect Filter Chips */}
          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <AppButton variant={selectedEffects.length === 0 ? "primary" : "quiet"} onPress={() => dispatch({ type: "effectsCleared" })}>All Effects</AppButton>
            <ToggleButtonGroup aria-label="Filter cards by skill effect" selectionMode="multiple" selectedKeys={selectedEffects} onSelectionChange={(keys) => {
              const next = Array.from(keys) as SkillEffectCategory[];
              for (const category of EFFECT_CATEGORIES) {
                if (next.includes(category.id) !== selectedEffects.includes(category.id)) dispatch({ type: "effectToggled", value: category.id });
              }
            }} className="flex items-center gap-1.5">
              {EFFECT_CATEGORIES.map((category) => <ToggleButton key={category.id} id={category.id} aria-description={category.description} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-600 outline-none transition-colors data-[selected]:border-emerald-700 data-[selected]:bg-emerald-700 data-[selected]:text-white data-[focus-visible]:ring-2 data-[focus-visible]:ring-emerald-500/70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:data-[selected]:bg-emerald-700 dark:data-[selected]:text-white sm:min-h-8">
                <span className={`h-1.5 w-1.5 rounded-full ${category.dotColor}`} />{category.label}
              </ToggleButton>)}
            </ToggleButtonGroup>
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
                    <Badge size="compact" tone="emerald" className="font-extrabold">
                      {selectedSkills.length} selected
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedSkills.length > 1 && (
                    <RadioGroup aria-label="Target skill matching" value={skillMatchMode} onChange={(value) => dispatch({ type: "skillMatchModeChanged", value: value as "OR" | "AND" })} orientation="horizontal" className="inline-flex gap-0.5 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
                      <Radio value="OR" className="flex min-h-11 cursor-pointer items-center rounded-md px-2 text-[11px] font-semibold outline-none data-[selected]:bg-emerald-700 data-[selected]:text-white data-[focus-visible]:ring-2 data-[focus-visible]:ring-emerald-500 sm:min-h-8">ANY (OR)</Radio>
                      <Radio value="AND" className="flex min-h-11 cursor-pointer items-center rounded-md px-2 text-[11px] font-semibold outline-none data-[selected]:bg-emerald-700 data-[selected]:text-white data-[focus-visible]:ring-2 data-[focus-visible]:ring-emerald-500 sm:min-h-8">ALL (AND)</Radio>
                    </RadioGroup>
                  )}

                  {selectedSkills.length > 0 && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "skillsCleared" })}
                      className="text-[11px] font-semibold text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => dispatch({ type: "skillPanelToggled" })}
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
                  <CardTargetSkillSearch query={skillQuery} results={searchedSkills} selected={selectedSkills}
                    onQueryChange={(value) => dispatch({ type: "skillQueryChanged", value })}
                    onAdd={(skill) => dispatch({ type: "skillAdded", skill })}
                    onRemove={(skillId) => dispatch({ type: "skillRemoved", skillId })} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cards List */}
        <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {!cards || (sort === "recommended" && !recommendationsMap) ? (
            <CardPickerSkeleton mode={mode} label={!cards ? "Loading support cards" : "Ranking recommendations"} />
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
      </AppDialog>

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
    </>
  );
}
