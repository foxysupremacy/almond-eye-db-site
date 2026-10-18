import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { benchmarkMetrics, benchmarkPairs, median, type BenchmarkMetrics, type UtoolsFixture } from "./utools-benchmark";

/**
 * U-tools benchmark over 37 courses (step 5a, task 4). Fixtures are the reduced U-tools captures in
 * fixtures/utools/ (scripts/reduce-utools-fixtures.ts: costume, style, U-tools total, unique and slot picks; the Oct CM
 * Kyoto 2200 capture is kyoto-10808.json). Every costume is ranked by the production engine in the style U-tools
 * scored it in, and the totals are compared over ALL rows (not just the top 20).
 *
 * Gates (set from the step 5a values minus a small margin; raise them when the engine gets closer):
 * - every course: all-rows Spearman rho >= PER_COURSE_RHO_FLOOR (lowest after step 5a: 0.541, Nakayama 3600);
 * - the median over the courses: >= MEDIAN_RHO_FLOOR (step 5a: 0.766; Kyoto 10808 0.844).
 * Step 5d (R32: no wisdom or lottery roll, prerequisites and popularity met) still passes both gates: median 0.761,
 * lowest 0.551 (Nakayama 3600), Kyoto 10808 0.833. U-tools keeps its x0.925 wisdom roll on evolutions, so our totals now
 * run about 4% higher (median ratio 1.029); ranks are almost unaffected.
 * The old top-20 rho is logged for information only. Absolute values are report-only (spec 7.4).
 */
const PER_COURSE_RHO_FLOOR = 0.52;
const MEDIAN_RHO_FLOOR = 0.74;

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/utools");
const fixtures: UtoolsFixture[] = fs.readdirSync(dir).filter((f) => /-\d+\.json$/.test(f)).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as UtoolsFixture);

const metrics: BenchmarkMetrics[] = [];
for (const fx of fixtures) metrics.push(benchmarkMetrics(fx.courseId, await benchmarkPairs(fx)));

const f3 = (n: number) => n.toFixed(3);
console.log(`[U-tools benchmark] ${metrics.length} courses; all-rows rho median ${f3(median(metrics.map((m) => m.rho)))} `
  + `(min ${f3(Math.min(...metrics.map((m) => m.rho)))}); top-20 rho median ${f3(median(metrics.map((m) => m.rhoTop20)))} (informational); `
  + `median ratio median ${f3(median(metrics.map((m) => m.medianRatio)))}`);
const kyoto = metrics.find((m) => m.courseId === 10808);
if (kyoto) console.log(`[U-tools benchmark] Kyoto 10808: rho ${f3(kyoto.rho)}, top-20 rho ${f3(kyoto.rhoTop20)}, median ratio ${f3(kyoto.medianRatio)}, top-10 overlap ${kyoto.top10Overlap}/10`);

describe("U-tools benchmark: 37 courses, all rows", () => {
  test("the 37 reduced fixtures load and every row but at most one per course (a costume missing from our data) is ranked in U-tools' style", () => {
    expect(fixtures.length).toBe(37);
    for (const [i, m] of metrics.entries()) expect({ course: m.courseId, matched: m.n >= fixtures[i].rows.length - 1 }).toEqual({ course: m.courseId, matched: true });
  });

  test(`every course: all-rows Spearman rho >= ${PER_COURSE_RHO_FLOOR}`, () => {
    for (const m of metrics) expect({ course: m.courseId, rho: m.rho >= PER_COURSE_RHO_FLOOR ? "ok" : f3(m.rho) }).toEqual({ course: m.courseId, rho: "ok" });
  });

  test(`median all-rows Spearman rho over the courses >= ${MEDIAN_RHO_FLOOR}`, () => {
    expect(median(metrics.map((m) => m.rho))).toBeGreaterThanOrEqual(MEDIAN_RHO_FLOOR);
  });
});
