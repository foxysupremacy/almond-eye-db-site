// Single source of truth for effect-type classification.
//
// The game encodes skill effects as {type, value, target} triples; this table
// maps each triple to one gameplay category. Both the evaluator
// (evaluateSkillForTrack) and the UI classifier (classifySkillEffects in
// lib/skill-effects.ts) must go through classifyEffect so the vocabularies
// can never drift apart again.

export type EffectCategory =
  | "target_speed"
  | "current_speed"
  | "acceleration"
  | "zenkai_acceleration"
  | "heal"
  | "debuff"
  | "passive"
  | "other";

/** Raw effect shape as found in skill conditionGroups. */
export interface RawEffect {
  type?: number;
  value?: number;
  target?: number;
  target_details?: number;
}

/**
 * Classify one raw effect triple.
 * Returns null for types with no gameplay category — the evaluator ignores
 * those and the UI classifier buckets them as "other".
 */
export function classifyEffect(eff: RawEffect): EffectCategory | null {
  const type = eff.type ?? 0;
  const val = eff.value ?? 0;
  const target = eff.target ?? 0;

  // Debuffs target opponents (9/10/18) or inflict negative effects
  if (target === 9 || target === 10 || target === 18 || val < 0 || type === 10 || type === 14) {
    return "debuff";
  }
  if (type === 31) return "acceleration";
  if (type === 48) return "zenkai_acceleration";
  if (type === 27) return "target_speed";
  if (type === 21 || type === 22) return "current_speed";
  if (type === 9) return "heal";
  if (type >= 1 && type <= 5) return "passive";
  return null;
}
