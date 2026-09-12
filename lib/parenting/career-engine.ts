// Career schedule engine — per-character career G1 objectives sourced from
// GameTora character pages ("objectiveData"), merged into lib/data/careers.json
// by scripts/extract-affinity.ts (run `bun run fetch:gametora` + `build:data`).
// Used to score untrained "potential veteran" candidates and to surface
// career/track fit in the parent picker. Zero-server, 100% client-side.

import { careersByCharId as rawCareersData } from "../data/registry";
import type { Course } from "../skill-engine/types";

export interface CareerG1Race {
  /** Trophy/saddle id (umdb singleModeWinsSaddle) when the race maps to one. */
  saddleId?: number;
  /** GameTora career race id (e.g. 1003 Osaka Hai, 1023 Arima Kinen). */
  raceId: number;
  nameEn: string;
  /** Only G1 races (grade 100) are exported. */
  grade: number;
  trackId: number;
  distance: number;
  terrain: number;
  /** True when the objective requires winning the race (cond_value 1). */
  mustWin: boolean;
}

const careersByCharId = new Map<number, CareerG1Race[]>();
for (const [charaIdStr, races] of Object.entries(
  rawCareersData as Record<string, CareerG1Race[]>
)) {
  careersByCharId.set(Number(charaIdStr), races ?? []);
}

/** All career G1 objectives for a character (may be empty when no GameTora page data exists). */
export function getCareerG1Races(charaId: number): CareerG1Race[] {
  return careersByCharId.get(charaId) ?? [];
}

/** Distinct saddle ids for the character's career G1s (potential G1 win trophies). */
export function getCareerG1Saddles(charaId: number): number[] {
  const saddles: number[] = [];
  for (const race of getCareerG1Races(charaId)) {
    if (race.saddleId != null && !saddles.includes(race.saddleId)) {
      saddles.push(race.saddleId);
    }
  }
  return saddles;
}

/**
 * Saddles for G1s the career objective REQUIRES winning (cond_value 1). A friend
 * borrow's trained Uma has these wins by definition, so borrow stubs use this set.
 */
export function getCareerMustWinSaddles(charaId: number): number[] {
  const saddles: number[] = [];
  for (const race of getCareerG1Races(charaId)) {
    if (race.saddleId != null && race.mustWin && !saddles.includes(race.saddleId)) {
      saddles.push(race.saddleId);
    }
  }
  return saddles;
}

// Saddle id -> (app racetrack id, Course.distance bucket) for turf G1s with fixed
// venues. Uses the app's racetracks.json id space (10005 Nakayama, 10006 Tokyo,
// 10007 Chukyo, 10008 Kyoto, 10009 Hanshin) — NOT GameTora's track ids, which
// differ for some venues. Dirt G1s (29-32, 36-39, 156-168) have no course
// geometry data and are omitted. Duplicate saddle ids (147/148/153/155) map to
// the same venues as their primaries.
const G1_COURSE_FIT: Record<number, { trackId: number; distanceBucket: 1 | 2 | 3 | 4 }> = {
  10: { trackId: 10005, distanceBucket: 4 }, // Arima Kinen — Nakayama 2500
  11: { trackId: 10006, distanceBucket: 3 }, // Japan Cup — Tokyo 2400
  12: { trackId: 10006, distanceBucket: 3 }, // Japanese Derby — Tokyo 2400
  13: { trackId: 10008, distanceBucket: 4 }, // Tenno Sho (Spring) — Kyoto 3200
  14: { trackId: 10009, distanceBucket: 3 }, // Takarazuka Kinen — Hanshin 2200
  15: { trackId: 10006, distanceBucket: 3 }, // Tenno Sho (Autumn) — Tokyo 2000
  16: { trackId: 10008, distanceBucket: 4 }, // Kikuka Sho — Kyoto 3000
  17: { trackId: 10009, distanceBucket: 3 }, // Osaka Hai — Hanshin 2000
  18: { trackId: 10005, distanceBucket: 3 }, // Satsuki Sho — Nakayama 2000
  19: { trackId: 10006, distanceBucket: 3 }, // Japanese Oaks — Tokyo 2400
  20: { trackId: 10007, distanceBucket: 1 }, // Takamatsunomiya Kinen — Chukyo 1200
  21: { trackId: 10006, distanceBucket: 2 }, // Yasuda Kinen — Tokyo 1600
  22: { trackId: 10005, distanceBucket: 1 }, // Sprinters Stakes — Nakayama 1200
  23: { trackId: 10008, distanceBucket: 2 }, // Mile Championship — Kyoto 1600
  24: { trackId: 10009, distanceBucket: 2 }, // Oka Sho — Hanshin 1600
  25: { trackId: 10006, distanceBucket: 2 }, // Victoria Mile — Tokyo 1600
  26: { trackId: 10008, distanceBucket: 3 }, // Queen Elizabeth II Cup — Kyoto 2200
  27: { trackId: 10006, distanceBucket: 2 }, // NHK Mile Cup — Tokyo 1600
  28: { trackId: 10008, distanceBucket: 3 }, // Shuka Sho — Kyoto 2000
  33: { trackId: 10005, distanceBucket: 2 }, // Asahi Hai Futurity Stakes — Nakayama 1600
  34: { trackId: 10005, distanceBucket: 3 }, // Hopeful Stakes — Nakayama 2000
  35: { trackId: 10009, distanceBucket: 2 }, // Hanshin Juvenile Fillies — Hanshin 1600
  147: { trackId: 10009, distanceBucket: 3 }, // Takarazuka Kinen (dup)
  148: { trackId: 10008, distanceBucket: 4 }, // Kikuka Sho (dup)
  153: { trackId: 10008, distanceBucket: 4 }, // Tenno Sho (Spring) (dup)
  155: { trackId: 10005, distanceBucket: 3 }, // Satsuki Sho (dup)
};

/** Career G1s held at the selected course (same venue + distance category). */
export function getCareerCourseFit(charaId: number, course?: Course | null): CareerG1Race[] {
  if (!course?.trackId) return [];
  const bucket = course.distance || 3;
  const fits: CareerG1Race[] = [];
  for (const race of getCareerG1Races(charaId)) {
    if (race.saddleId == null) continue;
    const fit = G1_COURSE_FIT[race.saddleId];
    if (fit && fit.trackId === course.trackId && fit.distanceBucket === bucket) {
      fits.push(race);
    }
  }
  return fits;
}
