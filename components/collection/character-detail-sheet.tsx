"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  type CharacterIndexEntry,
  type CharacterEvolutionDetail,
  type SkillDetail,
  api,
  getCharacterImageUrl,
} from "../../lib/api";
import { useDeck } from "../store";
import { useBodyScrollLock } from "../../lib/use-body-scroll-lock";
import SkillIcon from "../skill-icon";
import { SkillHoverCard } from "../skill-hover-card";
import {
  evaluateSkillActivation,
  runningStyleToNum,
  getRecommendedStyleForKit,
} from "../../lib/parenting/skill-evaluator";
import type { RunningStyle } from "../../lib/deck/types";
import { getPvpRaceParameters } from "../../lib/pvp-events";
import { getSkillRarityStyle } from "../../lib/skill-rarity";
import { Badge } from "../shared/badge";
import { StatIcon, StatusRankIcon, type StatName } from "../shared/status-icons";
import { uniqueInheritMap } from "../../lib/data/registry";
import {
  AlertTriangleIcon,
  CheckIcon,
  StarIcon,
  TrophyIcon,
  XIcon,
} from "../icons";

interface CharacterDetailSheetProps {
  character: CharacterIndexEntry | null;
  isOpen: boolean;
  onClose: () => void;
  details: [number, number] | undefined;
  onSetUmaDetails: (charaId: number, stars: number, talent: number) => void;
  onRemoveUma: (charaId: number) => void;
}

const STAT_NAMES = ["Speed", "Stamina", "Power", "Guts", "Wit"] as const;
const STAT_COLORS = [
  "text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50",
  "text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50",
  "text-orange-600 dark:text-orange-400 bg-orange-50/80 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/50",
  "text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50",
  "text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50",
];

const APTITUDE_LABELS = [
  "Turf",
  "Dirt",
  "Short",
  "Mile",
  "Medium",
  "Long",
  "Runner",
  "Leader",
  "Betweener",
  "Chaser",
] as const;

function getAptitudeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case "S":
      return "text-amber-500 font-black";
    case "A":
      return "text-emerald-600 dark:text-emerald-400 font-bold";
    case "B":
      return "text-sky-600 dark:text-sky-400 font-semibold";
    case "C":
      return "text-indigo-500 font-medium";
    case "D":
      return "text-zinc-600 dark:text-zinc-400";
    default:
      return "text-zinc-400 dark:text-zinc-500";
  }
}

export function CharacterDetailSheet({
  character,
  isOpen,
  onClose,
  details,
  onSetUmaDetails,
  onRemoveUma,
}: CharacterDetailSheetProps) {
  const { course, runningStyle, activePvpEvent, trackDetail } = useDeck();
  const raceParams = useMemo(() => getPvpRaceParameters(activePvpEvent), [activePvpEvent]);

  useBodyScrollLock(isOpen);

  const [evolutions, setEvolutions] = useState<CharacterEvolutionDetail[]>([]);
  const [loadedSkillsMap, setLoadedSkillsMap] = useState<Map<number, SkillDetail>>(new Map());
  const [selectedStyle, setSelectedStyle] = useState<RunningStyle | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ignore runningStyle from globalTrackBar; automatically recommend best style based on kit & aptitudes
  const recommendedStyle: RunningStyle = useMemo(() => {
    if (!character) return 1;
    return getRecommendedStyleForKit(character, evolutions, course, raceParams);
  }, [character, evolutions, course, raceParams]);

  // Reset selectedStyle when character changes or sheet opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStyle(null);
    }
  }, [isOpen, character?.id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch character evolutions and resolved skill details
  useEffect(() => {
    if (!isOpen || !character) return;

    let isCurrent = true;
    api.characterEvolutions(character.id).then((evols) => {
      if (isCurrent) setEvolutions(evols);
    });

    api.listSkills().then((allSkills) => {
      if (!isCurrent) return;
      const map = new Map<number, SkillDetail>();
      for (const s of allSkills) {
        map.set(s.id, s);
      }
      setLoadedSkillsMap(map);
    });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, character?.id]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !character || !mounted || typeof document === "undefined") return null;

  const isOwned = details !== undefined;
  const [currentStars, currentTalent] = details || [character.rarity || 3, 1];

  const inheritSkillId = character.uniqueSkillId
    ? uniqueInheritMap[String(character.uniqueSkillId)]
    : null;

  const activeStyle: RunningStyle = selectedStyle ?? recommendedStyle;

  // Track evaluation helper
  function evaluateSkill(skillId: number) {
    if (!course) {
      return {
        activates: false,
        reason: "No active track selected on Global Track Bar",
      };
    }
    return evaluateSkillActivation(skillId, course, activeStyle, raceParams);
  }

  // Calculate track compatibility score
  const allKitSkillIds: number[] = [
    ...(character.uniqueSkillId ? [character.uniqueSkillId] : []),
    ...(character.innateSkills || []),
    ...(character.awakeningSkills || []),
    ...evolutions.map((e) => e.skillId),
  ];

  let activatingCount = 0;
  for (const sid of allKitSkillIds) {
    if (evaluateSkill(sid).activates) activatingCount++;
  }

  const compatibilityPercent =
    allKitSkillIds.length > 0
      ? Math.round((activatingCount / allKitSkillIds.length) * 100)
      : 0;

  const compatibilityTier =
    compatibilityPercent >= 80
      ? "Tier S"
      : compatibilityPercent >= 60
        ? "Tier A"
        : compatibilityPercent >= 40
          ? "Tier B"
          : "Suboptimal";

  // Render a standard skill row adhering strictly to DESIGN.md
  function renderSkillRow(
    skillId: number,
    labelBadge?: { text: string; className: string },
    isIndented = false
  ) {
    const s = loadedSkillsMap.get(skillId);
    const rStyle = getSkillRarityStyle(s?.rarity);
    const evalResult = evaluateSkill(skillId);
    const activates = evalResult.activates;

    const nameEn = s?.nameEn || `Skill #${skillId}`;
    const nameJp = s?.nameJp || "";
    const descEn = s?.descEn || "";
    const iconId = s?.iconId ?? null;
    return (
      <div
        key={skillId}
        className={`flex items-center justify-between gap-3 py-2.5 px-3 transition-colors ${
          isIndented
            ? "ml-4 sm:ml-6 border-l-2 border-purple-400 dark:border-purple-600/80 bg-purple-50/20 dark:bg-purple-950/10"
            : ""
        } ${rStyle.bgClass ?? "bg-white dark:bg-zinc-900"} hover:brightness-[0.98] dark:hover:brightness-110`}
      >
        <div className="min-w-0 flex-1">
          <SkillHoverCard
            skillId={skillId}
            fallbackSkill={
              s
                ? {
                    nameEn: s.nameEn,
                    nameJp: s.nameJp,
                    rarity: s.rarity,
                    iconId: s.iconId,
                  }
                : undefined
            }
            cardName={character?.nameEn || ""}
            isParentMode={false}
            runningStyle={activeStyle}
            raceParams={raceParams}
            className="group inline-flex items-center gap-2.5 min-w-0 cursor-pointer"
          >
            {/* 1. Vertically centered icon */}
            <SkillIcon
              iconId={iconId}
              name={nameEn}
              className="h-7 w-7 object-contain flex-none shrink-0 drop-shadow-2xs"
            />

            {/* 2. 2-line title block: English top, Japanese bottom */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug">
                  {nameEn}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100 transition-opacity">
                  ↗
                </span>
              </div>
              {nameJp && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 font-normal leading-tight">
                  {nameJp}
                </p>
              )}
            </div>
          </SkillHoverCard>

          {descEn && (
            <p className="mt-1 line-clamp-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal pl-9">
              {descEn}
            </p>
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

  // Group awakening skills: Lv 2 White, Lv 3 Gold + Evolved, Lv 4 White, Lv 5 Gold + Evolved
  const lv1Skills = character.innateSkills || [];
  const lv2Skill = character.awakeningSkills?.[0];
  const lv3Skill = character.awakeningSkills?.[1];
  const lv4Skill = character.awakeningSkills?.[2];
  const lv5Skill = character.awakeningSkills?.[3];

  const lv3Evolutions = evolutions.filter((e) => e.rank === 3);
  const lv5Evolutions = evolutions.filter((e) => e.rank === 5);

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200 ease-out-quart"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chara-detail-title"
    >
      <div
        className="flex h-[90dvh] sm:h-[88vh] max-h-[92dvh] sm:max-h-[88vh] w-full sm:max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl text-left animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-[250ms] ease-out-expo pb-6 sm:pb-0 overscroll-contain touch-pan-y"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* Header Profile */}
        <div className="shrink-0 flex-none border-b border-zinc-200/80 dark:border-zinc-800 p-4 bg-zinc-50/70 dark:bg-zinc-900/70">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative aspect-square h-16 w-16 flex-none rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <img
                  src={character.imgUrl}
                  alt={character.nameEn}
                  className="h-full w-full object-contain filter drop-shadow-xs"
                  onError={(e) => {
                    e.currentTarget.src = getCharacterImageUrl(
                      character.charId,
                      character.id,
                      "01"
                    );
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="rounded px-1.5 py-0.2 text-[10px] font-black bg-amber-400 text-amber-950">
                    {"★".repeat(character.rarity)}
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    {character.titleEn || character.titleJp}
                  </span>
                </div>
                <h3
                  id="chara-detail-title"
                  className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5 leading-snug"
                >
                  {character.nameEn}
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-normal leading-tight">
                  {character.nameJp} {character.titleJp ? `[${character.titleJp}]` : ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Star & Talent Steppers + Ownership Row */}
          <div className="mt-3.5 pt-3 border-t border-zinc-200/70 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              {/* Star Stepper */}
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 text-[11px]">Stars:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSetUmaDetails(character.id, s, currentTalent)}
                      className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center cursor-pointer transition-colors ${
                        isOwned && s <= currentStars
                          ? "bg-amber-400 text-amber-950 font-black shadow-2xs"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Talent Stepper */}
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 text-[11px]">Awakening:</span>
                <select
                  value={isOwned ? currentTalent : 1}
                  onChange={(e) =>
                    onSetUmaDetails(
                      character.id,
                      currentStars,
                      Number(e.target.value)
                    )
                  }
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-900 dark:text-zinc-100 font-semibold cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Lv {lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              {isOwned ? (
                <button
                  type="button"
                  onClick={() => onRemoveUma(character.id)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  Remove from Owned ✕
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetUmaDetails(character.id, character.rarity, 5)}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
                >
                  + Add to Owned (Lv 5)
                </button>
              )}
            </div>
          </div>

          {/* Growth Rates & Aptitudes Shelf */}
          <div className="mt-3.5 flex flex-col gap-2 pt-3 border-t border-zinc-200/70 dark:border-zinc-800">
            {/* Growth Rates */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-500">Growth:</span>
              {(character.growthRates || [0, 0, 0, 0, 0]).map((rate, idx) => {
                if (rate === 0) return null;
                return (
                  <span
                    key={STAT_NAMES[idx]}
                    title={`${STAT_NAMES[idx]} growth +${rate}%`}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${STAT_COLORS[idx]}`}
                  >
                    <StatIcon stat={STAT_NAMES[idx] as StatName} className="h-3.5 w-3.5" />
                    <span>+{rate}%</span>
                  </span>
                );
              })}
              {!(character.growthRates || []).some((r) => r > 0) && (
                <span className="text-[10px] text-zinc-400 italic">None</span>
              )}
            </div>

            {/* Aptitudes: three flat, scannable rows on mobile */}
            <div className="flex flex-col gap-1 text-[10px]">
              {[
                { label: "Aptitude", start: 0, end: 2 },
                { label: "Distance", start: 2, end: 6 },
                { label: "Style", start: 6, end: 10 },
              ].map((group) => (
                <div key={group.label} className="grid min-w-0 grid-cols-[4.5rem_repeat(4,minmax(0,1fr))] items-center gap-1">
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                    {group.label}
                  </span>
                  {APTITUDE_LABELS.slice(group.start, group.end).map((lbl, offset) => {
                    const idx = group.start + offset;
                    const grade = character.aptitude?.[idx] || "-";
                    return (
                      <span key={lbl} className="inline-flex min-w-0 items-center justify-between gap-1 rounded-md bg-zinc-100/80 px-1.5 py-0.5 dark:bg-zinc-800/80">
                        <span className="truncate text-zinc-500">{lbl}</span>
                        <StatusRankIcon grade={grade} className="h-4.5 w-4.5 shrink-0" />
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Track Compatibility Banner & Running Style Selector */}
        <div className="shrink-0 flex-none px-4 py-2.5 bg-zinc-100/70 dark:bg-zinc-800/50 border-b border-zinc-200/70 dark:border-zinc-800 flex flex-col gap-2 text-xs">
          {/* Row 1: Target Track & Overall Compatibility */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <TrophyIcon className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 flex-none" />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                {course
                  ? `${trackDetail?.nameEn || "Target Course"} ${course.length}m ${course.terrain === 2 ? "Dirt" : "Turf"}`
                  : "Active Course: Default / None"}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-none">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {activatingCount}/{allKitSkillIds.length} Active
              </span>
              <Badge
                size="compact"
                uppercase
                tone={compatibilityTier === "Tier S" ? "amber" : compatibilityTier === "Tier A" ? "emerald" : "neutral"}
                className="font-black"
              >
                {compatibilityTier}
              </Badge>
            </div>
          </div>

          {/* Row 2: Running Style Selector (Auto-recommended from kit, ignores Global Track Bar) */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-700/50 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Eval Style:
              </span>
              <div className="inline-flex items-center gap-0.5">
                {([
                  { id: 1 as RunningStyle, name: "Runner", aptIdx: 6 },
                  { id: 2 as RunningStyle, name: "Leader", aptIdx: 7 },
                  { id: 3 as RunningStyle, name: "Betweener", aptIdx: 8 },
                  { id: 4 as RunningStyle, name: "Chaser", aptIdx: 9 },
                ] as const).map((st) => {
                  const isActive = activeStyle === st.id;
                  const isRec = recommendedStyle === st.id;
                  const aptGrade = character.aptitude?.[st.aptIdx] || "-";

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStyle(st.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-white dark:bg-zinc-900 text-emerald-800 dark:text-emerald-300 shadow-xs border border-emerald-500/30"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      <span>{st.name}</span>
                      <span className={`text-[9px] ${getAptitudeColor(aptGrade)}`}>
                        {aptGrade}
                      </span>
                      {isRec && (
                        <span className="rounded bg-amber-400/25 text-amber-900 dark:text-amber-300 px-1 py-0 text-[8px] font-black uppercase">
                          Auto
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedStyle !== null && selectedStyle !== recommendedStyle && (
              <button
                type="button"
                onClick={() => setSelectedStyle(null)}
                className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                title="Reset to recommended style based on character kit"
              >
                Reset to Auto (Rec)
              </button>
            )}
          </div>
        </div>

        {/* Skills List Surface (Single surface with divide-y per DESIGN.md) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {/* 1. Unique Skill Section */}
          {character.uniqueSkillId && (
            <div>
              <div className="px-3.5 py-1.5 bg-pink-500/10 dark:bg-pink-950/20 text-[10px] font-bold uppercase tracking-wider text-pink-700 dark:text-pink-300 flex items-center gap-1">
                <StarIcon className="h-3 w-3" />
                <span>Unique Skill (固有スキル)</span>
              </div>
              {renderSkillRow(character.uniqueSkillId, {
                text: "Base Unique",
                className: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300",
              })}
              {inheritSkillId &&
                renderSkillRow(inheritSkillId, {
                  text: "Inherit",
                  className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                }, true)}
            </div>
          )}

          {/* 2. Awakening Skills & Evolved Skills */}
          <div>
            <div className="px-3.5 py-1.5 bg-zinc-100/60 dark:bg-zinc-800/40 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Awakening & Evolved Skills (覚醒・進化スキル)
            </div>

            {/* Innate Lv 1 Skills */}
            {lv1Skills.map((sid) =>
              renderSkillRow(sid, {
                text: "Lv 1",
                className: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
              })
            )}

            {/* Lv 2 Skill */}
            {lv2Skill &&
              renderSkillRow(lv2Skill, {
                text: "Lv 2",
                className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
              })}

            {/* Lv 3 Gold Skill + Evolved Branch */}
            {lv3Skill && (
              <div>
                {renderSkillRow(lv3Skill, {
                  text: "Lv 3 Gold",
                  className: "bg-amber-300 text-amber-950 dark:bg-amber-900 dark:text-amber-100",
                })}
                {lv3Evolutions.map((ev) =>
                  renderSkillRow(
                    ev.skillId,
                    {
                      text: `Evol${ev.branchTag ? ` [${ev.branchTag}]` : ""}`,
                      className: "bg-purple-200 text-purple-950 dark:bg-purple-950 dark:text-purple-200 font-black",
                    },
                    true
                  )
                )}
              </div>
            )}

            {/* Lv 4 Skill */}
            {lv4Skill &&
              renderSkillRow(lv4Skill, {
                text: "Lv 4",
                className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
              })}

            {/* Lv 5 Gold Skill + Evolved Branch */}
            {lv5Skill && (
              <div>
                {renderSkillRow(lv5Skill, {
                  text: "Lv 5 Gold",
                  className: "bg-amber-300 text-amber-950 dark:bg-amber-900 dark:text-amber-100",
                })}
                {lv5Evolutions.map((ev) =>
                  renderSkillRow(
                    ev.skillId,
                    {
                      text: `Evol${ev.branchTag ? ` [${ev.branchTag}]` : ""}`,
                      className: "bg-purple-200 text-purple-950 dark:bg-purple-950 dark:text-purple-200 font-black",
                    },
                    true
                  )
                )}
              </div>
            )}
          </div>

          {/* 3. Event Skills */}
          {(character.eventSkills || []).length > 0 && (
            <div>
              <div className="px-3.5 py-1.5 bg-violet-500/10 dark:bg-violet-950/20 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Training Event Skills
              </div>
              {character.eventSkills!.map((sid) =>
                renderSkillRow(sid, {
                  text: "Event",
                  className: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
