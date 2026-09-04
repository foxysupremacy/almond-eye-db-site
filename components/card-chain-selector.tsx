"use client";

import React, { useMemo, useState, useEffect } from "react";
import type { CardIndexEntry, SkillSummary } from "../lib/data-store";
import { useDeck, getDefaultChoiceIndex } from "./store";
import { ChainArrowIcon, ChainStepBadge } from "./chain-arrow-icon";
import { SkillHoverCard } from "./skill-hover-card";
import SkillIcon from "./skill-icon";
import { getInheritableSkillForGold } from "../lib/skill-rarity";

interface CardChainSelectorProps {
  card: CardIndexEntry;
  mode: "main" | "parent";
}

export default function CardChainSelector({ card, mode }: CardChainSelectorProps) {
  const { setChainChoice, getChainChoice, resetCardChainChoices, skillsByCard } = useDeck();
  const [isOpen, setIsOpen] = useState(false);

  // Only SSR cards (rarity 3) have continuous chain choices
  const chainEvents = useMemo(() => {
    if (card.rarity !== 3 || !card.eventDetails) return [];
    return card.eventDetails
      .filter((ev) => ev.eventType === "chain" || (ev.chainStep != null && ev.chainStep > 0))
      .sort((a, b) => (a.chainStep ?? 0) - (b.chainStep ?? 0));
  }, [card]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const cardSkills = skillsByCard[card.id];
  const cardTitle = card.nameEn || card.nameJp;

  // Fallback skills for cards without a continuous chain (e.g. SR/R cards)
  const fallbackSkills = useMemo(() => {
    if (chainEvents.length > 0 || !cardSkills) return [];
    const all = [
      ...(cardSkills.eventSkills.map((s) => ({ ...s, source: "event" as const })) ?? []),
      ...(cardSkills.hintSkills.map((s) => ({ ...s, source: "hint" as const })) ?? []),
    ];
    return all.slice(0, 2);
  }, [chainEvents.length, cardSkills]);

  // Derive picked chain skills across each step of the continuous chain
  const pickedChainSkills = useMemo(() => {
    if (!cardSkills || chainEvents.length === 0) return [];
    const results: Array<{
      step: number;
      isClimax: boolean;
      skill: SkillSummary;
      inheritedWhiteSkill?: { whiteId: number; whiteNameEn: string; whiteNameJp: string };
    }> = [];

    chainEvents.forEach((ev) => {
      const stepNumber = ev.chainStep ?? 1;
      const isClimax = stepNumber === chainEvents.length;
      const defaultChoice = getDefaultChoiceIndex(ev, (id) => {
        const sk = cardSkills.eventSkills.find((s) => s.id === id);
        return sk?.rarity ?? 1;
      });
      const selectedChoice = getChainChoice(mode, card.id, ev.eventId, defaultChoice);
      const choiceObj = ev.choices.find((ch) => ch.index === selectedChoice);
      if (choiceObj) {
        const granted = cardSkills.eventSkills.filter((s) => choiceObj.skillIds.includes(s.id));
        granted.forEach((sk) => {
          let inheritedWhiteSkill: { whiteId: number; whiteNameEn: string; whiteNameJp: string } | undefined;
          if (mode === "parent" && sk.rarity === 2) {
            const mapped = getInheritableSkillForGold(sk.id);
            if (mapped) {
              inheritedWhiteSkill = mapped;
            }
          }
          results.push({ step: stepNumber, isClimax, skill: sk, inheritedWhiteSkill });
        });
      }
    });
    return results;
  }, [cardSkills, chainEvents, card.id, mode, getChainChoice]);

  // Final event summary for the chain path button
  const finalEvent = chainEvents[chainEvents.length - 1];
  const finalDefaultChoice = finalEvent
    ? getDefaultChoiceIndex(finalEvent, (id) => {
        const sk = cardSkills?.eventSkills.find((s) => s.id === id);
        return sk?.rarity ?? 1;
      })
    : 1;
  const finalSelectedChoice = finalEvent
    ? getChainChoice(mode, card.id, finalEvent.eventId, finalDefaultChoice)
    : 1;
  const finalChoiceObj = finalEvent?.choices.find((ch) => ch.index === finalSelectedChoice);
  const finalGrantedSkills = (cardSkills?.eventSkills ?? []).filter((s) =>
    finalChoiceObj?.skillIds.includes(s.id),
  );

  let triggerSummary = "Default Path";
  let isGoldOutcome = false;
  if (finalGrantedSkills.length > 0) {
    const goldSkill = finalGrantedSkills.find((s) => s.rarity === 2);
    if (goldSkill) {
      triggerSummary = `★ ${goldSkill.nameEn || goldSkill.nameJp}`;
      isGoldOutcome = true;
    } else {
      triggerSummary = finalGrantedSkills.map((s) => s.nameEn || s.nameJp).join(" + ");
    }
  } else if (finalChoiceObj?.statSummary) {
    triggerSummary = finalChoiceObj.statSummary;
  }

  // Skills to display on the card face:
  // For chain cards: display up to 2 skills, prioritizing gold skills from the climax chain step
  // For non-chain cards: fallback to top 2 event/hint skills, prioritizing gold
  const displayedSkills = useMemo(() => {
    if (chainEvents.length > 0) {
      const scored = pickedChainSkills.map((p, idx) => {
        let score = 0;
        const isGold = p.skill.rarity === 2;
        if (p.isClimax && isGold) {
          score = 1500;
        } else if (p.isClimax) {
          score = 1000;
        } else if (isGold) {
          score = 500;
        } else {
          score = 100 + p.step * 10;
        }
        return { item: p, score, originalIdx: idx };
      });

      // Sort descending by score
      scored.sort((a, b) => b.score - a.score || a.originalIdx - b.originalIdx);

      // Take top 2 and re-sort them chronologically by chain step ascending
      const top2 = scored.slice(0, 2);
      top2.sort((a, b) => a.item.step - b.item.step || a.originalIdx - b.originalIdx);

      return top2.map(({ item: p }) => {
        const isGold = p.skill.rarity === 2;
        const displayName =
          mode === "parent" && p.inheritedWhiteSkill
            ? p.inheritedWhiteSkill.whiteNameEn || p.inheritedWhiteSkill.whiteNameJp
            : p.skill.nameEn || p.skill.nameJp;

        return {
          key: `${p.step}-${p.skill.id}`,
          skillId: mode === "parent" && p.inheritedWhiteSkill ? p.inheritedWhiteSkill.whiteId : p.skill.id,
          name: displayName,
          nameJp: mode === "parent" && p.inheritedWhiteSkill ? p.inheritedWhiteSkill.whiteNameJp : p.skill.nameJp,
          rarity: mode === "parent" && p.inheritedWhiteSkill ? 1 : p.skill.rarity,
          iconId: p.skill.iconId,
          badgeLabel: `Lv ${p.step}`,
          isClimax: p.isClimax,
          isGold,
          isChain: true,
        };
      });
    }

    const sortedFallback = [...fallbackSkills].sort((a, b) => (b.rarity ?? 1) - (a.rarity ?? 1));
    return sortedFallback.slice(0, 2).map((sk) => ({
      key: String(sk.id),
      skillId: sk.id,
      name: sk.nameEn || sk.nameJp,
      nameJp: sk.nameJp,
      rarity: sk.rarity,
      iconId: sk.iconId,
      badgeLabel: sk.source === "event" ? "Event" : "Hint",
      isClimax: false,
      isGold: sk.rarity === 2,
      isChain: false,
    }));
  }, [chainEvents.length, pickedChainSkills, fallbackSkills, mode]);

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Top 2 Skills from Selected Chain (or fallback for non-chain) */}
        {displayedSkills.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {displayedSkills.map((item) => (
              <SkillHoverCard
                key={item.key}
                skillId={item.skillId}
                fallbackSkill={{
                  nameEn: item.name,
                  nameJp: item.nameJp,
                  rarity: item.rarity,
                  iconId: item.iconId,
                }}
                cardName={cardTitle}
                className="w-full"
              >
                <div
                  className={`flex items-center gap-1 sm:gap-1.5 rounded-lg border px-1.5 sm:px-2 py-1 text-xs transition-colors min-w-0 ${
                    item.isGold && mode !== "parent"
                      ? "border-amber-300 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 font-medium"
                      : "border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 hover:border-emerald-400 dark:hover:border-emerald-600"
                  }`}
                >
                  {/* Chain Level Badge (Lv 1, Lv 2, Lv 3) or Event/Hint */}
                  <span
                    className={`shrink-0 rounded px-1 sm:px-1.5 py-0.2 text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider ${
                      item.isChain
                        ? item.isClimax
                          ? "bg-amber-500 text-white dark:bg-amber-600"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                        : "bg-zinc-200/80 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold"
                    }`}
                  >
                    {item.badgeLabel}
                  </span>
                  <SkillIcon
                    iconId={item.iconId}
                    name={item.name}
                    className="h-3.5 w-3.5 object-contain flex-none"
                  />
                  <span className="truncate flex-1 text-left text-[10.5px] sm:text-[11px]">
                    {item.name}
                  </span>
                  {item.isGold && (
                    <span className="text-[8.5px] sm:text-[9px] font-bold text-amber-600 dark:text-amber-400 flex-none">
                      {mode === "parent" ? "Inherits" : "★ Gold"}
                    </span>
                  )}
                </div>
              </SkillHoverCard>
            ))}
          </div>
        )}

        {/* Previous Chain Path Button */}
        {chainEvents.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            className={`w-full flex items-center justify-between gap-1 sm:gap-1.5 rounded-lg border px-1.5 sm:px-2 py-1 sm:py-1.5 text-left transition-all cursor-pointer group active:scale-[0.98] shadow-2xs ${
              isGoldOutcome
                ? "border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 hover:border-amber-500 dark:hover:border-amber-600"
                : mode === "parent"
                  ? "border-emerald-200/90 dark:border-emerald-800/80 bg-white dark:bg-zinc-900 hover:border-emerald-400 dark:hover:border-emerald-600 text-emerald-950 dark:text-emerald-200"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-400 dark:hover:border-emerald-600 text-zinc-900 dark:text-zinc-100"
            }`}
            title="Configure continuous event chain choices (opens path selector)"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <ChainArrowIcon
                step={chainEvents.length}
                size="sm"
                className={isGoldOutcome ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}
              />
              <div className="min-w-0">
                <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 leading-none">
                  Chain Path
                </span>
                <span className={`block truncate text-[11px] font-semibold mt-0.5 ${isGoldOutcome ? "text-amber-950 dark:text-amber-100" : "text-zinc-800 dark:text-zinc-200"}`}>
                  {triggerSummary}
                </span>
              </div>
            </div>
            <span
              className="shrink-0 rounded p-1 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors"
              aria-hidden="true"
            >
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3l5 5-5 5" />
              </svg>
            </span>
          </button>
        ) : (
          <div
            className="flex w-full min-h-[38px] items-center justify-between gap-1.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-2 py-1 select-none"
            aria-hidden="true"
          >
            <div className="min-w-0">
              <span className="block text-[9px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 leading-none">
                Chain Path
              </span>
              <span className="block truncate text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                None (Single events)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Centered Modal Dialog / Bottom Sheet on Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chain-modal-title"
        >
          <div
            className="flex max-h-[85vh] sm:max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={card.imgUrl}
                  alt={cardTitle}
                  className="h-11 w-11 shrink-0 rounded-lg object-contain border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/40 p-0.5"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-amber-200/90 dark:bg-amber-950 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 dark:text-amber-100 border border-amber-400/80 dark:border-amber-700 uppercase">
                      SSR
                    </span>
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Continuous Event Chain
                    </span>
                  </div>
                  <h3 id="chain-modal-title" className="mt-0.5 truncate text-sm font-bold text-zinc-900 dark:text-zinc-100" title={cardTitle}>
                    {cardTitle}
                  </h3>
                  <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{card.nameJp}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => resetCardChainChoices(mode, card.id)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                  title="Reset all choices for this card to recommended defaults"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 active:scale-[0.95] transition-all cursor-pointer"
                  aria-label="Close dialog"
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body - List of Continuous Steps */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chainEvents.map((ev) => {
                const defaultChoice = getDefaultChoiceIndex(ev, (id) => {
                  const sk = cardSkills?.eventSkills.find((s) => s.id === id);
                  return sk?.rarity ?? 1;
                });
                const selectedChoice = getChainChoice(mode, card.id, ev.eventId, defaultChoice);
                const stepNumber = ev.chainStep ?? 1;
                const isClimaxStep = stepNumber === chainEvents.length;

                return (
                  <div key={ev.eventId} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-2xs">
                    {/* Step Title Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChainStepBadge step={stepNumber} isClimax={isClimaxStep} />
                        <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200" title={`${ev.nameEn} (${ev.nameJp})`}>
                          {ev.nameEn || ev.nameJp}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 font-medium">
                        {ev.choices.length} {ev.choices.length === 1 ? "option" : "options"}
                      </span>
                    </div>

                    {/* Full-width Choice Cards */}
                    <div className="space-y-2">
                      {ev.choices.map((ch) => {
                        const isSelected = selectedChoice === ch.index;

                        // Find skills granted by this choice
                        const grantedSkills = (cardSkills?.eventSkills ?? []).filter((s) =>
                          ch.skillIds.includes(s.id),
                        );
                        const hasGoldSkill = grantedSkills.some((s) => s.rarity === 2);

                        return (
                          <button
                            key={ch.index}
                            type="button"
                            onClick={() => setChainChoice(mode, card.id, ev.eventId, ch.index)}
                            className={`w-full flex items-start gap-3 rounded-xl border p-2.5 text-left transition-all cursor-pointer active:scale-[0.99] ${
                              isSelected
                                ? "border-emerald-600 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-2xs ring-1 ring-emerald-600 dark:ring-emerald-500"
                                : hasGoldSkill
                                  ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 hover:border-amber-400 dark:hover:border-amber-600"
                                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50"
                            }`}
                          >
                            {/* Radio Circle Indicator */}
                            <div className="mt-0.5 shrink-0">
                              <div
                                className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                                  isSelected
                                    ? "border-emerald-700 dark:border-emerald-500 bg-emerald-700 dark:bg-emerald-600 text-white"
                                    : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                                }`}
                              >
                                {isSelected && (
                                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                )}
                              </div>
                            </div>

                            {/* Choice Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                  Option {ch.index}: {ch.textEn || ch.textJp || `Choice ${ch.index}`}
                                </span>
                                {ch.textJp && ch.textEn && (
                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                                    {ch.textJp}
                                  </span>
                                )}
                              </div>

                              {/* Reward Badges */}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {grantedSkills.map((sk) => {
                                  const isGold = sk.rarity === 2;
                                  return (
                                    <SkillHoverCard
                                      key={sk.id}
                                      skillId={sk.id}
                                      fallbackSkill={sk}
                                      cardName={cardTitle}
                                    >
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border cursor-help transition-all hover:ring-2 ${
                                          isGold
                                            ? "border-amber-400 dark:border-amber-700 bg-amber-200/90 dark:bg-amber-950 text-amber-950 dark:text-amber-100 shadow-2xs hover:ring-amber-300/80 font-bold"
                                            : "border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:ring-zinc-300/80"
                                        }`}
                                      >
                                        <SkillIcon iconId={sk.iconId} name={sk.nameEn} className="h-3.5 w-3.5 object-contain flex-none" />
                                        {isGold && <span className="text-amber-800 dark:text-amber-300 font-bold">★</span>}
                                        <span>{sk.nameEn || sk.nameJp}</span>
                                        <span className="text-[9px] font-normal opacity-70">
                                          ({isGold ? "Gold" : "White"})
                                        </span>
                                      </span>
                                    </SkillHoverCard>
                                  );
                                })}

                                {ch.statSummary && (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 text-[10px] font-medium text-sky-900 dark:text-sky-300">
                                    <span>⚡</span>
                                    <span>{ch.statSummary}</span>
                                  </span>
                                )}

                                {grantedSkills.length === 0 && !ch.statSummary && (
                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                                    No direct skill reward
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Active path updates deck skills instantly
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
