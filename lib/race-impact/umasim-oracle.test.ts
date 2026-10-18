import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRacetracks } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { defaultRaceImpactProfile } from "./profile";
import { effectValues, NO_EFFECT, scaledDuration, simulateRun, simulationInputFor } from "./trace";

const EXPECTED_FIXTURES = 18;

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/umasim");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
const tracks = files.length ? await loadRacetracks() : [];

/**
 * Planned fixes, plus "unattributed" (cause not isolated). The former "type22-model" misses were frame alignment (step 4c).
 * Step 3b (R21) models the per-section random at its mean, so every former "section-random" gap now passes.
 * "frame-timing" (user-authorised, step 4b): a gain that depends on where the frames fall against the spurt / slope
 * boundaries or a skill's activation. Step 4c switches phase, slope and skills between frames (the mean over a uniform
 * alignment), which removed 15 such misses (10 frame-timing, 5 formerly tagged type22-model). What is left is the
 * fixtures' own frame alignment: 40 seeds average over only a fraction of a frame (mechanics doc start delay at ~3 m/s),
 * not over a uniform alignment.
 */
type GapFix = "newer-mechanics" | "frame-timing" | "unattributed";

/**
 * Checks that are known to miss umasim, keyed `<fixture file>|<check>`. A known gap is reported but does not fail;
 * the guard below FAILS when one starts passing, so the list can only shrink. Every other check must pass.
 * `<check>` is "baseline" (vs umasim stock), "classic baseline" (vs umasim with the newer JP mechanics off), the
 * fixture skill label (gain vs stock) or "classic: <label>" (gain vs classic).
 */
const KNOWN_GAPS: Record<string, { fix: GapFix; reason: string }> = {
  // Baselines vs stock: stock adds full spurt, stamina limit break and conserve power (0.1-0.85 s faster than classic).
  "chukyo-10704.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "fukushima-10404.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "funabashi-11404.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "hanshin-10914.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "kawasaki-11303.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "kokura-11004.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "kyoto-10808.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "longchamp-11203.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "morioka-11504.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "nakayama-10501.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "nakayama-10506.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "niigata-10305.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "ooi-11103.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "sapporo-10101.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "tokyo-10602.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "tokyo-10606.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "tokyo-10611.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics; vs classic see below" },
  "kyoto-10810.json|baseline": { fix: "newer-mechanics", reason: "stock-only mechanics and missing slopes cancel to about +0.05 s" },
  // Per-skill gains vs stock.
  "chukyo-10704.json|accel 0.4 for 3s base @1333m": { fix: "newer-mechanics", reason: "conserve power / full spurt overlap the accel window (classic matches)" },
  "hanshin-10914.json|target speed 0.35 for 3s base @2133m": { fix: "unattributed", reason: "near zero in both (0.000 vs 0.001 s): umasim still accelerating at spurt start; not a slope effect" },
  "hanshin-10914.json|accel 0.4 for 3s base @2133m": { fix: "newer-mechanics", reason: "stock 0.32 vs classic 0.40" },
  "kawasaki-11303.json|accel 0.4 for 3s base @1400m": { fix: "newer-mechanics", reason: "stock 0.430 vs classic 0.506 (ours 0.511)" },
  "hanshin-10914.json|target speed 0.35 for 3s base @1600m": { fix: "newer-mechanics", reason: "stock 0.160 vs classic 0.173 (ours 0.178, +3% vs classic); passed vs stock before step 4c only by frame alignment" },
  "hanshin-10914.json|current speed 0.15 for 3s base @1600m": { fix: "newer-mechanics", reason: "stock 0.069 vs classic 0.075 (ours 0.078, +4% vs classic); passed vs stock before step 4c only by frame alignment" },
  "hanshin-10914.json|current speed 0.15 for 3s base @2133m": { fix: "newer-mechanics", reason: "stock 0.054 vs classic 0.059 (ours 0.062)" },
  "kyoto-10808.json|accel 0.4 for 3s base @1467m": { fix: "newer-mechanics", reason: "stock 0.425 vs classic 0.481 (ours 0.484)" },
  "kyoto-10810.json|accel 0.4 for 3s base @2000m": { fix: "newer-mechanics", reason: "classic matches after slopes (0.833 vs 0.826); stock 0.745" },
  "morioka-11504.json|accel 0.4 for 3s base @1333m": { fix: "newer-mechanics", reason: "stock 0.431 vs classic 0.507 (ours 0.509)" },
  "niigata-10305.json|accel 0.4 for 3s base @1200m": { fix: "newer-mechanics", reason: "stock 0.405 vs classic 0.472" },
  "ooi-11103.json|accel 0.4 for 3s base @1333m": { fix: "newer-mechanics", reason: "stock 0.432 vs classic 0.508 (ours 0.509)" },
  "tokyo-10611.json|accel 0.4 for 3s base @1067m": { fix: "newer-mechanics", reason: "classic matches after slopes (0.716 vs 0.708); stock 0.568" },
  "tokyo-10602.json|accel 0.4 for 3s base @1067m": { fix: "newer-mechanics", reason: "step 3: classic now matches (0.584 vs 0.584); stock 0.459" },
  // Frame alignment (step 4b tag): after step 4c's sub-frame switching ours is the uniform-alignment mean, umasim's is not.
  "sapporo-10101.json|current speed 0.15 for 3s base @600m": { fix: "frame-timing", reason: "ours 0.0265 s = the 0.021-0.035 alignment span's mean (0.0265); umasim 0.031: its 40 seeds cover only part of a frame's alignment" },
  "hanshin-10914.json|classic: target speed 0.35 for 3s base @2133m": { fix: "frame-timing", reason: "near zero in both: ours 0.0001 vs 0.0013 s (0.02 m). A skill at the spurt point now starts with the spurt (sub-frame); the umasim result keeps an occasional pre-spurt frame. Was 0.0003 (inside the 1 ms floor) before step 4c" },
  "sapporo-10101.json|classic: current speed 0.15 for 3s base @600m": { fix: "frame-timing", reason: "ours 0.0265 s = the 0.021-0.035 alignment span's mean (0.0265); umasim 0.031: its 40 seeds cover only part of a frame's alignment" },
};

const checkKeys = new Set<string>();

/** A check either passes, or is a known gap that must still miss (the guard). */
function oracleCheck(file: string, check: string, title: string, measure: () => { ok: boolean; detail: string }): void {
  const key = `${file}|${check}`;
  checkKeys.add(key);
  const gap = KNOWN_GAPS[key];
  if (!gap) {
    test(`${file}: ${title}`, () => {
      const { ok, detail } = measure();
      if (!ok) throw new Error(`${key} missed umasim: ${detail}`);
      expect(ok).toBe(true);
    });
    return;
  }
  test(`${file}: ${title} [known gap: ${gap.fix}]`, () => {
    const { ok, detail } = measure();
    // Reported, not failed. The guard: a known gap that now passes must be removed from KNOWN_GAPS.
    console.info(`[umasim known gap: ${gap.fix}] ${key}: ${detail} (${gap.reason})`);
    if (ok) throw new Error(`${key} now matches umasim (${detail}): remove it from KNOWN_GAPS`);
    expect(ok).toBe(false);
  });
}

describe("umasim oracle (spec 7.3)", () => {
  for (const file of files) {
    const fx = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    let course: ReturnType<typeof flattenCourse> | undefined;
    for (const t of tracks) { const r = t.courses.find((c) => c.id === fx.courseId); if (r) course = flattenCourse(r); }
    const profile = { ...defaultRaceImpactProfile(), stats: fx.stats };
    // The fixtures ran with umasim's randomness fixed and downhill accel mode off.
    const input = { ...simulationInputFor(course as never, profile, fx.style), downhillMode: false };
    const base = simulateRun(input, null, 0, NO_EFFECT);
    oracleCheck(file, "baseline", "baseline finish within +-0.05 s", () => {
      const delta = base.finishTime - fx.baselineFinishSeconds;
      return { ok: Math.abs(delta) <= 0.05, detail: `ours ${base.finishTime.toFixed(3)} vs ${fx.baselineFinishSeconds.toFixed(3)} (${delta.toFixed(3)} s)` };
    });
    const classic = fx.umasimSettings?.classicBaselineFinishSeconds;
    if (typeof classic === "number") {
      oracleCheck(file, "classic baseline", "classic baseline finish within +-0.05 s", () => {
        const delta = base.finishTime - classic;
        return { ok: Math.abs(delta) <= 0.05, detail: `ours ${base.finishTime.toFixed(3)} vs classic ${classic.toFixed(3)} (${delta.toFixed(3)} s)` };
      });
    }
    for (const s of fx.skills) {
      oracleCheck(file, s.label, `${s.label} time gain within +-10%`, () => {
        const run = simulateRun(input, s.activationMeter, scaledDuration(s.baseTime, course!.length), effectValues(s.effects));
        const gain = base.finishTime - run.finishTime;
        const ok = Math.abs(gain - s.timeGainSeconds) <= Math.abs(s.timeGainSeconds) * 0.1 + 1e-3;
        return { ok, detail: `ours ${gain.toFixed(4)} vs ${Number(s.timeGainSeconds).toFixed(4)} s` };
      });
      if (typeof s.classicTimeGainSeconds === "number") {
        oracleCheck(file, `classic: ${s.label}`, `classic: ${s.label} time gain within +-10%`, () => {
          const run = simulateRun(input, s.activationMeter, scaledDuration(s.baseTime, course!.length), effectValues(s.effects));
          const gain = base.finishTime - run.finishTime;
          const ok = Math.abs(gain - s.classicTimeGainSeconds) <= Math.abs(s.classicTimeGainSeconds) * 0.1 + 1e-3;
          return { ok, detail: `ours ${gain.toFixed(4)} vs classic ${Number(s.classicTimeGainSeconds).toFixed(4)} s` };
        });
      }
    }
  }
  // The 18 committed fixtures (umasim SHA ca692ed); a missing directory must fail, not silently skip the oracle.
  test("all 18 umasim fixtures are present", () => {
    expect(files.length).toBe(EXPECTED_FIXTURES);
  });
  test("every known gap names an existing check", () => {
    expect(Object.keys(KNOWN_GAPS).filter((key) => !checkKeys.has(key))).toEqual([]);
  });
});
