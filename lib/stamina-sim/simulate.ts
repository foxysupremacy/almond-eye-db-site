import type { Course } from "../skill-engine/types";
import { initMechanics } from "./mechanics";
import { createRng } from "./rng";
import { simulateRun } from "./run";
import { rollSkillEvents } from "./skills";
import { raceContext } from "./stats";
import type { StaminaInput, StaminaResult } from "./types";

/** Monte Carlo over `runs` races; one context and one shared rng so (input, seed) is reproducible. Percentages are 0-100. */
export function runStaminaSim(
  input: StaminaInput,
  course: Course,
  opts: { runs?: number; seed?: number } = {},
): StaminaResult {
  const runs = Math.max(1, Math.floor(opts.runs ?? 1000));
  const rng = createRng(opts.seed ?? 1);
  const ctx = raceContext(input, course);
  let reached = 0, spurt = 0, keep = 0, surplus = 0;
  for (let i = 0; i < runs; i++) {
    const events = rollSkillEvents(input, ctx, rng);
    const mech = initMechanics(input, ctx, rng);
    const out = simulateRun(ctx, rng, events, mech);
    if (out.reachedGoal) reached++;
    if (out.maxSpurt) { spurt++; surplus += out.finalHp; }
    if (out.enteredStaminaKeep) keep++;
  }
  return {
    runs,
    goalReachPct: (reached / runs) * 100,
    maxSpurtPct: (spurt / runs) * 100,
    avgSurplusHp: spurt ? surplus / spurt : 0,
    staminaKeepPct: (keep / runs) * 100,
  };
}
