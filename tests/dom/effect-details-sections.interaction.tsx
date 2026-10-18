import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describeCondition } from "@/lib/skill-engine/describe";
import { skillsById } from "@/lib/data/registry";
import { ConditionBlocks, EffectBlocks, LevelStepper, orderRateRange, PositionDots } from "@/app/common/ui/skills/effect-details";

afterEach(cleanup);
const cascading = skillsById.get(120171)!;

describe("effect detail sections", () => {
  test("order_rate<=70 maps to positions per racer count", () => {
    expect(orderRateRange("phase==2&order_rate<=70", 9)).toEqual([1, 6]);
    expect(orderRateRange("phase==2&order_rate<=70", 12)).toEqual([1, 8]);
    expect(orderRateRange("phase==2", 9)).toBeNull();
  });
  test("orderRateRange consolidates every position term like describeCondition", () => {
    expect(orderRateRange("order_rate>=30&order_rate<=80", 9)).toEqual([3, 7]);
    expect(orderRateRange("order_rate>=30&order_rate<=80", 12)).toEqual([4, 10]);
    expect(orderRateRange("order>=3&order_rate<=70", 12)).toEqual([3, 8]);
    expect(orderRateRange("order_rate<=30&phase==1@order_rate<=50", 12)).toEqual([1, 6]);
    expect(orderRateRange("order_rate<=30@phase==1", 12)).toBeNull();
    expect(orderRateRange("order_rate<50", 12)).toEqual([1, 5]);
    expect(orderRateRange("order_rate>=50", 12)).toEqual([6, 12]);
    expect(orderRateRange("order_rate>50", 12)).toEqual([7, 12]);
    for (const [cond, n] of [["order_rate>=30&order_rate<=80", 9], ["order_rate>=30&order_rate<=80", 12], ["order>=3&order_rate<=70", 12], ["order_rate<50", 12], ["order_rate>=50", 12], ["order_rate>50", 12]] as const) {
      const [a, b] = orderRateRange(cond, n)!;
      const text = describeCondition(cond, null, n).when;
      expect(text.toLowerCase()).toContain(a === b ? `position ${a}` : `position ${a}–${b}`);
    }
  });
  test("racer count is normalized to 9..18", () => {
    expect(orderRateRange("order_rate<=50", 20)).toEqual([1, 9]);
    render(<PositionDots racerCount={20} range={[1, 6]} label="Position: 1st–6th" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(18);
  });
  test("position dots fill the allowed places", () => {
    render(<PositionDots racerCount={9} range={[1, 6]} label="CM condition: 1st–6th" />);
    const list = screen.getByRole("list", { name: "CM condition: 1st–6th" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(9);
    expect(within(list).getAllByRole("listitem").filter((li) => li.getAttribute("data-allowed") === "true")).toHaveLength(6);
  });
  test("conditions: one block per group with OR, active group tagged", () => {
    render(<ConditionBlocks groups={cascading.conditionGroups} activeIndex={1} venueLabel="Longchamp" racerCount={9} inactiveReasons={{ 0: "Track bonus: Japanese turf only" }} />);
    expect(screen.getAllByRole("group", { name: /condition group/i })).toHaveLength(2);
    expect(screen.getByText("Applies on Longchamp")).toBeTruthy();
    expect(screen.getByText("Track bonus: Japanese turf only")).toBeTruthy();
    expect(screen.getAllByText("OR").length).toBeGreaterThanOrEqual(1);
  });
  test("effects scale with level and show the duration formula", () => {
    const { rerender } = render(<EffectBlocks groups={cascading.conditionGroups} activeIndex={0} courseLength={2200} level={1} isUnique />);
    expect(screen.getAllByText(/0\.450 m\/s/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 s × 2\.2/).length).toBeGreaterThan(0);
    rerender(<EffectBlocks groups={cascading.conditionGroups} activeIndex={0} courseLength={2200} level={6} isUnique />);
    expect(screen.getAllByText(/0\.495 m\/s/).length).toBeGreaterThan(0);
  });
  test("level stepper bounds and delta", async () => {
    function Harness() {
      const [lv, setLv] = useState(1);
      return <LevelStepper level={lv} onChange={setLv} deltaBashin={lv === 1 ? null : 0.12} />;
    }
    const user = userEvent.setup();
    render(<Harness />);
    expect((screen.getByRole("button", { name: "Decrease unique level" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Increase unique level" }));
    expect(screen.getByText("Lv2")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Level delta" }).textContent).toContain("+0.12 Bashin vs Lv1");
  });
});
