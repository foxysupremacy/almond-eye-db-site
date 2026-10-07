"use client";

import { useEffect, type ReactNode } from "react";
import { RadioGroup, Radio } from "react-aria-components/RadioGroup";
import { CheckboxGroup, Checkbox } from "react-aria-components/CheckboxGroup";
import { APTITUDE_KEYS, type AptitudeKey, type AptitudeProjection, type BranchAssessment, type FarmAptitude, type FarmRank } from "@/lib/parenting/loop-planner";
import { StatusRankIcon } from "@/app/common/ui/primitives/status-icons";
import { ParentingPopover } from "./parenting-popover";

const GROUPS = [APTITUDE_KEYS.slice(0, 2), APTITUDE_KEYS.slice(2, 6), APTITUDE_KEYS.slice(6)] as const;
export const SHORT: Record<AptitudeKey, string> = { Turf: "Turf", Dirt: "Dirt", Sprint: "Spr", Mile: "Mile", Medium: "Med", Long: "Long", Runner: "Run", Leader: "Lead", Betweener: "Bet", Chaser: "Chase" };
export const APTITUDE_LABEL: Record<AptitudeKey, string> = {
  Turf: "Turf", Dirt: "Dirt", Sprint: "Sprint", Mile: "Mile", Medium: "Medium", Long: "Long",
  Runner: "Runner", Leader: "Leader", Betweener: "Betweener", Chaser: "Chaser",
};
const COMPACT_STYLE_LABEL: Partial<Record<AptitudeKey, string>> = {
  Runner: "RUN", Leader: "LEAD", Betweener: "BTWN", Chaser: "CHASE",
};
export function AptitudeName({ value }: { value: AptitudeKey }) {
  const compact = COMPACT_STYLE_LABEL[value];
  return <>
    <span className={`parenting-aptitude-label-full${compact ? " parenting-aptitude-label-has-compact" : ""}`}>{APTITUDE_LABEL[value]}</span>
    {compact && <span aria-hidden="true" className="parenting-aptitude-label-compact">{compact}</span>}
  </>;
}
export const BUTTON = "min-h-9 rounded-md px-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
export const CHOICE = "flex min-h-9 cursor-pointer items-center justify-center rounded-md bg-zinc-100 px-1 text-xs outline-none data-[selected]:bg-emerald-600 data-[selected]:text-white data-[focus-visible]:ring-2 data-[focus-visible]:ring-emerald-500 data-[disabled]:opacity-40 dark:bg-zinc-800 dark:data-[selected]:bg-emerald-600";
const GENETIC_CHOICE = `${CHOICE} group data-[disabled]:cursor-not-allowed`;
export function AptitudeGrid({ render }: { render: (aptitude: AptitudeKey) => ReactNode }) {
  return <div className="space-y-1">{GROUPS.map((group, index) => <div key={index} className={`grid gap-1 ${index === 0 ? "grid-cols-2" : "grid-cols-4"}`} data-aptitude-group={["Surface", "Distance", "Style"][index]}>{group.map(render)}</div>)}</div>;
}
export function nextPinkStars(stars?: number) { return stars && stars >= 1 && stars <= 3 ? stars : 3; }
export interface SparkSource { label: string; pink?: AptitudeKey | null; stars?: number | null }
export function isProjectionBoosted(projection: AptitudeProjection): boolean {
  return projection.availablePinkStars > 0 || (projection.base !== "?" && projection.projected !== "?" && projection.base !== projection.projected);
}

export function projectionDisplayGrade(projection: AptitudeProjection): string {
  const baseGrade = projection.base === "?" ? "-" : projection.base;
  const grade = isProjectionBoosted(projection) && projection.projected !== "?" && projection.projected !== "-" ? projection.projected : baseGrade;
  return grade === "-" ? "?" : grade;
}

export function AptitudeCell({
  aptitude,
  assessment,
  label,
  sources,
  onTargetChange,
  isPinkFactor,
  allowTargetSelection = false,
  compactCell = false,
}: {
  aptitude: AptitudeKey;
  assessment: BranchAssessment;
  label: string;
  sources: SparkSource[];
  onTargetChange?: (key: FarmAptitude, rank: FarmRank) => void;
  isPinkFactor?: boolean;
  allowTargetSelection?: boolean;
  compactCell?: boolean;
}) {
  const projection = assessment.projections.find((item) => item.aptitude === aptitude)!;
  const result = projection.confidence === "unknown" ? "?" : projection.projected;
  const isBoosted = isProjectionBoosted(projection);
  const grade = projectionDisplayGrade(projection);
  const displayGrade = grade === "?" ? "-" : grade;

  return (
    <ParentingPopover
      label={`${label} ${aptitude}: base ${projection.base}, projected ${result}`}
      className={`parenting-aptitude-cell group flex min-h-9 min-w-0 flex-col overflow-hidden rounded-lg border text-center transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${compactCell ? "w-full max-w-[4rem] justify-self-center" : "w-full"} ${
        isBoosted
          ? "border-pink-400 dark:border-pink-500 ring-2 ring-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.6)] dark:shadow-[0_0_12px_rgba(236,72,153,0.5)] z-1"
          : isPinkFactor
          ? "border-[#e4007f] ring-1 ring-[#e4007f] shadow-xs"
          : "border-zinc-200/90 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 shadow-2xs"
      }`}
      trigger={
        <div
          className="flex flex-col w-full"
          title={`${aptitude}: Base ${projection.base}${isBoosted ? ` → Boosted ${projection.projected} (${projection.availablePinkStars}★)` : ""}`}
        >
          <div className={`w-full border-b py-0.5 text-center text-[8px] font-bold sm:text-[9px] ${
            isBoosted
              ? "border-pink-300 dark:border-pink-600/80 bg-pink-50/90 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300"
              : "border-zinc-200/80 bg-white/95 text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-800/95 dark:text-zinc-300"
          }`}>
            <span className={`parenting-aptitude-label-full${COMPACT_STYLE_LABEL[aptitude] ? " parenting-aptitude-label-has-compact" : ""}`}>{APTITUDE_LABEL[aptitude]}</span>
            {COMPACT_STYLE_LABEL[aptitude] && <span aria-hidden="true" className="parenting-aptitude-label-compact">{COMPACT_STYLE_LABEL[aptitude]}</span>}
          </div>
          <div
            className={`flex h-6 sm:h-7 w-full items-center justify-center py-0.5 ${
              isPinkFactor
                ? "bg-[#e4007f] text-white"
                : isBoosted
                ? "bg-pink-50/60 dark:bg-pink-950/20 text-zinc-800 dark:text-zinc-100"
                : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100"
            }`}
          >
            {displayGrade === "-" || displayGrade === "?" ? (
              <span className={`text-[10px] font-bold ${isPinkFactor ? "text-white" : "text-zinc-400"}`}>?</span>
            ) : (
              <StatusRankIcon grade={displayGrade} className="h-4 w-4 sm:h-5 sm:w-5 object-contain" />
            )}
          </div>
        </div>
      }
    >
      <p className="text-sm font-semibold">{aptitude} · Base {projection.base} {isBoosted ? `→ Boosted ${projection.projected}` : ""}</p>
      <p className="mt-1 text-xs">{projection.availablePinkStars} pink ★ from ancestors pushing this up</p>
      {projection.confidence === "unknown" && projection.availablePinkStars > 0 && (
        <p className="mt-1 text-xs text-zinc-500">Some ancestors not yet set. Current projection: {projection.projected}.</p>
      )}
      {assessment.partialLineage && <p className="mt-1 text-xs text-zinc-500">Only the two declared GGGP inputs are included.</p>}
      {allowTargetSelection && projection.target && onTargetChange && (
        <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
          <RadioGroup aria-label={`${label} ${aptitude} target aptitude`} value={projection.target} onChange={(rank) => onTargetChange(aptitude as FarmAptitude, rank as FarmRank)} className="flex gap-1">
            {["C", "D", "E"].map((rank) => <Radio key={rank} value={rank} className={`${CHOICE} flex-1`}>{rank}</Radio>)}
          </RadioGroup>
          <p className="mt-1 text-xs">{projection.targetStatus === "met" ? "Target met" : projection.missingPinkStars == null ? "Unknown requirement" : `+${projection.missingPinkStars}★ needed from known inputs`}</p>
        </div>
      )}
      <ul className="mt-2 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
        {sources.map((source) => <li key={source.label} className="py-1">{source.label}: {source.pink === undefined ? "Not set" : source.pink === null ? "No factor" : `${source.pink} ${source.stars ?? "?"}★`}</li>)}
      </ul>
    </ParentingPopover>
  );
}
export function AptitudeTable(props: { assessment: BranchAssessment; label: string; sources: SparkSource[]; onTargetChange?: (key: FarmAptitude, rank: FarmRank) => void; pinkFactor?: AptitudeKey | null }) {
  return (
    <div className="mt-2">
      <AptitudeGrid
        render={(aptitude) => (
          <AptitudeCell
            key={aptitude}
            aptitude={aptitude}
            isPinkFactor={props.pinkFactor === aptitude}
            allowTargetSelection={Boolean(props.onTargetChange)}
            {...props}
          />
        )}
      />
    </div>
  );
}
export function WhiteGeneticPicker({ label, targets, assessment, onChange, maxTargets = 3, className = "w-full min-w-0" }: { label: string; targets: AptitudeKey[]; assessment: BranchAssessment; onChange: (targets: AptitudeKey[]) => void; maxTargets?: number; className?: string }) {
  useEffect(() => {
    const validTargets = targets.filter((key) => {
      const factor = assessment.whiteFactors.find((item) => item.name === key);
      return factor && factor.availablePinkStars >= 6;
    });
    if (validTargets.length !== targets.length) {
      onChange(validTargets);
    }
  }, [targets, assessment.whiteFactors, onChange]);

  return (
    <div className={className}>
      <ParentingPopover
        label={`${label} Target genetic`}
        className={`${BUTTON} h-10 min-h-10 w-full text-center flex items-center justify-center gap-1.5 font-bold text-violet-700 bg-violet-50/80 hover:bg-violet-100 border border-violet-300 dark:border-violet-800/80 dark:bg-violet-950/30 dark:hover:bg-violet-900/40 dark:text-violet-300 shadow-2xs rounded-lg py-1.5`}
        trigger={<>Target genetic{targets.length ? ` (${targets.length})` : ""}</>}
      >
        <div className="space-y-2">
          <p className="mb-2 text-xs font-semibold">Target genetic <span className="font-normal text-zinc-500">{targets.length}/{maxTargets}</span></p>
          <CheckboxGroup
            aria-label="White genetic targets"
            value={targets}
            onChange={(keys) => onChange((keys as AptitudeKey[]).slice(0, maxTargets))}
          >
            <AptitudeGrid
              render={(key) => {
                const factor = assessment.whiteFactors.find((item) => item.name === key);
                const stars = factor?.availablePinkStars ?? 0;
                const isEligible = stars >= 6;
                const isMaxReached = targets.length >= maxTargets && !targets.includes(key);
                const isDisabled = !isEligible || isMaxReached;

                return (
                  <Checkbox
                    key={key}
                    value={key}
                    aria-label={key}
                    isDisabled={isDisabled}
                    className={`${GENETIC_CHOICE} ${
                      !isEligible
                        ? "cursor-not-allowed text-zinc-500 dark:text-zinc-400"
                        : stars >= 12
                        ? "font-bold"
                        : "font-semibold"
                    }`}
                  >
                    <div
                      className="flex flex-col items-center justify-center leading-none py-0.5 w-full"
                      title={
                        !isEligible
                          ? `Requires ≥ 6★ pink factor (currently ${stars}★)`
                          : stars >= 12
                          ? `${key}: 12★ (Guaranteed)`
                          : `${key}: ${stars}★ (Eligible)`
                      }
                    >
                      <span>{SHORT[key]}</span>
                      <span className={`text-[8px] mt-0.5 ${
                        !isEligible
                          ? "text-zinc-500 dark:text-zinc-400"
                          : stars >= 12
                          ? "text-pink-700 dark:text-pink-300 font-extrabold group-data-[selected]:text-white"
                          : "text-pink-600 dark:text-pink-400 font-bold group-data-[selected]:text-white"
                      }`}>
                        {stars}★
                      </span>
                    </div>
                  </Checkbox>
                );
              }}
            />
          </CheckboxGroup>
          <p className="text-xs text-zinc-500">
            {targets.length >= maxTargets
              ? `Max ${maxTargets} genetics selected. Uncheck one to change.`
              : "Requires ≥ 6★ pink factor in 3-generation lineage to unlock."}
          </p>
          <div className="mt-2 flex border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <button type="button" onClick={() => onChange([])} className={`${BUTTON} flex-1 text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800`}>
              Clear targets
            </button>
          </div>
        </div>
      </ParentingPopover>
    </div>
  );
}
