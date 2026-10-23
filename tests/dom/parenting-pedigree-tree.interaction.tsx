import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { charactersById } from "@/lib/data/registry";
import { DEFAULT_PARENTING_SETUP } from "@/lib/parenting/state";
import { ParentingLoopOptimizer } from "@/features/parenting/loop-optimizer";
afterEach(cleanup);

test("tapping a GGP tile opens its sheet; switching to desktop closes it", async () => {
  const user = userEvent.setup();
  const props = { target: charactersById.get(106802)!, veterans: [], roster: [], setup: DEFAULT_PARENTING_SETUP, targetStage: null, onOpenPicker: () => {}, updateSetup: () => {} };
  const { rerender } = render(<ParentingLoopOptimizer tier="phone" {...props} />);
  await user.click(screen.getByRole("button", { name: "Edit GGP · Parent 2 · left → left" }));
  expect(screen.getByRole("dialog", { name: "GGP · Parent 2 · left → left" })).toBeTruthy();
  await act(async () => rerender(<ParentingLoopOptimizer tier="desktop" {...props} />));
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => rerender(<ParentingLoopOptimizer tier="phone" {...props} />));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("Choose uma from the GGP sheet calls onOpenPicker and the sheet stays open", async () => {
  const user = userEvent.setup(); const picked: string[] = [];
  render(<ParentingLoopOptimizer tier="phone" target={charactersById.get(106802)!} veterans={[]} roster={[]} setup={DEFAULT_PARENTING_SETUP} targetStage={null} onOpenPicker={(s) => picked.push(s)} updateSetup={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Edit GGP · Parent 1 · left → left" }));
  await user.click(screen.getByRole("button", { name: "Choose uma" }));
  expect(picked).toEqual(["p1_gp1_g1"]);
  expect(screen.getByRole("dialog", { name: "GGP · Parent 1 · left → left" })).toBeTruthy();
});

test("the unified P/GP card opens the picker directly on phone, without a sheet", async () => {
  const user = userEvent.setup(); const picked: string[] = [];
  render(<ParentingLoopOptimizer tier="phone" target={charactersById.get(106802)!} veterans={[]} roster={[]} setup={DEFAULT_PARENTING_SETUP} targetStage={null} onOpenPicker={(s) => picked.push(s)} updateSetup={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Choose P1" }));
  expect(picked).toEqual(["p1"]);
  expect(screen.queryByRole("dialog")).toBeNull();
});
