"use client";

import React, { useMemo, useState, useEffect } from "react";
import type { CardIndexEntry } from "../lib/data-store";
import { useDeck, getDefaultChoiceIndex } from "./store";
import { ChainArrowIcon, ChainStepBadge } from "./chain-arrow-icon";
import { SkillHoverCard } from "./skill-hover-card";
import SkillIcon from "./skill-icon";

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

  if (chainEvents.length === 0) {
    return (
      <div
        className="mt-2 flex w-full min-h-[42px] items-center justify-between gap-1.5 rounded-lg border border-dashed border-zinc-200/80 bg-zinc-50/50 px-2 py-1.5 select-none"
        aria-hidden="true"
      >
        <div className="min-w-0">
          <span className="block text-[9px] font-medium uppercase tracking-wider text-zinc-400 leading-none">
            Chain Path
          </span>
          <span className="block truncate text-[11px] text-zinc-400 mt-0.5">
            None (Single events)
          </span>
        </div>
      </div>
    );
  }

  const cardSkills = skillsByCard[card.id];

  // Derive active summary for the card face trigger pill
  // Looks at the final step (climax) to summarize the selected reward
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

  const cardTitle = card.nameEn || card.nameJp;

  return (
    <>
      {/* Compact Trigger Pill on Card Face */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={`mt-2 w-full flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-all cursor-pointer group active:scale-[0.98] shadow-2xs ${
          isGoldOutcome
            ? "border-amber-300 bg-amber-50/70 hover:bg-amber-50 text-amber-950"
            : mode === "parent"
              ? "border-emerald-200/80 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-950"
              : "border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100/80 text-zinc-900"
        }`}
        title="Configure continuous event chain choices (opens path selector)"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ChainArrowIcon
            step={chainEvents.length}
            size="sm"
            className={isGoldOutcome ? "text-amber-600" : mode === "parent" ? "text-emerald-700" : "text-[#794016]"}
          />
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-500 leading-none">
              Chain Path
            </span>
            <span className={`block truncate text-[11px] font-semibold mt-0.5 ${isGoldOutcome ? "text-amber-900" : "text-zinc-800"}`}>
              {triggerSummary}
            </span>
          </div>
        </div>
        <span
          className="shrink-0 rounded p-1 text-zinc-400 group-hover:text-zinc-700 group-hover:bg-black/5 transition-colors"
          aria-hidden="true"
        >
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </span>
      </button>

      {/* Centered Modal Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chain-modal-title"
        >
          <div
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 bg-[#fbfaf8] p-4">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={card.imgUrl}
                  alt={cardTitle}
                  className="h-11 w-11 shrink-0 rounded-lg object-contain border border-zinc-200/80 bg-zinc-50 p-0.5"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 uppercase">
                      SSR
                    </span>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Continuous Event Chain
                    </span>
                  </div>
                  <h3 id="chain-modal-title" className="mt-0.5 truncate text-sm font-bold text-zinc-900" title={cardTitle}>
                    {cardTitle}
                  </h3>
                  <p className="truncate text-[11px] text-zinc-400">{card.nameJp}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => resetCardChainChoices(mode, card.id)}
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                  title="Reset all choices for this card to recommended defaults"
                >
                  Reset to Recommended
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:scale-[0.95] transition-all cursor-pointer"
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
                  <div key={ev.eventId} className="rounded-xl border border-zinc-200/90 bg-zinc-50/40 p-3 shadow-2xs">
                    {/* Step Title Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-200/60 pb-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChainStepBadge step={stepNumber} isClimax={isClimaxStep} />
                        <span className="truncate text-xs font-semibold text-zinc-800" title={`${ev.nameEn} (${ev.nameJp})`}>
                          {ev.nameEn || ev.nameJp}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 shrink-0 font-medium">
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
                                ? mode === "parent"
                                  ? "border-emerald-600 bg-emerald-50/70 shadow-2xs ring-1 ring-emerald-600"
                                  : "border-[#794016] bg-[#794016]/5 shadow-2xs ring-1 ring-[#794016]"
                                : hasGoldSkill
                                  ? "border-amber-200 bg-amber-50/30 hover:border-amber-300 hover:bg-amber-50/60"
                                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/80"
                            }`}
                          >
                            {/* Radio Circle Indicator */}
                            <div className="mt-0.5 shrink-0">
                              <div
                                className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                                  isSelected
                                    ? mode === "parent"
                                      ? "border-emerald-700 bg-emerald-700 text-white"
                                      : "border-[#794016] bg-[#794016] text-white"
                                    : "border-zinc-300 bg-white"
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
                                <span className="text-xs font-semibold text-zinc-900">
                                  Option {ch.index}: {ch.textEn || ch.textJp || `Choice ${ch.index}`}
                                </span>
                                {ch.textJp && ch.textEn && (
                                  <span className="text-[10px] text-zinc-400 italic">
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
                                            ? "border-amber-300 bg-amber-100 text-amber-950 shadow-2xs hover:ring-amber-300/80"
                                            : "border-zinc-200 bg-zinc-100 text-zinc-800 hover:ring-zinc-300/80"
                                        }`}
                                      >
                                        <SkillIcon iconId={sk.iconId} name={sk.nameEn} className="h-3.5 w-3.5 rounded object-contain flex-none" />
                                        {isGold && <span className="text-amber-600 font-bold">★</span>}
                                        <span>{sk.nameEn || sk.nameJp}</span>
                                        <span className="text-[9px] font-normal opacity-70">
                                          ({isGold ? "Gold" : "White"})
                                        </span>
                                      </span>
                                    </SkillHoverCard>
                                  );
                                })}

                                {ch.statSummary && (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-900">
                                    <span>⚡</span>
                                    <span>{ch.statSummary}</span>
                                  </span>
                                )}

                                {grantedSkills.length === 0 && !ch.statSummary && (
                                  <span className="text-[10px] text-zinc-400 italic">
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
            <div className="flex items-center justify-between border-t border-zinc-100 bg-[#fbfaf8] px-4 py-3">
              <div className="text-[11px] text-zinc-500">
                Active path updates deck skills instantly
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-2xs active:scale-[0.98] transition-all cursor-pointer ${
                  mode === "parent"
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : "bg-[#794016] hover:bg-[#633310]"
                }`}
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
