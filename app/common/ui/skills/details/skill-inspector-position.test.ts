import { describe, expect, test } from "bun:test";
import { calculateSkillInspectorPosition, type InspectorRect } from "@/app/common/ui/skills/details/skill-inspector-position";

const viewport = { left: 0, top: 0, width: 1200, height: 800 };
const rect = (left: number, top: number, width: number, height: number): InspectorRect => ({ left, top, width, height, right: left + width, bottom: top + height });

describe("skill inspector placement", () => {
  test("prefers the right side and centers vertically on the trigger", () => {
    expect(calculateSkillInspectorPosition(rect(200, 300, 120, 32), { width: 420, height: 300 }, viewport)).toEqual({ x: 328, y: 166, side: "right" });
  });

  test("flips left when the panel does not fit on the right", () => {
    expect(calculateSkillInspectorPosition(rect(900, 300, 120, 32), { width: 420, height: 300 }, viewport)).toEqual({ x: 472, y: 166, side: "left" });
  });

  test("clamps a tall panel to the top and bottom viewport padding", () => {
    expect(calculateSkillInspectorPosition(rect(300, 0, 120, 32), { width: 420, height: 900 }, viewport)).toEqual({ x: 428, y: 16, side: "right" });
    expect(calculateSkillInspectorPosition(rect(300, 750, 120, 32), { width: 420, height: 300 }, viewport)).toEqual({ x: 428, y: 484, side: "right" });
  });

  test("uses the roomier side and clamps within a narrow visual viewport", () => {
    expect(calculateSkillInspectorPosition(rect(120, 300, 24, 32), { width: 320, height: 200 }, { left: 100, top: 40, width: 400, height: 360 })).toEqual({ x: 152, y: 184, side: "right" });
  });
});
