import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@react-aria/test-utils";
import { useState } from "react";
import { PinkSparkPicker, WhiteGeneticPicker, AptitudeTable } from "@/features/parenting/components/aptitude-controls";
import { evaluateParentingBranch, type AptitudeKey } from "@/lib/parenting/loop-planner";
afterEach(cleanup);
const assessment = evaluateParentingBranch("p1", {}, { geneGoals: {}, aptitudeGoals: {}, selectedSlots: {}, lockedSlots: {}, includeTripleCrownAffinity: false, includeTiaraAffinity: false });
function PinkProbe() {
  const [value, setValue] = useState<AptitudeKey | null | undefined>();
  const [stars, setStars] = useState<number>();
  return <PinkSparkPicker label="P1" value={value} stars={stars} onChange={(key, count) => { setValue(key); setStars(count); }} />;
}
test("pink hook popover updates immediately, preserves stars, Escape restores focus", async () => {
  const user = userEvent.setup(); render(<PinkProbe />);
  const trigger = screen.getByRole("button", { name: /P1 Red factor/ });
  const tester = new User({ interactionType: "keyboard" }).createTester("Dialog", { root: trigger, overlayType: "popover" });
  await tester.open(); expect(tester.getDialog()).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: "Medium" }));
  expect((screen.getByRole("radio", { name: "3 stars" }) as HTMLInputElement).checked).toBe(true);
  await user.click(screen.getByRole("radio", { name: "1 stars" }));
  await user.click(screen.getByRole("radio", { name: "Dirt" }));
  expect(trigger.textContent).toContain("Dirt★");
  expect(trigger.className).toContain("flex-col");
  expect(trigger.textContent).toContain("Dirt");
  expect(screen.getByRole("dialog")).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});
test("pink unset and no-factor differ; outside click dismisses", async () => {
  const user = userEvent.setup(); render(<PinkProbe />);
  const trigger = screen.getByRole("button", { name: /P1 Red factor/ });
  await user.click(trigger); await user.click(screen.getByRole("button", { name: "No factor" }));
  expect(trigger.getAttribute("aria-label")).toContain("No factor");
  await user.click(screen.getByRole("button", { name: "Not set" }));
  expect(trigger.getAttribute("aria-label")).toContain("Not set");
  await user.click(document.body); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
test("white targets support multiple keyboard selections without closing", async () => {
  const eligibleAssessment = evaluateParentingBranch("p1", {}, {
    geneGoals: {}, aptitudeGoals: {}, selectedSlots: {}, lockedSlots: {},
    includeTripleCrownAffinity: false, includeTiaraAffinity: false,
    factorGoals: {
      p1_gp1: { pink: "Medium", pinkStars: 3 }, p1_gp2: { pink: "Medium", pinkStars: 3 },
      p1_gp1_g1: { pink: "Turf", pinkStars: 3 }, p1_gp1_g2: { pink: "Turf", pinkStars: 3 },
    },
  });
  function Probe() { const [targets, setTargets] = useState<AptitudeKey[]>([]); return <WhiteGeneticPicker label="P1" targets={targets} assessment={eligibleAssessment} onChange={setTargets} />; }
  const user = userEvent.setup(); render(<Probe />);
  await user.click(screen.getByRole("button", { name: "P1 Target genetic" }));
  expect(screen.getByText("0/3").parentElement?.textContent).toContain("Target genetic");
  const medium = screen.getByRole("checkbox", { name: "Medium" }); medium.focus(); await user.keyboard(" ");
  expect((medium as HTMLInputElement).checked).toBe(true);
  await user.click(screen.getByRole("checkbox", { name: "Turf" }));
  expect(screen.getByRole("button", { name: "P1 Target genetic" }).textContent).toContain("(2)");
  expect(screen.getByRole("dialog")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Clear targets" }));
  expect(screen.getByRole("button", { name: "P1 Target genetic" }).textContent).not.toContain("(2)");
});

test("white targets greys out and disables aptitudes with below 6 stars", async () => {
  const user = userEvent.setup();
  render(<WhiteGeneticPicker label="P1" targets={[]} assessment={assessment} onChange={() => {}} />);
  await user.click(screen.getByRole("button", { name: "P1 Target genetic" }));
  const sprint = screen.getByRole("checkbox", { name: "Sprint" }) as HTMLInputElement;
  expect(sprint.disabled).toBe(true);
  expect(sprint.closest("label")?.className).toContain("text-zinc-500");
  expect(sprint.closest("label")?.querySelector("div")?.title).toContain("Requires ≥ 6★ pink factor");
});
test("aptitude shows unknown result and confines keyboard focus", async () => {
  const user = userEvent.setup(); render(<AptitudeTable label="P1" assessment={assessment} sources={[]} onTargetChange={() => {}} />);
  const trigger = screen.getByRole("button", { name: "P1 Turf: base ?, projected ?" });
  await user.click(trigger);
  const e = screen.getByRole("radio", { name: /^E$/ }); e.focus(); await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  await user.keyboard("{Tab}{Tab}{Tab}{Tab}");
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
});
