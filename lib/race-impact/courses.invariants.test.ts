import { describe, expect, test } from "bun:test";
import { loadRacetracks } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { defaultRaceImpactProfile } from "./profile";
import { effectValues, simulateRun, simulationInputFor, NO_EFFECT } from "./trace";

describe("all-course invariants (spec §7.2)", async () => {
  const tracks = await loadRacetracks();
  const courses = tracks.flatMap((t) => t.courses.map((r) => ({ ...flattenCourse(r), trackId: t.id })));
  test("there are 138 courses on 17 tracks", () => {
    expect(tracks.length).toBe(17);
    expect(courses.length).toBe(138);
  });
  for (const c of courses) {
    test(`course ${c.id} (${c.length} m): baseline finishes in a plausible window; speed buffs never slow`, () => {
      for (const style of [1, 2, 3, 4] as const) {
        const input = simulationInputFor(c, defaultRaceImpactProfile(), style);
        const base = simulateRun(input, null, 0, NO_EFFECT);
        expect(Number.isFinite(base.finishTime)).toBe(true);
        // average speed between 15 and 22 m/s
        expect(c.length / base.finishTime).toBeGreaterThan(15);
        expect(c.length / base.finishTime).toBeLessThan(22);
        const buff = simulateRun(input, c.length / 2, 3, effectValues([{ type: 27, value: 3500 }]));
        expect(buff.finishTime).toBeLessThanOrEqual(base.finishTime + 1e-9);
      }
    });
  }
});
