import type { SkillAnalysis } from "@/lib/skill-rating/types";
import { Region, RegionList } from "@/lib/skill-engine/region";
import type { SkillZoneResult } from "@/lib/skill-engine/zones";

/** Preserve trigger indices while projecting the canonical applicable paths. */
export function skillRatingZones(analysis: SkillAnalysis): SkillZoneResult[] {
  const paths = analysis.scenarios.flatMap((scenario) => scenario.paths);
  const count = Math.max(0, ...paths.map((path) => path.triggerIndex + 1));
  return Array.from({ length: count }, (_, triggerIndex) => {
    const matching = paths.filter((path) => path.triggerIndex === triggerIndex);
    let regions = new RegionList();
    for (const path of matching) {
      const next = new RegionList();
      next.push(...path.regions.map((region) => new Region(region.start, region.end)));
      regions = regions.union(next);
    }
    return {
      regions,
      isRandom: matching.some((path) => path.sampling !== "immediate"),
      earliestFire: regions.length ? regions[0].start : null,
    };
  });
}
