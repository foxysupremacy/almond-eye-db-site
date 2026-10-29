import type { RaceContext } from "./stats";
import { HP_LOSS_BUCKETS, RECOVERY_BUCKETS, type Rng, type StaminaInput } from "./types";
import type { RunEvents } from "./run";

/** Doc §Skill Activation Chance: wit check chance = max(100 - 9000 / BaseWit, 20) %. */
function witCheckChance(baseWiz: number): number {
  return Math.max(100 - 9000 / baseWiz, 20) / 100;
}

/**
 * Per-run skill events. Each skill fires at a uniform meter inside the mid-race [phases[0], phases[1]) (spec §4).
 * Recoveries (pct > 0) must pass the wit check; HP-loss debuffs (pct < 0) always land (spec: worst case).
 * Sorted by meter ascending.
 */
export function rollSkillEvents(input: StaminaInput, ctx: RaceContext, rng: Rng): RunEvents {
  const [from, to] = [ctx.phases[0], ctx.phases[1]];
  const meterAt = () => from + rng.next() * (to - from);
  const chance = witCheckChance(ctx.baseWiz);
  const heals: RunEvents["heals"] = [];

  RECOVERY_BUCKETS.forEach((pct, i) => {
    for (let n = input.recovery[i] ?? 0; n > 0; n--) {
      if (rng.next() < chance) heals.push({ meter: meterAt(), pct });
    }
  });
  HP_LOSS_BUCKETS.forEach((pct, i) => {
    for (let n = input.hpLoss[i] ?? 0; n > 0; n--) heals.push({ meter: meterAt(), pct: -pct });
  });

  heals.sort((a, b) => a.meter - b.meter);
  return { heals };
}
