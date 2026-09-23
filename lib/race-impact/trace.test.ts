import { describe, expect, test } from "bun:test";
import { defaultRaceImpactProfile } from "./profile";
import {
  computeGainDistribution,
  generateRaceTrace,
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
      wisdomRate: 0.95,
      rankRate: 1,
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
