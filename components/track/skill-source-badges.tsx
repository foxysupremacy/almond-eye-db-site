"use client";

import type { VisualizerSkillOrigin } from "../../lib/visualizer-skills";
import { SkillSourceIcons } from "../shared/skill-badges";

interface SkillSourceBadgesProps {
  origins: VisualizerSkillOrigin[];
  compact?: boolean;
}

export interface SkillSourceBadgeProps {
  origin: VisualizerSkillOrigin;
  compact?: boolean;
}

/** A card can grant the same skill through an event and a hint; show it once. */
export function dedupeSkillOrigins(origins: VisualizerSkillOrigin[]): VisualizerSkillOrigin[] {
  const seen = new Set<string>();
  return origins.filter((origin) => {
    const key = [origin.availability, origin.cardId ?? "", origin.label, origin.slotLabel ?? ""].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function SkillSourceBadge({ origin, compact = false }: SkillSourceBadgeProps) {
  return (
    <SkillSourceIcons
      sources={[{
        kind: origin.kind === "support-event" || origin.kind === "support-hint" ? "card" : "character",
        cardId: origin.cardId,
        name: origin.label,
        label: origin.slotLabel ?? origin.availability,
      }]}
      iconClassName={compact ? "h-4 w-4" : "h-5 w-5"}
    />
  );
}

export function SkillSourceBadges({ origins, compact = false }: SkillSourceBadgesProps) {
  const uniqueOrigins = dedupeSkillOrigins(origins ?? []);
  if (uniqueOrigins.length === 0) return null;

  return <div className="flex flex-wrap items-center gap-1">{uniqueOrigins.map((origin, idx) => (
    <SkillSourceBadge key={`${origin.availability}-${origin.cardId ?? origin.label}-${origin.slotLabel ?? idx}`} origin={origin} compact={compact} />
  ))}</div>;
}
