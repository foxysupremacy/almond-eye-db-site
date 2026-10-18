import { describe, expect, test } from "bun:test";
import { defaultRaceImpactProfile } from "./profile";
import {
  computeGainDistribution,
  generateRaceTrace,
  getCruisingTargetSpeed,
  getPhaseAtMeter,
  meterToBaselineTime,
  timeToBaselineMeter,
} from "./trace";

const course = {
  id: 10608,
  trackId: 10006,
  length: 2400,
  terrain: 1,
  turn: 1,
  distance: 3,
  inout: 1,
  corners: [],
  straights: [],
  slopes: [],
  spurtStart: { meters: 1600 },
};

describe("race trace physics simulation", () => {
  test("uses mechanics target-speed equations for cruise and spurt references", () => {
    const stats = defaultRaceImpactProfile().stats;
    const base = 20 - (2400 - 2000) / 1000;
    expect(getCruisingTargetSpeed(1, 2400, stats, 2)).toBeCloseTo(base * 0.991);
    expect(getCruisingTargetSpeed(2, 2400, stats, 2)).toBeCloseTo(base * 0.975 + Math.sqrt(500 * stats.speed) * 0.002);
    expect(getCruisingTargetSpeed(3, 2400, stats, 2)).toBeCloseTo(
      // Mechanics §Last Spurt: (BaseTargetSpeedPhase2 + 0.01*base)*1.05 + speed term + guts term, phase-2 target = late coef + speed term.
      (base * 0.975 + Math.sqrt(500 * stats.speed) * 0.002 + 0.01 * base) * 1.05 + Math.sqrt(500 * stats.speed) * 0.002 + Math.pow(450 * stats.guts, 0.597) * 0.0001,
    );
  });

  test("generates monotonic baseline trajectory from start to finish", () => {
    const trace = generateRaceTrace(null, {
      course,
      profile: defaultRaceImpactProfile(),
      runningStyle: 2,
    });

    expect(trace.points.length).toBeGreaterThan(30);
    expect(trace.points[0].baselineMeter).toBeGreaterThanOrEqual(0);
    expect(trace.points[trace.points.length - 1].baselineMeter).toBe(2400);

    // Monotonicity check
    for (let i = 1; i < trace.points.length; i++) {
      expect(trace.points[i].timeSeconds).toBeGreaterThan(trace.points[i - 1].timeSeconds);
      expect(trace.points[i].baselineMeter).toBeGreaterThanOrEqual(trace.points[i - 1].baselineMeter);
    }

    // Phases progression
    expect(getPhaseAtMeter(100, 2400, 1600)).toBe(0);
    expect(getPhaseAtMeter(500, 2400, 1600)).toBe(1);
    expect(getPhaseAtMeter(1500, 2400, 1600)).toBe(1);
    expect(getPhaseAtMeter(1600, 2400, 1600)).toBe(3);
  });

  test("accurately models target speed skill duration and distance gain", () => {
    const skill = {
      id: 101,
      conditionGroups: [
        {
          condition: "phase==1",
          base_time: 30_000,
          effects: [{ type: 27, value: 3500 }], // +0.35 m/s target speed
        },
      ],
    };

    const trace = generateRaceTrace(skill, {
      course,
      profile: defaultRaceImpactProfile(),
      runningStyle: 2,
    }, 800, [{ regions: [{ start: 600, end: 1200 }], isRandom: false }]);

    expect(trace.physicsStatus).toBe("modeled");
    expect(trace.activationMeter).toBe(800);
    expect(trace.distanceGainMeters).toBeGreaterThan(1.0);
    expect(trace.timeGainSeconds).toBeGreaterThan(0.04);
    expect(trace.bashinGain).toBeGreaterThan(0.4);
  });

  test("acceleration skill gains peak near spurt start and drop earlier", () => {
    const accelSkill = {
      id: 102,
      conditionGroups: [
        {
          condition: "phase>=2",
          base_time: 20_000,
          effects: [{ type: 31, value: 4000 }], // +0.40 m/s^2 accel
        },
      ],
    };

    const zones = [{ regions: [{ start: 1000, end: 2000 }], isRandom: false }];
    const dist = computeGainDistribution(accelSkill, zones, {
      course,
      profile: defaultRaceImpactProfile(),
    }, {
      geometryRate: 1,
      dynamicRate: 1,
      dependsOnPreviousTrigger: false,
      activationRate: 0.95,
      dynamicKeys: [],
      priorSource: "manual",
      priorSamples: 0,
      confidence: "high",
    });

    expect(dist.optimalMeter).not.toBeNull();
    // Accel skill peak should be close to spurtStart (1600m)
    expect(Math.abs((dist.optimalMeter ?? 0) - 1600)).toBeLessThanOrEqual(40);
    expect(dist.maxGainMeters).toBeGreaterThan(2.0);

    // Meter 1000 (well before spurt) should have low gain compared to spurt start
    const earlySample = dist.samples.find((s) => s.meter === 1000);
    const spurtSample = dist.samples.find((s) => s.meter === 1600);
    expect(earlySample?.gainMeters ?? 0).toBeLessThan(spurtSample?.gainMeters ?? 1);
  });

  test("scales skill duration by course distance and carries a pre-spurt speed effect into the spurt", () => {
    const skill = { id: 109, conditionGroups: [{ condition: "phase==2", base_time: 10_000, effects: [{ type: 27, value: 3_500 }] }] };
    const trace = generateRaceTrace(skill, { course, profile: defaultRaceImpactProfile(), runningStyle: 2 }, 1550);
    expect(trace.activationTimeSeconds).toBeGreaterThan(50);
    expect(trace.effectEndTimeSeconds - trace.activationTimeSeconds).toBeCloseTo(2.4, 1);
    const crossing = trace.points.find((point) => point.baselineMeter >= 1600);
    expect(crossing).toBeDefined();
    expect(crossing!.skillSpeed).toBeGreaterThanOrEqual(crossing!.baselineSpeed);
  });

  test("exposes spatial baseline and skill curves and models current-speed as an actual-speed modifier for the window", () => {
    const skill = { id: 112, conditionGroups: [{ condition: "phase==1", base_time: 10_000, effects: [{ type: 21, value: 4_500 }] }] };
    const trace = generateRaceTrace(skill, { course, profile: defaultRaceImpactProfile(), runningStyle: 2 }, 1000);
    expect(trace.spatialPoints.length).toBeGreaterThan(100);
    const before = trace.spatialPoints.find((point) => point.meter === 960)!;
    const during = trace.spatialPoints.find((point) => point.meter === 1008)!;
    expect(before.skillSpeed).toBeCloseTo(before.baselineSpeed, 1);
    // Window modifier: skill speed - baseline speed ~= value (0.45 m/s).
    expect(during.skillSpeed - during.baselineSpeed).toBeCloseTo(0.45, 1);
    // Type 21 leaves current speed untouched after the window.
    const afterPoint = trace.spatialPoints.find((point) => point.meter >= 1300)!;
    expect(afterPoint.skillSpeed - afterPoint.baselineSpeed).toBeCloseTo(0, 1);
  });

  test("raises target speed during the skill window and applies acceleration without a target jump", () => {
    const targetSkill = { id: 113, conditionGroups: [{ condition: "phase==1", base_time: 10_000, effects: [{ type: 27, value: 3_500 }] }] };
    const targetTrace = generateRaceTrace(targetSkill, { course, profile: defaultRaceImpactProfile(), runningStyle: 2 }, 1000);
    const targetPoint = targetTrace.spatialPoints.find((point) => point.meter >= 1024)!;
    expect(targetPoint.skillTargetSpeed - targetPoint.baselineTargetSpeed).toBeCloseTo(0.35, 1);

    const accelSkill = { id: 114, conditionGroups: [{ condition: "phase==1", base_time: 10_000, effects: [{ type: 31, value: 4_000 }] }] };
    // Acceleration only matters while below target: activate at spurt start (1600 m), where the horse is still ramping.
    const accelTrace = generateRaceTrace(accelSkill, { course, profile: defaultRaceImpactProfile(), runningStyle: 2 }, 1600);
    const accelPoint = accelTrace.spatialPoints.find((point) => point.meter >= 1624)!;
    expect(accelPoint.skillTargetSpeed).toBeCloseTo(accelPoint.baselineTargetSpeed, 1);
    expect(accelPoint.skillSpeed).toBeGreaterThan(accelPoint.baselineSpeed);
  });

  test("a later resolved condition group reports a smaller gain than an earlier stronger one", async () => {
    const { loadRacetracks, skillsById } = await import("../data/registry");
    const { flattenCourse } = await import("../api/course-format");
    const { resolveConditionGroup } = await import("./condition-group");
    let lc: ReturnType<typeof flattenCourse> | null = null;
    let trackId = 0;
    for (const track of await loadRacetracks()) {
      const row = track.courses.find((c) => c.id === 11203);
      if (row) { lc = flattenCourse(row); trackId = track.id; break; }
    }
    const lcCourse = { ...lc!, trackId };
    const skill = skillsById.get(120171)!;
    const resolved = resolveConditionGroup(skill, lcCourse, { groundCondition: 3 }, 2)!;
    const ctx = { course: lcCourse, profile: defaultRaceImpactProfile(), runningStyle: 2 as const };
    const zones = [resolved.zones];
    const strong = generateRaceTrace(skill, ctx, undefined, zones, { groupIndex: 0 });
    const weak = generateRaceTrace(skill, ctx, undefined, zones, { groupIndex: 1 });
    expect(weak.bashinGain).toBeLessThan(strong.bashinGain);
  });

  test("null activation leaves an unmodified trace and no sweet-spot marker", () => {
    const skill = { id: 115, conditionGroups: [{ condition: "phase==1", base_time: 10_000, effects: [{ type: 21, value: 4_500 }] }] };
    const trace = generateRaceTrace(skill, { course, profile: defaultRaceImpactProfile(), runningStyle: 2 }, null);
    expect(trace.activationMeter).toBeNull();
    expect(trace.spatialPoints[50].skillSpeed).toBeCloseTo(trace.spatialPoints[50].baselineSpeed, 1);
  });

  test("distribution includes the full course, zero baseline and separates multiple eligible regions", () => {
    const skill = { id: 110, conditionGroups: [{ condition: "random", base_time: 10_000, effects: [{ type: 21, value: 4_500 }] }] };
    const activation = { activationRate: 0.5 } as never;
    const distribution = computeGainDistribution(skill, [
      { regions: [{ start: 400, end: 460 }, { start: 1500, end: 1540 }], isRandom: true },
    ], { course, profile: defaultRaceImpactProfile(), runningStyle: 2 }, activation);
    expect(distribution.samples[0].meter).toBe(0);
    expect(distribution.samples[0].eligible).toBe(false);
    expect(distribution.samples[0].gainMeters).toBe(0);
    expect(distribution.samples.some((sample) => sample.eligible && sample.meter >= 400 && sample.meter <= 460)).toBe(true);
    expect(distribution.samples.some((sample) => sample.eligible && sample.meter >= 1500 && sample.meter <= 1540)).toBe(true);
    expect(distribution.samples.find((sample) => sample.meter === 1000)?.eligible).toBe(false);
  });

  test("activation near the finish clips distance benefit instead of extending past the course", () => {
    const skill = { id: 111, conditionGroups: [{ condition: "phase==3", base_time: 50_000, effects: [{ type: 21, value: 4_500 }] }] };
    const distribution = computeGainDistribution(skill, [{ regions: [{ start: 2370, end: 2400 }], isRandom: false }],
      { course, profile: defaultRaceImpactProfile(), runningStyle: 2 }, { activationRate: 1 } as never);
    const nearFinish = distribution.samples.find((sample) => sample.meter === 2380)!;
    expect(nearFinish.eligible).toBe(true);
    expect(nearFinish.gainMeters).toBeGreaterThanOrEqual(0);
    expect(nearFinish.gainMeters).toBeLessThan(distribution.maxGainMeters);
    expect(distribution.samples.find((sample) => sample.meter === 2400)?.gainMeters).toBe(0);
  });

  test("coordinates conversion between baseline time and meter works seamlessly", () => {
    const trace = generateRaceTrace(null, {
      course,
      profile: defaultRaceImpactProfile(),
      runningStyle: 2,
    });

    const tMid = meterToBaselineTime(1200, trace);
    expect(tMid).toBeGreaterThan(40);
    expect(tMid).toBeLessThan(80);

    const mBack = timeToBaselineMeter(tMid, trace);
    expect(Math.abs(mBack - 1200)).toBeLessThanOrEqual(15);
  });
});
