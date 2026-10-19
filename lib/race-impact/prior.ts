import type { DynamicConditionKey } from "./types";

/** Dynamic state needs race telemetry; geometry is evaluated by the zone engine. */
const CONDITION_PATTERNS: Array<[DynamicConditionKey, RegExp]> = [
  ["blocked", /blocked|is_blocked|block_front/i],
  ["overtake", /overtake|is_overtake/i],
  ["nearby", /near_count|nearby|near_/i],
  ["surrounded", /surrounded|surround/i],
  // `is_activate_other_skill_detail` is a dependency between details of the
  // same skill. It is intentionally *not* an activation-count roll.
  // activate_count_param_skill ("activated N skills so far") is the same roll (R7.4). R31: so are the own-activation
  // counts (activate_count_heal / _all / _start / _middle / _end_after / _later_half), assumed met like other dynamic
  // conditions; the team count (activate_count_all_team) stays a pass-through.
  ["activate_count", /(?:^|[&_])activate_count(?:_(?:param_skill|heal|all|start|middle|end_after|later_half))?(?:[<>=]|$)|is_activate_count/i],
  ["other_skill", /is_activate_other_skill_detail/i],
  ["visibility", /visible|vision/i],
];

export function dynamicConditionKeys(condition: string | null | undefined, precondition?: string | null): DynamicConditionKey[] {
  const text = `${condition ?? ""}&${precondition ?? ""}`;
  return CONDITION_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);
}

/**
 * Probability that a condition's dynamic (telemetry-only) parts hold, evaluated per `@` (OR) branch
 * (controller ruling R7.4): a branch's rate is the product of `rateOf(key)` over its dynamic keys (1 when it has
 * none) and the condition's rate is 1 - prod(1 - branchRate). The precondition is evaluated the same way and
 * multiplied in. `other_skill` (is_activate_other_skill_detail) is a chain marker, never a rate.
 */
export function dynamicActivationRate(
  condition: string | null | undefined, precondition: string | null | undefined, rateOf: (key: DynamicConditionKey) => number,
): number {
  const part = (text: string | null | undefined): number => {
    if (!text) return 1;
    const branchRates: number[] = [];
    for (const branch of text.split("@")) {
      const keys = dynamicConditionKeys(branch).filter((k) => k !== "other_skill");
      if (!keys.length) return 1;
      branchRates.push(keys.reduce((rate, key) => rate * rateOf(key), 1));
    }
    return branchRates.length === 1 ? branchRates[0] : 1 - branchRates.reduce((miss, rate) => miss * (1 - rate), 1);
  };
  return part(condition) * part(precondition);
}
