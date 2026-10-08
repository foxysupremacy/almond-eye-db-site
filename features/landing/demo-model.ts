import { describeCondition } from "@/lib/skill-engine/describe";
import { computeAllZones } from "@/lib/skill-engine/zones";
import type { Course } from "@/lib/skill-engine/types";
import type { LandingDemoSkill } from "./types";

/** Both the accessible summary and the SVG use the same engine results. */
export function evaluateDemoSkill(course: Course, skill: LandingDemoSkill) {
  const zones = computeAllZones(course, skill.conditionGroups);
  const ranges = zones.flatMap((zone) => zone.regions.map((region) => `${Math.round(region.start)}-${Math.round(region.end)}m`));
  return {
    zones,
    isRandom: zones.some((zone) => zone.isRandom),
    rangeText: ranges.length ? ranges.join(", ") : "No activation zone on this course.",
    conditionText: skill.conditionGroups.map((group) => describeCondition(group.condition ?? "", group.precondition, 12)).join("; "),
  };
}
