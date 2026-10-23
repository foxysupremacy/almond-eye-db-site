import { useState, useEffect, useMemo, useCallback } from "react";
import {
  api,
  type CardIndexEntry,
  type SkillDetail,
  charactersById,
  charactersByCharId,
  skillsById,
} from "@/lib/api";
import { useDeck } from "@/features/deck/state";
import { useOwnedCards } from "@/app/common/hooks/use-owned-cards";
import { useParentingSetup } from "@/features/parenting/hooks";
import { cardCharacterKey } from "@/lib/deck/card-constraints";
import { resolveTargetCharacter } from "@/lib/parenting/pedigree-resolvers";
import { recommendCardsForParent, type CardRecommendation } from "@/lib/recommendation/engine";
import { classifySkillEffects, type SkillEffectCategory } from "@/lib/skills/effects";
import { getInheritableSkillForGold, GOLD_TO_WHITE_MAP } from "@/lib/skills/rarity";
import { getDefaultChoiceIndex } from "@/lib/deck/event-choices";
import { evaluateSkillActivation } from "@/lib/parenting/skill-evaluator";
import {
  filterAndSortCards,
  type CardPickerSort,
  type CardPickerType,
  type EvaluatedTargetSkill,
} from "../pickers/model/card-filter";
import { cardPickerAdapter, type CardPickerState } from "../pickers/model/card-picker-state";
import { usePickerController } from "@/app/common/hooks/use-picker-controller";

const PICKER_WORK_DELAY_MS = 250;

export interface UseCardPickerViewModelOptions {
  mode?: "main" | "parent";
  slotIndex?: number | null;
  onPick: (card: CardIndexEntry) => void;
  onClose: () => void;
}

export interface CardPickerViewModelState {
  readonly mode: "main" | "parent";
  readonly cards: readonly CardIndexEntry[] | null;
  readonly skills: readonly SkillDetail[] | null;
  readonly pickerState: CardPickerState;
  readonly filteredCards: readonly CardIndexEntry[];
  readonly inspectCard: CardIndexEntry | null;
  readonly recommendationsMap: ReadonlyMap<number, CardRecommendation> | null;
  readonly parentCardTargetSkillsMap: ReadonlyMap<number, EvaluatedTargetSkill[]>;
  readonly cardMatchedSelectedSkillsMap: ReadonlyMap<number, { matchedSkills: SkillDetail[]; count: number }>;
  readonly searchedSkills: readonly SkillDetail[];
  readonly mainCardIdSet: ReadonlySet<number>;
  readonly parentCardIdSet: ReadonlySet<number>;
  readonly occupiedCharMap: ReadonlyMap<string, Set<number>>;
  readonly targetChara: ReturnType<typeof resolveTargetCharacter>;
  readonly isOwned: (cardId: number | string) => boolean;
  readonly getLimitBreak: (cardId: number | string) => number | undefined;
  readonly totalOwned: number;
}

export interface CardPickerViewModelCommands {
  readonly pickCard: (card: CardIndexEntry) => void;
  readonly openInspect: (card: CardIndexEntry) => void;
  readonly closeInspect: () => void;
  readonly setQuery: (query: string) => void;
  readonly setSort: (sort: CardPickerSort) => void;
  readonly setType: (type: CardPickerType) => void;
  readonly toggleOwnership: () => void;
  readonly clearEffects: () => void;
  readonly toggleEffect: (category: SkillEffectCategory) => void;
  readonly setSkillMatchMode: (mode: "OR" | "AND") => void;
  readonly clearSkills: () => void;
  readonly toggleSkillPanel: () => void;
  readonly setSkillQuery: (query: string) => void;
  readonly addSkill: (skill: SkillDetail) => void;
  readonly removeSkill: (skillId: number) => void;
  readonly close: () => void;
}

export interface CardPickerViewModel {
  readonly state: CardPickerViewModelState;
  readonly commands: CardPickerViewModelCommands;
}

export function useCardPickerViewModel({
  mode = "main",
  slotIndex,
  onPick,
  onClose,
}: UseCardPickerViewModelOptions): CardPickerViewModel {
  const {
    mainSkillIdSet,
    mainSlots,
    parentSlots,
    course,
    runningStyle,
    distance,
    surface,
    activeRaceParameters,
    activePreset,
  } = useDeck();

  const { state: pickerState, view, dispatch } = usePickerController(cardPickerAdapter, mode);

  const [cards, setCards] = useState<CardIndexEntry[] | null>(null);
  const [skills, setSkills] = useState<SkillDetail[] | null>(null);
  const [inspectCard, setInspectCard] = useState<CardIndexEntry | null>(null);

  const { getLimitBreak, isOwned, totalOwned } = useOwnedCards();

  // Async load card and skill catalogs
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

  const mainCardIdSetMemo = useMemo(() => {
    return new Set(mainSlots.filter(Boolean).map((c) => c!.id));
  }, [mainSlots]);

  const parentCardIdSet = useMemo(() => {
    return new Set(parentSlots.filter(Boolean).map((c) => c!.id));
  }, [parentSlots]);

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

  const raceParams = activeRaceParameters;

  // Recommendations map for both parent and main deck modes
  const [recommendationsMap, setRecommendationsMap] = useState<Map<number, CardRecommendation> | null>(null);
  useEffect(() => {
    if (pickerState.sort !== "recommended") return;
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
          limit: 600,
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
  }, [
    pickerState.sort,
    mode,
    mainSkillIdSet,
    parentSlots,
    mainSlots,
    course,
    runningStyle,
    distance,
    surface,
    raceParams,
    activePreset.parentChainChoices,
    activePreset.mainChainChoices,
  ]);

  // Target skills precomputation
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

      // 2. Event skills
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

      // 3. Fallback: Loose event skills
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

  const selectedSkillEquivMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const s of pickerState.selectedSkills) {
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
  }, [pickerState.selectedSkills, whiteToGoldsMap]);

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

  const cardMatchedSelectedSkillsMap = useMemo(() => {
    const map = new Map<number, { matchedSkills: SkillDetail[]; count: number }>();
    if (!cards || mode !== "parent" || pickerState.selectedSkills.length === 0) return map;

    for (const c of cards) {
      const granted = cardGrantedSkillsMap.get(c.id);
      if (!granted || granted.size === 0) {
        map.set(c.id, { matchedSkills: [], count: 0 });
        continue;
      }

      const matched: SkillDetail[] = [];
      for (const s of pickerState.selectedSkills) {
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
  }, [cards, mode, pickerState.selectedSkills, selectedSkillEquivMap, cardGrantedSkillsMap]);

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

  const searchedSkills = useMemo(() => {
    if (!skills || !pickerState.skillQuery.trim()) return [];
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
  }, [skills, pickerState.skillQuery, view.normalizedSkillQuery, view.selectedSkillIds, whiteToGoldsMap, allCardGrantedSkillIds]);

  const filteredCards = useMemo(
    () =>
      filterAndSortCards({
        cards,
        query: pickerState.query,
        type: pickerState.type,
        selectedEffects: pickerState.selectedEffects,
        cardEffectMap,
        cardSkillNamesMap,
        parentCardTargetSkillsMap,
        sort: pickerState.sort,
        mode,
        recommendationsMap: recommendationsMap ?? new Map(),
        onlyOwned: pickerState.onlyOwned,
        isOwned,
        selectedSkillCount: pickerState.selectedSkills.length,
        skillMatchMode: pickerState.skillMatchMode,
        cardMatchedSelectedSkillsMap,
      }),
    [
      cards,
      pickerState.query,
      pickerState.type,
      pickerState.selectedEffects,
      cardEffectMap,
      cardSkillNamesMap,
      parentCardTargetSkillsMap,
      pickerState.sort,
      mode,
      recommendationsMap,
      pickerState.onlyOwned,
      isOwned,
      pickerState.selectedSkills.length,
      pickerState.skillMatchMode,
      cardMatchedSelectedSkillsMap,
    ],
  );

  const pickCard = useCallback((card: CardIndexEntry) => {
    onPick(card);
  }, [onPick]);

  const openInspect = useCallback((card: CardIndexEntry) => {
    setInspectCard(card);
  }, []);

  const closeInspect = useCallback(() => {
    setInspectCard(null);
  }, []);

  const setQuery = useCallback((query: string) => {
    dispatch({ type: "queryChanged", value: query });
  }, [dispatch]);

  const setSort = useCallback((sort: CardPickerSort) => {
    dispatch({ type: "sortChanged", value: sort });
  }, [dispatch]);

  const setType = useCallback((type: CardPickerType) => {
    dispatch({ type: "typeChanged", value: type });
  }, [dispatch]);

  const toggleOwnership = useCallback(() => {
    dispatch({ type: "ownershipToggled" });
  }, [dispatch]);

  const clearEffects = useCallback(() => {
    dispatch({ type: "effectsCleared" });
  }, [dispatch]);

  const toggleEffect = useCallback((category: SkillEffectCategory) => {
    dispatch({ type: "effectToggled", value: category });
  }, [dispatch]);

  const setSkillMatchMode = useCallback((mode: "OR" | "AND") => {
    dispatch({ type: "skillMatchModeChanged", value: mode });
  }, [dispatch]);

  const clearSkills = useCallback(() => {
    dispatch({ type: "skillsCleared" });
  }, [dispatch]);

  const toggleSkillPanel = useCallback(() => {
    dispatch({ type: "skillPanelToggled" });
  }, [dispatch]);

  const setSkillQuery = useCallback((query: string) => {
    dispatch({ type: "skillQueryChanged", value: query });
  }, [dispatch]);

  const addSkill = useCallback((skill: SkillDetail) => {
    dispatch({ type: "skillAdded", skill });
  }, [dispatch]);

  const removeSkill = useCallback((skillId: number) => {
    dispatch({ type: "skillRemoved", skillId });
  }, [dispatch]);

  return {
    state: {
      mode,
      cards,
      skills,
      pickerState,
      filteredCards,
      inspectCard,
      recommendationsMap,
      parentCardTargetSkillsMap,
      cardMatchedSelectedSkillsMap,
      searchedSkills,
      mainCardIdSet: mainCardIdSetMemo,
      parentCardIdSet,
      occupiedCharMap,
      targetChara,
      isOwned,
      getLimitBreak,
      totalOwned,
    },
    commands: {
      pickCard,
      openInspect,
      closeInspect,
      setQuery,
      setSort,
      setType,
      toggleOwnership,
      clearEffects,
      toggleEffect,
      setSkillMatchMode,
      clearSkills,
      toggleSkillPanel,
      setSkillQuery,
      addSkill,
      removeSkill,
      close: onClose,
    },
  };
}
