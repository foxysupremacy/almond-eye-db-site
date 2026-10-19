import { describe, expect, test } from "bun:test";
import { skillsById } from "./registry";

describe("skill activation lot", () => {
  test("uniques are guaranteed (0)", () => {
    expect(skillsById.get(120171)?.activation).toBe(0); // Cascading Might
    expect(skillsById.get(100971)?.activation).toBe(0); // Still in Love unique
  });
  test("evolution and normal skills use the wisdom check (1)", () => {
    expect(skillsById.get(101703111)?.activation).toBe(1);
    expect(skillsById.get(204721)?.activation).toBe(1);
  });
});
