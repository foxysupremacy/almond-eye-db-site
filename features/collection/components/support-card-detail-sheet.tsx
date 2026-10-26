"use client";

import { CollectionDetailSurface } from "./collection-detail-surface";
import { Link as AriaLink } from "react-aria-components/Link";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";


import React, { useEffect, useMemo, useState } from "react";
import {
  type CardIndexEntry,
  type CardSkills,
  type SkillSummary,
  type SupportCardEffectsBlob,
  api,
} from "@/lib/api";
import { useDeck } from "@/features/deck/state";
import CardTypeIcon, { formatCardType } from "@/app/common/ui/cards/card-type-icon";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import { SkillHoverCard } from "@/app/common/ui/skills/details/skill-hover-card";
import {
  evaluateSkillActivation,
  runningStyleToNum,
} from "@/lib/parenting/skill-evaluator";
import { getPvpRaceParameters, isSkillBanned } from "@/lib/pvp/events";
import { getSkillRarityStyle, RARITY_META } from "@/app/common/ui/skills/skill-rarity";
import { Badge } from "@/app/common/ui/primitives/badge";
import EventChainAttribution from "@/app/common/ui/skills/provenance/event-chain-attribution";
import { ChainArrowIcon } from "@/app/common/ui/skills/provenance/chain-arrow-icon";
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  CheckIcon,
  SparklesIcon,
  TrophyIcon,
  XIcon,
} from "@/app/common/ui/primitives/icons";

interface SupportCardDetailSheetProps {
  card: CardIndexEntry | null;
  isOpen: boolean;
  onClose: () => void;
  limitBreak: number | undefined;
  onSetLimitBreak: (cardId: number, lb: number) => void;
  onRemoveCard: (cardId: number) => void;
  /** Render inside the canonical /supports/:id route rather than a modal. */
  page?: boolean;
  backHref?: string;
}

const LB_LABELS = ["0 LB", "1 LB", "2 LB", "3 LB", "MLB"] as const;

export function SupportCardDetailSheet({
  card,
  isOpen,
  onClose,
  limitBreak,
  onSetLimitBreak,
  onRemoveCard,
  page = false,
  backHref = "/supports",
}: SupportCardDetailSheetProps) {
  const { course, runningStyle, activePvpEvent, activeRaceParameters, trackDetail } = useDeck();
  const raceParams = activeRaceParameters;


  const [loadedSkills, setLoadedSkills] = useState<CardSkills | null>(null);
  const [cardEffectsBlob, setCardEffectsBlob] = useState<SupportCardEffectsBlob | null>(null);
  const [loading, setLoading] = useState(false);

  const isOwned = limitBreak !== undefined;
  const currentLb = limitBreak !== undefined ? limitBreak : 4; // Default to MLB for preview

  // Fetch card skills & support effects
  useEffect(() => {
    if (!isOpen || !card) return;

    let mounted = true;
    setLoading(true);

    Promise.all([
      api.cardSkills(card.id),
      api.cardSupportEffects(card.id),
    ])
      .then(([skills, effects]) => {
        if (!mounted) return;
        setLoadedSkills(skills);
        setCardEffectsBlob(effects || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load card details:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, card?.id]);




  if (!isOpen || !card) return null;

  const hintSkills = loadedSkills?.hintSkills || [];
  const baseEventSkills = loadedSkills?.eventSkills || [];
  const eventSkillById = new Map(baseEventSkills.map((skill) => [skill.id, skill]));
  const expandedEventSkills: SkillSummary[] = [];
  const occurrenceIds = new Set<number>();

  // Keep one row per event-choice occurrence. A skill can intentionally be
  // granted by several choices, so collapsing by skill id would hide valid
  // branches from the card detail view.
  for (const event of card.eventDetails ?? []) {
    for (const choice of event.choices) {
      for (const skillId of choice.skillIds) {
        const skill = eventSkillById.get(skillId);
        if (!skill) continue;
        occurrenceIds.add(skillId);
        expandedEventSkills.push({
          ...skill,
          eventMeta: {
            eventId: event.eventId,
            eventNameEn: event.nameEn,
            eventNameJp: event.nameJp,
            choiceIndex: choice.index,
            choiceTextEn: choice.textEn,
            choiceTextJp: choice.textJp,
            totalChoices: event.choices.length,
            eventType: event.eventType,
            chainStep: event.chainStep,
            statSummary: choice.statSummary,
          },
        });
      }
    }
  }

  const eventSkills = [
    ...expandedEventSkills,
    ...baseEventSkills.filter((skill) => !occurrenceIds.has(skill.id)),
  ];
  const totalSkillCount = hintSkills.length + eventSkills.length;

  function evaluateSkill(skillId: number) {
    if (!course) {
      return {
        activates: false,
        reason: "No track selected on Global Track Bar",
      };
    }
    return evaluateSkillActivation(skillId, course, runningStyle, raceParams);
  }

  let activatingSkillCount = 0;
  for (const s of [...hintSkills, ...eventSkills]) {
    if (evaluateSkill(s.id).activates) activatingSkillCount++;
  }

  function renderSkillRow(s: SkillSummary, source: "hint" | "event", showEventMeta = true) {
    const rStyle = getSkillRarityStyle(s.rarity);
    const isBanned = isSkillBanned(s.id, activePvpEvent);
    const evalResult = evaluateSkill(s.id);
    const activates = evalResult.activates;

    return (
      <div
        key={`${s.id}-${source}`}
        className={`flex items-center justify-between gap-3 py-2.5 px-3 transition-colors ${rStyle.bgClass ?? "bg-white dark:bg-zinc-900"} hover:brightness-[0.98] dark:hover:brightness-110`}
      >
        <div className="min-w-0 flex-1">
          <SkillHoverCard
            skillId={s.id}
            fallbackSkill={s}
            cardName={card?.nameEn || ""}
            cardId={card?.id}
            isParentMode={false}
            className="group inline-flex items-center gap-2.5 min-w-0 cursor-pointer"
          >
            {/* 1. Vertically centered icon */}
            <SkillIcon
              iconId={s.iconId}
              name={s.nameEn}
              className="h-7 w-7 object-contain flex-none shrink-0 drop-shadow-2xs"
            />

            {/* 2. Stacked Bilingual Text Container */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {isBanned && (
                  <span className="rounded px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                    BANNED
                  </span>
                )}
                <span
                  className={`text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug ${
                    isBanned ? "line-through text-zinc-500 dark:text-zinc-400" : ""
                  }`}
                >
                  {s.nameEn}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100 transition-opacity">
                  ↗
                </span>
              </div>

              {s.nameJp && (
                <p
                  className={`text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 font-normal leading-tight ${
                    isBanned ? "line-through" : ""
                  }`}
                >
                  {s.nameJp}
                </p>
              )}
            </div>
          </SkillHoverCard>

          {s.descEn && (
            <p className="mt-1 line-clamp-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal pl-9">
              {s.descEn}
            </p>
          )}

          {showEventMeta && s.eventMeta && (
            <div className="mt-1 pl-9 flex items-center gap-1.5 text-[10px] text-violet-700 dark:text-violet-400 flex-wrap">
              <EventChainAttribution eventMeta={s.eventMeta} />
              {s.eventMeta.statSummary && (
                <span className="rounded bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.2 font-semibold">
                  {s.eventMeta.statSummary}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Course Activation Status Badge */}
        <div className="flex-none shrink-0">
          {course ? (
            activates ? (
              <Badge
                size="standard"
                tone="emerald"
                icon={<CheckIcon className="h-3 w-3" />}
                className="font-bold"
                title={evalResult.evalResult?.verdictSummary || "Fires on target course"}
              >
                Active
              </Badge>
            ) : (
              <Badge
                size="standard"
                tone="rose"
                icon={<AlertTriangleIcon className="h-3 w-3" />}
                className="font-bold"
                title={evalResult.reason || "Does not activate on target course"}
              >
                {evalResult.reason?.toLowerCase().includes("rank") ? "Rank Trap" : "No Fire"}
              </Badge>
            )
          ) : (
            <span className="text-[10px] text-zinc-400 italic">No track set</span>
          )}
        </div>
      </div>
    );
  }

  const chainGroups = new Map<
    string,
    { step: number; choice: number; choiceText: string; eventId: number; skills: SkillSummary[] }
  >();
  const standaloneEventSkills: SkillSummary[] = [];

  for (const skill of eventSkills) {
    const meta = skill.eventMeta;
    if (meta?.eventType === "chain" && meta.chainStep) {
      const key = `${meta.eventId}:${meta.choiceIndex}`;
      const existing = chainGroups.get(key);
      if (existing) {
        // A malformed/duplicated skill id can occur more than once in one
        // choice. Keep one row within that branch, while preserving the same
        // skill when it is offered by a different choice.
        if (!existing.skills.some((groupSkill) => groupSkill.id === skill.id)) {
          existing.skills.push(skill);
        }
      } else {
        chainGroups.set(key, {
          step: meta.chainStep,
          choice: meta.choiceIndex,
          choiceText: meta.choiceTextEn || meta.choiceTextJp,
          eventId: meta.eventId,
          skills: [skill],
        });
      }
    } else {
      standaloneEventSkills.push(skill);
    }
  }

  const orderedChainGroups = [...chainGroups.values()].sort(
    (a, b) => a.step - b.step || a.choice - b.choice || a.eventId - b.eventId,
  );

  return (
    <CollectionDetailSurface
      page={page}
      isOpen={isOpen}
      onClose={onClose}
      title={card.charName || card.nameEn}
      ariaLabel={card.charName || card.nameEn}
      header={
        <div className="shrink-0 flex-none bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800">
          {/* Top Actions Bar (Close button when modal) */}
          {!page && (
            <div className="flex items-center justify-end px-4 pt-3 pb-1">
              <AppButton
                variant="quiet"
                onPress={onClose}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer ml-auto"
                iconOnly
                aria-label="Close"
              >
                <XIcon className="h-4 w-4" />
              </AppButton>
            </div>
          )}

          {/* Centered Large Card Art */}
          <div className="px-4 pb-2 pt-1">
            <div className="relative mx-auto w-44 sm:w-52 aspect-[3/4] rounded-xl overflow-hidden border border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100 dark:bg-zinc-800 shadow-sm flex items-center justify-center">
              <img
                src={card.imgUrl || card.portraitUrl}
                alt={card.nameEn}
                className="h-full w-full object-cover select-none"
                onError={(e) => {
                  if (card.portraitUrl && e.currentTarget.src !== card.portraitUrl) {
                    e.currentTarget.src = card.portraitUrl;
                  }
                }}
              />
            </div>

            {/* Rarity & Card Type Pill Row */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap mt-3">
              <Badge
                size="compact"
                uppercase
                tone={card.rarity === 3 ? "amber" : card.rarity === 2 ? "sky" : "neutral"}
                className="font-black"
              >
                {card.rarity === 3 ? "SSR" : card.rarity === 2 ? "SR" : "R"}
              </Badge>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 capitalize">
                <CardTypeIcon type={card.type} className="h-3.5 w-3.5" />
                <span>{formatCardType(card.type)}</span>
              </span>
              {card.release && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  • {card.release}
                </span>
              )}
            </div>

            {/* English Card Name (Large bold) */}
            <h3
              id="card-detail-title"
              className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mt-1 leading-snug"
            >
              {card.charName || card.nameEn}
            </h3>

            {/* Japanese Name directly below (muted sub-line) */}
            {(card.titleEn || card.titleJa || card.nameJp) && (
              <p className="text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 text-center font-medium mt-0.5 leading-tight">
                {card.titleEn || card.titleJa || card.nameJp}
              </p>
            )}
          </div>

          {/* Limit Break Stepper + Ownership Row */}
          <div className="px-4 sm:px-6 py-2.5 border-t border-zinc-200/70 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-[11px] font-medium">Limit Break:</span>
              <div className="inline-flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5">
                {[0, 1, 2, 3, 4].map((step) => (
                  <AppButton
                    key={step}
                    aria-pressed={isOwned && limitBreak === step}
                    variant="quiet"
                    onPress={() => onSetLimitBreak(card.id, step)}
                    title={`Set to ${step === 4 ? "MLB" : `${step} LB`}`}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                      isOwned && limitBreak === step
                        ? step === 4
                          ? "bg-amber-400 text-amber-950 font-black shadow-2xs"
                          : "bg-emerald-600 text-white font-bold"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    {LB_LABELS[step]}
                  </AppButton>
                ))}
              </div>
            </div>

            <div>
              {isOwned ? (
                <AppButton
                  variant="quiet"
                  onPress={() => onRemoveCard(card.id)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <XIcon className="h-3.5 w-3.5" /> Remove from Owned
                </AppButton>
              ) : (
                <AppButton
                  variant="quiet"
                  onPress={() => onSetLimitBreak(card.id, 4)}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
                >
                  + Add to Owned (MLB)
                </AppButton>
              )}
            </div>
          </div>

          {/* Track Compatibility Bar */}
          <div className="px-4 sm:px-6 py-2 bg-zinc-100/60 dark:bg-zinc-800/40 border-t border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <TrophyIcon className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 flex-none" />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                {course
                  ? `${trackDetail?.nameEn || "Target Course"} ${course.length}m`
                  : "Active Course: None"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span>{activatingSkillCount}/{totalSkillCount} Active</span>
            </div>
          </div>
        </div>
      }
    >
      {/* Continuous Scroll: Skills first, then Training Effects */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {/* Section 1: Skills & Track */}
        <div>
          {/* Event Skills Section */}
          {eventSkills.length > 0 && (
            <div>
              <div className="px-3.5 py-1.5 bg-violet-500/10 dark:bg-violet-950/20 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Event Skills ({eventSkills.length})
              </div>
              {orderedChainGroups.map((group) => (
                <section key={`${group.eventId}:${group.choice}`}>
                  <div className="flex min-w-0 items-center gap-1.5 border-b border-violet-200/60 px-3.5 py-2 text-[10px] text-violet-700 dark:border-violet-900/50 dark:text-violet-300">
                    <span className="shrink-0 font-bold uppercase tracking-wide">Chain {group.step}</span>
                    <ChainArrowIcon step={group.step} size="sm" className="text-violet-600 dark:text-violet-400" />
                    <span className="shrink-0 font-semibold">Choice {group.choice}</span>
                    <span className="min-w-0 truncate text-violet-600/80 dark:text-violet-300/80">{group.choiceText}</span>
                  </div>
                  <div className="ml-3 border-l border-violet-200/70 pl-2 dark:border-violet-900/60">
                    {group.skills.map((skill) => renderSkillRow(skill, "event", false))}
                  </div>
                </section>
              ))}
              {standaloneEventSkills.map((s) => renderSkillRow(s, "event"))}
            </div>
          )}

          {/* Hint Skills Section */}
          {hintSkills.length > 0 && (
            <div>
              <div className="px-3.5 py-1.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Hint Skills ({hintSkills.length})
              </div>
              {hintSkills.map((s) => renderSkillRow(s, "hint"))}
            </div>
          )}

          {loading && !loadedSkills && (
            <LoadingAnimation
              active={loading && !loadedSkills}
              label="Loading skills and effects..."
              size="md"
              fill={false}
              className="py-16"
            />
          )}
        </div>

        {/* Section 2: Training Effects (Support Effects) */}
        <div className="pt-2">
          <div className="px-3.5 py-2 bg-amber-500/10 dark:bg-amber-950/20 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <span>Training Effects ({cardEffectsBlob?.effects.length || 0})</span>
            <span className="text-[10px] font-normal normal-case text-zinc-500">
              Active: <strong className="font-bold text-amber-700 dark:text-amber-400">{LB_LABELS[currentLb]}</strong>
            </span>
          </div>

          {/* Unique Effect Card: Left-accent stripe minimal-box per DESIGN.md */}
          {cardEffectsBlob?.uniqueEffect && (
            <div className="border-l-4 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 p-3 sm:px-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                <SparklesIcon className="h-3.5 w-3.5 text-amber-600" />
                <span>Unique Effect (Lv {cardEffectsBlob.uniqueEffect.lv} Unlock)</span>
              </div>
              <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                {cardEffectsBlob.uniqueEffect.textEn || cardEffectsBlob.uniqueEffect.textJp}
              </p>
              {cardEffectsBlob.uniqueEffect.textJp && cardEffectsBlob.uniqueEffect.textEn !== cardEffectsBlob.uniqueEffect.textJp && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {cardEffectsBlob.uniqueEffect.textJp}
                </p>
              )}
            </div>
          )}

          {/* Flat Effects Table */}
          {cardEffectsBlob?.effects && cardEffectsBlob.effects.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 text-[11px]">
                    <th className="py-2.5 px-3 sm:px-4 font-semibold">Effect</th>
                    {LB_LABELS.map((label, idx) => (
                      <th
                        key={label}
                        className={`py-2 px-2 text-center font-bold min-w-12 ${
                          idx === currentLb
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                            : ""
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {cardEffectsBlob.effects.map((eff) => (
                    <tr
                      key={eff.type}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 sm:px-4">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block leading-snug">
                          {eff.nameEn}
                        </span>
                        {eff.nameJp && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block leading-tight">
                            {eff.nameJp}
                          </span>
                        )}
                      </td>
                      {eff.values.map((v, idx) => {
                        const isCurrent = idx === currentLb;
                        const isUnlocked = v > 0;
                        return (
                          <td
                            key={idx}
                            className={`py-2 px-2 text-center text-xs ${
                              isCurrent
                                ? "bg-amber-500/10 font-bold text-amber-900 dark:text-amber-200"
                                : isUnlocked
                                  ? "text-zinc-700 dark:text-zinc-300"
                                  : "text-zinc-300 dark:text-zinc-600"
                            }`}
                          >
                            {isUnlocked ? v : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(!cardEffectsBlob || cardEffectsBlob.effects.length === 0) && !loading && (
            <p className="text-xs text-zinc-400 text-center py-8">
              No training effects data available for this support card.
            </p>
          )}
        </div>
      </div>
    </CollectionDetailSurface>
  );
}
