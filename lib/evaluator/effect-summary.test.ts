import { describe, expect, test } from "bun:test";
import { summarizeSkillEffects } from "./effect-summary";

describe("summarizeSkillEffects", () => {
  test("collects categories, strongest values and longest base time", () => {
    const summary = summarizeSkillEffects([
      { base_time: 5000, effects: [{ type: 31, value: 1200 }, { type: 27, value: 2000 }] },
      { base_time: 8000, effects: [{ type: 21, value: 2500 }, { type: 9, value: 1 }] },
    ]);
    expect(summary.hasAccel).toBe(true);
    expect(summary.hasTargetSpeed).toBe(true);
    expect(summary.hasCurrentSpeed).toBe(true);
    expect(summary.hasHeal).toBe(true);
    expect(summary.maxBaseTime).toBe(8000);
    expect(summary.maxAccelVal).toBe(1200);
    expect(summary.maxSpeedVal).toBe(2500);
    expect(summary.zenkaiOnly).toBe(false);
  });

  test("marks a zenkai-only skill without treating empty groups as a skill", () => {
    const summary = summarizeSkillEffects([{ effects: [{ type: 48, value: 1700 }] }]);
    expect(summary.hasZenkaiAcceleration).toBe(true);
    expect(summary.maxZenkaiAccelerationVal).toBe(1700);
    expect(summary.zenkaiOnly).toBe(true);
    expect(summarizeSkillEffects(undefined).zenkaiOnly).toBe(false);
  });
});
