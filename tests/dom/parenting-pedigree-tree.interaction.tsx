import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { charactersById } from "@/lib/data/registry";
import { DEFAULT_PARENTING_SETUP } from "@/lib/parenting/state";
import { ParentingLoopOptimizer } from "@/features/parenting/loop-optimizer";
afterEach(cleanup);

test("tapping a tile opens its sheet; switching to desktop closes it", async () => {
  const user = userEvent.setup();
  const props = { target: charactersById.get(106802)!, veterans: [], roster: [], setup: DEFAULT_PARENTING_SETUP, targetStage: null, onOpenPicker: () => {}, updateSetup: () => {} };
  const { rerender } = render(<ParentingLoopOptimizer tier="phone" {...props} />);
  await user.click(screen.getByRole("button", { name: "Edit GP · Parent 2 · left" }));
  expect(screen.getByRole("dialog", { name: "GP · Parent 2 · left" })).toBeTruthy();
  await act(async () => rerender(<ParentingLoopOptimizer tier="desktop" {...props} />));
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => rerender(<ParentingLoopOptimizer tier="phone" {...props} />));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("Choose uma from the sheet calls onOpenPicker and the sheet stays open", async () => {
  const user = userEvent.setup(); const picked: string[] = [];
  render(<ParentingLoopOptimizer tier="phone" target={charactersById.get(106802)!} veterans={[]} roster={[]} setup={DEFAULT_PARENTING_SETUP} targetStage={null} onOpenPicker={(s) => picked.push(s)} updateSetup={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Edit Parent 1" }));
  await user.click(screen.getByRole("button", { name: "Choose uma" }));
  expect(picked).toEqual(["p1"]);
  expect(screen.getByRole("dialog", { name: "Parent 1" })).toBeTruthy();
});
