"use client";

// Ace Complement Finder (Parent Deck):
// Given the active CM/LOH race (or manual course) and a running style, this panel
// 1. computes the activating-skills list — skills the ace (main) deck + parent-inherited uniques
//    will ACTIVATE for that style, and
// 2. browses game-recommended skills and groups their support-card sources,
//    excluding skills already present in the Ace/lineage and Parent cards.

import { useEffect, useMemo, useState } from "react";
import { useDeck } from "@/features/deck/state";
import { RUNNING_STYLE_LABELS, DISTANCE_LABELS, SURFACE_LABELS } from "@/lib/deck/constants";
import { doesSkillFireOnCourse } from "@/lib/recommendation/engine";
import { useLineageSkills } from "@/features/parenting/hooks";
import type { CardIndexEntry, SkillDetail } from "@/lib/api";
import { api } from "@/lib/api";
import { GameRecommendedBrowser } from "@/features/deck/components/game-recommendation-browser";
import type { RunningStyle } from "@/lib/deck/types";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import SkillHoverCard from "@/app/common/ui/skills/details/skill-hover-card";
import { ZapIcon, ChevronDownIcon } from "@/app/common/ui/primitives/icons";
import { Badge } from "@/app/common/ui/primitives/badge";

const STYLE_IDS = [1, 2, 3, 4, 5] as const;

interface AceSkillEntry {
  id: number;
  nameEn: string;
  nameJp: string;
  iconId?: number | null;
  rarity?: number;
  source: "card" | "unique";
  sourceLabel: string;
  /** true = activates for this style on this course, null = not enough data to evaluate */
  fires: boolean | null;
}

export default function AceComplementFinder({
  onPickCard,
}: {
  onPickCard?: (card: CardIndexEntry, slotIndex: number) => void;
}) {
  const {
    mainSkills,
    mainSkillIdSet,
    parentSlots,
    setParentCard,
    course,
    trackDetail,
    activeCourseRow,
    runningStyle,
    allCards,
    activePvpEvent,
    activeRaceParameters,
    pvpRecommendationEvents,
    activeMasterChallengeEvent,
    activeMasterChallengeRace,
  } = useDeck();
  const { lineageUniqueSkills, bloodlineFactorSkills } = useLineageSkills();

  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isSkillListOpen, setIsSkillListOpen] = useState(true);
  // null = follow the deck's running style; otherwise compare another style
  const [styleOverride, setStyleOverride] = useState<RunningStyle | null>(null);
  const effectiveStyle = styleOverride ?? runningStyle;
  // Full skill details for recommendation skill display and effect classification
  const [skillDetailMap, setSkillDetailMap] = useState<Map<number, SkillDetail>>(() => new Map());
  useEffect(() => {
    api
      .listSkills()
      .then((skills) => setSkillDetailMap(new Map(skills.map((s) => [s.id, s]))))
      .catch(console.error);
  }, []);

  const raceParams = activeRaceParameters;

  // ----- Activating skills: ace deck card skills + inherited uniques, evaluated per style/course -----
  const aceSkillEntries = useMemo<AceSkillEntry[]>(() => {
    if (!course || !effectiveStyle) return [];
    const cardEntries: AceSkillEntry[] = mainSkills.map((s) => ({
      id: s.id,
      nameEn: s.nameEn,
      nameJp: s.nameJp,
      iconId: s.iconId,
      rarity: s.rarity,
      source: "card",
      sourceLabel: `Card (${s.cardName})`,
      fires: doesSkillFireOnCourse(s.id, course, effectiveStyle, raceParams),
    }));
    const uniqueEntries: AceSkillEntry[] = lineageUniqueSkills.map((s) => ({
      id: s.id,
      nameEn: s.nameEn,
      nameJp: s.nameJp,
      iconId: s.iconId,
      rarity: s.rarity,
      source: "unique",
      sourceLabel: s.sourceLabel,
      fires: doesSkillFireOnCourse(s.id, course, effectiveStyle, raceParams),
    }));
    return [...cardEntries, ...uniqueEntries];
  }, [mainSkills, lineageUniqueSkills, course, effectiveStyle, raceParams]);

  const firesCount = aceSkillEntries.filter((s) => s.fires === true).length;

  function handleAddCard(card: CardIndexEntry, slotIndex: number) {
    if (onPickCard) onPickCard(card, slotIndex);
    else setParentCard(slotIndex, card);
  }

  const raceTitle = activeMasterChallengeEvent
    ? `Master Challenge #${activeMasterChallengeEvent.eventId}`
    : activePvpEvent
    ? activePvpEvent.name
    : trackDetail && activeCourseRow
      ? `${trackDetail.nameEn} ${activeCourseRow.length}m (${DISTANCE_LABELS[activeCourseRow.distance as keyof typeof DISTANCE_LABELS]?.split(" ")[0]} ${SURFACE_LABELS[activeCourseRow.terrain as keyof typeof SURFACE_LABELS]})`
      : "Target Race";

  const hasAceData = mainSkills.length > 0 || lineageUniqueSkills.length > 0;
  const excludedRecommendationSkillIds = useMemo(() => new Set([
    ...mainSkillIdSet,
    ...lineageUniqueSkills.map((skill) => skill.id),
    ...bloodlineFactorSkills.map((skill) => skill.id),
  ]), [mainSkillIdSet, lineageUniqueSkills, bloodlineFactorSkills]);

  return (
    <section className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ZapIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-none" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Ace Complement Finder</h3>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Skills your ace deck + inherited uniques activate for{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{raceTitle}</span>
            {effectiveStyle ? (
              <>
                {" "}· <span className="font-semibold text-zinc-800 dark:text-zinc-200">{RUNNING_STYLE_LABELS[effectiveStyle as keyof typeof RUNNING_STYLE_LABELS]}</span>
              </>
            ) : null}
            . Search game-recommended skills or group their sources by support card. Card results omit Ace/lineage duplicates and cards already in Parent.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPanelOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer transition-all ease-out-quart duration-150 active:scale-[0.98]"
          aria-expanded={isPanelOpen}
        >
          <span>{isPanelOpen ? "Collapse" : "Expand"}</span>
          <ChevronDownIcon
            className={`h-3.5 w-3.5 transition-transform duration-200 ease-in-out-cubic ${isPanelOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isPanelOpen && (
        <div className="animate-in fade-in duration-200 ease-out-quart">
          {/* Style override selector */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Style:</span>
            <button
              type="button"
              onClick={() => setStyleOverride(null)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                styleOverride === null
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Deck{runningStyle ? ` (${RUNNING_STYLE_LABELS[runningStyle]})` : ""}
            </button>
            {STYLE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setStyleOverride(id)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  styleOverride === id
                    ? "bg-emerald-700 dark:bg-emerald-600 text-white font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {RUNNING_STYLE_LABELS[id]}
              </button>
            ))}
          </div>

          <GameRecommendedBrowser
            activePvpEvent={activePvpEvent}
            activeCourseId={activeCourseRow?.id ?? null}
            course={course}
            raceParams={raceParams}
            runningStyle={effectiveStyle}
            pvpRecommendationEvents={pvpRecommendationEvents}
            activeMasterChallengeRace={activeMasterChallengeRace}
            allCards={allCards}
            skillDetailMap={skillDetailMap}
            excludedSkillIds={excludedRecommendationSkillIds}
            parentSlots={parentSlots}
            onAddCard={handleAddCard}
          />

          {!course ? (
            <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 italic">
              Pick a race (CM/LOH preset or any course) in the bar above to evaluate skill activation.
            </p>
          ) : !hasAceData ? (
            <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 italic">
              Build your Main Deck (ace) and set Parent lineage in the Parenting tab to compute activating skills.
            </p>
          ) : (
            <>
              {/* Activating skills (ace deck + inherited uniques) */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIsSkillListOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 cursor-pointer group"
                  aria-expanded={isSkillListOpen}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ChevronDownIcon
                      className={`h-3 w-3 flex-none transition-transform duration-200 ease-in-out-cubic ${isSkillListOpen ? "rotate-180" : ""}`}
                    />
                    <span className="group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                      Ace & Inherited Skills — Activating ({firesCount}/{aceSkillEntries.length})
                    </span>
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">green = triggers</span>
                </button>
                {isSkillListOpen && (
                  <div className="flex flex-wrap gap-1 animate-in fade-in duration-200 ease-out-quart">
                  {aceSkillEntries.map((s) => (
                    <SkillHoverCard
                      key={`${s.source}-${s.id}`}
                      skillId={s.id}
                      fallbackSkill={{ nameEn: s.nameEn, nameJp: s.nameJp, rarity: s.rarity, iconId: s.iconId }}
                    >
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border cursor-pointer transition-all hover:scale-[1.02] ${
                          s.fires === true
                            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-200 font-semibold shadow-2xs"
                            : s.fires === false
                              ? "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500"
                              : "border-dashed border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                        }`}
                        title={`${s.nameEn} — ${s.sourceLabel}${s.fires === true ? " • Activates for this style" : s.fires === false ? " • Does not activate for this style" : " • Activation unknown"}`}
                      >
                        {s.fires === true && (
                          <ZapIcon className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 flex-none" />
                        )}
                        <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-3.5 w-3.5 object-contain flex-none" />
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
                          [{s.source === "card" ? "A" : "U"}]
                        </span>
                        <span className="truncate max-w-[130px]">{s.nameEn}</span>
                      </span>
                    </SkillHoverCard>
                  ))}
                  </div>
                )}
                <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                  [A] = ace deck card skill · [U] = uma-inherited unique · dimmed = does not trigger for this style
                </p>
              </div>

            </>
          )}
        </div>
      )}
    </section>
  );
}
