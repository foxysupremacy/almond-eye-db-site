// Single source of truth for effect-type classification.
//
// The game encodes skill effects as {type, value, target} triples; this table
// maps each triple to one gameplay category. Both the evaluator
// (evaluateSkillForTrack) and the UI classifier (classifySkillEffects in
// lib/skills/effects.ts) must go through classifyEffect so the vocabularies
// can never drift apart again.

export type EffectCategory =
  | "target_speed"
  | "current_speed"
  | "acceleration"
  | "lane_movement"
  | "zenkai_acceleration"
  | "heal"
  | "debuff"
  | "passive"
  | "other";

/** Raw effect shape as found in skill conditionGroups. */
export type RawEffect = import("../data/types").RawSkillEffect;

export interface EffectDescriptor {
  family: import("../skill-rating/types").EffectFamily | null;
  category: EffectCategory | null;
  target: "self" | "opponents" | "allies" | "all" | "unknown";
  sign: "benefit" | "cost" | "conditional";
}

/** Kind, recipient and sign are independent; a self cost is not a PvP debuff. */
export function describeEffect(effect: RawEffect): EffectDescriptor {
  const type = effect.type ?? 0;
  const value = effect.value ?? 0;
  const targetId = effect.target ?? 1;
  const target: EffectDescriptor["target"] = targetId === 0 || targetId === 1 ? "self"
    : targetId === 2 ? "all" : targetId === 11 ? "allies"
    : [4, 7, 9, 10, 18, 19, 20, 21, 22, 23].includes(targetId) ? "opponents" : "unknown";
  const families: Partial<Record<number, import("../skill-rating/types").EffectFamily>> = {
    1: "passive_speed", 2: "passive_stamina", 3: "passive_power", 4: "passive_guts", 5: "passive_wisdom",
    9: "recovery", 10: "start_delay", 14: "start_delay", 21: "current_speed_21", 22: "current_speed_22",
    27: "target_speed", 28: "lane_movement", 31: "acceleration", 48: "zenkai",
  };
  const family = families[type] ?? null;
  const sign = type === 14 ? "conditional" : type === 10 ? (value < 10_000 ? "benefit" : "cost") : value < 0 ? "cost" : "benefit";
  const category: EffectCategory | null = target === "opponents" && family !== "start_delay" ? "debuff"
    : family === "target_speed" ? "target_speed"
    : family === "current_speed_21" || family === "current_speed_22" ? "current_speed"
    : family === "acceleration" ? "acceleration" : family === "lane_movement" ? "lane_movement" : family === "zenkai" ? "zenkai_acceleration"
    : family === "recovery" ? "heal" : family?.startsWith("passive_") ? "passive" : null;
  return { family, category, target, sign };
}

/**
 * Classify one raw effect triple.
 * Returns null for types with no gameplay category — the evaluator ignores
 * those and the UI classifier buckets them as "other".
 */
export function classifyEffect(eff: RawEffect): EffectCategory | null {
  return describeEffect(eff).category;
}
