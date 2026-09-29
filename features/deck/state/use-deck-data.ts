"use client";

import { useEffect, useState } from "react";
import type { CardIndexEntry, Racetrack, RacetrackDetail } from "@/lib/api";
import { initDataStore, type DataStore } from "@/lib/api";

interface DeckDataState {
  dataStore: DataStore | null;
  index: CardIndexEntry[] | null;
  tracks: Racetrack[] | null;
  trackDetailsCache: Record<number, RacetrackDetail | null>;
}

/** Load the static game data once and prepare the lookup structures for deck state. */
export function useDeckData(): DeckDataState {
  const [state, setState] = useState<DeckDataState>({
    dataStore: null,
    index: null,
    tracks: null,
    trackDetailsCache: {},
  });

  useEffect(() => {
    let cancelled = false;

    initDataStore().then((dataStore) => {
      if (cancelled) return;
      const trackDetailsCache: Record<number, RacetrackDetail | null> = {};
      for (const track of dataStore.racetracks) trackDetailsCache[track.id] = track;

      setState({
        dataStore,
        index: dataStore.cards,
        tracks: dataStore.racetracks.map(({ id, nameJa, nameEn, courseCount }) => ({
          id,
          nameJa,
          nameEn,
          courseCount,
        })),
        trackDetailsCache,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
