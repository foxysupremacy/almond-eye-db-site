"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultRaceImpactProfile,
  loadRaceImpactProfile,
  saveRaceImpactProfile,
  subscribeRaceImpactProfile,
  type RaceImpactProfile,
} from "@/lib/race-impact";

/** Shared saved race assumptions for inspectors, recommendations and workers. */
export function useRaceImpactProfile() {
  const [profile, setProfile] = useState<RaceImpactProfile>(defaultRaceImpactProfile);
  useEffect(() => {
    const sync = () => setProfile(loadRaceImpactProfile());
    sync();
    return subscribeRaceImpactProfile(sync);
  }, []);
  const updateProfile = useCallback((next: RaceImpactProfile) => {
    setProfile(next);
    saveRaceImpactProfile(next);
  }, []);
  return { raceImpactProfile: profile, updateRaceImpactProfile: updateProfile };
}
