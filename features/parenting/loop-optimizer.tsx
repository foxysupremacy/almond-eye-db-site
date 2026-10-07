"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "react-aria-components/Button";
import type { CharacterIndexEntry } from "@/lib/data/types";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import type { AptitudeKey, BranchAssessment, LoopUmaSlot, LoopAncestorSlot, LoopCandidate } from "@/lib/parenting/loop-planner";
import { type ParentingSetup } from "@/lib/parenting/state";
import { AptitudeCell, AptitudeName, WhiteGeneticPicker, type SparkSource } from "./components/aptitude-controls";
import { PinkSparkFields, withPinkSpark } from "./components/pink-spark-fields";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import SkillHoverCard from "@/app/common/ui/skills/details/skill-hover-card";
import { GeneticIndicator } from "./components/genetic-indicator";
import type { Course } from "@/lib/skill-engine/types";
import { ParentingPopover } from "./components/parenting-popover";
import { useAncestorNavigation } from "./hooks/use-ancestor-navigation";
import { usePedigreeTier, type PedigreeTier } from "./hooks/use-pedigree-tier";
import { AncestorNavTarget } from "./pedigree/ancestor-nav-target";
import { AncestorSheet } from "./pedigree/ancestor-sheet";
import { PedigreeTree, SparkInput } from "./pedigree/pedigree-tree";
import { SLOT_LABEL } from "./pedigree/pedigree-slots";
import { AncestorPortrait } from "./pedigree/ancestor-portrait";
import { usePedigreeModel, type EditableFactorPlan } from "./hooks/use-pedigree-model";

interface Props {
  target: CharacterIndexEntry | null;
  veterans: KyumaruVeteranItem[];
  roster: CharacterIndexEntry[];
  setup: ParentingSetup;
  targetStage: ReactNode;
  course?: Course | null;
  runningStyle?: number | null;
  /** Test override; normally measured from the container width. */
  tier?: PedigreeTier;
  onOpenPicker: (slot: LoopAncestorSlot) => void;
  updateSetup: (updater: (prev: ParentingSetup) => ParentingSetup) => void;
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

  return (
    <Button
      onPress={onOpenPicker}
      aria-label={`Choose ${SLOT_LABEL[slot]}${candidate ? `: ${candidate.name}` : ""}`}
      data-ancestor-identity={density}
      className="group/avatar flex min-h-9 max-w-full flex-col items-center justify-center outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-lg"
    >
      <AncestorPortrait candidate={candidate} className={size} />
      <span className={`mt-1 w-full ${nameWidth} truncate text-center font-bold ${nameSize} text-zinc-800 dark:text-zinc-100 leading-tight transition-colors duration-150 group-hover/avatar:text-emerald-700 dark:group-hover/avatar:text-emerald-400`}>
        {candidate?.name ?? "Select parent"}
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
  geneticIndicator,
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
  geneticIndicator?: ReactNode;
}) {
  if (density === "great-grandparent") {
    return (
      <div className="relative min-w-0 rounded-xl border border-zinc-200/90 bg-white/95 p-1 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/95">
        <div className="flex flex-col items-center justify-center px-1 pb-1 pt-3">
          <AncestorIdentityButton slot={slot} candidate={candidate} density="great-grandparent" onOpenPicker={onOpenPicker} />
        </div>
        <div className="mt-1">
          <ParentingPopover
            label={`${SLOT_LABEL[slot]} Red factor: ${factorGoal.pink ?? (factorGoal.pink === null ? "No factor" : "Not set")}`}
            className="parenting-aptitude-cell flex h-10 w-full min-w-0 items-center justify-center gap-1 rounded-lg border border-pink-300 bg-pink-50/80 px-1.5 text-center font-bold text-[10px] text-pink-900 transition-colors hover:bg-pink-100/90 cursor-pointer dark:border-pink-800 dark:bg-pink-950/25 dark:text-pink-100 dark:hover:bg-pink-900/40 outline-none focus-visible:ring-2 focus-visible:ring-pink-500 shadow-2xs"
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
            <PinkSparkFields
              title="Pink factor (Aptitude spark)"
              value={factorGoal.pink}
              stars={factorGoal.pinkStars}
              onChange={(value, stars) => onFactorGoalChange(withPinkSpark(factorGoal, value, stars))}
            />
          </ParentingPopover>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-w-0">
      <div className="w-full min-w-0 rounded-2xl border border-zinc-200/90 bg-white/95 p-1 pt-3 sm:p-2 sm:pt-4 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/95">
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
        {geneticIndicator}
        <div className="mt-1.5 sm:mt-2 h-10 min-h-10 min-w-0 flex-none">
          {uniqueSkill ? (
            <SkillHoverCard
              skillId={uniqueSkill.id}
              fallbackSkill={uniqueSkill}
              isParentMode
              className="group inline-flex h-full w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-200/90 bg-white/95 px-2 py-1 shadow-2xs transition-colors hover:bg-zinc-50 dark:border-zinc-700/80 dark:bg-zinc-800/95 dark:hover:bg-zinc-700/90"
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
        <div className="mt-1.5 sm:mt-2">
          <ParentingPopover
            label={`${SLOT_LABEL[slot]} Red factor: ${factorGoal.pink ?? (factorGoal.pink === null ? "No factor" : "Not set")}`}
            className="flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border border-pink-300 bg-pink-50/80 px-3 text-center font-bold text-xs text-pink-900 transition-colors cursor-pointer hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-950/25 dark:text-pink-100 dark:hover:bg-pink-900/40 outline-none focus-visible:ring-2 focus-visible:ring-pink-500 shadow-2xs"
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
            <PinkSparkFields
              value={factorGoal.pink}
              stars={factorGoal.pinkStars}
              onChange={(value, stars) => onFactorGoalChange(withPinkSpark(factorGoal, value, stars))}
            />
          </ParentingPopover>
        </div>
        <div className="mt-1.5 sm:mt-2">
          <WhiteGeneticPicker
            label={SLOT_LABEL[slot]}
            assessment={assessment}
            targets={whiteTargets}
            onChange={onWhiteTargetsChange}
          />
        </div>
      </div>
    </div>
  );
}

export function ParentingLoopOptimizer(props: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const measuredTier = usePedigreeTier(containerRef);
  const tier = props.tier ?? measuredTier;
  const [sheetSlot, setSheetSlot] = useState<LoopUmaSlot | null>(null);
  useEffect(() => { if (tier === "desktop") setSheetSlot(null); }, [tier]);
  const ancestorNavigation = useAncestorNavigation({ tier, openSlot: setSheetSlot, closeSheet: () => setSheetSlot(null) });
  const model = usePedigreeModel(props);
  const ancestorContent = (slot: LoopAncestorSlot, density: "parent" | "grandparent" | "great-grandparent" | "great-great-grandparent") => {
    if (density === "great-great-grandparent") return <SparkInput key={slot} slot={slot} goal={model.config.factorGoals?.[slot] ?? {}} onChange={(goal) => model.setFactorGoal(slot, goal)} />;
    const umaSlot = slot as LoopUmaSlot;
    const geneticAssessment = model.geneticAssessment(umaSlot);
    return <AncestorCard geneticIndicator={geneticAssessment ? <GeneticIndicator assessment={geneticAssessment} context={model.minmaxContext} onNavigate={ancestorNavigation.navigate} /> : undefined} key={slot} slot={umaSlot} whiteTargets={model.whiteTargets(umaSlot)} onWhiteTargetsChange={(targets) => model.setWhiteTargets(umaSlot, targets)} sources={model.sparkSources(umaSlot)} assessment={model.assessments[umaSlot]} candidate={model.selectedCandidates[umaSlot]} density={density} factorGoal={model.factorPlan(slot)} uniqueSkill={model.uniqueSkill(umaSlot)} onFactorGoalChange={(goal) => model.setFactorGoal(slot, goal)} onOpenPicker={() => props.onOpenPicker(slot)} />;
  };

  const renderBranch = (parentSlot: "p1" | "p2") => {
    const ancestorCard = (slot: LoopAncestorSlot, density: "parent" | "grandparent" | "great-grandparent" | "great-great-grandparent") => {
      return <AncestorNavTarget key={slot} slot={slot} layout="desktop" navigation={ancestorNavigation}>
        {ancestorContent(slot, density)}
      </AncestorNavTarget>;
    };
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
              <div className="grid grid-cols-2 items-stretch gap-1">{ggpSlots.map((slot) => <div key={slot} className="flex min-w-0 flex-col">
                {ancestorCard(slot, "great-grandparent")}
                <svg data-pedigree-connector="great-grandparent-to-great-great-grandparent" aria-hidden="true" className="pointer-events-none block h-4 w-full text-emerald-700/50 dark:text-emerald-300/50" viewBox="0 0 1000 16" preserveAspectRatio="none"><path d="M500 0V6H250V16M500 6H750V16" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
                <div className="grid grid-cols-2 items-stretch gap-1">{([`${slot}_g1`, `${slot}_g2`] as LoopAncestorSlot[]).map((gggpSlot) => ancestorCard(gggpSlot, "great-great-grandparent"))}</div>
              </div>)}</div>
            </div>
          </div>;
        })}
      </div>
    </section>;
  };

  return <section ref={containerRef} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bold text-zinc-900 dark:text-zinc-100">Parent Planning</h3>
        <p className="text-xs text-zinc-500 mt-1">Set pink sparks below each branch to support its planned aptitude, G1 farming and white genetics.</p></div>
    </header>
    {props.targetStage && <div>{props.targetStage}</div>}
    {!props.target ? <p className="text-sm text-zinc-500">Select a target Uma to build the pedigree.</p> : <>
      <div className="border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800" aria-live="polite">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">Ace genetics: {[model.minmax.target.surface, model.minmax.target.distance, model.minmax.target.style].filter(Boolean).join(" · ") || "Select a course and style"}</p>
      </div>

      <div className={`border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-3 ${tier === "phone" ? "-mx-4" : ""}`}>
        {tier === "desktop"
          ? <div className="relative">
            <svg aria-hidden="true" className="pointer-events-none block h-7 w-full text-emerald-700/50 dark:text-emerald-300/50" viewBox="0 0 1000 28" preserveAspectRatio="none"><path d="M500 0V12H250V28M500 12H750V28" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
            <div className="grid grid-cols-2 gap-1 sm:gap-3">{renderBranch("p1")}{renderBranch("p2")}</div>
          </div>
          : <PedigreeTree tier={tier} model={model} navigation={ancestorNavigation} course={props.course} runningStyle={props.runningStyle} onOpenSheet={setSheetSlot} />}
      </div>
      {tier !== "desktop" && <AncestorSheet slot={sheetSlot} tier={tier} model={model} navigation={ancestorNavigation} onNavigate={setSheetSlot} onChooseUma={(slot) => props.onOpenPicker(slot)} onClose={() => setSheetSlot(null)} />}
    </>}
  </section>;
}
