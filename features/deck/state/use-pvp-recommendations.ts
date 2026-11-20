"use client";

import { useEffect, useState } from "react";
import { api, type PvpRaceFitAssistance } from "@/lib/api";

const NO_EVENTS: PvpRaceFitAssistance[] = [];

/**
 * Race fit recommendations, loaded after the deck has painted. The dataset is
 * a deferred chunk: until it resolves this returns an empty list, which the
 * PvP/Master Challenge matchers already treat as "no match yet".
 */
export function usePvpRecommendations(): PvpRaceFitAssistance[] {
  const [events, setEvents] = useState<PvpRaceFitAssistance[]>(NO_EVENTS);

  useEffect(() => {
    let cancelled = false;
    api.pvpRecommendations().then(
      (payload) => {
        if (!cancelled) setEvents(payload.raceFitAssistance);
      },
      (error: unknown) => {
        console.error("Failed to load PvP recommendations", error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return events;
}
