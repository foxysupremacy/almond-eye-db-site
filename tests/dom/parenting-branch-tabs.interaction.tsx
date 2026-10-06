import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { User } from "@react-aria/test-utils";
import { useState } from "react";
import { PedigreeBranchTabs, type PedigreeBranch } from "@/features/parenting/components/pedigree-branch-tabs";

afterEach(cleanup);

function BranchTabsProbe() {
  const [branch, setBranch] = useState<PedigreeBranch>("p1");
  return <div data-testid="branch-tabs"><PedigreeBranchTabs value={branch} onChange={setBranch}>
    <p>{branch.toUpperCase()} branch content</p>
  </PedigreeBranchTabs></div>;
}

test("pedigree branch tabs switch with keyboard and expose the selected branch", async () => {
  const { getByRole } = render(<BranchTabsProbe />);
  const tabs = new User({ interactionType: "keyboard" }).createTester("Tabs", { root: screen.getByTestId("branch-tabs") });

  expect(tabs.getSelectedTab()).toBe(getByRole("tab", { name: "P1" }));
  await tabs.triggerTab({ tab: "P2" });
  expect(tabs.getSelectedTab()).toBe(getByRole("tab", { name: "P2" }));
  expect(screen.getByText("P2 branch content")).toBeTruthy();
});
