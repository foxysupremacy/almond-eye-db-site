import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PinkSparkFields, withPinkSpark } from "@/features/parenting/components/pink-spark-fields";
import type { AptitudeKey } from "@/lib/parenting/loop-planner";
afterEach(cleanup);

function Probe() {
  const [goal, setGoal] = useState<{ pink?: AptitudeKey | null; pinkStars?: number; blue?: number }>({ blue: 1 });
  return <><PinkSparkFields value={goal.pink} stars={goal.pinkStars} onChange={(v, s) => setGoal((g) => withPinkSpark(g, v, s))} />
    <output>{JSON.stringify(goal)}</output></>;
}
const out = () => document.querySelector("output")!.textContent;

test("choosing an aptitude defaults to 3 stars and keeps unrelated fields", async () => {
  const user = userEvent.setup(); render(<Probe />);
  await user.click(screen.getByRole("radio", { name: "Medium" }));
  expect(out()).toBe('{"blue":1,"pink":"Medium","pinkStars":3}');
  await user.click(screen.getByRole("radio", { name: "1 stars" }));
  expect(out()).toBe('{"blue":1,"pink":"Medium","pinkStars":1}');
});

test("Not set removes the spark; No factor stores null / 0", async () => {
  const user = userEvent.setup(); render(<Probe />);
  await user.click(screen.getByRole("radio", { name: "Dirt" }));
  await user.click(screen.getByRole("button", { name: "No factor" }));
  expect(out()).toBe('{"blue":1,"pink":null,"pinkStars":0}');
  await user.click(screen.getByRole("button", { name: "Not set" }));
  expect(out()).toBe('{"blue":1}');
});

test("withPinkSpark is the mapping every pink editor uses", () => {
  expect(withPinkSpark({ pink: "Turf" as AptitudeKey, pinkStars: 2 }, undefined, undefined)).toEqual({});
  expect(withPinkSpark({}, "Long", 3)).toEqual({ pink: "Long", pinkStars: 3 });
});
