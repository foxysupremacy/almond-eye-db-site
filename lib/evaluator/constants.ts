/**
 * Expected typical rank intervals for 9-uma CM room.
 * Runner: 1st - 2nd
 * Leader: 2nd - 5th
 * Betweener: 4th - 7th
 * Chaser: 4th - 9th (current game version)
 */
export const STYLE_EXPECTED_RANKS: Record<number, [number, number]> = {
  1: [1, 2], // Runner
  2: [2, 5], // Leader
  3: [4, 7], // Betweener
  4: [4, 9], // Chaser (updated for the current game version — End Closers now sit 4th–9th)
  5: [1, 1], // Great Escape
};

export const STYLE_NAMES: Record<number, string> = {
  1: "Runner",
  2: "Leader",
  3: "Betweener",
  4: "Chaser",
  5: "Great Escape",
};

export interface PhaseProfile {
  score: number;
  stars: 1 | 2 | 3 | 4 | 5;
  tier: "S" | "A" | "B" | "C" | "D" | "F";
  summary: string;
}

export interface StylePhaseProfile {
  early: PhaseProfile;
  mid: PhaseProfile;
  late: PhaseProfile;
}

export const STYLE_PHASE_PROFILES: Record<number | "neutral", StylePhaseProfile> = {
  // Runner (1): Early/Mid speed is vital to secure and hold 1st place before spurt
  1: {
    early: {
      score: 90,
      stars: 5,
      tier: "S",
      summary: "Early Speed (Runner Priority): establishes early lead contention to secure 1st place before the pack settles.",
    },
    mid: {
      score: 88,
      stars: 5,
      tier: "S",
      summary: "Mid-Race Speed (Runner Priority): extends lead cushion to protect 1st place before the 2/3 spurt point.",
    },
    late: {
      score: 75,
      stars: 3,
      tier: "B",
      summary: "Late-Race Speed: provides secondary top speed boost; Runner's primary win condition is determined by early/mid lead and spurt accel.",
    },
  },
  // Leader (2): Mid speed is critical to stay in ranks 2–4 behind the runner
  2: {
    early: {
      score: 78,
      stars: 4,
      tier: "A",
      summary: "Early Speed: establishes forward positioning in the front pack.",
    },
    mid: {
      score: 88,
      stars: 5,
      tier: "S",
      summary: "Mid-Race Speed (Leader Priority): holds critical 2nd–4th position envelope to guarantee late acceleration trigger conditions.",
    },
    late: {
      score: 85,
      stars: 4,
      tier: "A",
      summary: "Late-Race Speed: raises spurt top speed to hunt down the leading runner on the final stretch.",
    },
  },
  // Betweener (3): Conserves early, mid-race positioning, bursts in late race
  3: {
    early: {
      score: 65,
      stars: 2,
      tier: "C",
      summary: "Early Speed: low tactical value for Betweener; surging forward too early risks violating mid/late rank trigger windows.",
    },
    mid: {
      score: 82,
      stars: 4,
      tier: "A",
      summary: "Mid-Race Speed: adjusts position within the mid-pack without surging into front-runner rank traps.",
    },
    late: {
      score: 92,
      stars: 5,
      tier: "S",
      summary: "Late-Race Speed (Betweener Priority): essential top-speed ceiling expansion for final stretch overtaking.",
    },
  },
  // Chaser (4): Backline reserve, all-out late burst
  4: {
    early: {
      score: 62,
      stars: 2,
      tier: "C",
      summary: "Early Speed: negligible utility for Chaser; backline position keep naturally sits in ranks 7–9.",
    },
    mid: {
      score: 80,
      stars: 4,
      tier: "A",
      summary: "Mid-Race Speed: bridges the gap to the mid-pack preparing for the late-race burst.",
    },
    late: {
      score: 95,
      stars: 5,
      tier: "S",
      summary: "Late-Race Speed (Chaser Priority): maximum priority terminal speed weapon for late-race sweeps.",
    },
  },
  // Great Escape (5): behaves like extreme Runner
  5: {
    early: {
      score: 92,
      stars: 5,
      tier: "S",
      summary: "Early Speed (Great Escape Priority): absolute necessity to break away from the entire pack from the opening stride.",
    },
    mid: {
      score: 90,
      stars: 5,
      tier: "S",
      summary: "Mid-Race Speed (Great Escape Priority): sustains extreme breakaway gap.",
    },
    late: {
      score: 70,
      stars: 3,
      tier: "B",
      summary: "Late-Race Speed: low impact if breakaway cushion was not established earlier.",
    },
  },
  // Neutral: Generic fallback when style is unknown or all-style
  neutral: {
    early: {
      score: 72,
      stars: 3,
      tier: "B",
      summary: "Early Speed: establishes early position before the pack settles.",
    },
    mid: {
      score: 82,
      stars: 4,
      tier: "A",
      summary: "Mid-Race Speed: contests position before the 2/3 spurt point.",
    },
    late: {
      score: 85,
      stars: 4,
      tier: "A",
      summary: "Late-Race Speed: raises the spurt target-speed ceiling during the final stretch.",
    },
  },
};

/**
 * Maximum delay in meters from the spurt point for an acceleration skill
 * to still be classified as Valid Fastest Accel (Tier S).
 * Accounts for course geometry specifics like ParisLongchamp 2400m
 * where the Fausse Ligne Droite starts at 1617m (+17m after spurt at 1600m).
 */
export const SPURT_ACCEL_TOLERANCE_METERS = 50;

/**
 * Critical course distance threshold for severe stamina penalties on Heavy/Bad turf.
 */
export const HEAVY_TURF_STAMINA_CRITICAL_DISTANCE = 2400;
