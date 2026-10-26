"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import type { RunningStyle } from "@/lib/deck/types";
import {
  dynamicConditionKeys,
  isUniqueSkill,
  simulationInputFor,
  type RaceImpactProfile,
  type SkillScore,
} from "@/lib/race-impact";
import type { Course, RaceParameters } from "@/lib/skill-engine/types";
import type { SkillZoneResult } from "@/lib/skill-engine/zones";
import type { SkillDetail } from "@/lib/data/types";
import { useRaceImpactProfile } from "@/app/common/hooks/use-race-impact-profile";
import { useTier } from "@/app/common/hooks/use-tier";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { AppDisclosure } from "@/app/common/ui/controls/app-disclosure";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { XIcon } from "@/app/common/ui/primitives/icons";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import { ActivationStrip, GainPositionChart, phaseBandsForCourse, SpeedTimeChart } from "./charts";
import { ConditionBlocks } from "./condition-blocks";
import { EffectBlocks } from "./effect-blocks";
import { LevelStepper } from "./level-stepper";
import { ModelAssumptions, SummaryRow } from "./model-assumptions";
import { RaceImpactProfilePanel } from "./race-impact-profile-panel";
import { useSkillEffect } from "./use-skill-effect";

export interface RailOption {
  skillId: number;
  nameEn: string;
  nameJp: string;
  iconId: number | null;
  bashin: number;
  best: boolean;
  badge?: "Banned" | "Weaker than base" | "Partially modeled" | "Not modeled";
}
export interface RailSlot { label: "Unique" | "Evolution 1" | "Evolution 2" | "Evolution 3"; options: RailOption[] }
export interface SkillEffectRail {
  portraitUrl: string;
  characterName: string;
  slots: RailSlot[];
  /** `slot3` is set only for the few costumes with an Evolution 3 slot. */
  totals: { unique: number; slot1: number; slot2: number; slot3?: number; total: number };
}
export interface SkillEffectDetailsModalProps {
  open: boolean;
  onClose(): void;
  course: Course;
  raceParams: Partial<RaceParameters>;
  racerCount: number;
  style: RunningStyle;
  venueLabel: string;
  focusSkillId: number;
  rail?: SkillEffectRail;
}

const TRACK_BONUS = /track_id>=10001&track_id<=10010/;

/** Why a condition group cannot fire on this course (spec §3.6). */
export function inactiveReasonFor(group: { condition?: string | null; precondition?: string | null }): string {
  const text = `${group.condition ?? ""}&${group.precondition ?? ""}`;
  if (TRACK_BONUS.test(text)) return "Track bonus: Japanese tracks only";
  if (/ground_type==1/.test(text)) return "Turf only";
  if (/ground_type==2/.test(text)) return "Dirt only";
  if (/running_style/.test(text)) return "Different running style";
  return "Conditions not met on this course";
}

function inactiveReasonsFor(skill: SkillDetail, allZones: SkillZoneResult[], activeIndex: number | null): Record<number, string> {
  const out: Record<number, string> = {};
  (skill.conditionGroups ?? []).forEach((group, index) => {
    if (index === activeIndex) return;
    if (allZones[index] && allZones[index].regions.length > 0) return;
    out[index] = inactiveReasonFor(group);
  });
  return out;
}

const fmtBashin = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
/**
 * R32: scores assume the skill activates. A rate below 1 has three causes, told apart so a map fact is never
 * blamed on the user's settings: a No-Debuffs ban, no group able to fire on this map / style (scoreSkill returns
 * no group), or a situational override the user set in the profile.
 */
export function activationLabel(
  score: Pick<SkillScore, "activationRate" | "banned" | "groupIndex">,
  dynamicOverrides: RaceImpactProfile["dynamicOverrides"],
): string {
  if (score.banned) return "Banned in this event";
  if (score.groupIndex == null) return "Cannot activate on this map / style";
  if (score.activationRate < 1 && Object.keys(dynamicOverrides).length > 0) return `${pct(score.activationRate)} (your situational override)`;
  return "Assumed to activate";
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{children}</h3>;
}

function RailOptionLabel({ option, descId }: { option: RailOption; descId: string }) {
  const primary = option.nameEn || option.nameJp;
  const secondary = option.nameJp && option.nameJp !== primary ? option.nameJp : null;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <SkillIcon iconId={option.iconId} name={primary} className="h-6 w-6 flex-none shrink-0 object-contain" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{primary}</span>
        {secondary ? <span className="mt-0.5 truncate text-[10px] text-zinc-400 dark:text-zinc-500">{secondary}</span> : null}
        {option.badge ? <span id={`${descId}-badge`} className="mt-0.5 truncate text-[10px] text-amber-700 dark:text-amber-400">{option.badge}</span> : null}
      </span>
      <span id={`${descId}-gain`} className="flex-none text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
        {fmtBashin(option.bashin)}{option.best ? <span className="ml-1 text-emerald-700 dark:text-emerald-400">Best</span> : null}
      </span>
    </span>
  );
}

function RailButton({ option, pressed, onSelect }: { option: RailOption; pressed: boolean; onSelect(id: number): void }) {
  const descId = useId();
  const describedBy = [`${descId}-gain`, option.badge ? `${descId}-badge` : null].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={option.nameEn || option.nameJp}
      aria-describedby={describedBy}
      onClick={() => onSelect(option.skillId)}
      className={`w-full rounded-md px-1.5 py-1.5 text-left transition-colors duration-150 ${pressed ? "bg-emerald-50 dark:bg-emerald-950/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}
    >
      <RailOptionLabel option={option} descId={descId} />
    </button>
  );
}

function Rail({ rail, focused, onSelect }: { rail: SkillEffectRail; focused: number; onSelect(id: number): void }) {
  return (
    <aside aria-label="Skill choices" className="min-h-0 overflow-y-auto overscroll-contain border-zinc-100 px-3 py-4 sm:border-r dark:border-zinc-800">
      <div className="flex items-center gap-2 pb-3">
        {rail.portraitUrl ? <img src={rail.portraitUrl} alt="" className="h-10 w-10 flex-none shrink-0 rounded-full object-cover" /> : null}
        <span className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{rail.characterName}</span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {rail.slots.map((slot) => (
          <section key={slot.label} aria-label={slot.label} className="py-2">
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{slot.label}</h3>
            {slot.options.length === 0 ? (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">No options</p>
            ) : (
              <ul className="flex flex-col">
                {slot.options.map((option) => (
                  <li key={option.skillId}>
                    <RailButton option={option} pressed={option.skillId === focused} onSelect={onSelect} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}

function ChipRow({ rail, focused, onSelect }: { rail: SkillEffectRail; focused: number; onSelect(id: number): void }) {
  const options = rail.slots.flatMap((slot) => slot.options.map((option) => ({ slot: slot.label, option })));
  return (
    <ul aria-label="Skill options" className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-zinc-100 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      {options.map(({ slot, option }) => (
        <li key={`${slot}-${option.skillId}`} className="flex-none">
          <button
            type="button"
            aria-pressed={option.skillId === focused}
            aria-label={option.nameEn || option.nameJp}
            onClick={() => onSelect(option.skillId)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-150 ${option.skillId === focused ? "border-emerald-500 text-emerald-800 dark:text-emerald-300" : "border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"}`}
          >
            <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500">{slot}</span>
            <span className="max-w-40 truncate">{option.nameEn || option.nameJp}</span>
            <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{fmtBashin(option.bashin)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SkeletonBlocks() {
  return (
    <div aria-busy="true" aria-label="Loading skill effect" className="flex flex-col gap-4">
      <div className="h-40 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-36 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-6 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-20 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export function SkillEffectDetailsModal(props: SkillEffectDetailsModalProps) {
  const { open, onClose, course, racerCount, style, venueLabel, focusSkillId, rail } = props;
  // One phone breakpoint across the app (<640, shared with Rankings).
  const isDesktop = useTier() !== "phone";
  const [focused, setFocused] = useState(focusSkillId);
  const [level, setLevel] = useState(1);
  // Each open (or a new focusSkillId) starts a fresh session: back to the requested skill at Lv1.
  // Adjusted during render so the stale skill is never fetched or painted.
  const [session, setSession] = useState({ open, focusSkillId });
  if (session.open !== open || session.focusSkillId !== focusSkillId) {
    setSession({ open, focusSkillId });
    if (open) {
      setFocused(focusSkillId);
      setLevel(1);
    }
  }

  // useSkillEffect memoizes on object identity; keep raceParams stable across re-renders.
  const raceKey = JSON.stringify(props.raceParams);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const raceParams = useMemo(() => props.raceParams, [raceKey]);

  // Shared, value-cached profile: an edit saves once and every consumer recomputes once.
  const [profile, onProfileChange] = useRaceImpactProfile();

  const effect = useSkillEffect({ skillId: open ? focused : null, course, raceParams, style, racerCount, profile, level });
  const { skill, score, lv1Score, trace, resolvedIndex, allZones } = effect;
  const isUnique = skill ? isUniqueSkill(skill) : false;

  const bands = useMemo(() => phaseBandsForCourse(course.length, simulationInputFor(course, profile, style, raceParams.groundCondition).spurt), [course, profile, style, raceParams.groundCondition]);
  const dynamicKeys = useMemo(() => Array.from(new Set(
    (skill?.conditionGroups ?? [])
      .flatMap((group) => dynamicConditionKeys(group.condition, group.precondition))
      .filter((key) => key !== "other_skill"),
  )), [skill]);
  const inactiveReasons = useMemo(() => (skill ? inactiveReasonsFor(skill, allZones, resolvedIndex) : {}), [skill, allZones, resolvedIndex]);

  const gainSamples = useMemo(() => (score?.samples ?? []).map((s) => ({ meter: s.meter, bashin: s.bashin })), [score]);
  const activationSamples = useMemo(() => (score?.samples ?? []).map((s) => ({ meter: s.meter })), [score]);
  const bestMeter = useMemo(() => {
    if (!gainSamples.length) return null;
    return gainSamples.reduce((best, s) => (s.bashin > best.bashin ? s : best)).meter;
  }, [gainSamples]);
  const deltaBashin = isUnique && level > 1 && score && lv1Score ? score.expectedBashin - lv1Score.expectedBashin : null;

  const ownerName = rail?.characterName ?? null;
  // R18: the header is stable while switching skills; the skill section carries the name. The dialog's
  // accessible name still identifies the skill.
  const title = `Skill effect · ${venueLabel}`;
  const skillName = skill ? (skill.nameEn || skill.nameJp) : null;
  const ariaLabel = skillName ? `${skillName} skill effect` : title;

  let content: ReactNode;
  if (effect.status === "error") {
    content = (
      <div role="alert" className="flex flex-col items-start gap-2 py-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{effect.errorMessage}</p>
        {effect.errorKind === "fetch" ? <AppButton variant="secondary" onPress={effect.retry}>Retry</AppButton> : null}
      </div>
    );
  } else if (!skill) {
    // On a rail switch the previous skill stays visible while the next loads; only open/close blanks it.
    // The loading visual itself is the always-mounted LoadingAnimation rendered next to {content}.
    content = null;
  } else {
    content = (
      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/80 [&>section]:py-4 [&>section:first-child]:pt-0">
        <section aria-label="Charts" className="flex flex-col gap-4">
          {trace ? <SpeedTimeChart trace={trace} /> : <p className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">No modeled effect on this course</p>}
          <GainPositionChart courseLength={course.length} samples={gainSamples} bands={bands} bestMeter={bestMeter} />
          <ActivationStrip courseLength={course.length} samples={activationSamples} bands={bands} />
        </section>

        <section aria-label="Skill">
          <div className="flex items-center gap-3">
            <SkillIcon iconId={skill.iconId} name={skill.nameEn} className="h-10 w-10 flex-none shrink-0 object-contain" />
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <span className="truncate text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-100">{skill.nameEn || skill.nameJp}</span>
              {skill.nameJp && skill.nameJp !== skill.nameEn ? (
                <span className="mt-0.5 truncate text-xs leading-tight text-zinc-400 dark:text-zinc-500">{skill.nameJp}</span>
              ) : null}
            </div>
          </div>
          {ownerName ? <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{ownerName}</p> : null}
          {skill.descEn ? <p className="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">{skill.descEn}</p> : null}
        </section>

        <section aria-label="Summary">
          <SectionTitle>Summary</SectionTitle>
          {score ? (
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              <SummaryRow label="Expected gain" value={`${fmtBashin(score.expectedBashin)} Bashin`} />
              <SummaryRow label="Gain when it fires" value={`${fmtBashin(score.meanBashin)} Bashin`} />
              <SummaryRow label="Range" value={`${score.minBashin.toFixed(2)} – ${score.maxBashin.toFixed(2)} Bashin`} />
              <SummaryRow label="Activation" value={activationLabel(score, profile.dynamicOverrides)} />
              <SummaryRow label="Useful chance" value={pct(score.usefulRate)} />
              {score.recoveryHpPercent != null ? <SummaryRow label="Recovery" value={`${score.recoveryHpPercent.toFixed(2)}% HP`} /> : null}
              {score.physicsStatus === "partial" || score.physicsStatus === "not-modeled" ? (
                <SummaryRow label="Model" value={score.physicsStatus === "partial" ? "Partially modeled" : "Not modeled"} />
              ) : null}
            </dl>
          ) : null}
        </section>

        {rail ? (
          <section aria-label="Overall performance">
            <SectionTitle>Overall performance</SectionTitle>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              <SummaryRow label="Unique" value={`${fmtBashin(rail.totals.unique)} Bashin`} />
              <SummaryRow label="Evolution 1" value={`${fmtBashin(rail.totals.slot1)} Bashin`} />
              <SummaryRow label="Evolution 2" value={`${fmtBashin(rail.totals.slot2)} Bashin`} />
              {rail.totals.slot3 != null ? <SummaryRow label="Evolution 3" value={`${fmtBashin(rail.totals.slot3)} Bashin`} /> : null}
              <SummaryRow label="Total" value={`${fmtBashin(rail.totals.total)} Bashin`} />
            </dl>
          </section>
        ) : null}

        <section aria-label="Conditions">
          <SectionTitle>Conditions</SectionTitle>
          <ConditionBlocks groups={skill.conditionGroups} activeIndex={resolvedIndex} venueLabel={venueLabel} racerCount={racerCount} inactiveReasons={inactiveReasons} />
        </section>

        <section aria-label="Effects">
          <SectionTitle>Effects</SectionTitle>
          <EffectBlocks groups={skill.conditionGroups} activeIndex={resolvedIndex} courseLength={course.length} level={isUnique ? level : 1} isUnique={isUnique}
            course={course} profile={profile} style={style} groundCondition={raceParams.groundCondition} selectedUma={rail?.characterName} />
        </section>

        {isUnique ? (
          <section aria-label="Unique level">
            <SectionTitle>Unique level</SectionTitle>
            <LevelStepper level={level} onChange={setLevel} deltaBashin={deltaBashin} />
          </section>
        ) : null}

        <section aria-label="Assumptions">
          <AppDisclosure title={<span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Assumptions</span>}>
            <div className="mt-2 flex flex-col gap-3">
              <ModelAssumptions profile={profile} racerCount={racerCount} />
              <RaceImpactProfilePanel embedded profile={profile} dynamicKeys={dynamicKeys} onChange={onProfileChange} />
            </div>
          </AppDisclosure>
        </section>
      </div>
    );
  }

  const closeButton = (
    <AppButton variant="quiet" iconOnly aria-label="Close skill effect details" onPress={onClose}>
      <XIcon className="h-5 w-5" />
    </AppButton>
  );
  const onOpenChange = (next: boolean) => { if (!next) onClose(); };
  // On a rail switch the previous skill stays visible, dimmed and marked busy, until the next one loads.
  const busyClass = `transition-opacity duration-150 ease-out motion-reduce:transition-none ${effect.switching ? "opacity-60" : ""}`;

  if (isDesktop) {
    // The dialog branch starts at the tablet tier (>=640px), so its layout uses `sm:` to match useTier.
    return (
      <AppDialog
        isOpen={open}
        onOpenChange={onOpenChange}
        title={title}
        ariaLabel={ariaLabel}
        size="lg"
        overlayLayer="inspection"
        headerAction={closeButton}
        bodyClassName={`min-h-0 flex-1 overflow-hidden ${rail ? "sm:grid sm:grid-cols-[200px_1fr]" : "flex flex-col"}`}
      >
        {rail ? <Rail rail={rail} focused={focused} onSelect={setFocused} /> : null}
        <div aria-busy={effect.switching} className={`relative min-h-0 overflow-y-auto overscroll-contain px-5 py-4 sm:h-full ${busyClass}`}>
          {content}
          <LoadingAnimation
            active={!skill && effect.status !== "error"}
            label="Loading skill effect"
            size="md"
            fallback={<SkeletonBlocks />}
          />
        </div>
      </AppDialog>
    );
  }
  return (
    <AppDialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title={title}
      ariaLabel={ariaLabel}
      size="phone-full"
      overlayLayer="inspection"
      headerAction={closeButton}
    >
      {rail ? <ChipRow rail={rail} focused={focused} onSelect={setFocused} /> : null}
      <div aria-busy={effect.switching} className={`relative px-4 py-4 ${busyClass}`}>
        {content}
        <LoadingAnimation
          active={!skill && effect.status !== "error"}
          label="Loading skill effect"
          size="md"
          fallback={<SkeletonBlocks />}
        />
      </div>
    </AppDialog>
  );
}
