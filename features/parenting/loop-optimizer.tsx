"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "react-aria-components/Button";
import { Radio, RadioGroup } from "react-aria-components/RadioGroup";
import type { CharacterIndexEntry } from "@/lib/data/types";
import { characters as allCharacters, skillsById, successionFactors, uniqueInheritMap } from "@/lib/data/registry";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import { buildLoopCandidates, LOOP_ANCESTOR_SLOTS, LOOP_UMA_SLOTS, evaluateParentingBranch, type AptitudeKey, type BranchAssessment, type LoopUmaSlot, type LoopAncestorSlot, type LoopCandidate, type ParentingLoopConfig } from "@/lib/parenting/loop-planner";
import { normalizeLoopConfig, type GrandparentSlot, type ParentingSetup } from "@/lib/parenting/state";
import { AptitudeCell, AptitudeGrid, AptitudeName, BUTTON, CHOICE, PinkSparkPicker, SHORT, WhiteGeneticPicker, nextPinkStars, type SparkSource } from "./components/aptitude-controls";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import SkillHoverCard from "@/app/common/ui/skills/details/skill-hover-card";
import { StatIcon, type StatName } from "@/app/common/ui/primitives/status-icons";
import { getCharacterImageUrl } from "@/lib/api";
import { getCharaIdFromCardId } from "@/lib/lineage/affinity-engine";
import { extractSlotPrimaryFactors } from "@/lib/lineage/factor-decoder";
import { ParentingPopover } from "./components/parenting-popover";
import { PedigreeBranchTabs } from "./components/pedigree-branch-tabs";

interface Props {
  target: CharacterIndexEntry | null;
  veterans: KyumaruVeteranItem[];
  roster: CharacterIndexEntry[];
  setup: ParentingSetup;
  targetStage: ReactNode;
  onOpenPicker: (slot: LoopAncestorSlot) => void;
  updateSetup: (updater: (prev: ParentingSetup) => ParentingSetup) => void;
}

const SLOT_LABEL = Object.fromEntries(LOOP_ANCESTOR_SLOTS.map((slot) => {
  const [branch, gp, ...descendants] = slot.split("_");
  const labels = descendants.map((part, index) => `${index === 0 ? "GGP" : "GGGP"}${part.slice(1)}`);
  return [slot, [branch.toUpperCase(), gp?.toUpperCase(), ...labels].filter(Boolean).join(" ")];
})) as Record<LoopAncestorSlot, string>;
const MOBILE_BRANCH_BASE_ZOOM = 1.3;
const MIN_MOBILE_BRANCH_ZOOM = 0.8;
const MAX_MOBILE_BRANCH_ZOOM = 1.3;
function defaultConfig(): ParentingLoopConfig {
  return { geneGoals: {}, aptitudeGoals: {}, slotAptitudeGoals: {}, factorGoals: {}, selectedSlots: {}, lockedSlots: {}, includeTripleCrownAffinity: false, includeTiaraAffinity: false };
}

const APTITUDE_GROUPS = [
  { label: "Surface", indices: [0, 1], names: ["Turf", "Dirt"] },
  { label: "Distance", indices: [2, 3, 4, 5], names: ["Short", "Mile", "Medium", "Long"] },
  { label: "Style", indices: [6, 7, 8, 9], names: ["Runner", "Leader", "Between", "Chaser"] },
] as const;
const FACTOR_APTITUDE_OPTIONS = ["Turf", "Dirt", "Sprint", "Mile", "Medium", "Long", "Runner", "Leader", "Betweener", "Chaser"] as const;
const BLUE_FACTOR_NAMES: Record<number, { name: string; short: string }> = {
  1: { name: "Speed", short: "SPD" }, 2: { name: "Stamina", short: "STA" }, 3: { name: "Power", short: "PWR" },
  4: { name: "Guts", short: "GUT" }, 5: { name: "Wit", short: "WIT" },
};
const BLUE_FACTOR_STATS: Record<number, StatName> = {
  1: "Speed", 2: "Stamina", 3: "Power", 4: "Guts", 5: "Wit",
};
const RED_FACTOR_NAMES: Record<AptitudeKey, { name: string; short: string }> = {
  Turf: { name: "Turf", short: "TURF" }, Dirt: { name: "Dirt", short: "DIRT" }, Sprint: { name: "Sprint", short: "SPRT" },
  Mile: { name: "Mile", short: "MILE" }, Medium: { name: "Medium", short: "MED" }, Long: { name: "Long", short: "LONG" },
  Runner: { name: "Runner", short: "RUN" }, Leader: { name: "Leader", short: "LEAD" },
  Betweener: { name: "Betweener", short: "BTWN" }, Chaser: { name: "Chaser", short: "CHAS" },
};
type EditableFactorPlan = { blue?: number | null; blueStars?: number; pink?: AptitudeKey | null; pinkStars?: number };

function editableFactorPlan(candidate: LoopCandidate | null, saved?: { blue?: number | null; blueStars?: number | null; pink?: AptitudeKey | null; pinkStars?: number | null }): EditableFactorPlan {
  const actual = extractSlotPrimaryFactors(candidate?.veteran?.factor_info_array);
  const has = (key: "blue" | "blueStars" | "pink" | "pinkStars") => saved != null && Object.prototype.hasOwnProperty.call(saved, key);
  const actualPink = (actual.pink?.nameEn === "Med" ? "Medium" : actual.pink?.nameEn) as AptitudeKey | undefined;
  const pink = has("pink") ? saved?.pink ?? null : actualPink ?? null;
  return {
    blue: has("blue") ? saved?.blue ?? null : actual.blue ? Math.floor(actual.blue.factorId / 100) : candidate?.factorKnowledge ? null : undefined,
    blueStars: has("blueStars") ? saved?.blueStars ?? 0 : actual.blue?.stars ?? (candidate?.factorKnowledge ? 0 : undefined),
    pink: has("pink") ? pink : actualPink ?? (candidate?.factorKnowledge ? null : undefined),
    pinkStars: has("pinkStars") ? saved?.pinkStars ?? 0 : pink ? (pink === actualPink ? actual.pink?.stars ?? 1 : 1) : 0,
  };
}

function FactorGoalRow(props: FactorGoalRowProps) {
  if (props.kind === "pink") return <PinkSparkPicker label={SLOT_LABEL[props.slot]} value={props.value as AptitudeKey | null | undefined} stars={props.stars} onChange={props.onChange} />;
  return <BlueFactorGoalRow {...props} />;
}

interface FactorGoalRowProps {
  slot: LoopAncestorSlot;
  kind: "blue" | "pink";
  value: number | AptitudeKey | null | undefined;
  stars?: number;
  onChange: (nextValue: number | AptitudeKey | null | undefined, nextStars?: number) => void;
}
function BlueFactorGoalRow({ slot, kind, value, stars, onChange }: FactorGoalRowProps) {
  const isBlue = kind === "blue";
  const selected = isBlue
    ? typeof value === "number" ? BLUE_FACTOR_NAMES[value] : undefined
    : typeof value === "string" ? RED_FACTOR_NAMES[value as AptitudeKey] : undefined;
  const starCount = typeof stars === "number" && stars >= 1 && stars <= 3 ? stars : undefined;
  const iconIndex = isBlue ? 0 : 3;
  const asset = selected && starCount
    ? `/assets/factor/utx_ico_factor_rarity_${String(iconIndex + starCount - 1).padStart(2, "0")}.png`
    : null;
  const label = isBlue ? "Blue" : "Red";
  const factorOptions = isBlue
    ? Object.entries(BLUE_FACTOR_NAMES).map(([id, name]) => ({ value: Number(id), ...name }))
    : FACTOR_APTITUDE_OPTIONS.map((key) => ({ value: key, ...RED_FACTOR_NAMES[key] }));

  const radioClass = "flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-left text-[10px] text-zinc-300 outline-none data-[selected]:border-emerald-500 data-[selected]:bg-emerald-950/60 data-[selected]:text-emerald-200 data-[focus-visible]:ring-2 data-[focus-visible]:ring-emerald-500";
  const triggerClass = isBlue
    ? "border-sky-800/60 bg-sky-950/30 text-sky-100 hover:bg-sky-900/50 dark:border-sky-700/70"
    : "border-pink-800/60 bg-pink-950/25 text-pink-100 hover:bg-pink-900/40 dark:border-pink-700/70";
  const trigger = isBlue ? (
    <><span className="min-w-0 truncate">{selected?.short ?? (value === null ? "NONE" : "SET FACTOR")}</span>{asset ? <img src={asset} alt={`${starCount} star${starCount === 1 ? "" : "s"}`} className="h-3.5 w-8 shrink-0 object-contain" /> : <span className="shrink-0 text-[8px] font-semibold text-zinc-400">{value === null ? "—" : "?"}</span>}</>
  ) : (
    <span className="flex min-w-0 flex-col items-center justify-center gap-0.5 leading-none">
      <span className="max-w-full truncate text-[8px]">{selected?.name ?? (value === null ? "None" : "Set")}</span>
      <span aria-hidden="true" className="flex gap-px text-[8px]">
        {[1, 2, 3].map((star) => <span key={star} className={value && star <= (starCount ?? 0) ? "text-pink-300" : "text-zinc-500/70"}>★</span>)}
      </span>
    </span>
  );
  return <ParentingPopover
    label={`${SLOT_LABEL[slot]} ${label} factor: ${selected ? `${selected.name}, ${starCount ?? "no"} stars` : value === null ? "No factor" : "Not set"}`}
    className={`flex h-8 w-full min-w-0 flex-none items-center justify-center gap-1 rounded-md border px-1.5 text-center text-[8px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${triggerClass}`}
    trigger={trigger}
  >
    <div className="space-y-2" aria-label={`${SLOT_LABEL[slot]} ${label} factor options`}>
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label} factor</p>
        <RadioGroup aria-label={`${label} factor`} value={value == null ? "" : String(value)} onChange={(next) => onChange(isBlue ? Number(next) : next as AptitudeKey, starCount ?? 3)} className={`grid ${isBlue ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"} gap-1`}>
          {factorOptions.map((option) => <Radio key={option.value} value={String(option.value)} className={radioClass}>
            {isBlue && typeof option.value === "number" && <StatIcon stat={BLUE_FACTOR_STATS[option.value]} className="h-4 w-4 shrink-0" />}
            <span className="font-normal">{option.name}</span>
          </Radio>)}
        </RadioGroup>
        <div className="mt-1.5 flex gap-1"><Button onPress={() => onChange(undefined, undefined)} className="min-h-8 flex-1 rounded-md border border-zinc-800 px-2 text-[10px] text-zinc-300 hover:bg-zinc-800">Not set</Button><Button onPress={() => onChange(null, 0)} className="min-h-8 flex-1 rounded-md border border-zinc-800 px-2 text-[10px] text-zinc-300 hover:bg-zinc-800">No factor</Button></div>
      </div>
      {selected && <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Stars</p>
        <RadioGroup aria-label={`${label} factor stars`} value={starCount ? String(starCount) : ""} onChange={(count) => onChange(value, Number(count))} className="flex gap-1">
          {[1, 2, 3].map((count) => <Radio key={count} value={String(count)} aria-label={`${count} star${count === 1 ? "" : "s"}`} className={`${radioClass} flex-1`}><img src={`/assets/factor/utx_ico_factor_rarity_${String(iconIndex + count - 1).padStart(2, "0")}.png`} alt="" className="h-4 w-9 object-contain" /></Radio>)}
        </RadioGroup>
      </div>}
    </div>
  </ParentingPopover>;
}

function SparkInput({ slot, goal, onChange }: {
  slot: LoopAncestorSlot;
  goal: NonNullable<ParentingLoopConfig["factorGoals"]>[LoopAncestorSlot];
  onChange: (goal: EditableFactorPlan) => void;
}) {
  return <div role="group" aria-label={`${SLOT_LABEL[slot]} pink spark input`} className="min-w-0 px-0.5 pt-1">
    <FactorGoalRow slot={slot} kind="pink" value={goal?.pink} stars={goal?.pinkStars ?? undefined} onChange={(pink, pinkStars) => onChange({ ...(pink === undefined ? {} : { pink: pink as AptitudeKey | null }), ...(pinkStars === undefined ? {} : { pinkStars }) })} />
  </div>;
}

function AncestorIdentityButton({
  slot,
  candidate,
  density,
  onOpenPicker,
}: {
  slot: LoopUmaSlot;
  candidate: LoopCandidate | null;
  density: "parent" | "grandparent" | "great-grandparent" | "great-great-grandparent";
  onOpenPicker: () => void;
}) {
  const size = density === "parent"
    ? "h-16 w-16 sm:h-20 sm:w-20"
    : density === "grandparent"
      ? "h-12 w-12 sm:h-14 sm:w-14"
      : "h-10 w-10 sm:h-12 sm:w-12";
  const nameSize = density === "parent"
    ? "text-[11px] sm:text-xs"
    : density === "grandparent"
      ? "text-[9px] sm:text-[10px]"
      : "text-[8px] sm:text-[9px]";
  const nameWidth = density === "parent" ? "max-w-[125px]" : density === "grandparent" ? "max-w-[95px]" : "max-w-[82px]";
  const portraitImageClass = "absolute inset-0 h-full w-full object-contain object-top drop-shadow-xs scale-[1.65] origin-top -translate-y-[17%]";

  return (
    <Button
      onPress={onOpenPicker}
      aria-label={`Choose ${SLOT_LABEL[slot]}${candidate ? `: ${candidate.name}` : ""}`}
      data-ancestor-identity={density}
      className="group/avatar flex min-h-9 max-w-full flex-col items-center justify-center outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-lg"
    >
      {candidate ? (
        <div className={`relative ${size} flex-none overflow-visible rounded-full shadow-sm transition-transform duration-150 ease-out-quart group-hover/avatar:scale-105`}>
          <div data-portrait-layer="back" aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden rounded-full">
            <img
              src={getCharacterImageUrl(getCharaIdFromCardId(candidate.cardId), candidate.cardId, "01")}
              alt=""
              className={portraitImageClass}
            />
          </div>
          <div
            data-portrait-layer="frame"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 rounded-full ring-[2.5px] ring-amber-400/95 dark:ring-amber-400/80"
          />
          <img
            src={getCharacterImageUrl(getCharaIdFromCardId(candidate.cardId), candidate.cardId, "01")}
            alt=""
            aria-hidden="true"
            data-portrait-layer="front"
            className={`${portraitImageClass} z-20`}
            style={{
              clipPath: "polygon(50% -20%, 64% -16%, 78% -8%, 89% 5%, 96% 20%, 100% 41%, 0 41%, 4% 20%, 11% 5%, 22% -8%, 36% -16%)",
            }}
          />
        </div>
      ) : (
        <div className={`${size} flex flex-col flex-none items-center justify-center rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/70 text-zinc-400 transition-colors duration-150 ease-out-quart group-hover/avatar:border-emerald-500 group-hover/avatar:text-emerald-500`}>
          <span className="text-xl font-bold leading-none">+</span>
          <span className="mt-0.5 text-[7px] font-semibold uppercase tracking-wider">Select</span>
        </div>
      )}
      <span className={`mt-1 w-full ${nameWidth} truncate text-center font-bold ${nameSize} text-zinc-800 dark:text-zinc-100 leading-tight transition-colors duration-150 group-hover/avatar:text-emerald-700 dark:group-hover/avatar:text-emerald-400`}>
        {candidate?.name ?? `Select ${SLOT_LABEL[slot]}`}
      </span>
    </Button>
  );
}

function AncestorCard({
  slot,
  candidate,
  density,
  onOpenPicker,
  factorGoal,
  uniqueSkill,
  onFactorGoalChange,
  assessment,
  sources,
  whiteTargets,
  onWhiteTargetsChange,
}: {
  slot: LoopUmaSlot;
  candidate: LoopCandidate | null;
  density: "parent" | "grandparent" | "great-grandparent" | "great-great-grandparent";
  onOpenPicker: () => void;
  factorGoal: EditableFactorPlan;
  uniqueSkill?: { id: number; nameEn: string; nameJp: string; iconId?: number | null };
  onFactorGoalChange: (goal: EditableFactorPlan) => void;
  assessment: BranchAssessment;
  sources: SparkSource[];
  whiteTargets: AptitudeKey[];
  onWhiteTargetsChange: (targets: AptitudeKey[]) => void;
}) {
  if (density === "great-grandparent") {
    return (
      <div className="relative min-w-0 rounded-xl border border-zinc-300/80 bg-zinc-200/85 p-1 shadow-2xs dark:border-zinc-700/80 dark:bg-zinc-900/90">
        <div className="flex flex-col items-center justify-center px-1 pb-1 pt-3">
          <AncestorIdentityButton slot={slot} candidate={candidate} density="great-grandparent" onOpenPicker={onOpenPicker} />
        </div>
        <div className="mt-1">
          <ParentingPopover
            label={`${SLOT_LABEL[slot]} Red factor: ${factorGoal.pink ?? (factorGoal.pink === null ? "No factor" : "Not set")}`}
            className="parenting-aptitude-cell flex h-10 w-full min-w-0 items-center justify-center gap-1 rounded-lg border border-pink-300 bg-pink-50 px-1.5 text-center font-bold text-[10px] text-pink-900 transition-colors hover:bg-pink-100 cursor-pointer dark:border-pink-800 dark:bg-pink-950/25 dark:text-pink-100 dark:hover:bg-pink-900/40 outline-none focus-visible:ring-2 focus-visible:ring-pink-500 shadow-2xs"
            trigger={
              <div className="flex items-center justify-center gap-1 w-full truncate">
                <span className={`text-[10px] font-bold ${factorGoal.pink ? "text-pink-600 dark:text-pink-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                  {factorGoal.pink ? <AptitudeName value={factorGoal.pink} /> : "Aptitude"}
                </span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3].map((star) => (
                    <span
                      key={star}
                      className={`text-[10px] leading-none ${
                        star <= (factorGoal.pinkStars ?? (factorGoal.pink ? 3 : 0))
                          ? "text-pink-600 dark:text-pink-400"
                          : "text-zinc-400/60 dark:text-zinc-600"
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            }
          >
            <p className="mb-2 text-xs font-semibold">Pink factor (Aptitude spark)</p>
            <RadioGroup aria-label="Stars" value={factorGoal.pinkStars ? String(factorGoal.pinkStars) : ""} isDisabled={!factorGoal.pink} onChange={(count) => onFactorGoalChange({ ...factorGoal, pinkStars: Number(count) })} className="mb-2 flex gap-1">
              {[1, 2, 3].map((count) => <Radio key={count} value={String(count)} aria-label={`${count} stars`} className={`${CHOICE} flex-1`}>{"★".repeat(count)}</Radio>)}
            </RadioGroup>
            <RadioGroup aria-label="Pink aptitude" value={factorGoal.pink ?? ""} onChange={(key) => onFactorGoalChange({ ...factorGoal, pink: key as AptitudeKey, pinkStars: nextPinkStars(factorGoal.pinkStars) })}>
              <AptitudeGrid render={(key) => <Radio key={key} value={key} aria-label={key} className={CHOICE}>{SHORT[key]}</Radio>} />
            </RadioGroup>
            <div className="mt-2 flex gap-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <button type="button" onClick={() => { const next = { ...factorGoal }; delete next.pink; delete next.pinkStars; onFactorGoalChange(next); }} className={`${BUTTON} flex-1`}>Not set</button>
              <button type="button" onClick={() => onFactorGoalChange({ ...factorGoal, pink: null, pinkStars: 0 })} className={`${BUTTON} flex-1`}>No factor</button>
            </div>
          </ParentingPopover>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-w-0">
      <div className="w-full min-w-0 rounded-2xl border border-zinc-300/80 bg-zinc-200/85 p-1 pt-3 sm:p-2 sm:pt-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/90">
        <div className="w-full text-center h-auto flex flex-col gap-1 sm:gap-1.5">
            <div data-aptitude-group="Surface" className="w-full grid grid-cols-4 justify-items-stretch gap-1 sm:gap-1.5 items-end">
            <div className="col-span-2 flex flex-col items-center justify-center p-0.5 min-w-0">
              <AncestorIdentityButton slot={slot} candidate={candidate} density={density} onOpenPicker={onOpenPicker} />
            </div>
            <AptitudeCell aptitude="Turf" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Dirt" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
          </div>
          <div data-aptitude-group="Distance" className="w-full grid grid-cols-4 justify-items-stretch gap-1 sm:gap-1.5">
            <AptitudeCell aptitude="Sprint" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Mile" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Medium" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Long" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
          </div>
          <div data-aptitude-group="Style" className="w-full grid grid-cols-4 justify-items-stretch gap-1 sm:gap-1.5">
            <AptitudeCell aptitude="Runner" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Leader" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Betweener" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Chaser" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
          </div>
        </div>
        <div className="mt-1 sm:mt-1.5 h-10 min-h-10 min-w-0 flex-none">
          {uniqueSkill ? (
            <SkillHoverCard
              skillId={uniqueSkill.id}
              fallbackSkill={uniqueSkill}
              isParentMode
              className="group inline-flex h-full w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-300/80 bg-white/95 px-2 py-1 shadow-2xs transition-colors hover:bg-zinc-50 dark:border-zinc-700/80 dark:bg-zinc-800/95 dark:hover:bg-zinc-700/90"
            >
              <SkillIcon iconId={uniqueSkill.iconId} name={uniqueSkill.nameEn} className="h-5 w-5 flex-none object-contain drop-shadow-2xs sm:h-6 sm:w-6" />
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[11px] font-semibold leading-tight text-zinc-900 transition-colors group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400 sm:text-xs">{uniqueSkill.nameEn}</p>
                {uniqueSkill.nameJp && <p className="mt-0.5 truncate text-[10px] font-normal leading-tight text-zinc-400 dark:text-zinc-500">{uniqueSkill.nameJp}</p>}
              </div>
            </SkillHoverCard>
          ) : (
            <div aria-hidden="true" className="h-10 w-full" />
          )}
        </div>
        <div className="mt-1 sm:mt-1.5">
          <ParentingPopover
            label={`${SLOT_LABEL[slot]} Red factor: ${factorGoal.pink ?? (factorGoal.pink === null ? "No factor" : "Not set")}`}
            className="flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border border-pink-300 bg-pink-50 px-3 text-center font-bold text-xs text-pink-900 transition-colors cursor-pointer hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-950/25 dark:text-pink-100 dark:hover:bg-pink-900/40 outline-none focus-visible:ring-2 focus-visible:ring-pink-500 shadow-2xs"
            trigger={
              <div className="flex items-center justify-center gap-1.5 w-full">
                <span className="text-[11px] sm:text-xs font-bold text-pink-700 dark:text-pink-300">
                  {factorGoal.pink ? <AptitudeName value={factorGoal.pink} /> : "Aptitude"}
                </span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3].map((star) => (
                    <span
                      key={star}
                      className={`text-[12px] sm:text-[13px] leading-none ${
                        star <= (factorGoal.pinkStars ?? (factorGoal.pink ? 3 : 0))
                          ? "text-pink-600 dark:text-pink-400"
                          : "text-zinc-400/60 dark:text-zinc-600"
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            }
          >
            <p className="mb-2 text-xs font-semibold">Pink spark</p>
            <RadioGroup aria-label="Stars" value={factorGoal.pinkStars ? String(factorGoal.pinkStars) : ""} isDisabled={!factorGoal.pink} onChange={(count) => onFactorGoalChange({ ...factorGoal, pinkStars: Number(count) })} className="mb-2 flex gap-1">
              {[1, 2, 3].map((count) => <Radio key={count} value={String(count)} aria-label={`${count} stars`} className={`${CHOICE} flex-1`}>{"★".repeat(count)}</Radio>)}
            </RadioGroup>
            <RadioGroup aria-label="Pink aptitude" value={factorGoal.pink ?? ""} onChange={(key) => onFactorGoalChange({ ...factorGoal, pink: key as AptitudeKey, pinkStars: nextPinkStars(factorGoal.pinkStars) })}>
              <AptitudeGrid render={(key) => <Radio key={key} value={key} aria-label={key} className={CHOICE}>{SHORT[key]}</Radio>} />
            </RadioGroup>
            <div className="mt-2 flex gap-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <button type="button" onClick={() => { const next = { ...factorGoal }; delete next.pink; delete next.pinkStars; onFactorGoalChange(next); }} className={`${BUTTON} flex-1`}>Not set</button>
              <button type="button" onClick={() => onFactorGoalChange({ ...factorGoal, pink: null, pinkStars: 0 })} className={`${BUTTON} flex-1`}>No factor</button>
            </div>
          </ParentingPopover>
        </div>
        <div className="mt-1 sm:mt-1.5">
          <WhiteGeneticPicker
            label={SLOT_LABEL[slot]}
            assessment={assessment}
            targets={whiteTargets}
            onChange={onWhiteTargetsChange}
            maxTargets={2}
          />
        </div>
      </div>
    </div>
  );
}

export function ParentingLoopOptimizer(props: Props) {
  const [mobileBranch, setMobileBranch] = useState<"p1" | "p2">("p1");
  const [mobileBranchZoom, setMobileBranchZoom] = useState(1);
  const branchTouchStart = useRef<{ x: number; y: number } | null>(null);
  const stored = props.setup.loopConfig;
  const candidateVeterans = useMemo(() => {
    const extras: KyumaruVeteranItem[] = [];
    if (props.setup.parent1) extras.push(props.setup.parent1);
    if (props.setup.parent2) extras.push(props.setup.parent2);
    for (const parent of [props.setup.parent1, props.setup.parent2]) {
      for (const ancestor of parent?.succession_chara_array ?? []) {
        if (ancestor.card_id) extras.push(ancestor as unknown as KyumaruVeteranItem);
      }
    }
    for (const slot of Object.values(props.setup.gpOverrides)) {
      if (slot) extras.push({
        card_id: slot.card_id, trained_chara_id: slot.trained_chara_id,
        name: slot.name, factor_info_array: slot.factor_info_array,
        win_saddle_id_array: slot.win_saddle_id_array,
      } as KyumaruVeteranItem);
    }
    const seen = new Set<string>();
    return [...props.veterans, ...extras].filter((vet) => {
      const identity = `${vet.trained_chara_id ?? vet.card_id}:${vet.create_time ?? ""}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }, [props.veterans, props.setup.parent1, props.setup.parent2, props.setup.gpOverrides]);
  const current = useMemo(() => {
    const candidates = buildLoopCandidates(candidateVeterans, props.roster);
    const find = (cardId?: number | null, trainedId?: number) => {
      if (!cardId) return undefined;
      return candidates.find((candidate) => candidate.cardId === cardId && candidate.source === "veteran" && (trainedId == null || candidate.veteran?.trained_chara_id === trainedId))?.key
        ?? candidates.find((candidate) => candidate.key === `r:${cardId}`)?.key;
    };
    const gp = (parent: KyumaruVeteranItem | null, position: 10 | 20, override?: GrandparentSlot | null) => {
      const succession = parent?.succession_chara_array?.find((entry) => entry.position_id === position);
      const slot = override ?? succession;
      return slot ? find(slot.card_id, override?.trained_chara_id) : undefined;
    };
    const map: Partial<Record<LoopAncestorSlot, string>> = {};
    const p1 = find(props.setup.parent1?.card_id, props.setup.parent1?.trained_chara_id);
    const p2 = find(props.setup.parent2?.card_id, props.setup.parent2?.trained_chara_id);
    if (p1) map.p1 = p1; if (p2) map.p2 = p2;
    const gp1 = gp(props.setup.parent1, 10, props.setup.gpOverrides.p1_gp1);
    const gp2 = gp(props.setup.parent1, 20, props.setup.gpOverrides.p1_gp2);
    const gp3 = gp(props.setup.parent2, 10, props.setup.gpOverrides.p2_gp1);
    const gp4 = gp(props.setup.parent2, 20, props.setup.gpOverrides.p2_gp2);
    if (gp1) map.p1_gp1 = gp1; if (gp2) map.p1_gp2 = gp2;
    if (gp3) map.p2_gp1 = gp3; if (gp4) map.p2_gp2 = gp4;
    return map;
  }, [candidateVeterans, props.roster, props.setup.parent1, props.setup.parent2, props.setup.gpOverrides]);
  const allCandidates = useMemo(() => buildLoopCandidates(candidateVeterans, props.roster), [candidateVeterans, props.roster]);
  const config = useMemo(() => ({ ...defaultConfig(), ...normalizeLoopConfig(stored, candidateVeterans) }), [stored, candidateVeterans]);
  useEffect(() => {
    if (!stored || !LOOP_ANCESTOR_SLOTS.some((slot) => slot.split("_").length === 4 && stored.selectedSlots[slot] && !config.selectedSlots[slot])) return;
    props.updateSetup((prev) => ({ ...prev, loopConfig: config }));
  }, [stored, config, props.updateSetup]);
  const selectedSlots = useMemo(() => ({ ...current, ...config.selectedSlots }), [current, config.selectedSlots]);
  const selectedCandidates = useMemo(() => Object.fromEntries(LOOP_UMA_SLOTS.map((slot) => {
    const key = selectedSlots[slot];
    const exact = allCandidates.find((candidate) => candidate.key === key);
    if (exact || !key) return [slot, exact ?? null];
    const [source, identity] = key.split(":");
    const id = Number(identity);
    const match = source === "v"
      ? allCandidates.find((candidate) => candidate.source === "veteran" && (candidate.veteran?.trained_chara_id === id || candidate.cardId === id))
      : allCandidates.find((candidate) => candidate.cardId === id && (source === "b" ? candidate.source === "borrow-placeholder" : candidate.source === "roster-goal"));
    return [slot, match ?? null];
  })) as Record<LoopUmaSlot, LoopCandidate | null>, [allCandidates, selectedSlots]);
  const plannedConfig = useMemo(() => {
    const factorGoals = { ...config.factorGoals };
    for (const slot of LOOP_UMA_SLOTS) {
      const candidate = selectedCandidates[slot];
      if (!candidate) continue;
      const plan = editableFactorPlan(candidate, factorGoals[slot]);
      if (candidate.factorKnowledge || plan.blue !== undefined || (plan.pink !== undefined && plan.pinkStars !== undefined)) factorGoals[slot] = plan;
    }
    return { ...config, factorGoals };
  }, [config, selectedCandidates]);
  const assessments = useMemo(() => Object.fromEntries(
    LOOP_UMA_SLOTS.map((slot) => [slot, evaluateParentingBranch(slot, selectedCandidates, plannedConfig, props.target)]),
  ) as Record<LoopUmaSlot, BranchAssessment>, [selectedCandidates, plannedConfig, props.target]);
  const updateConfig = (next: ParentingLoopConfig) => {
    props.updateSetup((prev) => ({ ...prev, loopConfig: next }));
  };
  const setFactorGoal = (slot: LoopAncestorSlot, goal: EditableFactorPlan) => {
    updateConfig({ ...config, factorGoals: { ...config.factorGoals, [slot]: goal } });
  };
  const ancestorCard = (slot: LoopAncestorSlot, density: "parent" | "grandparent" | "great-grandparent" | "great-great-grandparent") => {
    if (density === "great-great-grandparent") return <SparkInput key={slot} slot={slot} goal={config.factorGoals?.[slot] ?? {}} onChange={(goal) => setFactorGoal(slot, goal)} />;
    const umaSlot = slot as LoopUmaSlot;
    const candidate = selectedCandidates[umaSlot];
    const assessment = assessments[umaSlot];
    const uniqueId = candidate ? allCharacters.find((character) => character.charId === candidate.charId)?.uniqueSkillId : undefined;
    const inheritedUniqueId = uniqueId == null ? undefined : uniqueInheritMap[String(uniqueId)];
    const uniqueSkill = (inheritedUniqueId == null ? undefined : skillsById.get(inheritedUniqueId))
      ?? (uniqueId == null ? undefined : skillsById.get(uniqueId));
    const uniqueSkillForInspector = uniqueSkill ? { id: uniqueSkill.id, nameEn: uniqueSkill.nameEn, nameJp: uniqueSkill.nameJp, iconId: uniqueSkill.iconId } : undefined;
    return <AncestorCard key={slot} slot={umaSlot} whiteTargets={config.slotWhiteTargets?.[umaSlot] ?? []} onWhiteTargetsChange={(targets) => updateConfig({ ...config, slotWhiteTargets: { ...config.slotWhiteTargets, [umaSlot]: targets } })} sources={assessment.sourceSlots.map((sourceSlot) => { const sourceCandidate = selectedCandidates[sourceSlot as LoopUmaSlot] ?? null; const plan = editableFactorPlan(sourceCandidate, config.factorGoals?.[sourceSlot]); return { label: SLOT_LABEL[sourceSlot], pink: plan.pink, stars: plan.pinkStars }; })} assessment={assessment} candidate={candidate} density={density} factorGoal={editableFactorPlan(candidate, config.factorGoals?.[slot])} uniqueSkill={uniqueSkillForInspector} onFactorGoalChange={(goal) => setFactorGoal(slot, goal)} onOpenPicker={() => props.onOpenPicker(slot)} />;
  };

  const renderBranch = (parentSlot: "p1" | "p2") => {
    const gpSlots = parentSlot === "p1" ? ["p1_gp1", "p1_gp2"] as const : ["p2_gp1", "p2_gp2"] as const;
    return <section key={parentSlot} aria-label={`${parentSlot.toUpperCase()} lineage branch`} className="min-w-0">
      {ancestorCard(parentSlot, "parent")}
      <svg data-pedigree-connector="parent-to-grandparent" aria-hidden="true" className="pointer-events-none block h-6 w-full text-emerald-700/50 dark:text-emerald-300/50" viewBox="0 0 1000 24" preserveAspectRatio="none"><path d="M500 0V10H250V24M500 10H750V24" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
      <div className="grid grid-cols-2 items-stretch gap-0.5 sm:gap-2">
        {gpSlots.map((gpSlot) => {
          const ggpSlots = gpSlot.endsWith("gp1") ? [`${parentSlot}_gp1_g1`, `${parentSlot}_gp1_g2`] as const : [`${parentSlot}_gp2_g1`, `${parentSlot}_gp2_g2`] as const;
          return <div key={gpSlot} className="flex min-w-0 flex-col">
            {ancestorCard(gpSlot, "grandparent")}
            <div className="mt-1">
              <svg data-pedigree-connector="grandparent-to-great-grandparent" aria-hidden="true" className="pointer-events-none block h-4 w-full text-emerald-700/50 dark:text-emerald-300/50" viewBox="0 0 1000 16" preserveAspectRatio="none"><path d="M500 0V6H250V16M500 6H750V16" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
              <div className="grid grid-cols-2 items-stretch gap-1">{ggpSlots.map((slot) => <div key={slot} className="flex min-w-0 flex-col rounded-lg bg-zinc-50/70 dark:bg-zinc-900/60">
                {ancestorCard(slot, "great-grandparent")}
                <div className="px-1.5 pb-1">
                  <svg data-pedigree-connector="great-grandparent-to-great-great-grandparent" aria-hidden="true" className="pointer-events-none block h-4 w-full text-emerald-700/50 dark:text-emerald-300/50" viewBox="0 0 1000 16" preserveAspectRatio="none"><path d="M500 0V6H250V16M500 6H750V16" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
                  <div className="grid grid-cols-2 items-stretch gap-1">{([`${slot}_g1`, `${slot}_g2`] as LoopAncestorSlot[]).map((gggpSlot) => ancestorCard(gggpSlot, "great-great-grandparent"))}</div>
                </div>
              </div>)}</div>
            </div>
          </div>;
        })}
      </div>
    </section>;
  };

  const handleBranchTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch) branchTouchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleBranchTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = branchTouchStart.current;
    const touch = event.changedTouches[0];
    branchTouchStart.current = null;
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    setMobileBranch(dx < 0 ? "p2" : "p1");
  };

  return <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bold text-zinc-900 dark:text-zinc-100">Parent Planning</h3>
        <p className="text-xs text-zinc-500 mt-1">Set pink sparks below each branch to support its planned aptitude, G1 farming and white genetics.</p></div>
    </header>
    {props.targetStage && <div>{props.targetStage}</div>}
    {!props.target ? <p className="text-sm text-zinc-500">Select a target Uma to build the pedigree.</p> : <>
      <div className="border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
        <span className="text-zinc-400">MDB gene catalog: {successionFactors.factors.length} factors; aptitude thresholds are data-backed.</span>
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-3">
        <div className="relative hidden lg:block">
          <svg aria-hidden="true" className="pointer-events-none block h-7 w-full text-emerald-700/50 dark:text-emerald-300/50" viewBox="0 0 1000 28" preserveAspectRatio="none"><path d="M500 0V12H250V28M500 12H750V28" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
          <div className="grid grid-cols-2 gap-1 sm:gap-3">{renderBranch("p1")}{renderBranch("p2")}</div>
        </div>
        <div className="lg:hidden">
          <PedigreeBranchTabs value={mobileBranch} onChange={setMobileBranch} trailing={<div className="flex items-center gap-1">
                <Button aria-label="Zoom out branch" isDisabled={mobileBranchZoom <= MIN_MOBILE_BRANCH_ZOOM} onPress={() => setMobileBranchZoom((zoom) => Math.max(MIN_MOBILE_BRANCH_ZOOM, Math.round((zoom - 0.1) * 10) / 10))} className="min-h-9 min-w-9 rounded-lg border border-zinc-200 bg-white text-lg font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">−</Button>
                <span className="min-w-10 text-center text-[10px] tabular-nums text-zinc-500">{Math.round(mobileBranchZoom * 100)}%</span>
                <Button aria-label="Zoom in branch" isDisabled={mobileBranchZoom >= MAX_MOBILE_BRANCH_ZOOM} onPress={() => setMobileBranchZoom((zoom) => Math.min(MAX_MOBILE_BRANCH_ZOOM, Math.round((zoom + 0.1) * 10) / 10))} className="min-h-9 min-w-9 rounded-lg border border-zinc-200 bg-white text-lg font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">+</Button>
              </div>}>
            <svg aria-hidden="true" className="pointer-events-none block h-5 w-full text-emerald-700/50 dark:text-emerald-300/50" viewBox="0 0 1000 20" preserveAspectRatio="none"><path d="M500 0V20" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
            <div onTouchStart={handleBranchTouchStart} onTouchEnd={handleBranchTouchEnd} className="touch-pan-y overflow-x-auto" aria-label="Pedigree branch. Swipe left or right to switch between P1 and P2.">
              <div className="origin-top-left" style={{ zoom: mobileBranchZoom * MOBILE_BRANCH_BASE_ZOOM }}>{renderBranch(mobileBranch)}</div>
            </div>
          </PedigreeBranchTabs>
          <p className="mt-1 text-center text-[10px] text-zinc-500">Swipe left or right to view {mobileBranch === "p1" ? "P2" : "P1"}</p>
        </div>
      </div>
    </>}
  </section>;
}
