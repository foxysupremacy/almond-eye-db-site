// Top-level zone computation: given a course and a skill's condition +
// precondition strings, return the candidate activation regions (and whether
// they're random vs deterministic). Mirrors uma-tools' buildSkillData(), minus
// effects/simulation.

import { Region, RegionList } from "./region";
import { CourseHelpers } from "./course";
import { Conditions, EqOperator, NeqOperator, LtOperator, LteOperator, GtOperator, GteOperator, AndOperator, OrOperator } from "./conditions";
import { getParser } from "./parser";
import { ImmediatePolicy, isRandom } from "./sample-policy";
import type { Course, HorseParameters, RaceParameters } from "./types";
import { BANNED_DEBUFF_SKILL_IDS } from "../pvp-events";

// Fixed max-stat horse, same choice as uma-tools' skill-visualizer app.
const HORSE: HorseParameters = {
  speed: 2000,
  stamina: 2000,
  power: 2000,
  guts: 2000,
  wisdom: 2000,
  strategy: 1, // Nige
};

/** The max-stat horse, overridable per-call. */
export const DEFAULT_HORSE = HORSE;

/** A max-stat horse running a specific style (strategy 1–5). */
export function horseForStrategy(strategy: number): HorseParameters {
  return { ...HORSE, strategy };
}

const parser = getParser(Conditions, {
  and: AndOperator,
  or: OrOperator,
  eq: EqOperator,
  neq: NeqOperator,
  lt: LtOperator,
  lte: LteOperator,
  gt: GtOperator,
  gte: GteOperator,
});

export interface SkillZoneResult {
  /** Candidate activation regions (half-open meters). Empty = never fires here. */
  regions: RegionList;
  /** Whether the trigger is random-positioned (drawn as a band) vs deterministic. */
  isRandom: boolean;
  /** Earliest point (m) any preconditioned entry trigger can fire, or null. */
  earliestFire: number | null;
}

function wholeCourse(course: Course): RegionList {
  const rl = new RegionList();
  rl.push(new Region(0, course.length));
  return rl;
}

/** Compute candidate zones for ONE condition group ({condition, precondition}).
 *  `horse` overrides the fixed max-stat horse (used to gate `running_style`
 *  conditions by the selected running style). */
export function computeZones(
  course: Course,
  condition: string,
  precondition?: string | null,
  horse: HorseParameters = HORSE,
  extra?: Partial<RaceParameters>,
): SkillZoneResult {
  const fullExtra: RaceParameters = { skillId: "", ...extra };
  if (fullExtra.noDebuffs && fullExtra.skillId) {
    const numId = Number(fullExtra.skillId);
    if (!Number.isNaN(numId) && BANNED_DEBUFF_SKILL_IDS.has(numId)) {
      return { regions: new RegionList(), isRandom: false, earliestFire: null };
    }
  }
  let full = wholeCourse(course);
  let earliestFire: number | null = null;

  // precondition narrows the track to "at/after the earliest point it can be
  // satisfied", then the main condition is intersected within that.
  if (precondition) {
    const pre = parser.parse(parser.tokenize(precondition));
    const [preRegions] = pre.apply(full, course, horse, fullExtra);
    if (preRegions.length === 0) {
      return { regions: new RegionList(), isRandom: false, earliestFire: null };
    }
    const bounds = new Region(preRegions[0].start, full[full.length - 1].end);
    earliestFire = preRegions[0].start;
    full = full.rmap((r) => r.intersect(bounds));
  }

  let op;
  try {
    op = parser.parse(parser.tokenize(condition));
  } catch {
    return { regions: new RegionList(), isRandom: false, earliestFire };
  }

  const [regions] = op.apply(full, course, horse, fullExtra);
  const random = isRandom(op.samplePolicy);

  // An empty condition (e.g. "always" or a bare noop chain) still yields the
  // whole remaining track; that is intentional.
  return { regions, isRandom: random, earliestFire };
}

/** Compute zones for all groups of a skill, in order.
 *  Groups whose condition/precondition requires `is_activate_other_skill_detail==1`
 *  ("this skill already activated once") are chained to the earlier groups: they
 *  can only fire at/after the earliest point a previous trigger can fire, and
 *  are empty when no earlier trigger can fire on this course at all. */
export function computeAllZones(
  course: Course,
  groups: { condition?: string | null; precondition?: string | null }[],
  horse: HorseParameters = HORSE,
  extra?: Partial<RaceParameters>,
): SkillZoneResult[] {
  const results = groups.map((g) =>
    computeZones(course, g.condition ?? "", g.precondition ?? null, horse, extra),
  );
  for (let i = 0; i < groups.length; i++) {
    const raw = `${groups[i].condition ?? ""}&${groups[i].precondition ?? ""}`;
    if (!raw.includes("is_activate_other_skill_detail")) continue;
    // Earliest point any earlier trigger of this skill can fire.
    let lower: number | null = null;
    for (let j = 0; j < i; j++) {
      if (results[j].regions.length === 0) continue;
      const s = results[j].regions[0].start;
      if (lower == null || s < lower) lower = s;
    }
    if (lower == null) {
      results[i] = { regions: new RegionList(), isRandom: false, earliestFire: null };
    } else {
      const bounds = new Region(lower, course.length);
      results[i] = {
        ...results[i],
        regions: results[i].regions.rmap((r) => r.intersect(bounds)),
        earliestFire: lower,
      };
    }
  }
  return results;
}

export { CourseHelpers, ImmediatePolicy };
