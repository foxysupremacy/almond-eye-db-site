import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackSkillSidebar } from "@/features/visualizer/components/track-skill-sidebar";
import { TrackUnifiedTooltip } from "@/features/visualizer/components/track-unified-tooltip";
import type { VisualizerSkill } from "@/lib/visualizer/skills";
import type { Course } from "@/lib/skill-engine/types";

afterEach(cleanup);

const skill: VisualizerSkill = {
  id: 120171,
  nameEn: "Cascading Might",
  nameJp: "カスケーディング・マイト",
  rarity: 5,
  iconId: null,
  filterCategory: "unique",
  origins: [],
};

function renderSidebar(
  skills: VisualizerSkill[],
  selected: number[],
  opened: number[],
) {
  return render(
    <TrackSkillSidebar
      visualizerDeck="main"
      onVisualizerDeckChange={() => {}}
      rarityFilter="all"
      onRarityFilterChange={() => {}}
      activeSkills={skills}
      displayedSkills={skills}
      selectedSkillId={null}
      onSelectSkill={(id) => selected.push(id)}
      onOpenEffectGraph={(id) => opened.push(id)}
      firesOnCourse={() => true}
      isSkillBanned={() => false}
    />,
  );
}

test("graph icon opens the effect graph; row click only selects", async () => {
  const user = userEvent.setup();
  const selected: number[] = [];
  const opened: number[] = [];
  renderSidebar([skill], selected, opened);

  await user.click(screen.getByRole("button", { name: "Open effect graph for Cascading Might" }));
  expect(opened).toEqual([120171]);
  expect(selected).toEqual([]);

  await user.click(screen.getByRole("button", { name: /Cascading Might/, pressed: false }));
  expect(selected).toEqual([120171]);
  expect(opened).toEqual([120171]);
});

test("graph button is not nested inside the row button", () => {
  renderSidebar([skill], [], []);
  const graphButton = screen.getByRole("button", { name: "Open effect graph for Cascading Might" });
  expect(graphButton.parentElement?.closest("button")).toBeNull();
});

test("graph button label falls back to the Japanese name", () => {
  const jpOnly: VisualizerSkill = { ...skill, id: 1, nameEn: "", nameJp: "日本語スキル" };
  renderSidebar([jpOnly], [], []);
  expect(screen.getByRole("button", { name: "Open effect graph for 日本語スキル" })).toBeTruthy();
});

test("course tooltip has no pin UI and shows meters first", () => {
  const course = { length: 1600 } as unknown as Course;
  render(
    <TrackUnifiedTooltip
      course={course}
      zones={null}
      impact={null}
      hoverMeter={800}
      coords={{ x: 100, y: 100 }}
    />,
  );
  const tip = screen.getByRole("tooltip", { name: "Course position details" });
  expect(tip.className.includes("ring-2")).toBe(false);
  expect(screen.queryByText("Tap to pin")).toBeNull();
  expect(screen.queryByText("Pinned")).toBeNull();
  expect(screen.queryByRole("button", { name: "Unpin course position" })).toBeNull();
  expect(screen.getByText("+0.00 m")).toBeTruthy();
  expect(screen.getByText("0.00 bashin")).toBeTruthy();
});

test("Board 3 is gone", async () => {
  const mod = await import("@/features/visualizer/components");
  expect("RaceEffectGraph" in mod).toBe(false);
});
