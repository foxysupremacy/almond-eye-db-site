"use client";

import { useEffect, useMemo, useState } from "react";
import type { CardIndexEntry, SkillDetail } from "@/lib/api";
import type { Course, RaceParameters } from "@/lib/skill-engine/types";
import type { RunningStyle } from "@/lib/deck/types";
import { useRaceImpactProfile } from "@/app/common/hooks/use-race-impact-profile";
import { useSkillRatingSession } from "@/app/common/hooks/use-skill-rating-session";
import { evaluateSkillActivation } from "@/lib/parenting/skill-evaluator";
import { classifySkillEffects, type SkillEffectCategory } from "@/lib/skills/effects";
import { findDuplicateRecommendedCardSkillIds, hideDuplicateRecommendedCardSkills, includeCardsWithAdditionalSkills, projectAdditionalCardSkills, type GameRecommendedCardRow } from "@/features/deck/model/game-recommendation-projections";
import { canPlaceCard } from "@/lib/deck/card-constraints";
import CardTypeIcon, { formatCardType } from "@/app/common/ui/cards/card-type-icon";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import SkillHoverCard from "@/app/common/ui/skills/details/skill-hover-card";
import { RARITY_META } from "@/app/common/ui/skills/skill-rarity";

const CARD_TYPE_FILTERS = ["speed", "stamina", "power", "guts", "wit", "friend", "group"] as const;
const INITIAL_CARD_COUNT = 18;
const CARD_COUNT_INCREMENT = 12;

interface GameRecommendedCardListProps {
  rows: GameRecommendedCardRow[];
  allCards: CardIndexEntry[] | null;
  parentSlots: (CardIndexEntry | null)[];
  skillDetailMap: Map<number, SkillDetail>;
  effectFilter: readonly SkillEffectCategory[];
  excludedSkillIds: ReadonlySet<number>;
  course: Course | null;
  runningStyle: RunningStyle | null;
  raceParams?: Partial<RaceParameters>;
  search: string;
  onSearchChange: (search: string) => void;
  onAddCard: (card: CardIndexEntry, slotIndex: number) => void;
}

export function GameRecommendedCardList({
  rows,
  allCards,
  parentSlots,
  skillDetailMap,
  effectFilter,
  excludedSkillIds,
  course,
  runningStyle,
  raceParams,
  search,
  onSearchChange,
  onAddCard,
}: GameRecommendedCardListProps) {
  const { raceImpactProfile } = useRaceImpactProfile();
  const ratingSession = useSkillRatingSession(course, runningStyle, raceParams?.numUmas ?? 9, raceParams, raceImpactProfile);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [visibleCardCount, setVisibleCardCount] = useState(INITIAL_CARD_COUNT);
  const [activeSkillResults, setActiveSkillResults] = useState<{
    countsByCard: Map<number, number>;
    skillsByCard: Map<number, SkillDetail[]>;
  } | null>(null);
  const [isCalculatingTrackSkills, setIsCalculatingTrackSkills] = useState(false);
  const candidateRows = useMemo(
    () => includeCardsWithAdditionalSkills(rows, allCards, new Set(parentSlots.flatMap((card) => card ? [card.id] : []))),
    [rows, allCards, parentSlots],
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem("almond_ace_finder_card_type");
      if (saved && (CARD_TYPE_FILTERS as readonly string[]).includes(saved)) setTypeFilter(saved);
      setHideDuplicates(localStorage.getItem("almond_ace_finder_hide_card_duplicates") === "true");
    } catch {}
  }, []);

  const additionalCandidatesByCard = useMemo(() => {
    const result = new Map<number, SkillDetail[]>();
    for (const row of candidateRows) {
      if (!row.card) continue;
      const recommendedSkillIds = new Set(row.skills.map((skill) => skill.skillId));
      const candidates = projectAdditionalCardSkills(row.card, recommendedSkillIds, excludedSkillIds, skillDetailMap)
        .filter((skill) => effectFilter.length === 0 || classifySkillEffects(skill).some((effect) => effectFilter.includes(effect)));
      result.set(row.cardId, candidates);
    }
    return result;
  }, [candidateRows, excludedSkillIds, skillDetailMap, effectFilter]);

  const duplicateSkillIds = useMemo(
    () => findDuplicateRecommendedCardSkillIds(candidateRows, additionalCandidatesByCard),
    [candidateRows, additionalCandidatesByCard],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const displayRows = hideDuplicates ? hideDuplicateRecommendedCardSkills(candidateRows, additionalCandidatesByCard) : candidateRows;
    return displayRows.filter(({ card, cardId, skills }) => {
      if (skills.length === 0 && (!course || (additionalCandidatesByCard.get(cardId)?.length ?? 0) === 0)) return false;
      if (typeFilter && (!card || formatCardType(card.type) !== typeFilter)) return false;
      if (!query) return true;
      const searchable = [
        card?.nameEn,
        card?.nameJp,
        card?.titleEn,
        card?.titleJa,
        card?.charName,
        String(cardId),
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return searchable.includes(query);
    });
  }, [candidateRows, search, typeFilter, hideDuplicates, additionalCandidatesByCard, course]);

  useEffect(() => {
    setVisibleCardCount(INITIAL_CARD_COUNT);
  }, [rows, search, typeFilter, hideDuplicates]);

  useEffect(() => {
    if (!course) {
      setActiveSkillResults(null);
      setIsCalculatingTrackSkills(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cursor = 0;
    const countsByCard = new Map<number, number>();
    const skillsByCard = new Map<number, SkillDetail[]>();
    const activationBySkill = new Map<number, boolean>();

    function evaluate(skillId: number): boolean {
      if (!activationBySkill.has(skillId)) {
        activationBySkill.set(skillId, evaluateSkillActivation(skillId, course!, runningStyle, raceParams, { raceImpactProfile, session: ratingSession }).activates);
      }
      return activationBySkill.get(skillId) === true;
    }

    function processBatch() {
      if (cancelled) return;
      const batchEnd = Math.min(cursor + 8, filteredRows.length);
      for (; cursor < batchEnd; cursor++) {
        const row = filteredRows[cursor];
        const additional = (additionalCandidatesByCard.get(row.cardId) ?? [])
          .filter((skill) => !hideDuplicates || !duplicateSkillIds.has(skill.id));
        const recommended = row.skills.filter((skill) => !hideDuplicates || !duplicateSkillIds.has(skill.skillId));
        const activeSkillIds = new Set<number>();

        for (const skill of recommended) {
          if (evaluate(skill.skillId)) activeSkillIds.add(skill.skillId);
        }
        for (const skill of additional) {
          if (evaluate(skill.id)) activeSkillIds.add(skill.id);
        }

        countsByCard.set(row.cardId, activeSkillIds.size);
        skillsByCard.set(row.cardId, additional.filter((skill) => activeSkillIds.has(skill.id)));
      }

      if (cursor < filteredRows.length) {
        timer = setTimeout(processBatch, 0);
      } else {
        setActiveSkillResults({ countsByCard, skillsByCard });
        setIsCalculatingTrackSkills(false);
      }
    }

    setActiveSkillResults(null);
    setIsCalculatingTrackSkills(filteredRows.length > 0);
    timer = setTimeout(processBatch, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [filteredRows, course, runningStyle, raceParams, raceImpactProfile, ratingSession, additionalCandidatesByCard, hideDuplicates, duplicateSkillIds]);

  const displayRows = useMemo(() => filteredRows.filter((row) => {
    if (row.skills.length > 0) return true;
    return Boolean(course && activeSkillResults?.skillsByCard.get(row.cardId)?.length);
  }), [filteredRows, course, activeSkillResults]);
  const rankedRows = useMemo(() => [...displayRows].sort((a, b) => {
    const activeCountDiff = (activeSkillResults?.countsByCard.get(b.cardId) ?? 0) - (activeSkillResults?.countsByCard.get(a.cardId) ?? 0);
    return activeCountDiff || b.skills.length - a.skills.length ||
      (a.card?.nameEn ?? `Card ${a.cardId}`).localeCompare(b.card?.nameEn ?? `Card ${b.cardId}`, "en") ||
      a.cardId - b.cardId;
  }), [displayRows, activeSkillResults]);
  const visibleRows = useMemo(() => rankedRows.slice(0, visibleCardCount), [rankedRows, visibleCardCount]);

  function changeTypeFilter(next: string | null) {
    setTypeFilter(next);
    try {
      if (next) localStorage.setItem("almond_ace_finder_card_type", next);
      else localStorage.removeItem("almond_ace_finder_card_type");
    } catch {}
  }

  function changeHideDuplicates(next: boolean) {
    setHideDuplicates(next);
    try {
      if (next) localStorage.setItem("almond_ace_finder_hide_card_duplicates", "true");
      else localStorage.removeItem("almond_ace_finder_hide_card_duplicates");
    } catch {}
  }

  const firstEmptySlotIndex = parentSlots.findIndex((card) => card === null);

  return (
    <div>
      <label className="mt-2 block">
        <span className="sr-only">Search recommended cards</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search recommended cards…"
          className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-1" aria-label="Filter recommended cards by type">
        <span className="mr-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Type:</span>
        <button
          type="button"
          onClick={() => changeTypeFilter(null)}
          aria-pressed={typeFilter === null}
          className={`rounded border px-1.5 py-1 text-[10px] font-medium transition-colors ${typeFilter === null ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400"}`}
        >
          All
        </button>
        {CARD_TYPE_FILTERS.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => changeTypeFilter(typeFilter === type ? null : type)}
            title={`${type.charAt(0).toUpperCase() + type.slice(1)} cards`}
            aria-pressed={typeFilter === type}
            className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded border p-1 transition-colors ${typeFilter === type ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/50" : "border-zinc-200 bg-white opacity-65 hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-800/60"}`}
          >
            <CardTypeIcon type={type} className="h-4 w-4 flex-none object-contain" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => changeHideDuplicates(!hideDuplicates)}
          aria-pressed={hideDuplicates}
          className={`ml-1 min-h-8 rounded border px-2 py-1 text-[10px] font-medium transition-colors ${hideDuplicates ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400"}`}
        >
          Hide duplicates
        </button>
      </div>

      {rankedRows.length === 0 ? (
        <p className="mt-3 text-xs italic text-zinc-400 dark:text-zinc-500">
          {isCalculatingTrackSkills ? "Checking support-card skills for this track…" : rows.length === 0 && !course ? "No eligible game-recommended support cards for this race and style." : hideDuplicates && search.trim() === "" && !typeFilter ? "No cards have unique recommended or track-active skills with Hide duplicates enabled." : "No cards match this search and card type."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {visibleRows.map(({ cardId, card, skills }) => {
            const canAdd = Boolean(card) && firstEmptySlotIndex >= 0 && canPlaceCard(parentSlots, firstEmptySlotIndex, card!);
            const blockedByUma = Boolean(card) && firstEmptySlotIndex >= 0 && !canPlaceCard(parentSlots, firstEmptySlotIndex, card!);
            const activeCardSkills = activeSkillResults?.skillsByCard.get(cardId) ?? [];
            const activeSkillCount = activeSkillResults?.countsByCard.get(cardId) ?? 0;
            return (
              <li key={cardId} className="flex min-w-0 items-start gap-3 py-2.5">
                <div className="h-12 w-12 flex-none overflow-hidden">
                  {card?.portraitUrl || card?.imgUrl ? (
                    <img src={card.portraitUrl || card.imgUrl} alt={card.nameEn} className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] text-zinc-400 dark:text-zinc-500">#{cardId}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {card && (
                      <span className={`flex-none rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${RARITY_META[card.rarity]?.chip ?? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                        {RARITY_META[card.rarity]?.label ?? "R"}
                      </span>
                    )}
                    {card && <CardTypeIcon type={card.type} className="h-4 w-4 flex-none object-contain" />}
                    <div className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {card?.nameEn || `Card #${cardId}`}
                      </span>
                      {card?.nameJp && (
                        <span className="mt-0.5 block truncate text-[10px] font-normal text-zinc-400 dark:text-zinc-500">{card.nameJp}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {skills.map((skill) => {
                      const detail = skillDetailMap.get(skill.skillId);
                      const name = detail?.nameEn || `Skill ${skill.skillId}`;
                      return (
                        <SkillHoverCard
                          key={skill.skillId}
                          skillId={skill.skillId}
                          fallbackSkill={{ nameEn: name, nameJp: detail?.nameJp ?? "", rarity: detail?.rarity, iconId: detail?.iconId }}
                          cardName={card?.nameEn}
                        >
                          <span className="inline-flex max-w-full items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                            <SkillIcon iconId={detail?.iconId} name={name} className="h-3.5 w-3.5 flex-none object-contain" />
                            <span className="max-w-[150px] truncate">{name}</span>
                          </span>
                        </SkillHoverCard>
                      );
                    })}
                  </div>
                  {activeCardSkills.length > 0 && (
                    <div className="mt-1.5">
                      <p className="mb-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Also activates on this track</p>
                      <div className="flex flex-wrap gap-1">
                        {activeCardSkills.map((skill) => (
                          <SkillHoverCard
                            key={skill.id}
                            skillId={skill.id}
                            fallbackSkill={{ nameEn: skill.nameEn, nameJp: skill.nameJp, rarity: skill.rarity, iconId: skill.iconId }}
                            cardName={card?.nameEn}
                          >
                            <span className="inline-flex max-w-full items-center gap-1 rounded border border-emerald-200 bg-emerald-50/60 px-1.5 py-0.5 text-[10px] text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
                              <SkillIcon iconId={skill.iconId} name={skill.nameEn} className="h-3.5 w-3.5 flex-none object-contain" />
                              <span className="max-w-[150px] truncate">{skill.nameEn}</span>
                            </span>
                          </SkillHoverCard>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-none flex-col items-end self-center gap-1">
                  <span className="whitespace-nowrap text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <span title={course ? "Distinct skills from this card that activate on the selected track and style" : "Game-recommended skills; select a track to count activatable skills"}>
                      +{course ? (isCalculatingTrackSkills || !activeSkillResults ? "…" : activeSkillCount) : skills.length} skills
                    </span>
                  </span>
                  {blockedByUma && <span className="text-[10px] text-amber-700 dark:text-amber-300">Uma in Parent</span>}
                  {card && (
                    <button
                      type="button"
                      disabled={!canAdd}
                      onClick={() => canAdd && onAddCard(card, firstEmptySlotIndex)}
                      title={blockedByUma ? "Another card for this Uma is already in the Parent Deck" : undefined}
                      className="min-h-8 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                    >
                      {firstEmptySlotIndex < 0 ? "Full" : blockedByUma ? "Unavailable" : `+ Slot ${firstEmptySlotIndex + 1}`}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rankedRows.length > visibleCardCount && (
        <button
          type="button"
          onClick={() => setVisibleCardCount((count) => count + CARD_COUNT_INCREMENT)}
          className="mt-2 min-h-8 rounded-lg px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
        >
          Show more cards ({rankedRows.length - visibleCardCount} remaining)
        </button>
      )}
    </div>
  );
}
