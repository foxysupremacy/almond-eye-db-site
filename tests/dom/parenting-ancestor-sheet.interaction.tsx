import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { characters } from "@/lib/data/registry";
import { DEFAULT_PARENTING_SETUP, type ParentingSetup } from "@/lib/parenting/state";
import type { LoopUmaSlot } from "@/lib/parenting/loop-planner";
import { usePedigreeModel } from "@/features/parenting/hooks/use-pedigree-model";
import { AncestorSheet } from "@/features/parenting/pedigree/ancestor-sheet";
afterEach(cleanup);

const noNav = { navigate: () => {}, targetProps: (slot: string, layout: string) => ({ ref: () => {}, tabIndex: -1, "data-ancestor-slot": slot, "data-ancestor-layout": layout, className: "relative" }), highlightKey: () => null };
function Probe({ start, onChoose, tier = "phone" }: { start: LoopUmaSlot; onChoose?: (s: LoopUmaSlot) => void; tier?: "phone" | "tablet" }) {
  const [setup, setSetup] = useState<ParentingSetup>(DEFAULT_PARENTING_SETUP);
  const [slot, setSlot] = useState<LoopUmaSlot | null>(start);
  const model = usePedigreeModel({ target: characters[0], veterans: [], roster: characters, setup, updateSetup: (u) => setSetup(u) });
  return <><AncestorSheet slot={slot} tier={tier} model={model} navigation={noNav as never} onNavigate={setSlot} onChooseUma={onChoose ?? (() => {})} onClose={() => setSlot(null)} />
    <output data-testid="goals">{JSON.stringify(setup.loopConfig?.factorGoals ?? {})}</output></>;
}

test("sheet edits the pink spark and footer navigates sibling, parent and child", async () => {
  const user = userEvent.setup(); render(<Probe start="p1_gp2" />);
  expect(screen.getByRole("dialog", { name: "GP · Parent 1 · right" })).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: "Long" }));
  expect(screen.getByTestId("goals").textContent).toContain('"p1_gp2":{"pink":"Long","pinkStars":3}');
  await user.click(screen.getByRole("button", { name: "Go to GP · Parent 1 · left" }));
  expect(screen.getByRole("dialog", { name: "GP · Parent 1 · left" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Go to Parent 1" }));
  expect(screen.getByRole("dialog", { name: "Parent 1" })).toBeTruthy();
});

test("great-grandparent sheet on phone edits both deepest-row sparks inline", async () => {
  const user = userEvent.setup(); render(<Probe start="p2_gp1_g2" />);
  const groups = screen.getAllByRole("group", { name: /pink spark input/ });
  expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual(["P2 GP1 GGP2 GGGP1 pink spark input", "P2 GP1 GGP2 GGGP2 pink spark input"]);
  await user.click(screen.getAllByRole("radio", { name: "Dirt" })[1]);
  expect(screen.getByTestId("goals").textContent).toContain('"p2_gp1_g2_g1":{"pink":"Dirt","pinkStars":3}');
});

test("Choose uma hands the slot to the picker and keeps the sheet open", async () => {
  const user = userEvent.setup(); let chosen: string | null = null;
  render(<Probe start="p1" onChoose={(s) => { chosen = s; }} />);
  await user.click(screen.getByRole("button", { name: /Choose uma|Change/ }));
  expect(chosen).toBe("p1");
  expect(screen.getByRole("dialog", { name: "Parent 1" })).toBeTruthy();
});

test("parent sheet shows the genetic details section inline, without a popover", () => {
  render(<Probe start="p1" />);
  expect(screen.getByRole("dialog", { name: "Parent 1" }).textContent).toContain("Genetic assessment");
});

test("tablet great-grandparent sheet does not render inline deepest-row sparks", () => {
  render(<Probe start="p2_gp1_g2" tier="tablet" />);
  expect(screen.queryAllByRole("group", { name: /pink spark input/ })).toHaveLength(0);
});

test("tablet tier docks the dialog to the side, phone stays a bottom sheet", () => {
  const { unmount } = render(<Probe start="p1" tier="tablet" />);
  const side = screen.getByRole("dialog", { name: "Parent 1" });
  expect(side.closest('[class*="md:max-w-md"]')).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close Parent 1" }).className).toContain("md:min-h-11");
  unmount();
  render(<Probe start="p1" tier="phone" />);
  const bottom = screen.getByRole("dialog", { name: "Parent 1" });
  expect(bottom.closest('[class*="md:max-w-md"]')).toBeNull();
});

test("sheet shows a visible genetic status line", () => {
  render(<Probe start="p1" />);
  expect(screen.getByTestId("sheet-genetic-status").textContent).toContain("Select course / style");
});

test("footer keeps three buttons; missing targets are disabled with a label", () => {
  const { unmount } = render(<Probe start="p1" />);
  const none = screen.getByRole("button", { name: "No parent" }) as HTMLButtonElement;
  expect(none.disabled).toBe(true);
  unmount();
  render(<Probe start="p1_gp1_g1" />);
  expect((screen.getByRole("button", { name: "No child" }) as HTMLButtonElement).disabled).toBe(true);
});

test("phone great-grandparent sheet labels its own pink spark group distinctly", () => {
  render(<Probe start="p2_gp1_g2" />);
  expect(screen.getAllByRole("group", { name: "P2 GP1 GGP2 pink spark" })).toHaveLength(1);
});

test("side sheet keeps the tree visible; bottom sheet overlay is unchanged", () => {
  const { unmount } = render(<Probe start="p1" tier="tablet" />);
  const side = screen.getByRole("dialog", { name: "Parent 1" }).closest('[class*="fixed"]') as HTMLElement;
  expect(side.className).toContain("md:bg-black/20");
  unmount();
  render(<Probe start="p1" tier="phone" />);
  expect((screen.getByRole("dialog", { name: "Parent 1" }).closest('[class*="fixed"]') as HTMLElement).className).not.toContain("md:bg-black/20");
});

test("navigating to another slot resets the body scroll", async () => {
  const user = userEvent.setup(); render(<Probe start="p1_gp2" />);
  const body = screen.getByRole("dialog", { name: "GP · Parent 1 · right" }).querySelector(".overflow-y-auto") as HTMLElement;
  body.scrollTop = 120;
  await user.click(screen.getByRole("button", { name: "Go to GP · Parent 1 · left" }));
  expect((screen.getByRole("dialog", { name: "GP · Parent 1 · left" }).querySelector(".overflow-y-auto") as HTMLElement).scrollTop).toBe(0);
});
