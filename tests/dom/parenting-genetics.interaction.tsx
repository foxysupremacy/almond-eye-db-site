import { afterEach, expect, test } from "bun:test";
import { useState } from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@react-aria/test-utils";
import { GeneticIndicator } from "@/features/parenting/components/genetic-indicator";
import { ParentingLoopOptimizer } from "@/features/parenting/loop-optimizer";
import { useAncestorNavigation } from "@/features/parenting/hooks/use-ancestor-navigation";
import { WhiteGeneticPicker } from "@/features/parenting/components/aptitude-controls";
import { evaluateParentingMinmax, type ParentingMinmaxContext } from "@/lib/parenting/minmax";
import { branchSourceSlots, buildLoopCandidates, evaluateParentingBranch, type AptitudeKey } from "@/lib/parenting/loop-planner";
import { DEFAULT_PARENTING_SETUP } from "@/lib/parenting/state";
import { charactersById } from "@/lib/data/registry";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";

afterEach(cleanup);
function context(): ParentingMinmaxContext {
  const candidate = buildLoopCandidates([], [charactersById.get(106802)!])[0];
  candidate.baseAptitude = Array(10).fill("A");
  return {
    ancestors: { p1: candidate },
    config: { ...DEFAULT_PARENTING_SETUP.loopConfig!, factorGoals: Object.fromEntries(branchSourceSlots("p1").map((slot, index) => [slot, { pink: index < 2 ? "Dirt" : null, pinkStars: index < 2 ? 3 : 0 }])) },
    course: { id: 1, terrain: 1, distance: 4, length: 2500, turn: 1, inout: 1, corners: [], straights: [], slopes: [] },
    runningStyle: 2,
  };
}

test("genetic warnings open by keyboard, explain sources and reductions, and restore focus", async () => {
  const ctx = context();
  ctx.ancestors.p1_gp1 = { ...ctx.ancestors.p1!, name: "Oguri Cap" };
  ctx.ancestors.p1_gp2 = { ...ctx.ancestors.p1!, name: "El Condor Pasa" };
  const before = JSON.stringify(ctx);
  render(<GeneticIndicator context={ctx} assessment={evaluateParentingMinmax(ctx).slots[0]} />);
  const trigger = screen.getByRole("button", { name: /P1 genetics: 1 frequent genetic risks/ });
  const tester = new User({ interactionType: "keyboard" }).createTester("Dialog", { root: trigger, overlayType: "popover" });
  await tester.open();
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("Dirt 6★ · Frequent roll risk");
  const sources = screen.getByText("From:").nextElementSibling!;
  expect(sources.children).toHaveLength(2);
  expect(sources.children[0].textContent).toBe("GP Dirt 3★Oguri Cap · Parent 1 · left");
  expect(sources.children[1].textContent).toBe("GP Dirt 3★El Condor Pasa · Parent 1 · right");
  expect(dialog.textContent).toContain("Farm targets preserved");
  expect(dialog.textContent).toContain("→ Turf 3★");
  expect(dialog.textContent).not.toContain("0 fewer schedulable G1s");
  const user = userEvent.setup();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
  expect(JSON.stringify(ctx)).toBe(before);
});

test("duplicate donor names carry branch labels and tradeoffs show concrete ranks", async () => {
  const ctx = context();
  ctx.ancestors.p1!.name = "Satono Crown";
  ctx.ancestors.p1!.baseAptitude[1] = "G";
  ctx.config.slotAptitudeGoals = { p1: { Dirt: "C" } };
  ctx.ancestors.p1_gp1 = { ...ctx.ancestors.p1!, name: "Oguri Cap", baseAptitude: Array(10).fill("A") };
  ctx.ancestors.p1_gp2 = { ...ctx.ancestors.p1_gp1 };
  const slots = branchSourceSlots("p1");
  for (const slot of slots.slice(0, 4)) ctx.config.factorGoals![slot] = { pink: "Dirt", pinkStars: 3 };
  render(<GeneticIndicator context={ctx} assessment={evaluateParentingMinmax(ctx).slots[0]} />);
  await userEvent.setup().click(screen.getByRole("button", { name: /P1 genetics/ }));
  const dialog = screen.getByRole("dialog");
  const sources = screen.getByText("From:").nextElementSibling!;
  expect(sources.children).toHaveLength(4);
  expect(sources.children[0].textContent).toBe("GP Dirt 3★Oguri Cap · Parent 1 · left");
  expect(sources.children[1].textContent).toBe("GP Dirt 3★Oguri Cap · Parent 1 · right");
  expect(sources.children[2].textContent).toBe("GGP Dirt 3★Parent 1 · left → left");
  expect(dialog.textContent).toContain("Dirt 12★ · Guaranteed genetics in this model");
  expect(dialog.textContent).toContain("Parent Dirt C → E · needs C");
  expect(dialog.textContent).toContain("Satono Crown · Parent 1");
  expect(dialog.textContent).not.toContain("aptitude rank gaps");
  expect(dialog.textContent).not.toContain("0 fewer schedulable G1s");
});

test("imported genetics stay separate from a low-risk retraining forecast", async () => {
  const ctx = context();
  ctx.ancestors.p1 = buildLoopCandidates([{ card_id: 106802, factor_info_array: [{ factor_id: 5000203 }] } as KyumaruVeteranItem], [])[0];
  ctx.config.factorGoals!.p1_gp1 = { pink: "Dirt", pinkStars: 2 };
  ctx.config.factorGoals!.p1_gp2 = { pink: "Dirt", pinkStars: 2 };
  render(<GeneticIndicator context={ctx} assessment={evaluateParentingMinmax(ctx).slots[0]} />);
  await userEvent.setup().click(screen.getByRole("button", { name: /P1 genetics/ }));
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("Use this trained Uma now");
  expect(dialog.textContent).toContain("Dirt genetic present · 3★");
  expect(dialog.textContent).toContain("If retrained with this pedigree");
  expect(dialog.textContent).toContain("Pink totals below 6★");
  expect(dialog.textContent).not.toContain("Dirt 4★");
  expect(dialog.textContent).not.toContain("Reduce Dirt");
});

test("unknown donors remain visible without repeated zero-star warnings", async () => {
  const ctx = context();
  delete ctx.config.factorGoals!.p1_gp2_g2;
  render(<GeneticIndicator context={ctx} assessment={evaluateParentingMinmax(ctx).slots[0]} />);
  await userEvent.setup().click(screen.getByRole("button", { name: /P1 genetics/ }));
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("Unknown donor factors:");
  expect(dialog.textContent).toContain("GGP Factors unknown");
  expect(dialog.textContent).toContain("Parent 1 · right → right");
  expect(dialog.textContent).toContain("Incomplete data; aptitude preservation unconfirmed");
  expect(dialog.textContent).not.toContain("0★");
  expect(dialog.textContent).not.toContain("Farm targets preserved");
});

test("GGGP source rows close the warning and jump to the exact desktop spark input", async () => {
  const slot = "p1_gp2_g2_g2";
  const { container } = render(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[]}
    setup={{ ...DEFAULT_PARENTING_SETUP, loopConfig: {
      ...DEFAULT_PARENTING_SETUP.loopConfig!,
      factorGoals: Object.fromEntries(branchSourceSlots("p1_gp2").map((source) => [source, { pink: "Dirt", pinkStars: 3 }])),
    } }} targetStage={null} course={context().course} runningStyle={2}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);
  const destination = container.querySelector<HTMLDivElement>(`[data-ancestor-layout="desktop"][data-ancestor-slot="${slot}"]`)!;
  const desktop = container.querySelector('[data-ancestor-layout="desktop"][data-ancestor-slot="p1_gp2"]')!;
  const scrolls: ScrollIntoViewOptions[] = [];
  destination.scrollIntoView = (options) => scrolls.push(options as ScrollIntoViewOptions);
  const user = userEvent.setup();
  await user.click(within(desktop as HTMLElement).getByRole("button", { name: /P1 GP2 genetics/ }));
  const row = screen.getAllByRole("button", { name: "Go to GGGP, Parent 1 · right → right → right" })[0];
  expect(row.textContent).toContain("GGGP Dirt 3★");
  act(() => row.focus());
  await user.keyboard("{Enter}");
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(destination);
    expect(scrolls).toEqual([{ behavior: "instant", block: "center", inline: "center" }]);
    expect(destination.querySelector(".animate-ancestor-highlight")).not.toBeNull();
  });
  // Reopening and choosing the same donor must restart the highlight.
  const firstHighlight = destination.querySelector(".animate-ancestor-highlight");
  await user.click(within(desktop as HTMLElement).getByRole("button", { name: /P1 GP2 genetics/ }));
  await user.click(screen.getAllByRole("button", { name: "Go to GGGP, Parent 1 · right → right → right" })[0]);
  await waitFor(() => expect(destination.querySelector(".animate-ancestor-highlight")).not.toBe(firstHighlight));
});

test("phone navigation to a GGGP closes the sheet then focuses the inline chip", async () => {
  const opened: string[] = []; let closed = 0; const scrolls: string[] = [];
  function Probe() {
    const navigation = useAncestorNavigation({ tier: "phone", openSlot: (slot) => opened.push(slot), closeSheet: () => { closed++; } });
    const props = navigation.targetProps("p2_gp2_g2_g2", "phone");
    return <>
      <button onClick={() => navigation.navigate("p2_gp2_g2_g2")}>Find donor</button>
      <div {...props} ref={(element) => { props.ref(element); if (element) element.scrollIntoView = () => scrolls.push("phone"); }} data-testid="phone-donor">
        {navigation.highlightKey("p2_gp2_g2_g2", "phone") !== null ? "Highlighted donor" : "Donor"}</div>
    </>;
  }
  render(<Probe />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Find donor" }));
  await waitFor(() => {
    expect(closed).toBe(1);
    expect(opened).toEqual([]);
    expect(document.activeElement).toBe(screen.getByTestId("phone-donor"));
    expect(screen.getByTestId("phone-donor").textContent).toBe("Highlighted donor");
    expect(scrolls).toEqual(["phone"]);
  });
});

test("tablet navigation to a GGGP closes the sheet then focuses the inline chip", async () => {
  const opened: string[] = []; let closed = 0; const scrolls: string[] = [];
  function Probe() {
    const navigation = useAncestorNavigation({ tier: "tablet", openSlot: (slot) => opened.push(slot), closeSheet: () => { closed++; } });
    const props = navigation.targetProps("p1_gp2_g2_g2", "tablet");
    return <>
      <button onClick={() => navigation.navigate("p1_gp2_g2_g2")}>Find donor</button>
      <div {...props} ref={(element) => { props.ref(element); if (element) element.scrollIntoView = () => scrolls.push("tablet"); }} data-testid="tablet-donor">
        {navigation.highlightKey("p1_gp2_g2_g2", "tablet") !== null ? "Highlighted donor" : "Donor"}</div>
    </>;
  }
  render(<Probe />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Find donor" }));
  await waitFor(() => {
    expect(closed).toBe(1);
    expect(opened).toEqual([]);
    expect(document.activeElement).toBe(screen.getByTestId("tablet-donor"));
    expect(screen.getByTestId("tablet-donor").textContent).toBe("Highlighted donor");
    expect(scrolls).toEqual(["tablet"]);
  });
});

test("phone and tablet navigation focuses P/GP cards and opens the GGP sheet", async () => {
  for (const tier of ["phone", "tablet"] as const) {
    const opened: string[] = []; let closed = 0; const scrolls: string[] = [];
    function Probe() {
      const navigation = useAncestorNavigation({ tier, openSlot: (slot) => opened.push(slot), closeSheet: () => { closed++; } });
      const props = navigation.targetProps("p1_gp2", tier);
      return <>
        <button onClick={() => navigation.navigate("p1_gp2")}>Go card</button>
        <div {...props} ref={(element) => { props.ref(element); if (element) element.scrollIntoView = () => scrolls.push(tier); }} data-testid="tier-card">Card</div>
        <button onClick={() => navigation.navigate("p1_gp1_g1")}>Go ggp</button>
      </>;
    }
    render(<Probe />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Go card" }));
    await waitFor(() => {
      expect(opened).toEqual([]);
      expect(closed).toBe(1);
      expect(document.activeElement).toBe(screen.getByTestId("tier-card"));
      expect(scrolls).toEqual([tier]);
    });
    await user.click(screen.getByRole("button", { name: "Go ggp" }));
    expect(opened).toEqual(["p1_gp1_g1"]);
    cleanup();
  }
});

test("off-target Dirt stays selectable and touch/click warnings update with the course", async () => {
  const ctx = context();
  const user = userEvent.setup();
  const selected: string[][] = [];
  const view = render(<WhiteGeneticPicker label="P1" targets={[]} assessment={evaluateParentingBranch("p1", ctx.ancestors, ctx.config)} onChange={(targets) => selected.push(targets)} />);
  await user.click(screen.getByRole("button", { name: "P1 Target genetic" }));
  const dirt = screen.getByRole("checkbox", { name: "Dirt" }) as HTMLInputElement;
  expect(dirt.disabled).toBe(false);
  await user.click(dirt);
  expect(selected.some((targets) => targets.length === 1 && targets[0] === "Dirt")).toBe(true);
  await user.keyboard("{Escape}");
  view.rerender(<GeneticIndicator context={ctx} assessment={evaluateParentingMinmax(ctx).slots[0]} />);
  await user.click(screen.getByRole("button", { name: /P1 genetics/ }));
  expect(screen.getByRole("dialog").textContent).toContain("Dirt 6★");
  await user.keyboard("{Escape}");
  const changed = { ...ctx, course: { ...ctx.course!, terrain: 2 } };
  view.rerender(<GeneticIndicator context={changed} assessment={evaluateParentingMinmax(changed).slots[0]} />);
  expect(screen.getByRole("button", { name: /P1 genetics/ }).textContent).toContain("Good genetic planning");
});

for (const stars of [0, 1, 5]) test(`${stars} pink stars do not show off-target genetic warnings`, async () => {
  const ctx = context();
  ctx.config.factorGoals!.p1_gp1 = { pink: "Dirt", pinkStars: Math.min(3, stars) };
  ctx.config.factorGoals!.p1_gp2 = { pink: "Dirt", pinkStars: Math.max(0, stars - 3) };
  const before = JSON.stringify(ctx);
  render(<GeneticIndicator context={ctx} assessment={evaluateParentingMinmax(ctx).slots[0]} />);
  const trigger = screen.getByRole("button", { name: /P1 genetics/ });
  expect(trigger.textContent).toBe("Good genetic planning");
  expect(trigger.className).toContain("text-emerald-700 dark:text-emerald-400");
  await userEvent.setup().click(trigger);
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("Pink totals below 6★");
  expect(dialog.textContent).not.toContain(`Dirt ${stars}★`);
  expect(dialog.textContent).not.toContain("Low risk");
  expect(dialog.textContent).not.toContain("From:");
  expect(JSON.stringify(ctx)).toBe(before);
});

test("five known stars with unknown donors retain the incomplete-data notice", async () => {
  const ctx = context();
  ctx.config.factorGoals!.p1_gp2 = { pink: "Dirt", pinkStars: 2 };
  delete ctx.config.factorGoals!.p1_gp2_g2;
  render(<GeneticIndicator context={ctx} assessment={evaluateParentingMinmax(ctx).slots[0]} />);
  const trigger = screen.getByRole("button", { name: /P1 genetics/ });
  expect(trigger.textContent).toBe("Genetic data incomplete");
  expect(trigger.className).not.toContain("text-emerald");
  await userEvent.setup().click(trigger);
  expect(screen.getByRole("dialog").textContent).toContain("Unknown donor factors:");
  expect(screen.getByRole("dialog").textContent).not.toContain("Pink totals below 6★");
  expect(screen.getByRole("dialog").textContent).not.toContain("Dirt 5★");
});

test("three six-star genetic targets can be selected, changed and cleared", async () => {
  const ctx = context();
  const aptitudes: AptitudeKey[] = ["Turf", "Long", "Leader"];
  for (const [index, slot] of branchSourceSlots("p1").entries()) ctx.config.factorGoals![slot] = { pink: aptitudes[Math.floor(index / 2)], pinkStars: 3 };
  const assessment = evaluateParentingBranch("p1", ctx.ancestors, ctx.config);
  function Picker() {
    const [targets, setTargets] = useState<AptitudeKey[]>([]);
    return <WhiteGeneticPicker label="P1" targets={targets} assessment={assessment} onChange={setTargets} />;
  }
  render(<Picker />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "P1 Target genetic" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("6★ · ≈40%");
  expect(dialog.textContent).toContain("White genetic roll odds: 6–11★ ≈40% · 12★ = 100%.");
  for (const aptitude of aptitudes) await user.click(screen.getByRole("checkbox", { name: aptitude }));
  expect(screen.getByText("3/3")).toBeTruthy();
  expect(screen.getByText("Max 3 genetics selected. Uncheck one to change.")).toBeTruthy();
  for (const aptitude of aptitudes) expect((screen.getByRole("checkbox", { name: aptitude }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("checkbox", { name: "Dirt" }) as HTMLInputElement).disabled).toBe(true);
  await user.click(screen.getByRole("checkbox", { name: "Leader" }));
  expect(screen.getByText("2/3")).toBeTruthy();
  expect((screen.getByRole("checkbox", { name: "Leader" }) as HTMLInputElement).disabled).toBe(false);
  await user.click(screen.getByRole("checkbox", { name: "Leader" }));
  expect(screen.getByText("3/3")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Clear targets" }));
  expect(screen.getByText("0/3")).toBeTruthy();
  for (const aptitude of aptitudes) expect((screen.getByRole("checkbox", { name: aptitude }) as HTMLInputElement).checked).toBe(false);
});

test("Sprint tradeoffs appear only for a Sprint target course", async () => {
  const ctx = context();
  ctx.ancestors.p1!.name = "Satono Crown";
  ctx.ancestors.p1!.baseAptitude[2] = "G";
  ctx.ancestors.p1_gp1 = { ...ctx.ancestors.p1!, name: "Mejiro McQueen", baseAptitude: [...ctx.ancestors.p1!.baseAptitude] };
  const user = userEvent.setup();
  const view = render(<GeneticIndicator context={ctx} assessment={evaluateParentingMinmax(ctx).slots[0]} />);
  await user.click(screen.getByRole("button", { name: /P1 genetics/ }));
  expect(screen.getByRole("dialog").textContent).not.toContain("Sprint G → G · needs C");
  await user.keyboard("{Escape}");
  const sprint = { ...ctx, course: { ...ctx.course!, distance: 1, length: 1200 } };
  view.rerender(<GeneticIndicator context={sprint} assessment={evaluateParentingMinmax(sprint).slots[0]} />);
  await user.click(screen.getByRole("button", { name: /P1 genetics/ }));
  expect(screen.getByRole("dialog").textContent).toContain("Parent Sprint G → G · needs C");
  expect(screen.getByRole("dialog").textContent).toContain("Satono Crown · Parent 1");
  expect(screen.getByRole("dialog").textContent).toContain("GP Sprint G → G · needs C");
  expect(screen.getByRole("dialog").textContent).toContain("Mejiro McQueen · Parent 1 · left");
  await user.keyboard("{Escape}");
  const missing = { ...ctx, course: null };
  view.rerender(<GeneticIndicator context={missing} assessment={evaluateParentingMinmax(missing).slots[0]} />);
  await user.click(screen.getByRole("button", { name: /P1 genetics/ }));
  expect(screen.getByRole("dialog").textContent).not.toContain("Sprint G → G · needs C");
});
