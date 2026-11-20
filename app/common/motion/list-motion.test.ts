import { describe, expect, test } from "bun:test";
import { LIST_MOTION_MAX_ROWS, LIST_MOTION_OPTIONS, shouldAnimateList } from "./list-motion";

describe("shouldAnimateList", () => {
  test("animates short and medium lists", () => {
    expect(shouldAnimateList(0)).toBe(true);
    expect(shouldAnimateList(12)).toBe(true);
    expect(shouldAnimateList(LIST_MOTION_MAX_ROWS)).toBe(true);
  });

  test("turns off above the row cap to protect long lists", () => {
    expect(shouldAnimateList(LIST_MOTION_MAX_ROWS + 1)).toBe(false);
    expect(shouldAnimateList(400)).toBe(false);
  });
});

describe("LIST_MOTION_OPTIONS", () => {
  test("stays within the 300ms motion budget and uses out-quart", () => {
    expect(LIST_MOTION_OPTIONS.duration).toBeLessThanOrEqual(300);
    expect(LIST_MOTION_OPTIONS.easing).toBe("cubic-bezier(0.165, 0.84, 0.44, 1)");
  });
});
