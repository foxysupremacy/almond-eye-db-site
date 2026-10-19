import { describe, expect, test } from "bun:test";
import { dynamicActivationRate } from "./prior";

describe("dynamicActivationRate (R7.4, per @ branch)", () => {
  const rate = (table: Record<string, number>) => (key: string) => table[key] ?? 1;

  test("no dynamic keys -> 1", () => {
    expect(dynamicActivationRate("phase==2&order<=3", null, rate({ overtake: 0.2 }))).toBe(1);
  });

  test("a single branch multiplies the rates of its keys", () => {
    expect(dynamicActivationRate("is_overtake==1&blocked_front==1", null, rate({ overtake: 0.5, blocked: 0.4 }))).toBeCloseTo(0.2, 10);
  });

  test("OR branches combine as 1 - prod(1 - branch rate)", () => {
    expect(dynamicActivationRate("is_overtake==1&phase==2@blocked_front==1", null, rate({ overtake: 0.3, blocked: 0.5 }))).toBeCloseTo(1 - 0.7 * 0.5, 10);
    // the second branch has no dynamic key, so it is certain
    expect(dynamicActivationRate("is_overtake==1&phase==2@phase_random==2", null, rate({ overtake: 0 }))).toBe(1);
  });

  test("other_skill (is_activate_other_skill_detail) is a chain marker, never a rate", () => {
    expect(dynamicActivationRate("is_activate_other_skill_detail==1&phase==3", null, rate({ other_skill: 0 }))).toBe(1);
  });

  test("the precondition multiplies in, evaluated per its own branches", () => {
    expect(dynamicActivationRate("phase==2", "is_overtake==1", rate({ overtake: 0.25 }))).toBeCloseTo(0.25, 10);
  });
});
