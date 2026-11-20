import { describe, expect, test } from "bun:test";
import { computeIndicatorBox } from "./use-active-indicator";

describe("computeIndicatorBox", () => {
  test("positions the pill relative to the container", () => {
    expect(
      computeIndicatorBox(
        { left: 100, top: 50, width: 600, height: 56 },
        { left: 180, top: 58, width: 90, height: 32 },
        { left: 0, top: 0 },
        { left: 0, top: 0 },
      ),
    ).toEqual({ x: 80, y: 8, width: 90, height: 32 });
  });

  test("adds horizontal scroll so the pill stays on a scrolled-away link", () => {
    expect(
      computeIndicatorBox(
        { left: 100, top: 50, width: 300, height: 56 },
        { left: 60, top: 58, width: 90, height: 32 },
        { left: 120, top: 0 },
        { left: 0, top: 0 },
      ).x,
    ).toBe(80);
  });

  test("subtracts the container border (absolute children use the padding box)", () => {
    expect(
      computeIndicatorBox(
        { left: 0, top: 700, width: 390, height: 64 },
        { left: 20, top: 706, width: 36, height: 28 },
        { left: 0, top: 0 },
        { left: 0, top: 1 },
      ),
    ).toEqual({ x: 20, y: 5, width: 36, height: 28 });
  });
});
