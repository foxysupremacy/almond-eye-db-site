"use client";

import { useSyncExternalStore } from "react";
import {
  defaultRaceImpactProfile,
  loadRaceImpactProfile,
  saveRaceImpactProfile,
  subscribeRaceImpactProfile,
  type RaceImpactProfile,
} from "@/lib/race-impact";

// Snapshot cached by serialized value: unrelated storage events (any key fires
// "storage") re-read the profile but return the SAME object, so memoized work
// keyed on the profile never recomputes for them.
let cachedKey: string | null = null;
let cachedProfile: RaceImpactProfile | null = null;

function getSnapshot(): RaceImpactProfile {
  const next = loadRaceImpactProfile();
  const key = JSON.stringify(next);
  if (key !== cachedKey || !cachedProfile) {
    cachedKey = key;
    cachedProfile = next;
  }
  return cachedProfile;
}

let serverProfile: RaceImpactProfile | null = null;
function getServerSnapshot(): RaceImpactProfile {
  serverProfile ??= defaultRaceImpactProfile();
  return serverProfile;
}

function setProfile(next: RaceImpactProfile): void {
  saveRaceImpactProfile(next);
}

/** The shared race-impact profile (localStorage), with a setter that saves and notifies every subscriber. */
export function useRaceImpactProfile(): [RaceImpactProfile, (next: RaceImpactProfile) => void] {
  const profile = useSyncExternalStore(subscribeRaceImpactProfile, getSnapshot, getServerSnapshot);
  return [profile, setProfile];
}
