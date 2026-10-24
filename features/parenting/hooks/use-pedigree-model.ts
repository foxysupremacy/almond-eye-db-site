import { useEffect, useMemo } from "react";
import type { CharacterIndexEntry } from "@/lib/data/types";
import { characters as allCharacters, skillsById, uniqueInheritMap } from "@/lib/data/registry";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import { LOOP_ANCESTOR_SLOTS, LOOP_UMA_SLOTS, evaluateParentingBranch, type AptitudeKey, type BranchAssessment, type FarmAptitude, type LoopUmaSlot, type LoopAncestorSlot, type LoopCandidate, type ParentingLoopConfig, type TargetRank } from "@/lib/parenting/loop-planner";
import type { BranchSparkAssignment } from "@/lib/parenting/spark-suggester";
import type { ParentingSetup } from "@/lib/parenting/state";
import { resolveMinmaxPedigree } from "@/lib/parenting/minmax-context";
import { evaluateParentingMinmax, type ParentingMinmaxAssessment, type ParentingMinmaxContext, type SlotGeneticAssessment } from "@/lib/parenting/minmax";
import type { Course } from "@/lib/skill-engine/types";
import { extractSlotPrimaryFactors } from "@/lib/lineage/factor-decoder";
import type { SparkSource } from "../components/aptitude-controls";
import { SLOT_LABEL } from "../pedigree/pedigree-slots";

export type EditableFactorPlan = { blue?: number | null; blueStars?: number; pink?: AptitudeKey | null; pinkStars?: number };

export function editableFactorPlan(candidate: LoopCandidate | null, saved?: { blue?: number | null; blueStars?: number | null; pink?: AptitudeKey | null; pinkStars?: number | null }): EditableFactorPlan {
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

export interface PedigreeModel {
  config: ParentingLoopConfig;
  selectedCandidates: Record<LoopUmaSlot, LoopCandidate | null>;
  assessments: Record<LoopUmaSlot, BranchAssessment>;
  minmaxContext: ParentingMinmaxContext;
  minmax: ParentingMinmaxAssessment;
  factorPlan(slot: LoopAncestorSlot): EditableFactorPlan;
  sparkSources(slot: LoopUmaSlot): SparkSource[];
  uniqueSkill(slot: LoopUmaSlot): { id: number; nameEn: string; nameJp: string; iconId?: number | null } | undefined;
  whiteTargets(slot: LoopUmaSlot): AptitudeKey[];
  geneticAssessment(slot: LoopUmaSlot): SlotGeneticAssessment | undefined;
  setFactorGoal(slot: LoopAncestorSlot, goal: EditableFactorPlan): void;
  setWhiteTargets(slot: LoopUmaSlot, targets: AptitudeKey[]): void;
  setAptitudeGoal(slot: LoopUmaSlot, aptitude: AptitudeKey, rank: TargetRank | null): void;
  /** Single write for the whole focus set — per-aptitude writes would each
   * start from the same stale config and overwrite each other. */
  setDisabledFarmAptitudes(next: FarmAptitude[]): void;
  applyBranchSparks(assignments: Partial<Record<LoopAncestorSlot, BranchSparkAssignment>>): void;
}

export interface PedigreeModelProps {
  target: CharacterIndexEntry | null;
  veterans: KyumaruVeteranItem[];
  roster: CharacterIndexEntry[];
  setup: ParentingSetup;
  course?: Course | null;
  runningStyle?: number | null;
  updateSetup: (updater: (prev: ParentingSetup) => ParentingSetup) => void;
}

export function usePedigreeModel(props: PedigreeModelProps): PedigreeModel {
  const stored = props.setup.loopConfig;
  const pedigree = useMemo(() => resolveMinmaxPedigree(props.setup, props.veterans, props.roster), [props.setup, props.veterans, props.roster]);
  const config = pedigree.config;
  const selectedCandidates = pedigree.ancestors as Record<LoopUmaSlot, LoopCandidate | null>;
  useEffect(() => {
    if (!stored || !LOOP_ANCESTOR_SLOTS.some((slot) => slot.split("_").length === 4 && stored.selectedSlots[slot] && !config.selectedSlots[slot])) return;
    props.updateSetup((prev) => ({ ...prev, loopConfig: config }));
  }, [stored, config, props.updateSetup]);
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
  const minmaxContext: ParentingMinmaxContext = useMemo(() => ({ ancestors: selectedCandidates, config: plannedConfig, target: props.target, course: props.course, runningStyle: props.runningStyle }), [selectedCandidates, plannedConfig, props.target, props.course, props.runningStyle]);
  const minmax = useMemo(() => evaluateParentingMinmax(minmaxContext), [minmaxContext]);
  const updateConfig = (next: ParentingLoopConfig) => {
    props.updateSetup((prev) => ({ ...prev, loopConfig: next }));
  };
  const setFactorGoal = (slot: LoopAncestorSlot, goal: EditableFactorPlan) => {
    updateConfig({ ...config, factorGoals: { ...config.factorGoals, [slot]: goal } });
  };
  const factorPlan = (slot: LoopAncestorSlot): EditableFactorPlan =>
    slot.split("_").length === 4 ? (config.factorGoals?.[slot] ?? {}) as EditableFactorPlan
      : editableFactorPlan(selectedCandidates[slot as LoopUmaSlot], config.factorGoals?.[slot]);
  const sparkSources = (slot: LoopUmaSlot): SparkSource[] => assessments[slot].sourceSlots.map((sourceSlot) => {
    const plan = editableFactorPlan(selectedCandidates[sourceSlot as LoopUmaSlot] ?? null, config.factorGoals?.[sourceSlot]);
    return { label: SLOT_LABEL[sourceSlot], pink: plan.pink, stars: plan.pinkStars };
  });
  const uniqueSkill = (slot: LoopUmaSlot) => {
    const candidate = selectedCandidates[slot];
    const uniqueId = candidate ? allCharacters.find((character) => character.charId === candidate.charId)?.uniqueSkillId : undefined;
    const inheritedUniqueId = uniqueId == null ? undefined : uniqueInheritMap[String(uniqueId)];
    const skill = (inheritedUniqueId == null ? undefined : skillsById.get(inheritedUniqueId))
      ?? (uniqueId == null ? undefined : skillsById.get(uniqueId));
    return skill ? { id: skill.id, nameEn: skill.nameEn, nameJp: skill.nameJp, iconId: skill.iconId } : undefined;
  };
  const whiteTargets = (slot: LoopUmaSlot) => config.slotWhiteTargets?.[slot] ?? [];
  const geneticAssessment = (slot: LoopUmaSlot) => minmax.slots.find((entry) => entry.slot === slot);
  const setWhiteTargets = (slot: LoopUmaSlot, targets: AptitudeKey[]) =>
    updateConfig({ ...config, slotWhiteTargets: { ...config.slotWhiteTargets, [slot]: targets } });
  const setAptitudeGoal = (slot: LoopUmaSlot, aptitude: AptitudeKey, rank: TargetRank | null) => {
    const goals = { ...config.slotAptitudeGoals?.[slot] };
    if (rank == null) delete goals[aptitude];
    else goals[aptitude] = rank;
    const slotAptitudeGoals = { ...config.slotAptitudeGoals, [slot]: goals };
    if (!Object.keys(goals).length) delete slotAptitudeGoals[slot];
    updateConfig({ ...config, slotAptitudeGoals });
  };
  const setDisabledFarmAptitudes = (next: FarmAptitude[]) => {
    updateConfig({ ...config, disabledFarmAptitudes: [...new Set(next)] });
  };
  const applyBranchSparks = (assignments: Partial<Record<LoopAncestorSlot, BranchSparkAssignment>>) => {
    const factorGoals = { ...config.factorGoals };
    for (const [slot, assignment] of Object.entries(assignments)) {
      const key = slot as LoopAncestorSlot;
      factorGoals[key] = { ...factorGoals[key], pink: assignment.pink, pinkStars: assignment.pinkStars };
    }
    updateConfig({ ...config, factorGoals });
  };

  return { config, selectedCandidates, assessments, minmaxContext, minmax, factorPlan, sparkSources, uniqueSkill, whiteTargets, geneticAssessment, setFactorGoal, setWhiteTargets, setAptitudeGoal, setDisabledFarmAptitudes, applyBranchSparks };
}
