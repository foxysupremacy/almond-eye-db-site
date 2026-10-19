import { describe, expect, test } from "bun:test";
import { describeEffect, classifyEffect } from "./effects";
import { applicationRatingEnvironment } from "../skill-rating/application";

describe("effect and inherited-variant contracts", () => {
  test("a missing inherited variant never reuses stronger original effects", () => {
    const gold = { id: -42, rarity: 2, conditionGroups: [{ effects: [{ type: 27, value: 4500 }] }] };
    expect(applicationRatingEnvironment.resolveVariant?.(gold, "parent-factor")).toBeNull();
    expect(applicationRatingEnvironment.resolveVariant?.({ ...gold, rarity: 5 }, "inherited-unique")).toBeNull();
    const white = { ...gold, rarity: 1 };
    expect(applicationRatingEnvironment.resolveVariant?.(white, "parent-factor")).toBe(white);
  });

  test("self costs and start-delay modifiers are distinct from opponent debuffs", () => {
    expect(classifyEffect({ type: 21, value: -2500 })).toBe("current_speed");
    expect(describeEffect({ type: 21, value: -2500 }).sign).toBe("cost");
    expect(classifyEffect({ type: 10, value: 9000 })).toBeNull();
    expect(describeEffect({ type: 10, value: 9000 }).family).toBe("start_delay");
    expect(classifyEffect({ type: 27, value: -1000, target: 9 })).toBe("debuff");
  });
});
