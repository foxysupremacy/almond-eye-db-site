import type { RunningStyle } from "../deck/types";
import type { RaceImpactPriorsPayload, RaceImpactPrior, DynamicConditionKey, PriorSource } from "./types";

/** Dynamic state needs race telemetry; geometry is evaluated by the zone engine. */
const CONDITION_PATTERNS: Array<[DynamicConditionKey, RegExp]> = [
  ["blocked", /blocked|is_blocked|block_front/i],
  ["overtake", /overtake|is_overtake/i],
  ["nearby", /near_count|nearby|near_/i],
  ["surrounded", /surrounded|surround/i],
  // `is_activate_other_skill_detail` is a dependency between details of the
  // same skill. It is intentionally *not* an activation-count roll.
  ["activate_count", /(?:^|[&_])activate_count(?:[<>=]|$)|is_activate_count/i],
  ["other_skill", /is_activate_other_skill_detail/i],
  ["visibility", /visible|vision/i],
];

export function dynamicConditionKeys(condition: string | null | undefined, precondition?: string | null): DynamicConditionKey[] {
  const text = `${condition ?? ""}&${precondition ?? ""}`;
  return CONDITION_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);
}

export interface PriorLookup {
  probability: number;
  source: PriorSource;
  samples: number;
}

function probability(prior: RaceImpactPrior): number {
  return prior.opportunities > 0 ? prior.activations / prior.opportunities : 0.5;
}

/** Prefer a sufficiently sampled exact course cell, then a style-level global cell. */
export function lookupDynamicPrior(
  payload: RaceImpactPriorsPayload | undefined,
  key: DynamicConditionKey,
  context: { courseId?: number; groundCondition?: number; runningStyle?: RunningStyle | null; racerCount?: number },
): PriorLookup {
  const priors = payload?.priors ?? [];
  const track = priors.find((p) =>
    p.key === key && p.courseId === context.courseId && p.runningStyle === context.runningStyle &&
    p.opportunities >= 30,
  );
  if (track) return { probability: probability(track), source: "track", samples: track.opportunities };
  const global = priors.find((p) =>
    p.key === key && p.courseId === undefined && p.runningStyle === context.runningStyle &&
    p.opportunities >= 30,
  ) ?? priors.find((p) => p.key === key && p.courseId === undefined && p.opportunities >= 30);
  if (global) return { probability: probability(global), source: "global", samples: global.opportunities };
  return { probability: 0.5, source: "manual", samples: 0 };
}
