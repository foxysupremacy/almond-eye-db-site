"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "react-aria-components/Button";
import type { AptitudeKey, BranchAssessment, LoopAncestorSlot, LoopCandidate, LoopUmaSlot } from "@/lib/parenting/loop-planner";
import { AptitudeCell, AptitudeName, WhiteGeneticPicker, type SparkSource } from "../components/aptitude-controls";
import { PinkSparkFields, withPinkSpark } from "../components/pink-spark-fields";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import SkillHoverCard from "@/app/common/ui/skills/details/skill-hover-card";
import { GeneticIndicator } from "../components/genetic-indicator";
import { ParentingPopover } from "../components/parenting-popover";
import type { useAncestorNavigation } from "../hooks/use-ancestor-navigation";
import type { PedigreeTier } from "../hooks/use-pedigree-tier";
import { AncestorNavTarget } from "./ancestor-nav-target";
import { SparkInput } from "./pedigree-tree";
import { SLOT_LABEL } from "./pedigree-slots";
import { AncestorPortrait } from "./ancestor-portrait";
import type { EditableFactorPlan, PedigreeModel } from "../hooks/use-pedigree-model";

export function AncestorIdentityButton({
  slot,
  candidate,
  density,
  onOpenPicker,
  isPhone = false,
}: {
  slot: LoopUmaSlot;
  candidate: LoopCandidate | null;
  density: "parent" | "grandparent" | "great-grandparent" | "great-great-grandparent";
  onOpenPicker: () => void;
  isPhone?: boolean;
}) {
  const size = isPhone ? "h-8 w-8 sm:h-9 sm:w-9" : "h-9 w-9 sm:h-10 sm:w-10";

  return (
    <Button
      onPress={onOpenPicker}
      aria-label={`Choose ${SLOT_LABEL[slot]}${candidate ? `: ${candidate.name}` : ""}`}
      data-ancestor-identity={density}
      className="group/avatar flex flex-col items-center justify-center min-h-9 max-w-full outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-lg"
    >
      <AncestorPortrait candidate={candidate} className={size} />
      <span className={`mt-0.5 sm:mt-1 w-full ${isPhone ? "max-w-[64px] text-[7.5px]" : "max-w-[78px] text-[8px] sm:text-[9px]"} truncate text-center font-bold text-zinc-800 dark:text-zinc-100 leading-tight transition-colors duration-150 group-hover/avatar:text-emerald-700 dark:group-hover/avatar:text-emerald-400`}>
        {candidate?.name ?? "Select parent"}
      </span>
    </Button>
  );
}

export function AncestorCard({
  slot,
  candidate,
  density,
  tier = "desktop",
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
  tier?: PedigreeTier;
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
  const isPhone = tier === "phone";

  if (density === "great-grandparent") {
    return (
      <div data-ancestor-tile="great-grandparent" className={`relative min-w-0 ${isPhone ? "p-0.5" : "p-1"}`}>
        <div className={`flex flex-col items-center justify-center ${isPhone ? "px-0.5 pb-0.5 pt-1" : "px-1 pb-1 pt-2"}`}>
          <AncestorIdentityButton slot={slot} candidate={candidate} density="great-grandparent" onOpenPicker={onOpenPicker} isPhone={isPhone} />
        </div>
        <div className="mt-0.5 sm:mt-1">
          <ParentingPopover
            label={`${SLOT_LABEL[slot]} Red factor: ${factorGoal.pink ?? (factorGoal.pink === null ? "No factor" : "Not set")}`}
            className={`parenting-aptitude-cell flex ${isPhone ? "h-6 text-[9px] px-1" : "h-8 text-[10px] px-1.5"} w-full min-w-0 items-center justify-center gap-1 rounded-lg border border-pink-300 bg-pink-50/80 text-center font-bold text-pink-900 transition-colors hover:bg-pink-100/90 cursor-pointer dark:border-pink-800 dark:bg-pink-950/25 dark:text-pink-100 dark:hover:bg-pink-900/40 outline-none focus-visible:ring-2 focus-visible:ring-pink-500 shadow-2xs`}
            trigger={
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 w-full truncate">
                <span className={`${isPhone ? "text-[8.5px]" : "text-[10px]"} font-bold ${factorGoal.pink ? "text-pink-600 dark:text-pink-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                  {factorGoal.pink ? <AptitudeName value={factorGoal.pink} /> : "Aptitude"}
                </span>
                <div className="flex items-center gap-px sm:gap-0.5">
                  {[1, 2, 3].map((star) => (
                    <span
                      key={star}
                      className={`${isPhone ? "text-[8.5px]" : "text-[10px]"} leading-none ${
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

  const cardWidthClass = isPhone
    ? "w-[148px] min-w-[148px] max-w-[148px]"
    : "w-[240px] min-w-[240px] max-w-[240px] sm:w-[280px] sm:min-w-[280px] sm:max-w-[280px]";
  const portraitSize = isPhone ? "h-11 w-11" : "h-14 w-14 sm:h-16 sm:w-16";

  // Unified P & GP card
  return (
    <div className={`relative min-w-0 ${cardWidthClass} flex justify-center`}>
      <div className={`group/card relative ${cardWidthClass} flex flex-col justify-between rounded-xl sm:rounded-2xl border border-zinc-200/90 bg-white/95 shadow-sm transition-all duration-150 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-800/95 overflow-hidden text-center`}>
        <div className={`@container w-full min-w-0 flex flex-col ${isPhone ? "gap-1 p-1 pt-1.5" : "gap-1.5 p-1 pt-2 sm:p-1.5 sm:pt-3"}`}>
          {/* Row 1: Portrait / Avatar (col-span-2) + Surface Aptitudes (Turf & Dirt, col-span-2) */}
          <div className="grid grid-cols-4 justify-items-stretch gap-0.5 sm:gap-1 items-end w-full">
            <div className="col-span-2 flex flex-col items-center justify-center relative">
              <Button
                onPress={onOpenPicker}
                aria-label={`Choose ${SLOT_LABEL[slot]}${candidate ? `: ${candidate.name}` : ""}`}
                data-ancestor-identity={density}
                className="group/avatar flex flex-col items-center justify-center min-h-9 sm:min-h-10 max-w-full outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-lg relative"
              >
                <AncestorPortrait candidate={candidate} className={portraitSize} />
                <span className={`mt-0.5 w-full ${isPhone ? "max-w-[68px] text-[7.5px]" : "max-w-[85px] text-[8.5px] sm:text-[9.5px]"} truncate text-center font-bold text-zinc-800 dark:text-zinc-100 leading-tight transition-colors duration-150 group-hover/avatar:text-emerald-700 dark:group-hover/avatar:text-emerald-400`}>
                  {candidate?.name ?? "Select parent"}
                </span>
                {geneticIndicator && (
                  <div className="absolute -top-1 -right-1 z-20">
                    {geneticIndicator}
                  </div>
                )}
              </Button>
            </div>
            <div data-aptitude-group="Surface" className="col-span-2 grid grid-cols-2 gap-0.5 sm:gap-1">
              <AptitudeCell aptitude="Turf" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
              <AptitudeCell aptitude="Dirt" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            </div>
          </div>

          {/* Row 2: Distance Aptitudes (Sprint, Mile, Medium, Long) */}
          <div data-aptitude-group="Distance" className="grid w-full grid-cols-4 justify-items-stretch gap-0.5 sm:gap-1">
            <AptitudeCell aptitude="Sprint" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Mile" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Medium" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Long" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
          </div>

          {/* Row 3: Running Style Aptitudes (Runner, Leader, Betweener, Chaser) */}
          <div data-aptitude-group="Style" className="grid w-full grid-cols-4 justify-items-stretch gap-0.5 sm:gap-1">
            <AptitudeCell aptitude="Runner" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Leader" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Betweener" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
            <AptitudeCell aptitude="Chaser" assessment={assessment} label={SLOT_LABEL[slot]} sources={sources} compactCell />
          </div>

          {/* Row 4: Pink Factor Pill */}
          <div>
            <ParentingPopover
              label={`${SLOT_LABEL[slot]} Red factor: ${factorGoal.pink ?? (factorGoal.pink === null ? "No factor" : "Not set")}`}
              className={`flex ${isPhone ? "h-6 sm:h-7" : "h-7 sm:h-8.5"} w-full min-w-0 items-center justify-center gap-1 sm:gap-1.5 rounded-lg border border-pink-300 bg-pink-50/80 px-1 sm:px-2.5 text-center font-bold text-[9px] sm:text-[11px] text-pink-900 transition-colors cursor-pointer hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-950/25 dark:text-pink-100 dark:hover:bg-pink-900/40 outline-none focus-visible:ring-2 focus-visible:ring-pink-500 shadow-2xs`}
              trigger={
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 w-full">
                  <span className="text-[9px] sm:text-[11px] font-bold text-pink-700 dark:text-pink-300 truncate">
                    {factorGoal.pink ? <AptitudeName value={factorGoal.pink} /> : "Aptitude"}
                  </span>
                  <div className="flex items-center gap-px sm:gap-0.5 flex-none">
                    {[1, 2, 3].map((star) => (
                      <span
                        key={star}
                        className={`text-[9.5px] sm:text-[12px] leading-none ${
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

          {/* Row 5: Unique Skill */}
          <div className={`${isPhone ? "h-6 min-h-6" : "h-7 sm:h-8 min-h-7 sm:min-h-8"} w-full min-w-0 flex-none`}>
            {uniqueSkill ? (
              <SkillHoverCard
                skillId={uniqueSkill.id}
                fallbackSkill={uniqueSkill}
                isParentMode
                className="group inline-flex h-full w-full min-w-0 cursor-pointer items-center justify-center gap-1 sm:gap-1.5 rounded-lg border border-zinc-200/90 bg-white/95 px-2 py-0.5 shadow-2xs transition-colors hover:bg-zinc-50 dark:border-zinc-700/80 dark:bg-zinc-800/95 dark:hover:bg-zinc-700/90"
              >
                <SkillIcon iconId={uniqueSkill.iconId} name={uniqueSkill.nameEn} className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-none object-contain drop-shadow-2xs" />
                <span className={`truncate ${isPhone ? "text-[8px]" : "text-[9px] sm:text-[10px]"} font-semibold leading-tight text-zinc-900 transition-colors group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400`}>
                  {uniqueSkill.nameEn}
                </span>
              </SkillHoverCard>
            ) : (
              <div aria-hidden="true" className="h-8 w-full">
                <div className="h-full w-full flex items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700/60 bg-zinc-50/50 dark:bg-zinc-800/30 text-[8px] sm:text-[9px] text-zinc-400 dark:text-zinc-500">
                  <span>No unique skill</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card Footer: White Genetics Picker with Medal Icon */}
        <WhiteGeneticPicker
          label={SLOT_LABEL[slot]}
          assessment={assessment}
          targets={whiteTargets}
          onChange={onWhiteTargetsChange}
          footerMode
        />
      </div>
    </div>
  );
}

export const PEDIGREE_ZOOM_STORAGE_KEY = "almond_pedigree_zoom";

export function AutoFitPedigreeTree({ children, tier = "desktop" }: { children: ReactNode; tier?: PedigreeTier }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [userZoom, setUserZoom] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

  const isPhone = tier === "phone";
  // Minimum reference width for 2 branches:
  // On phone (~148px card * 4 cols + gaps + borders) ≈ 660px
  // On tablet/desktop (~280px card * 4 cols + gaps + borders) ≈ 1180px
  const BASE_WIDTH = isPhone ? 660 : 1180;
  // Keep scale legible on small devices: do not shrink below 0.70x on phone or 0.72x on desktop
  const MIN_SCALE = isPhone ? 0.70 : 0.72;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PEDIGREE_ZOOM_STORAGE_KEY);
      if (stored !== null) {
        const val = parseFloat(stored);
        if (!isNaN(val) && val >= 0.45 && val <= 1.5) {
          setUserZoom(val);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer || typeof ResizeObserver === "undefined") return;

    const updateScale = () => {
      const containerWidth = outer.clientWidth;
      if (containerWidth > 0 && containerWidth < BASE_WIDTH) {
        const rawScale = containerWidth / BASE_WIDTH;
        const effectiveScale = Math.max(MIN_SCALE, rawScale);
        setBaseScale(effectiveScale);
      } else {
        setBaseScale(1);
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [BASE_WIDTH, MIN_SCALE]);

  const effectiveScale = Math.round(baseScale * userZoom * 100) / 100;

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    if (effectiveScale < 1 || userZoom !== 1) {
      setScaledHeight(inner.scrollHeight * effectiveScale);
    } else {
      setScaledHeight(undefined);
    }
  }, [effectiveScale, userZoom]);

  const saveZoom = (next: number) => {
    setUserZoom(next);
    try {
      localStorage.setItem(PEDIGREE_ZOOM_STORAGE_KEY, String(next));
    } catch {}
  };

  const handleZoomIn = () => {
    saveZoom(Math.min(1.5, Math.round((userZoom + 0.1) * 10) / 10));
  };

  const handleZoomOut = () => {
    saveZoom(Math.max(0.45, Math.round((userZoom - 0.1) * 10) / 10));
  };

  const handleResetZoom = () => {
    saveZoom(1);
  };

  return (
    <div className="relative w-full">
      {/* Zoom Controls Toolbar */}
      <div className="flex items-center justify-end pb-2 px-1">
        <div
          role="toolbar"
          aria-label="Pedigree zoom controls"
          className="inline-flex items-center gap-1 rounded-full border border-zinc-200/90 bg-white/90 p-1 shadow-2xs backdrop-blur-xs dark:border-zinc-700/80 dark:bg-zinc-800/90"
        >
          <Button
            onPress={handleZoomOut}
            aria-label="Zoom out"
            isDisabled={userZoom <= 0.45}
            className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </Button>

          <Button
            onPress={handleResetZoom}
            aria-label={`Current zoom ${Math.round(effectiveScale * 100)}%, click to reset`}
            className="min-w-[42px] px-1.5 py-0.5 text-center text-[10px] font-bold text-zinc-700 transition-colors hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-zinc-200 dark:hover:text-emerald-400 cursor-pointer"
          >
            {Math.round(effectiveScale * 100)}%
          </Button>

          <Button
            onPress={handleZoomIn}
            aria-label="Zoom in"
            isDisabled={userZoom >= 1.5}
            className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Button>
        </div>
      </div>

      <div
        ref={outerRef}
        className="relative w-full overflow-x-auto overflow-y-hidden scrollbar-thin pb-2"
        style={scaledHeight ? { height: `${scaledHeight + 10}px` } : undefined}
      >
        <div
          style={effectiveScale < 1 || userZoom !== 1 ? { width: `${BASE_WIDTH * effectiveScale}px`, minWidth: `${BASE_WIDTH * effectiveScale}px` } : undefined}
          className="mx-auto"
        >
          <div
            ref={innerRef}
            data-pedigree-autofit="true"
            className="mx-auto transition-transform origin-top duration-75"
            style={{
              width: `${BASE_WIDTH}px`,
              maxWidth: `${BASE_WIDTH}px`,
              minWidth: `${BASE_WIDTH}px`,
              ...(effectiveScale !== 1 ? {
                transform: `scale(${effectiveScale})`,
                transformOrigin: "top left",
              } : {}),
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ParentPedigreeCanvasProps {
  model: PedigreeModel;
  navigation: ReturnType<typeof useAncestorNavigation>;
  tier: PedigreeTier;
  onOpenPicker: (slot: LoopAncestorSlot) => void;
}

/**
 * Dedicated pedigree canvas for rendering the 2-branch parent and ancestor tree.
 * Encapsulates responsive scaling, SVG tree connectors, and individual ancestor cards.
 */
export function ParentPedigreeCanvas({
  model,
  navigation,
  tier,
  onOpenPicker,
}: ParentPedigreeCanvasProps) {
  const isPhone = tier === "phone";
  const cardWidthClass = isPhone
    ? "w-[148px] max-w-[148px]"
    : "w-[240px] max-w-[240px] sm:w-[280px] sm:max-w-[280px]";

  const ancestorContent = (
    slot: LoopAncestorSlot,
    density: "parent" | "grandparent" | "great-grandparent" | "great-great-grandparent"
  ) => {
    if (density === "great-great-grandparent") {
      return (
        <SparkInput
          key={slot}
          slot={slot}
          compact={isPhone}
          goal={model.config.factorGoals?.[slot] ?? {}}
          onChange={(goal) => model.setFactorGoal(slot, goal)}
        />
      );
    }
    const umaSlot = slot as LoopUmaSlot;
    const geneticAssessment = model.geneticAssessment(umaSlot);
    return (
      <AncestorCard
        key={slot}
        slot={umaSlot}
        density={density}
        tier={tier}
        candidate={model.selectedCandidates[umaSlot]}
        assessment={model.assessments[umaSlot]}
        factorGoal={model.factorPlan(slot)}
        uniqueSkill={model.uniqueSkill(umaSlot)}
        sources={model.sparkSources(umaSlot)}
        whiteTargets={model.whiteTargets(umaSlot)}
        onWhiteTargetsChange={(targets) => model.setWhiteTargets(umaSlot, targets)}
        onFactorGoalChange={(goal) => model.setFactorGoal(slot, goal)}
        onOpenPicker={() => onOpenPicker(slot)}
        geneticIndicator={
          geneticAssessment ? (
            <GeneticIndicator
              compactBadge
              assessment={geneticAssessment}
              context={model.minmaxContext}
              onNavigate={navigation.navigate}
            />
          ) : undefined
        }
      />
    );
  };

  const renderBranch = (parentSlot: "p1" | "p2") => {
    const ancestorCard = (
      slot: LoopAncestorSlot,
      density: "parent" | "grandparent" | "great-grandparent" | "great-great-grandparent"
    ) => {
      const isCard = density === "parent" || density === "grandparent";
      return (
        <AncestorNavTarget
          key={slot}
          slot={slot}
          layout={tier}
          navigation={navigation}
          className={isCard ? `${cardWidthClass} flex justify-center` : "w-full"}
        >
          {ancestorContent(slot, density)}
        </AncestorNavTarget>
      );
    };

    const gpSlots =
      parentSlot === "p1"
        ? (["p1_gp1", "p1_gp2"] as const)
        : (["p2_gp1", "p2_gp2"] as const);

    return (
      <section
        key={parentSlot}
        aria-label={`${parentSlot.toUpperCase()} lineage branch`}
        className={`min-w-0 ${isPhone ? "px-1" : "sm:px-3"} ${parentSlot === "p2" ? "sm:border-l sm:border-zinc-200/70 dark:sm:border-zinc-800" : ""}`}
      >
        <div className="w-full flex justify-center pb-1">
          <div className={`${cardWidthClass} min-w-0 flex justify-center px-1`}>
            {ancestorCard(parentSlot, "parent")}
          </div>
        </div>
        <svg
          data-pedigree-connector="parent-to-grandparent"
          aria-hidden="true"
          className="pointer-events-none block h-5 sm:h-6 w-full text-emerald-700/50 dark:text-emerald-300/50"
          viewBox="0 0 1000 24"
          preserveAspectRatio="none"
        >
          <path
            d="M500 0V10H250V24M500 10H750V24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="grid grid-cols-2 items-stretch gap-0.5 sm:gap-0">
          {gpSlots.map((gpSlot, gpIndex) => {
            const ggpSlots = gpSlot.endsWith("gp1")
              ? ([`${parentSlot}_gp1_g1`, `${parentSlot}_gp1_g2`] as const)
              : ([`${parentSlot}_gp2_g1`, `${parentSlot}_gp2_g2`] as const);
            return (
              <div
                key={gpSlot}
                className={`flex min-w-0 flex-col ${isPhone ? "px-0.5" : "sm:px-2"} ${gpIndex === 1 ? "sm:border-l sm:border-zinc-200/70 dark:sm:border-zinc-800" : ""}`}
              >
                <div className="w-full flex justify-center">
                  <div className={`${cardWidthClass} flex justify-center`}>
                    {ancestorCard(gpSlot, "grandparent")}
                  </div>
                </div>
                <div className="mt-1">
                  <svg
                    data-pedigree-connector="grandparent-to-great-grandparent"
                    aria-hidden="true"
                    className="pointer-events-none block h-3.5 sm:h-4 w-full text-emerald-700/50 dark:text-emerald-300/50"
                    viewBox="0 0 1000 16"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M500 0V6H250V16M500 6H750V16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <div className="grid grid-cols-2 items-stretch gap-0.5 sm:gap-1">
                    {ggpSlots.map((slot) => (
                      <div key={slot} className="flex min-w-0 flex-col">
                        {ancestorCard(slot, "great-grandparent")}
                        <svg
                          data-pedigree-connector="great-grandparent-to-great-great-grandparent"
                          aria-hidden="true"
                          className="pointer-events-none block h-3.5 sm:h-4 w-full text-emerald-700/50 dark:text-emerald-300/50"
                          viewBox="0 0 1000 16"
                          preserveAspectRatio="none"
                        >
                          <path
                            d="M500 0V6H250V16M500 6H750V16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                        <div className="grid grid-cols-2 items-stretch gap-0.5 sm:gap-1">
                          {([`${slot}_g1`, `${slot}_g2`] as LoopAncestorSlot[]).map((gggpSlot) =>
                            ancestorCard(gggpSlot, "great-great-grandparent")
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <AutoFitPedigreeTree tier={tier}>
      <div className="relative">
        <svg
          aria-hidden="true"
          className="pointer-events-none block h-6 sm:h-7 w-full text-emerald-700/50 dark:text-emerald-300/50"
          viewBox="0 0 1000 28"
          preserveAspectRatio="none"
        >
          <path
            d="M500 0V12H250V28M500 12H750V28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="grid grid-cols-2 gap-0.5 sm:gap-0">
          {renderBranch("p1")}
          {renderBranch("p2")}
        </div>
      </div>
    </AutoFitPedigreeTree>
  );
}
