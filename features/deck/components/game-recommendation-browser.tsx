"use client";

import { useEffect, useMemo, useState } from "react";
import type { CardIndexEntry, PvpRaceFitAssistance, PvpRecommendedRace, SkillDetail } from "@/lib/api";
import type { Course, RaceParameters } from "@/lib/skill-engine/types";
import type { PvpEvent } from "@/lib/pvp/events";
import { filterRecommendedSkillsByStyle, getRecommendedRace } from "@/lib/pvp/recommendations";
import type { RunningStyle } from "@/lib/deck/types";
import type { SkillEffectCategory } from "@/lib/skills/effects";
import { EFFECT_CATEGORIES } from "@/app/common/ui/skills/skill-effects";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import SkillHoverCard from "@/app/common/ui/skills/details/skill-hover-card";
import { Badge } from "@/app/common/ui/primitives/badge";
import { GameRecommendedCardList } from "@/features/deck/components/game-recommended-card-list";
import { filterRecommendedSkillsByEffect, projectGameRecommendedCards } from "@/features/deck/model/game-recommendation-projections";

interface GameRecommendedBrowserProps {
  activePvpEvent: PvpEvent | null;
  activeCourseId: number | null;
  course: Course | null;
  raceParams?: Partial<RaceParameters>;
  runningStyle: RunningStyle | null;
  pvpRecommendationEvents: PvpRaceFitAssistance[];
  activeMasterChallengeRace: PvpRecommendedRace | null;
  allCards: CardIndexEntry[] | null;
  skillDetailMap: Map<number, SkillDetail>;
  excludedSkillIds: ReadonlySet<number>;
  parentSlots: (CardIndexEntry | null)[];
  onAddCard: (card: CardIndexEntry, slotIndex: number) => void;
}

const INITIAL_SKILL_COUNT = 36;

export function GameRecommendedBrowser({
  activePvpEvent,
  activeCourseId,
  course,
  raceParams,
  runningStyle,
  pvpRecommendationEvents,
  activeMasterChallengeRace,
  allCards,
  skillDetailMap,
  excludedSkillIds,
  parentSlots,
  onAddCard,
}: GameRecommendedBrowserProps) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_SKILL_COUNT);
  const [expandedSkillId, setExpandedSkillId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"skills" | "cards">("skills");
  const [cardSearch, setCardSearch] = useState("");
  const [effectFilter, setEffectFilter] = useState<SkillEffectCategory[]>([]);
  const [effectFilterHydrated, setEffectFilterHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("almond_ace_finder_effect_filter");
      if (raw) {
        const allowed = new Set(EFFECT_CATEGORIES.map((category) => category.id));
        setEffectFilter((JSON.parse(raw) as SkillEffectCategory[]).filter((category) => allowed.has(category)));
      }
    } catch {} finally {
      setEffectFilterHydrated(true);
    }
  }, []);

  const pvpRecommendationRace = useMemo(() => {
    if (activeMasterChallengeRace || !activePvpEvent?.recommendationEventId) return null;
    return getRecommendedRace(
      pvpRecommendationEvents,
      activePvpEvent.recommendationEventId,
      activeCourseId,
      activePvpEvent.recommendationEventSubId,
    );
  }, [activeMasterChallengeRace, activeCourseId, activePvpEvent, pvpRecommendationEvents]);
  const recommendationRace = activeMasterChallengeRace ?? pvpRecommendationRace;
  const cardById = useMemo(() => new Map((allCards ?? []).map((card) => [card.id, card])), [allCards]);
  const styleSkills = useMemo(
    () => filterRecommendedSkillsByStyle(recommendationRace?.recommendedSkills ?? [], runningStyle),
    [recommendationRace, runningStyle],
  );
  const effectFilteredSkills = useMemo(
    () => filterRecommendedSkillsByEffect(styleSkills, effectFilter, skillDetailMap),
    [styleSkills, effectFilter, skillDetailMap],
  );
  const cardRows = useMemo(() => projectGameRecommendedCards({
    skills: styleSkills,
    excludedSkillIds,
    excludedCardIds: new Set(parentSlots.flatMap((card) => card ? [card.id] : [])),
    effectFilter,
    skillDetailMap,
    allCards,
  }), [styleSkills, excludedSkillIds, parentSlots, effectFilter, skillDetailMap, allCards]);
  const recommendedSkills = useMemo(() => {
    const eligible = effectFilteredSkills;
    const query = search.trim().toLocaleLowerCase();
    if (!query) return eligible;
    return eligible.filter((entry) => {
      const skill = skillDetailMap.get(entry.skillId);
      return `${skill?.nameEn ?? `Skill ${entry.skillId}`} ${skill?.nameJp ?? ""} ${entry.skillId}`
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [effectFilteredSkills, search, skillDetailMap]);

  useEffect(() => {
    setVisibleCount(INITIAL_SKILL_COUNT);
    setExpandedSkillId(null);
  }, [recommendationRace, runningStyle, search, effectFilter]);

  useEffect(() => {
    if (!effectFilterHydrated) return;
    try {
      if (effectFilter.length) localStorage.setItem("almond_ace_finder_effect_filter", JSON.stringify(effectFilter));
      else localStorage.removeItem("almond_ace_finder_effect_filter");
    } catch {}
  }, [effectFilter, effectFilterHydrated]);

  function toggleEffectFilter(category: SkillEffectCategory) {
    setEffectFilter((current) => current.includes(category)
      ? current.filter((entry) => entry !== category)
      : [...current, category]);
  }

  return (
    <section className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800" aria-label="Game recommendations">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Game Recommendations</h4>
          <Badge size="compact" tone="sky">Game data</Badge>
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {recommendationRace
            ? activeView === "skills"
              ? `${recommendedSkills.length} skills for ${runningStyle ? "selected style" : "all styles"}`
              : `${cardRows.length} game-recommended cards`
            : "Select a supported race"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <div className="flex min-h-9 items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/70" role="tablist" aria-label="Game recommendations view">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "skills"}
            onClick={() => setActiveView("skills")}
            className={`min-h-8 rounded-md px-2.5 text-xs font-medium transition-colors ${activeView === "skills" ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
          >
            By Skill
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "cards"}
            onClick={() => setActiveView("cards")}
            className={`min-h-8 rounded-md px-2.5 text-xs font-medium transition-colors ${activeView === "cards" ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
          >
            By Card
          </button>
        </div>
        <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Effect filters apply to both views</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1" aria-label="Filter recommendations by skill effect">
        <span className="mr-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Effect:</span>
        {EFFECT_CATEGORIES.map((category) => {
          const active = effectFilter.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleEffectFilter(category.id)}
              title={category.description}
              aria-pressed={active}
              className={`inline-flex min-h-8 items-center gap-1 rounded border px-1.5 text-[10px] font-medium transition-colors ${active ? `${category.badge} font-semibold` : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400"}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${category.dotColor} ${active ? "" : "opacity-50"}`} />
              {category.label}
            </button>
          );
        })}
        {effectFilter.length > 0 && (
          <button type="button" onClick={() => setEffectFilter([])} className="min-h-8 rounded px-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
            Clear
          </button>
        )}
      </div>

      {!recommendationRace ? (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Game skill data is unavailable for this event/course combination. Choose a supported Champions Meeting preset or a Master Challenge race.
        </p>
      ) : runningStyle === 5 ? (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          The game data does not include a separate Runaway style recommendation.
        </p>
      ) : activeView === "cards" ? (
        <GameRecommendedCardList
          rows={cardRows}
          allCards={allCards}
          parentSlots={parentSlots}
          skillDetailMap={skillDetailMap}
          effectFilter={effectFilter}
          excludedSkillIds={excludedSkillIds}
          course={course}
          runningStyle={runningStyle}
          raceParams={raceParams}
          search={cardSearch}
          onSearchChange={setCardSearch}
          onAddCard={onAddCard}
        />
      ) : (
        <div role="tabpanel" aria-label="Game recommended skills">
          <label className="mt-2 block">
            <span className="sr-only">Search game recommended skills</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search game recommended skills…"
              className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </label>

          {recommendedSkills.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">No game recommended skills match this style and search.</p>
          ) : (
            <>
              <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {recommendedSkills.slice(0, visibleCount).map((entry) => {
                  const detail = skillDetailMap.get(entry.skillId);
                  const skillName = detail?.nameEn || `Skill ${entry.skillId}`;
                  const sourceCards = entry.supportCardIds
                    .map((id) => ({ id, card: cardById.get(id) }))
                    .sort((a, b) => Number(Boolean(b.card)) - Number(Boolean(a.card)));
                  const expanded = expandedSkillId === entry.skillId;
                  return (
                    <li key={entry.skillId} className="py-2">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <SkillHoverCard
                          skillId={entry.skillId}
                          fallbackSkill={{
                            nameEn: detail?.nameEn ?? skillName,
                            nameJp: detail?.nameJp ?? "",
                            rarity: detail?.rarity,
                            iconId: detail?.iconId,
                          }}
                          className="group inline-flex min-w-0 items-center gap-2 cursor-pointer"
                        >
                          <SkillIcon iconId={detail?.iconId} name={skillName} className="h-6 w-6 flex-none object-contain" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold leading-snug text-zinc-900 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400">
                              {skillName}
                            </span>
                            {detail?.nameJp && (
                              <span className="mt-0.5 block truncate text-[10px] font-normal leading-tight text-zinc-400 dark:text-zinc-500">
                                {detail.nameJp}
                              </span>
                            )}
                          </span>
                        </SkillHoverCard>
                        <button
                          type="button"
                          onClick={() => setExpandedSkillId(expanded ? null : entry.skillId)}
                          aria-expanded={expanded}
                          className="min-h-8 flex-none rounded-lg px-2 text-[10px] font-medium text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
                        >
                          Support cards ({entry.supportCardIds.length})
                        </button>
                      </div>
                      {expanded && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-8">
                          {sourceCards.length > 0 ? sourceCards.map(({ id, card }) => (
                            <span
                              key={id}
                              title={card ? `${card.nameEn}${card.nameJp ? ` · ${card.nameJp}` : ""}` : `Card ${id} is not in the local card registry`}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-zinc-100 px-1.5 py-1 text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              {card?.portraitUrl || card?.imgUrl ? (
                                <img src={card.portraitUrl || card.imgUrl} alt="" className="h-6 w-6 flex-none object-contain" loading="lazy" />
                              ) : (
                                <span className="grid h-6 w-6 flex-none place-items-center rounded bg-zinc-200 text-[8px] dark:bg-zinc-700">#{id}</span>
                              )}
                              <span className="truncate">{card?.nameEn || `Card #${id}`}</span>
                            </span>
                          )) : (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">No support card source listed.</span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {recommendedSkills.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + INITIAL_SKILL_COUNT)}
                  className="mt-2 min-h-8 rounded-lg px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                >
                  Show more ({recommendedSkills.length - visibleCount} remaining)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
