"use client";

import { useMemo } from "react";
import type { Course, RaceParameters } from "@/lib/skill-engine/types";
import type { RunningStyle } from "@/lib/deck/types";
import { createApplicationRatingSession } from "@/lib/skill-rating/application";
import { defaultRaceImpactProfile, type RaceImpactProfile } from "@/lib/race-impact";

/** One canonical cache for all skill evaluations made under the same UI context. */
export function useSkillRatingSession(
  course: Course | null | undefined,
  style: RunningStyle | number | null | undefined,
  racerCount: number,
  raceParameters?: Partial<RaceParameters>,
  profile?: RaceImpactProfile,
) {
  const resolvedProfile = useMemo(() => profile ?? defaultRaceImpactProfile(), [profile]);
  return useMemo(() => createApplicationRatingSession({
    course: course ?? null,
    style: style ?? null,
    racerCount,
    raceParameters,
    profile: resolvedProfile,
  }), [course, style, racerCount, raceParameters, resolvedProfile]);
}
