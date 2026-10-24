import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { charactersById } from "@/lib/data/registry";
import { DEFAULT_PARENTING_SETUP, type ParentingSetup } from "@/lib/parenting/state";
import { ParentingLoopOptimizer } from "@/features/parenting/loop-optimizer";
afterEach(cleanup);

/** Mirrors the deck reducer: every updater receives the previous setup, so a
 * toggle must be committed as ONE update — per-aptitude updates computed from
 * a stale render config used to cancel each other out (checkbox snapped back). */
function OptimizerProbe() {
  const [setup, setSetup] = useState<ParentingSetup>(DEFAULT_PARENTING_SETUP);
  return <ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[]}
    setup={setup} targetStage={null}
    onOpenPicker={() => {}} updateSetup={(updater) => setSetup((prev) => updater(prev))}
  />;
}

test("farm focus toggle commits and stays toggled instead of snapping back", async () => {
  const user = userEvent.setup();
  render(<OptimizerProbe />);
  await user.click(screen.getByRole("button", { name: "Farm focus" }));
  const sprint = screen.getByRole("checkbox", { name: "Spr" }) as HTMLInputElement;
  expect(sprint.checked).toBe(true);
  await user.click(sprint);
  await waitFor(() => expect(sprint.checked).toBe(false));
  expect(screen.getByRole("button", { name: "Farm focus" }).textContent).toContain("−Spr");
  // The neighbouring toggles keep their state in the same popover.
  expect((screen.getByRole("checkbox", { name: "Med" }) as HTMLInputElement).checked).toBe(true);
  // Re-enable works the same way.
  await user.click(sprint);
  await waitFor(() => expect(sprint.checked).toBe(true));
  expect(screen.getByRole("button", { name: "Farm focus" }).textContent).toContain("Farm focus: all");
});
