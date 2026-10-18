import { describe, expect, test } from "bun:test";
import { flattenCourse } from "@/lib/api/course-format";
import { loadRacetracks } from "@/lib/data/registry";
import { defaultRaceImpactProfile } from "@/lib/race-impact";
import { buildRankingRequest } from "./build-request";

describe("buildRankingRequest", () => {
  test("R32: skill inputs carry no wisdom-check `activation` flag (dead data path, never read by the worker)", async () => {
    const track = (await loadRacetracks()).find((t) => t.courses.some((c) => c.id === 10808))!;
    const course = flattenCourse(track.courses.find((c) => c.id === 10808)!);
    const req = buildRankingRequest({ course, raceParams: {}, racerCount: 9, profile: defaultRaceImpactProfile() });
    const inputs = Object.values(req.skills);
    expect(inputs.length).toBeGreaterThan(100);
    for (const s of inputs) expect(Object.keys(s).sort()).toEqual(["conditionGroups", "id", "rarity"]);
  });
});
