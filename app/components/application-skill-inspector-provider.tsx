"use client";

import type { ReactNode } from "react";
import { useDeck } from "@/features/deck/state";
import { SkillInspectorProvider } from "@/app/common/ui/skills/details/skill-hover-card";

/** Connects application deck state to the shared, domain-agnostic inspector UI. */
export function ApplicationSkillInspectorProvider({ children }: { children: ReactNode }) {
  const { course, racerCount, runningStyle, activePvpEvent, activeRaceParameters } = useDeck();
  return (
    <SkillInspectorProvider
      course={course}
      racerCount={racerCount}
      runningStyle={runningStyle}
      activePvpEvent={activePvpEvent}
      raceParams={activeRaceParameters}
    >
      {children}
    </SkillInspectorProvider>
  );
}
