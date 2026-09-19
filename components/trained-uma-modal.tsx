"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { KyumaruVeteranItem, KyumaruLearnedSkill, KyumaruFactorInfo } from "../lib/kyumaru-types";
import { getCharacterImageUrl, type CharacterIndexEntry } from "../lib/api";
import { skillsById, charactersById } from "../lib/data/registry";
import { decodeFactor, type DecodedFactor } from "../lib/factor-decoder";
import { getSkillRarityStyle } from "../lib/skill-rarity";
import SkillIcon from "./skill-icon";
import { SkillHoverCard } from "./skill-hover-card";
import { useBodyScrollLock } from "../lib/use-body-scroll-lock";
import { useParentingSetup } from "../lib/parenting-state";
import { useDeck } from "./store";
import { getPvpRaceParameters } from "../lib/pvp-events";
import {
  extractActiveParentTargetSkills,
  evaluateVeteranTargetFactors,
} from "../lib/parent-factor-matcher";
import { getInheritableSkillForGold, getInheritableSkillForUnique } from "../lib/skill-rarity";
import { XIcon } from "./icons";

interface TrainedUmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  veteran: KyumaruVeteranItem | null;
  runs?: KyumaruVeteranItem[];
  initialRunIndex?: number;
  character?: CharacterIndexEntry | null;
}

type ModalTab = "skills" | "factors";
type LineageScope = "self" | "parent1" | "parent2";

export default function TrainedUmaModal({
  isOpen,
  onClose,
  veteran,
  runs = [],
  initialRunIndex = 0,
  character,
}: TrainedUmaModalProps) {
  const { setParent1, setParent2 } = useParentingSetup();
  const { parentSkills, course, runningStyle, activePvpEvent } = useDeck();
  const [parentNotice, setParentNotice] = useState<string | null>(null);
  const [activeRunIndex, setActiveRunIndex] = useState(initialRunIndex);
  const [activeTab, setActiveTab] = useState<ModalTab>("skills");
  const [lineageScope, setLineageScope] = useState<LineageScope>("self");
  const [skillQuery, setSkillQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(isOpen);

  // Sync activeRunIndex when initialRunIndex or veteran changes
  useEffect(() => {
    setActiveRunIndex(initialRunIndex);
    setActiveTab("skills");
    setLineageScope("self");
    setSkillQuery("");
  }, [veteran, initialRunIndex, isOpen]);

  // Pointer fine guard for search input autofocus (DESIGN.md Section 6)
  useEffect(() => {
    if (isOpen && activeTab === "skills") {
      if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
        searchInputRef.current?.focus();
      }
    }
  }, [isOpen, activeTab]);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Active run data
  const currentRun = useMemo(() => {
    if (runs.length > 0 && runs[activeRunIndex]) {
      return runs[activeRunIndex];
    }
    return veteran;
  }, [runs, activeRunIndex, veteran]);

  // Associated character metadata
  const charaMeta = useMemo(() => {
    if (character) return character;
    if (currentRun) {
      return charactersById.get(currentRun.card_id) || null;
    }
    return null;
  }, [character, currentRun]);

  // Lineage parents
  const parent1Chara = useMemo(() => {
    const p1 = currentRun?.succession_chara_array?.find((p) => p.position_id === 10);
    if (!p1) return null;
    return {
      chara: charactersById.get(p1.card_id) || null,
      cardId: p1.card_id,
      factors: p1.factor_info_array || [],
    };
  }, [currentRun]);

  const parent2Chara = useMemo(() => {
    const p2 = currentRun?.succession_chara_array?.find((p) => p.position_id === 20);
    if (!p2) return null;
    return {
      chara: charactersById.get(p2.card_id) || null,
      cardId: p2.card_id,
      factors: p2.factor_info_array || [],
    };
  }, [currentRun]);

  const raceParams = useMemo(() => getPvpRaceParameters(activePvpEvent), [activePvpEvent]);
  const activeTargetSkillsMap = useMemo(() => {
    return extractActiveParentTargetSkills(parentSkills, course, runningStyle, raceParams);
  }, [parentSkills, course, runningStyle, raceParams]);
  const hasTargetSkills = activeTargetSkillsMap.size > 0;

  const targetFactorMatch = useMemo(() => {
    if (!currentRun || !hasTargetSkills) return { count: 0, matchedSkills: [] };
    return evaluateVeteranTargetFactors(currentRun, activeTargetSkillsMap);
  }, [currentRun, activeTargetSkillsMap, hasTargetSkills]);

  const isTargetSkill = (sid: number): boolean => {
    if (!hasTargetSkills) return false;
    if (activeTargetSkillsMap.has(sid)) return true;
    const gold = getInheritableSkillForGold(sid);
    if (gold && activeTargetSkillsMap.has(gold.whiteId)) return true;
    const uniq = getInheritableSkillForUnique(sid);
    if (uniq && activeTargetSkillsMap.has(uniq)) return true;
    return false;
  };

  const isTargetFactor = (f: DecodedFactor): boolean => {
    if (!hasTargetSkills || !f.skillIds) return false;
    return f.skillIds.some((sid) => isTargetSkill(sid));
  };

  // Factors for active lineage scope
  const scopedFactors: DecodedFactor[] = useMemo(() => {
    if (!currentRun) return [];
    let factorArray: KyumaruFactorInfo[] = [];
    if (lineageScope === "self") {
      factorArray = currentRun.factor_info_array || [];
    } else if (lineageScope === "parent1") {
      factorArray = parent1Chara?.factors || [];
    } else if (lineageScope === "parent2") {
      factorArray = parent2Chara?.factors || [];
    }
    return factorArray.map((f) => decodeFactor(f.factor_id));
  }, [currentRun, lineageScope, parent1Chara, parent2Chara]);

  // Group scoped factors by color
  const factorGroups = useMemo(() => {
    const blue: DecodedFactor[] = [];
    const pink: DecodedFactor[] = [];
    const green: DecodedFactor[] = [];
    const white: DecodedFactor[] = [];

    for (const f of scopedFactors) {
      if (f.type === "blue") blue.push(f);
      else if (f.type === "pink") pink.push(f);
      else if (f.type === "green") green.push(f);
      else white.push(f);
    }

    // Sort green factors: Target factors first
    green.sort((a, b) => {
      const aIsTarget = isTargetFactor(a) ? 0 : 1;
      const bIsTarget = isTargetFactor(b) ? 0 : 1;
      if (aIsTarget !== bIsTarget) return aIsTarget - bIsTarget;
      return b.stars - a.stars;
    });

    // Sort white factors: Target factors first, then Skills, then Races, then Scenarios
    white.sort((a, b) => {
      const aIsTarget = isTargetFactor(a) ? 0 : 1;
      const bIsTarget = isTargetFactor(b) ? 0 : 1;
      if (aIsTarget !== bIsTarget) return aIsTarget - bIsTarget;
      const order = (cat?: string) => (cat === "skill" ? 1 : cat === "race" ? 2 : cat === "scenario" ? 3 : 4);
      return order(a.category) - order(b.category) || b.stars - a.stars || a.name.localeCompare(b.name);
    });

    return { blue, pink, green, white };
  }, [scopedFactors, hasTargetSkills, activeTargetSkillsMap]);

  // Learned skills for current run
  const learnedSkillsList = useMemo(() => {
    if (!currentRun?.skill_array) return [];
    const q = skillQuery.trim().toLowerCase();

    const list = currentRun.skill_array.map((item: KyumaruLearnedSkill) => {
      const skill = skillsById.get(item.skill_id);
      return {
        skillId: item.skill_id,
        level: item.level,
        skill,
        nameEn: skill?.nameEn || `Skill ${item.skill_id}`,
        nameJp: skill?.nameJp || "",
        rarity: skill?.rarity ?? 1,
        iconId: skill?.iconId ?? null,
      };
    });

    // Sort: Unique skills (Lv > 1 or rarity 3) first, then Gold (rarity 2), then White (rarity 1)
    list.sort((a, b) => {
      return (b.rarity || 1) - (a.rarity || 1) || b.level - a.level || a.nameEn.localeCompare(b.nameEn);
    });

    if (!q) return list;
    return list.filter(
      (s) => s.nameEn.toLowerCase().includes(q) || s.nameJp.toLowerCase().includes(q)
    );
  }, [currentRun, skillQuery]);

  if (!isOpen || !currentRun) return null;

  const charId = charaMeta?.charId || 0;
  const cardId = currentRun.card_id;
  const avatarUrl = charId && cardId ? getCharacterImageUrl(charId, cardId) : "";
  const nameEn = charaMeta?.nameEn || currentRun.name || `Chara ${cardId}`;
  const nameJp = charaMeta?.nameJp || "";
  const titleEn = charaMeta?.titleEn || charaMeta?.titleJp || `Costume ${cardId}`;

  const rankPadded = String(currentRun.rank || 0).padStart(2, "0");
  const rankIconSrc = `/assets/statusrank/utx_ico_statusrank_${rankPadded}.png`;

  const totalSkillsCount = currentRun.skill_array?.length || 0;
  const totalFactorsCount = currentRun.factor_info_array?.length || 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200 ease-out-quart"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-[250ms] ease-out-expo"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* Modal Header */}
        <div className="border-b border-zinc-100 dark:border-zinc-800 p-4 bg-zinc-50/70 dark:bg-zinc-900/60">
          <div className="flex items-start justify-between gap-3">
            {/* Uma Identity */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 p-0.5 shadow-2xs overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={nameEn}
                    className="h-full w-full object-contain filter drop-shadow-xs scale-[1.65] origin-top translate-y-[2%]"
                  />
                ) : (
                  <span className="text-2xl">🐎</span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate leading-snug">
                    {nameEn}
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {titleEn} {nameJp && `• ${nameJp}`}
                </p>

                <div className="flex items-center gap-2 mt-1.5">
                  <img
                    src={rankIconSrc}
                    alt={`Rank ${currentRun.rank}`}
                    className="h-4 w-auto object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {currentRun.rank_score?.toLocaleString()} pts
                  </span>
                  {currentRun.create_time && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-0.5">
                      • {currentRun.create_time}
                    </span>
                  )}
                  {runs.length > 1 && (
                    <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 ml-1">
                      Run #{activeRunIndex + 1} of {runs.length}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Parenting & Close Buttons */}
            <div className="flex items-center gap-2">
              {parentNotice && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg animate-in fade-in duration-150">
                  {parentNotice}
                </span>
              )}

              {currentRun && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setParent1(currentRun);
                      setParentNotice("Assigned Parent 1!");
                      setTimeout(() => setParentNotice(null), 2500);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 cursor-pointer transition-colors"
                    title="Assign to Parent 1 in Parenting Hub"
                  >
                    + P1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParent2(currentRun);
                      setParentNotice("Assigned Parent 2!");
                      setTimeout(() => setParentNotice(null), 2500);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-pink-500/10 hover:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-500/30 cursor-pointer transition-colors"
                    title="Assign to Parent 2 in Parenting Hub"
                  >
                    + P2
                  </button>
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Multi-Run Switcher */}
          {runs.length > 1 && (
            <div className="mt-3 pt-2.5 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <span className="text-[11px] font-semibold text-zinc-400 shrink-0 mr-1">Runs:</span>
              {runs.map((r, idx) => (
                <button
                  key={r.trained_chara_id || idx}
                  type="button"
                  onClick={() => setActiveRunIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 ${
                    activeRunIndex === idx
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <span>#{idx + 1}</span>
                  {idx === 0 && <span className="ml-1 text-[10px] opacity-80">(Top)</span>}
                  <span className="ml-1.5 font-bold">{r.rank_score?.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {/* 5 Stats Shelf */}
          <div className="grid grid-cols-5 gap-1 mt-3 text-center bg-white dark:bg-zinc-800/70 p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs">
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-bold">SPD</div>
              <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">
                {currentRun.speed}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-bold">STA</div>
              <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">
                {currentRun.stamina}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-bold">PWR</div>
              <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">
                {currentRun.power}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-bold">GUT</div>
              <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">
                {currentRun.guts}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-bold">WIT</div>
              <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">
                {currentRun.wiz}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation (Learned Skills vs Sparks/Factors) */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 pt-2 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("skills")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === "skills"
                  ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span>Learned Skills</span>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                {totalSkillsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("factors")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === "factors"
                  ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span>Sparks & Factors</span>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                {totalFactorsCount}
              </span>
              {targetFactorMatch.count > 0 && (
                <span className="rounded-full bg-emerald-500 text-white px-1.5 py-0.2 text-[10px] font-black shadow-2xs">
                  +{targetFactorMatch.count} target
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: LEARNED SKILLS */}
          {activeTab === "skills" && (
            <div className="space-y-3 animate-in fade-in duration-200 ease-out-quart">
              {/* Filter / Search Bar */}
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                  placeholder="Search acquired skills by English or Japanese name..."
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-hidden focus:border-emerald-500 transition-colors"
                />
                {skillQuery && (
                  <button
                    type="button"
                    onClick={() => setSkillQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {learnedSkillsList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-400">
                  {skillQuery ? "No learned skills match your search." : "No learned skills recorded for this run."}
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-2xs">
                  {learnedSkillsList.map((item) => {
                    const isUnique = item.rarity === 3 || item.level > 1;

                    return (
                      <div
                        key={item.skillId}
                        className="flex items-center justify-between gap-3 p-2.5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        {/* Interactive Skill Hover Trigger (DESIGN.md Section 10 & 11) */}
                        <SkillHoverCard
                          skillId={item.skillId}
                          fallbackSkill={item.skill ? {
                            nameEn: item.skill.nameEn,
                            nameJp: item.skill.nameJp,
                            rarity: item.skill.rarity,
                            iconId: item.skill.iconId,
                          } : undefined}
                          className="group inline-flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                        >
                          {/* Centered Skill Icon */}
                          <SkillIcon
                            iconId={item.iconId}
                            name={item.nameEn}
                            className="h-7 w-7 object-contain flex-none drop-shadow-2xs"
                          />

                          {/* Bilingual Title Block */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug truncate">
                                {item.nameEn}
                              </span>
                              <span className="text-[10px] text-zinc-400 group-hover:text-emerald-600 opacity-60 transition-opacity">
                                ↗
                              </span>
                            </div>
                            {item.nameJp && (
                              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal mt-0.5 leading-tight truncate">
                                {item.nameJp}
                              </p>
                            )}
                          </div>
                        </SkillHoverCard>

                        {/* Right Pill: Rarity & Level & Target */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isTargetSkill(item.skillId) && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              🎯 Target
                            </span>
                          )}
                          {isUnique ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 shadow-2xs">
                              Lv {item.level}
                            </span>
                          ) : item.rarity === 2 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/30">
                              Gold
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                              White
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SPARKS & FACTORS */}
          {activeTab === "factors" && (
            <div className="space-y-4 animate-in fade-in duration-200 ease-out-quart">
              {/* Lineage Scope Switcher */}
              <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-1 border border-zinc-200 dark:border-zinc-700/60 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setLineageScope("self")}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    lineageScope === "self"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  <span>Self Factors</span>
                  <span className="ml-1 text-[10px] opacity-75">({currentRun.factor_info_array?.length || 0})</span>
                </button>

                {parent1Chara && (
                  <button
                    type="button"
                    onClick={() => setLineageScope("parent1")}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      lineageScope === "parent1"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span>P1: {parent1Chara.chara?.nameEn || "Parent 1"}</span>
                    <span className="ml-1 text-[10px] opacity-75">({parent1Chara.factors.length})</span>
                  </button>
                )}

                {parent2Chara && (
                  <button
                    type="button"
                    onClick={() => setLineageScope("parent2")}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      lineageScope === "parent2"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span>P2: {parent2Chara.chara?.nameEn || "Parent 2"}</span>
                    <span className="ml-1 text-[10px] opacity-75">({parent2Chara.factors.length})</span>
                  </button>
                )}
              </div>

              {/* TARGET FACTORS MATCHED FROM PARENT DECK */}
              {hasTargetSkills && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 sm:p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
                          Target Factors from Parent Deck
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Sparks across this horse's 3-generation lineage matching your current Parent Deck skills
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-bold">
                      {targetFactorMatch.count} Matched
                    </span>
                  </div>

                  {targetFactorMatch.count === 0 ? (
                    <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 text-center text-xs text-zinc-400">
                      No target factors matched in this horse's 3-generation bloodline.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {targetFactorMatch.matchedSkills.map((m) => {
                        const sk = skillsById.get(m.skillId);
                        return (
                          <div
                            key={m.skillId}
                            className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-500/30 shadow-2xs"
                          >
                            <div className="min-w-0 flex items-start gap-2.5">
                              {sk && (
                                <SkillIcon
                                  iconId={sk.iconId}
                                  name={sk.nameEn}
                                  className="h-6 w-6 object-contain flex-none mt-0.5 drop-shadow-2xs"
                                />
                              )}
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate block leading-snug">
                                  {m.skillNameEn}
                                </span>
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate leading-tight mt-0.5">
                                  {m.skillNameJa}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {m.occurrences.map((occ, idx) => (
                                    <span
                                      key={idx}
                                      className={`px-1.5 py-0.5 rounded text-[8.5px] font-semibold ${
                                        occ.origin === "self"
                                          ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                          : occ.origin === "parent1"
                                          ? "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                                          : "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800"
                                      }`}
                                    >
                                      {occ.originLabel} ({occ.stars}★)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 shrink-0">
                              {"★".repeat(m.maxStars)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 4 Factor Categories */}
              <div className="space-y-4">
                {/* 1. BLUE STAT FACTORS */}
                {factorGroups.blue.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                        Blue Stat Sparks (Chỉ số cơ bản)
                      </h4>
                    </div>

                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/80 shadow-2xs">
                      {factorGroups.blue.map((f, idx) => {
                        const statBonus = f.stars === 3 ? "+21" : f.stars === 2 ? "+12" : "+5";
                        return (
                          <div key={f.factorId || idx} className="p-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                  {f.nameEn || f.name}
                                </span>
                                {f.nameJa && (
                                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                    ({f.nameJa})
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Increases starting stat by <strong className="text-blue-600 dark:text-blue-400 font-bold">{statBonus}</strong> at Career start & Inspiration events
                              </p>
                            </div>

                            {/* Stars badge */}
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shrink-0">
                              {"★".repeat(f.stars)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. PINK APTITUDE FACTORS */}
                {factorGroups.pink.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full bg-pink-500" />
                      <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                        Pink Aptitude Sparks (Thích ứng đường đua)
                      </h4>
                    </div>

                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/80 shadow-2xs">
                      {factorGroups.pink.map((f, idx) => (
                        <div key={f.factorId || idx} className="p-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                {f.nameEn || f.name}
                              </span>
                              {f.nameJa && (
                                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                  ({f.nameJa})
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                              Boosts aptitude grade before run and during Inspiration (up to S rank)
                            </p>
                          </div>

                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/30 shrink-0">
                            {"★".repeat(f.stars)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. GREEN UNIQUE FACTORS */}
                {factorGroups.green.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                        Green Unique Sparks (Kỹ năng độc quyền kế thừa)
                      </h4>
                    </div>

                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/80 shadow-2xs">
                      {factorGroups.green.map((f, idx) => {
                        const grantedSkills = (f.skillIds || []).map((id) => skillsById.get(id)).filter(Boolean);
                        const isTarget = isTargetFactor(f);

                        return (
                          <div
                            key={f.factorId || idx}
                            className={`p-3 space-y-2 transition-colors ${
                              isTarget ? "bg-emerald-500/[0.04] dark:bg-emerald-950/[0.08]" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                    {f.nameEn || f.name}
                                  </span>
                                  {f.nameJa && (
                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                      ({f.nameJa})
                                    </span>
                                  )}
                                  {isTarget && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                      🎯 Target Skill
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                                {"★".repeat(f.stars)}
                              </span>
                            </div>

                            {/* Directly display provided skills below factor */}
                            {grantedSkills.length > 0 && (
                              <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80">
                                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                                  Provides Inherited Skill (Cung cấp kỹ năng):
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {grantedSkills.map((sk) => (
                                    <SkillHoverCard
                                      key={sk!.id}
                                      skillId={sk!.id}
                                      fallbackSkill={sk}
                                      className="group inline-flex items-center gap-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1 cursor-pointer hover:bg-emerald-100/60 transition-colors"
                                    >
                                      <SkillIcon
                                        iconId={sk!.iconId}
                                        name={sk!.nameEn}
                                        className="h-5 w-5 object-contain flex-none drop-shadow-2xs"
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 truncate leading-snug">
                                            {sk!.nameEn}
                                          </span>
                                          <span className="text-[10px] text-zinc-400 group-hover:text-emerald-600 opacity-60">
                                            ↗
                                          </span>
                                        </div>
                                        {sk!.nameJp && (
                                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate leading-tight mt-0.5">
                                            {sk!.nameJp}
                                          </p>
                                        )}
                                      </div>
                                    </SkillHoverCard>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. WHITE FACTORS (Skills, Races, Scenarios) */}
                {factorGroups.white.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full bg-zinc-400" />
                      <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                        White Sparks ({factorGroups.white.length} Factors: Kỹ năng, Giải đấu, Kịch bản)
                      </h4>
                    </div>

                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/80 shadow-2xs">
                      {factorGroups.white.map((f, idx) => {
                        const grantedSkills = (f.skillIds || []).map((id) => skillsById.get(id)).filter(Boolean);
                        const isTarget = isTargetFactor(f);

                        return (
                          <div
                            key={f.factorId || idx}
                            className={`p-3 space-y-2 transition-colors ${
                              isTarget ? "bg-emerald-500/[0.04] dark:bg-emerald-950/[0.08]" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                    {f.nameEn || f.name}
                                  </span>
                                  {f.nameJa && f.nameJa !== f.nameEn && (
                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                                      ({f.nameJa})
                                    </span>
                                  )}
                                  {f.category && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                      {f.category}
                                    </span>
                                  )}
                                  {isTarget && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                      🎯 Target Skill
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-black shrink-0 ${
                                  isTarget
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                                }`}
                              >
                                {"★".repeat(f.stars)}
                              </span>
                            </div>

                            {/* If factor provides skill(s), display directly underneath with SkillHoverCard */}
                            {grantedSkills.length > 0 && (
                              <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80">
                                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                                  Provides Hint for Skill (Cung cấp hint kỹ năng):
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {grantedSkills.map((sk) => (
                                    <SkillHoverCard
                                      key={sk!.id}
                                      skillId={sk!.id}
                                      fallbackSkill={sk}
                                      className="group inline-flex items-center gap-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-1 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-500/30 transition-colors"
                                    >
                                      <SkillIcon
                                        iconId={sk!.iconId}
                                        name={sk!.nameEn}
                                        className="h-5 w-5 object-contain flex-none drop-shadow-2xs"
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 truncate leading-snug">
                                            {sk!.nameEn}
                                          </span>
                                          <span className="text-[10px] text-zinc-400 group-hover:text-emerald-600 opacity-60">
                                            ↗
                                          </span>
                                        </div>
                                        {sk!.nameJp && (
                                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate leading-tight mt-0.5">
                                            {sk!.nameJp}
                                          </p>
                                        )}
                                      </div>
                                    </SkillHoverCard>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
