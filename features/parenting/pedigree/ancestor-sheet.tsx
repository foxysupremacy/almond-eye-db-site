"use client";

import { useEffect, useRef } from "react";
import { MobileSheet } from "@/app/common/ui/controls/mobile-sheet";
import { AppButton } from "@/app/common/ui/controls/app-button";
import SkillHoverCard from "@/app/common/ui/skills/details/skill-hover-card";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import { charactersByCharId, charactersById } from "@/lib/data/registry";
import type { LoopAncestorSlot, LoopUmaSlot } from "@/lib/parenting/loop-planner";
import { AptitudeTable, WhiteGeneticPicker } from "../components/aptitude-controls";
import { PinkSparkFields, withPinkSpark } from "../components/pink-spark-fields";
import { GeneticDetails } from "../components/genetic-indicator";
import { GENETIC_TONE_CLASS, geneticStatus } from "../components/genetic-status";
import { AlertTriangleIcon, CheckIcon } from "@/app/common/ui/primitives/icons";
import { ancestorTitle } from "../components/ancestor-label";
import type { PedigreeModel } from "../hooks/use-pedigree-model";
import { AncestorNavTarget, type AncestorNavigationTarget } from "./ancestor-nav-target";
import { AncestorPortrait } from "./ancestor-portrait";
import { SLOT_LABEL, childSlots, parentSlot, siblingSlot, slotGeneration } from "./pedigree-slots";

const SECTION = "border-t border-zinc-100 py-3 first:border-t-0 first:pt-0 dark:border-zinc-800";

export function AncestorSheet({ slot, tier, model, navigation, onNavigate, onChooseUma, onClose }: {
  slot: LoopUmaSlot | null; tier: "phone" | "tablet"; model: PedigreeModel;
  navigation: AncestorNavigationTarget & { navigate: (slot: LoopAncestorSlot) => void };
  onNavigate: (slot: LoopUmaSlot) => void; onChooseUma: (slot: LoopUmaSlot) => void; onClose: () => void;
}) {
  const bodyRef = useRef<HTMLElement>(null);
  useEffect(() => { const body = bodyRef.current?.closest<HTMLElement>(".overflow-y-auto"); if (body) body.scrollTop = 0; }, [slot]);
  if (!slot) return null;
  const candidate = model.selectedCandidates[slot];
  const nameJp = candidate ? (charactersById.get(candidate.cardId) ?? charactersByCharId.get(candidate.charId))?.nameJp : undefined;
  const plan = model.factorPlan(slot);
  const unique = model.uniqueSkill(slot);
  const genetic = model.geneticAssessment(slot);
  const generation = slotGeneration(slot);
  const inlineChildren = generation === "great-grandparent" && tier === "phone";
  const firstChild = generation === "great-grandparent" ? null : childSlots(slot)[0] as LoopUmaSlot;
  const status = genetic ? geneticStatus(genetic, model.minmaxContext) : null;
  const StatusIcon = status?.alert ? AlertTriangleIcon : CheckIcon;
  const nav = (target: LoopUmaSlot | null, glyph: string, missing: string, after = false) => target
    ? <AppButton variant="quiet" aria-label={`Go to ${ancestorTitle(target)}`} onPress={() => onNavigate(target)} className="min-h-11 flex-1 md:min-h-11">{after ? `${SLOT_LABEL[target]} ${glyph}` : `${glyph} ${SLOT_LABEL[target]}`}</AppButton>
    : <AppButton variant="quiet" isDisabled aria-label={missing} className="min-h-11 flex-1 md:min-h-11"><span aria-hidden="true">{glyph}</span></AppButton>;

  return <MobileSheet open onClose={onClose} title={ancestorTitle(slot)} placement={tier === "tablet" ? "side" : "bottom"}
    footer={<div className="flex gap-2">{nav(siblingSlot(slot) as LoopUmaSlot, "◀", "No sibling")}{nav(parentSlot(slot) as LoopUmaSlot | null, "↑", "No parent")}{nav(firstChild, "▶", "No child", true)}</div>}>
    <section ref={bodyRef} className={SECTION}>
      <div className="flex items-center gap-3 pt-2">
        <AncestorPortrait candidate={candidate} className="h-16 w-16" emptyLabel="Add" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{candidate?.name ?? "No uma chosen"}</p>
          {nameJp && <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-500">{nameJp}</p>}
        </div>
        <AppButton variant="secondary" size="md" onPress={() => onChooseUma(slot)} className="min-h-11 md:min-h-11">{candidate ? "Change" : "Choose uma"}</AppButton>
      </div>
    </section>
    <section className={SECTION}><p className="mb-1 text-xs font-semibold text-zinc-500">Aptitudes (projected)</p>
      <AptitudeTable assessment={model.assessments[slot]} label={SLOT_LABEL[slot]} sources={model.sparkSources(slot)} pinkFactor={plan.pink} /></section>
    {genetic && status && <section className={SECTION}>
      <p data-testid="sheet-genetic-status" className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${GENETIC_TONE_CLASS[status.tone]}`}><StatusIcon className="h-3.5 w-3.5 shrink-0" />{status.text}</p>
      <GeneticDetails assessment={genetic} context={model.minmaxContext} onNavigate={navigation.navigate} /></section>}
    {unique && <section className={SECTION}>
      <SkillHoverCard skillId={unique.id} fallbackSkill={unique} isParentMode className="group inline-flex min-w-0 cursor-pointer items-center gap-2.5">
        <SkillIcon iconId={unique.iconId} name={unique.nameEn} className="h-7 w-7 flex-none object-contain" />
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{unique.nameEn}</p>{unique.nameJp && <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-500">{unique.nameJp}</p>}</div>
      </SkillHoverCard></section>}
    <section className={SECTION} role="group" aria-label={`${SLOT_LABEL[slot]} pink spark`}><PinkSparkFields value={plan.pink} stars={plan.pinkStars} onChange={(v, s) => model.setFactorGoal(slot, withPinkSpark(plan, v, s))} /></section>
    {generation !== "great-grandparent" && <section className={SECTION}>
      <WhiteGeneticPicker label={SLOT_LABEL[slot]} assessment={model.assessments[slot]} targets={model.whiteTargets(slot)} onChange={(t) => model.setWhiteTargets(slot, t)} /></section>}
    {inlineChildren && childSlots(slot).map((child) => {
      const childPlan = model.factorPlan(child);
      return <AncestorNavTarget key={child} slot={child} layout="sheet" navigation={navigation} className={SECTION}>
        <div role="group" aria-label={`${SLOT_LABEL[child]} pink spark input`}>
          <PinkSparkFields title={ancestorTitle(child)} value={childPlan.pink} stars={childPlan.pinkStars} onChange={(v, s) => model.setFactorGoal(child, withPinkSpark(childPlan, v, s))} />
        </div>
      </AncestorNavTarget>;
    })}
  </MobileSheet>;
}
