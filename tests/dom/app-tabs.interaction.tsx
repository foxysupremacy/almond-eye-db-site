import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppMobileNavigation } from "@/app/common/ui/controls/app-mobile-navigation";
import { AppShellHeader } from "@/app/common/ui/controls/app-shell-header";
import { MOBILE_TABS, TABS, type RootAppRoute } from "@/app/tabs";

afterEach(cleanup);

test("Rankings sits between Parenting and Visualizer with a BY TRACK badge", () => {
  expect(TABS.map((t) => t.id)).toEqual(["main", "parent-deck", "parenting", "rankings", "visualizer", "supports", "characters", "veterans"]);
  const rankings = TABS.find((t) => t.id === "rankings");
  expect(rankings?.label).toBe("Rankings");
  expect(rankings?.badge).toBe("By track");
});

test("mobile nav has six items with Ranks before Race and Library last", () => {
  expect(MOBILE_TABS.map((t) => t.label)).toEqual(["Deck", "Parents", "Lineage", "Ranks", "Race", "Library"]);
});

test("Library opens a sheet with canonical destinations and can be dismissed", async () => {
  const user = userEvent.setup();
  render(<AppMobileNavigation activeRoute="supports" />);
  const trigger = screen.getByRole("button", { name: "Library" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await user.click(trigger);
  const library = screen.getByRole("navigation", { name: "Library navigation" });
  expect(within(library).getByRole("link", { name: "Supports" }).getAttribute("href")).toBe("/supports");
  expect(within(library).getByRole("link", { name: "Characters" }).getAttribute("href")).toBe("/characters");
  expect(within(library).getByRole("link", { name: "Trained Umas" }).getAttribute("href")).toBe("/#veterans");
  expect(within(library).getByRole("link", { name: "Supports" }).getAttribute("aria-current")).toBe("page");
  await user.click(screen.getByRole("button", { name: "Close Library" }));
  expect(screen.queryByRole("navigation", { name: "Library navigation" })).toBeNull();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("root navigation changes Rankings and Trained Umas without reloading", async () => {
  const user = userEvent.setup();
  const selected: RootAppRoute[] = [];
  render(<AppMobileNavigation activeRoute="main" onRootRouteChange={(route) => selected.push(route)} />);
  await user.click(screen.getByRole("link", { name: "Ranks" }));
  expect(selected).toEqual(["rankings"]);
  await user.click(screen.getByRole("button", { name: "Library" }));
  await user.click(screen.getByRole("link", { name: "Trained Umas" }));
  expect(selected).toEqual(["rankings", "veterans"]);
  expect(screen.queryByRole("navigation", { name: "Library navigation" })).toBeNull();
});

test("collection pages link Rankings back to the root hash", () => {
  render(<AppMobileNavigation activeRoute="characters" />);
  const rankings = screen.getByRole("link", { name: "Ranks" });
  expect(rankings.getAttribute("href")).toBe("/#rankings");
  expect(rankings.getAttribute("aria-current")).toBeNull();
});

test("shared desktop header exposes Rankings and retains collection page URLs", async () => {
  const user = userEvent.setup();
  const selected: RootAppRoute[] = [];
  render(<AppShellHeader activeRoute="rankings" isControlsCollapsed={false} mobileTitle="Rankings" onToggleControls={() => {}} onRootRouteChange={(route) => selected.push(route)} />);
  const nav = screen.getByRole("navigation", { name: "Primary navigation" });
  const rankings = within(nav).getByRole("link", { name: "Rankings By track" });
  expect(rankings.getAttribute("href")).toBe("/#rankings");
  expect(rankings.getAttribute("aria-current")).toBe("page");
  expect(within(nav).getByRole("link", { name: "Supports" }).getAttribute("href")).toBe("/supports");
  expect(within(nav).getByRole("link", { name: "Characters" }).getAttribute("href")).toBe("/characters");
  await user.click(rankings);
  expect(selected).toEqual(["rankings"]);
});
