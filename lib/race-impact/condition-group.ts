import type { RunningStyle } from "../deck/types";
import type { SkillDetailInput } from "../evaluator/types";
import { computePvpSkillZones } from "../pvp/skill-zones";
import { horseForStrategy, type SkillZoneResult } from "../skill-engine/zones";
import type { Course, RaceParameters } from "../skill-engine/types";

type ConditionGroup = NonNullable<SkillDetailInput["conditionGroups"]>[number];

export interface ConditionTrigger {
  index: number;
  group: ConditionGroup;
  zones: SkillZoneResult;
}

export interface ResolvedConditionGroup {
  /** The first trigger (kept for the UI). */
  index: number;
  group: ConditionGroup;
  zones: SkillZoneResult;
  /** Zones for every group, same order as conditionGroups (for the Conditions UI). */
  allZones: SkillZoneResult[];
  /** Every trigger placed in one simulated race: the first firable group, then chained later groups. */
  triggers: ConditionTrigger[];
}

/**
 * A later group whose condition references another detail of the SAME skill fires in the same race (uma-tools rule). `is_used_skill_id==X` with X another skill is not a chain marker: it
 * is a prerequisite, which R32 treats as met for every Uma (the zone engine passes it through).
 */
export const CHAINED_TRIGGER_PATTERN = /is_activate_other_skill_detail/;

const PREREQUISITE_PATTERN = /is_used_skill_id(?:_with_detail_one)?==(\d+)/g;

/** Step 5a: the chain marker counts in the precondition too (Gold City 120401), as computeAllZones already reads it. */
export function isChainedTo(group: { condition?: string | null; precondition?: string | null }, skillId?: number | string | null): boolean {
  const condition = `${group.condition ?? ""}&${group.precondition ?? ""}`;
  if (CHAINED_TRIGGER_PATTERN.test(condition)) return true;
  if (skillId == null) return false;
  return [...condition.matchAll(PREREQUISITE_PATTERN)].some((m) => m[1] === String(skillId));
}

/**
 * Indices of the groups placed in one race. A skill's alternative groups are mutually exclusive (one shared
 * cooldown), so only the first group with a non-empty zone fires, plus every LATER group with a non-empty zone that
 * chains to it (is_activate_other_skill_detail). R32: prerequisite groups (`is_used_skill_id==X`) are placeable like any
 * other group. Empty when no group can fire.
 */
export function placedTriggerIndices(
  groups: ReadonlyArray<{ condition?: string | null; precondition?: string | null }>,
  zones: ReadonlyArray<{ regions: { length: number } }>,
  skillId?: number | string | null,
): number[] {
  const firable = (i: number) => Boolean(zones[i]?.regions.length);
  const first = groups.findIndex((_, i) => firable(i));
  if (first < 0) return [];
  const out = [first];
  for (let i = first + 1; i < groups.length; i++) {
    if (firable(i) && isChainedTo(groups[i], skillId)) out.push(i);
  }
  return out;
}

/**
 * Step 5a: later groups that are ALTERNATIVES to the placed group `first` (firable, placeable, not chained to it). They
 * matter only when the placed group's condition depends on the race state: then whichever group holds first fires
 * (dynamic-placement.ts). Ascending index order.
 */
export function alternativeTriggerIndices(
  groups: ReadonlyArray<{ condition?: string | null; precondition?: string | null }>,
  zones: ReadonlyArray<{ regions: { length: number } }>,
  first: number, skillId?: number | string | null,
): number[] {
  const out: number[] = [];
  for (let i = first + 1; i < groups.length; i++) {
    if (zones[i]?.regions.length && !isChainedTo(groups[i], skillId)) out.push(i);
  }
  return out;
}

/**
 * The game evaluates a skill's condition groups in order and uses the first
 * one that can fire. On a given course that is the first group with a
 * non-empty activation zone (e.g. a "3x on Japanese turf" group loses to the
 * plain group at Longchamp). R32: race-situation conditions count as met, so a group that needs another skill
 * (is_used_skill_id) or a popularity band competes like any other group; only the map (track, distance, surface,
 * geometry, style) decides. Later groups chained to it (is_activate_other_skill_detail) are placed as additional
 * triggers in the same race.
 */
export function resolveConditionGroup(
  skill: SkillDetailInput,
  course: Course,
  raceParams: Partial<RaceParameters>,
  style: RunningStyle | null,
): ResolvedConditionGroup | null {
  const groups = skill.conditionGroups ?? [];
  if (!groups.length) return null;
  const allZones = computePvpSkillZones(
    course,
    groups.map((g) => ({ condition: g.condition ?? "", precondition: g.precondition ?? null })),
    style ? horseForStrategy(style) : undefined,
    { ...raceParams, skillId: String(skill.id) },
  );
  const placed = placedTriggerIndices(groups, allZones, skill.id);
  if (!placed.length) return null;
  const triggers = placed.map((index) => ({ index, group: groups[index], zones: allZones[index] }));
  const [first] = triggers;
  return { index: first.index, group: first.group, zones: first.zones, allZones, triggers };
}

/** True when more than one group is placed in one race (a firable first group plus chained later groups). */
export function hasChainedTriggers(
  groups: ReadonlyArray<{ condition?: string | null; precondition?: string | null }>, zones: ReadonlyArray<{ regions: { length: number } }>,
  skillId?: number | string | null,
): boolean {
  return placedTriggerIndices(groups, zones, skillId).length > 1;
}
