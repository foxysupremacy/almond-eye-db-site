"use client";

import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";



import { CheckIcon, XIcon } from "@/app/common/ui/primitives/icons";
import React, { useEffect, useMemo, useState } from "react";
import { api, type CardIndexEntry, type SkillSummary, type CardSkills } from "@/lib/api";
import { useDeck } from "@/features/deck/state";
import { RARITY_META, getSkillRarityStyle } from "@/app/common/ui/skills/skill-rarity";
import CardTypeIcon, { formatCardType } from "@/app/common/ui/cards/card-type-icon";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import { SkillHoverCard } from "@/app/common/ui/skills/details/skill-hover-card";
import SkillItem from "@/app/common/ui/skills/skill-item";
import DuplicateSkillBadge from "@/app/common/ui/skills/provenance/duplicate-skill-badge";
import { getInheritableSkillForGold } from "@/lib/skills/rarity";
import { isSkillBanned, getPvpRaceParameters } from "@/lib/pvp/events";
import { SkillIndicatorGroup, SkillSourceIcons } from "@/app/common/ui/skills/skill-badges";
import { buildDuplicateSkillIndex, type DuplicateSkillIndex } from "@/lib/skills/duplicates";
import { evaluateSkillActivation } from "@/lib/parenting/skill-evaluator";
import { getDefaultChoiceIndex } from "@/lib/deck/event-choices";
import EventChainAttribution from "@/app/common/ui/skills/provenance/event-chain-attribution";

interface CardSkillsSheetProps {
  card: CardIndexEntry;
  isOpen: boolean;
  onClose: () => void;
  onPick?: (card: CardIndexEntry) => void;
  mode?: "main" | "parent";
}

export default function CardSkillsSheet({ card, isOpen, onClose, onPick, mode = "main" }: CardSkillsSheetProps) {
  const {
    skillsByCard,
    mainSkillIdSet,
    parentSlots,
    activePvpEvent,
    activeRaceParameters,
    course,
    runningStyle,
    activePreset,
  } = useDeck();
  const [loadedSkills, setLoadedSkills] = useState<CardSkills | null>(null);
  const [loading, setLoading] = useState(false);
  const isParent = mode === "parent";
  const raceParams = activeRaceParameters;


  // Fetch skills dynamically if not already in deck store
  useEffect(() => {
    if (!isOpen || !card) return;
    if (skillsByCard[card.id]) {
      setLoadedSkills(skillsByCard[card.id]);
    } else {
      setLoading(true);
      api
        .cardSkills(card.id)
        .then((data) => {
          setLoadedSkills(data);
          setLoading(false);
        })
        .catch(() => {
          setLoadedSkills(null);
          setLoading(false);
        });
    }
  }, [isOpen, card?.id, skillsByCard]);



  // Parent mode: map skillId -> every equipped parent card (this one included)
  // that also grants it, so rows can show the "duplicate with N cards" badge
  const parentDuplicateCardsMap = useMemo<DuplicateSkillIndex>(() => {
    if (!isParent) return new Map();
    return buildDuplicateSkillIndex(
      parentSlots.flatMap((c) => {
        if (!c) return [];
        const cs = skillsByCard[c.id];
        if (!cs) return [];
        return [{
          card: {
          cardId: c.id,
          cardName: c.nameEn || c.nameJp || `Card #${c.id}`,
          cardNameJp: c.nameJp,
          rarity: c.rarity,
          type: c.type,
          portraitUrl: c.portraitUrl,
          imgUrl: c.imgUrl,
          },
          grants: [
            ...cs.eventSkills.map((s) => ({ id: s.id, source: "event", eventMeta: s.eventMeta ?? null })),
            ...cs.hintSkills.map((s) => ({ id: s.id, source: "hint", eventMeta: s.eventMeta ?? null })),
          ],
        }];
      })
    );
  }, [isParent, parentSlots, skillsByCard]);

  if (!isOpen) return null;

  const cardSkills = skillsByCard[card.id] ?? loadedSkills;
  const eventSkills = cardSkills?.eventSkills ?? [];
  const hintSkills = cardSkills?.hintSkills ?? [];
  const totalCount = eventSkills.length + hintSkills.length;
  const cardTitle = card.nameEn || card.nameJp;

  function renderSkillRow(s: SkillSummary, source: "event" | "hint") {
    const rStyle = getSkillRarityStyle(s.rarity);
    const isBanned = isSkillBanned(s.id, activePvpEvent);
    const inMainDeck = isParent && mainSkillIdSet.has(s.id);
    const dupEntries = isParent ? parentDuplicateCardsMap.get(s.id) ?? [] : [];
    const isEquipped = parentSlots.some((c) => c?.id === card.id);
    const otherDupEntries = dupEntries.filter((e) => e.cardId !== card.id);
    const isDupAcrossParents = otherDupEntries.length > 0;

    // Check activation against course geometry and running style
    let evalSkillId = s.id;
    if (isParent && s.rarity === 2) {
      const mapped = getInheritableSkillForGold(s.id);
      evalSkillId = mapped ? mapped.whiteId : s.id;
    }
    const activation = course
      ? evaluateSkillActivation(evalSkillId, course, runningStyle, raceParams)
      : { activates: false, reason: "Select a track to evaluate skill activation" };
    const canActivate = activation.activates;

    // Check event branch choice
    let isActiveChoice = true;
    let isBranchingEvent = false;
    if (source === "event" && s.eventMeta && card.eventDetails) {
      const evDetail = card.eventDetails.find((ev) => ev.eventId === s.eventMeta!.eventId);
      if (evDetail && evDetail.choices && evDetail.choices.length > 1) {
        isBranchingEvent = true;
        const choiceKey = `${card.id}:${s.eventMeta.eventId}`;
        const selectedChoice =
          activePreset.parentChainChoices?.[choiceKey] ??
          activePreset.parentChainChoices?.[String(card.id)] ??
          getDefaultChoiceIndex(
            evDetail,
            (id) => skillsByCard[card.id]?.eventSkills.find((sk) => sk.id === id)?.rarity ?? 1,
          );
        isActiveChoice = s.eventMeta.choiceIndex === selectedChoice;
      }
    }

    // Unique to this card: not in the main deck, no other parent card has it, activates on track/style, and is on active choice branch
    const isUniqueTarget = isParent && !inMainDeck && !isDupAcrossParents && canActivate && isActiveChoice;

    return (
      <div
        key={`${s.id}-${source}`}
        className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 ${
          rStyle.borderClass
        } ${
          isBanned
            ? "opacity-60 bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
            : isParent && !canActivate
              ? "opacity-75 bg-zinc-50/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800"
              : isDupAcrossParents
                ? "bg-sky-50/40 dark:bg-sky-950/20"
                : inMainDeck
                  ? "bg-amber-50/40 dark:bg-amber-950/20"
                  : isUniqueTarget
                    ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                    : rStyle.bgClass ?? "bg-white dark:bg-zinc-900"
        }`}
      >
        <div className="min-w-0 flex-1">
          <SkillItem
            skill={{
              id: s.id,
              iconId: s.iconId,
              nameEn: s.nameEn,
              nameJp: s.nameJp,
              rarity: s.rarity,
              cardName: cardTitle,
              cardId: card.id,
            }}
            size="sm"
            showExternalIcon={true}
            isBanned={isBanned}
            trailing={
              <div className={`${isParent ? "mt-1 " : ""}flex flex-wrap items-center gap-1.5`}>
                {isBanned && <SkillIndicatorGroup indicators={[{ kind: "banned", title: "Banned by Special Rule (No Debuffs) - this skill cannot be used and will not activate" }]} />}
                {isParent && (
                  <SkillIndicatorGroup density="standard" indicators={[
                    ...(isUniqueTarget ? [{ kind: "unique-target" as const, title: "Unique to this card — not in the Main Deck and no other picked parent card grants it. Equipping this card is the only way to farm this skill in the current setup." }] : []),
                    ...(!canActivate ? [{ kind: "no-activation" as const, label: activation.reason?.toLowerCase().includes("rank") ? "Rank Trap" : undefined, title: activation.reason || "This skill cannot activate on the selected course or running style" }] : []),
                    ...(isBranchingEvent && !isActiveChoice ? [{ kind: "unselected-choice" as const, title: "This skill is from an alternative choice branch and is not currently selected in the event chain" }] : []),
                    ...(inMainDeck ? [{ kind: "in-main-deck" as const }] : []),
                  ]} />
                )}
                {isDupAcrossParents && (
                  <DuplicateSkillBadge
                    cards={isEquipped ? dupEntries : otherDupEntries}
                    currentCardId={isEquipped ? card.id : undefined}
                    skillName={s.nameEn}
                    variant="sky"
                  />
                )}
              </div>
            }
          >
            {s.descEn && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-600 dark:text-zinc-300">
                {s.descEn}
              </p>
            )}
            <div className="mt-1">
              <SkillSourceIcons sources={[{ kind: "card", cardId: card.id, name: cardTitle }]} />
            </div>

            {s.eventMeta && (
              <div className="mt-1"><EventChainAttribution eventMeta={s.eventMeta} /></div>
            )}
          </SkillItem>
        </div>
      </div>
    );
  }

  return (
    <AppDialog isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}
      title={cardTitle} ariaLabel={cardTitle} size="sheet" overlayLayer="inspection"
      header={<></>} bodyClassName="contents" className="max-h-[92dvh] sm:max-h-[88vh] sm:max-w-lg text-left pb-6 sm:pb-0">
        {/* Mobile handle */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={card.portraitUrl || card.imgUrl}
              alt={cardTitle}
              className="h-12 w-12 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${RARITY_META[card.rarity]?.chip ?? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}>
                  {RARITY_META[card.rarity]?.label ?? "R"}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 capitalize">
                  <CardTypeIcon type={card.type} className="h-3.5 w-3.5 object-contain flex-none" />
                  <span>{formatCardType(card.type)}</span>
                </span>
              </div>
              <h3 id="card-skills-title" className="mt-0.5 truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {cardTitle}
              </h3>
              <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{card.nameJp}</p>
            </div>
          </div>

          <AppButton variant="quiet"
            type="button"
            onPress={onClose}
            iconOnly

            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </AppButton>
        </div>

        {/* Subtitle count banner */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-100/60 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 text-xs">
          <span className="text-zinc-600 dark:text-zinc-300 font-medium">
            Granted Skills ({totalCount})
          </span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Tap or hover any skill to inspect course triggers
          </span>
        </div>

        {/* Skills list */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {eventSkills.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                  Event Skills
                </span>
                <span className="text-[11px] text-zinc-400">({eventSkills.length})</span>
              </div>
              <div className="space-y-1.5">
                {eventSkills.map((s) => renderSkillRow(s, "event"))}
              </div>
            </div>
          )}

          {hintSkills.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Hint Skills
                </span>
                <span className="text-[11px] text-zinc-400">({hintSkills.length})</span>
              </div>
              <div className="space-y-1.5">
                {hintSkills.map((s) => renderSkillRow(s, "hint"))}
              </div>
            </div>
          )}

          {loading && !cardSkills && (
            <LoadingAnimation
              active={loading && !cardSkills}
              label="Loading card skills…"
              size="md"
              fill={false}
              className="py-12"
            />
          )}

          {!loading && totalCount === 0 && (
            <p className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
              No skills found for this card.
            </p>
          )}
        </div>

        {onPick && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Ready to equip this support card?
            </span>
            <AppButton variant="primary"
              type="button"
              onPress={() => {
                onPick(card);
                onClose();
              }}
            >
              <span>Select Card</span>
              <CheckIcon className="h-3.5 w-3.5" />
            </AppButton>
          </div>
        )}
    </AppDialog>
  );
}
