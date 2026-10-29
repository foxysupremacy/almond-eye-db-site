import type { Course } from "../skill-engine/types";
import type { StaminaInput } from "./types";

/** Kyoto 2200 m turf (course 10808). Stamina / max HP do not depend on stat thresholds, so a literal course is exact. */
export const kyoto2200: Course = {
  id: 10808, length: 2200, terrain: 1, turn: 1, distance: 3, inout: 1,
  corners: [], straights: [], slopes: [], statThresholds: [],
};

export const defaults: StaminaInput = {
  stats: { speed: 1200, stamina: 1200, power: 1200, guts: 1200, wisdom: 1200 },
  style: 3,
  aptitude: { ground: "A", distance: "A", style: "A" },
  motivation: "normal",
  greens: { spd60: 0, spd40: 0, sta60: 0, sta40: 0 },
  recovery: [0, 0, 0, 0, 0, 0, 0],
  hpLoss: [0, 0, 0, 0, 0, 0],
  toggles: { dueling: false, spotStruggle: false, kakari: false },
  groundCondition: 2,
};
