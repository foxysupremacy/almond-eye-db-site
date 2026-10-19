import { afterEach, expect, test } from "bun:test";
import { cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { api } from "@/lib/api";
import { useSkillEffect } from "@/app/common/ui/skills/effect-details/use-skill-effect";
import { EffectBlocks } from "@/app/common/ui/skills/effect-details/effect-blocks";
import { SkillDetailPanel } from "@/app/common/ui/skills/details/skill-detail-panel";
import { skillsById } from "@/lib/data/registry";
import { defaultRaceImpactProfile } from "@/lib/race-impact";
import { Region, RegionList } from "@/lib/skill-engine/region";
import type { Course } from "@/lib/skill-engine/types";

afterEach(cleanup);
const profile = defaultRaceImpactProfile();
const course: Course = { id: 10808, length: 2200, distance: 3, terrain: 1, turn: 1, inout: 1,
  corners: [], straights: [], slopes: [] };

function effects(id: number, selectedCourse = course, level = 1, selectedUma?: string) {
  const skill = skillsById.get(id)!;
  return <EffectBlocks groups={skill.conditionGroups} activeIndex={0} courseLength={selectedCourse.length}
    level={level} isUnique={skill.rarity >= 3 && skill.rarity <= 5} course={selectedCourse}
    profile={profile} style={2} selectedUma={selectedUma} />;
}

test("Peerless Heroine special value follows the Medium course and new-engine level order", () => {
  const { rerender } = render(effects(101291));
  let group = within(screen.getByRole("group", { name: "Effect group 1" }));
  expect(group.getByText("+0.650 m/s")).toBeTruthy();
  expect(group.getByText("Medium-race effect bonus")).toBeTruthy();
  expect(group.queryByText("assumed")).toBeNull();
  rerender(effects(101291, course, 6));
  group = within(screen.getByRole("group", { name: "Effect group 1" }));
  expect(group.getByText("+0.650 m/s")).toBeTruthy();
  rerender(effects(101291, { ...course, distance: 4, length: 3000 }, 6));
  expect(within(screen.getByRole("group", { name: "Effect group 1" })).getByText("+0.495 m/s")).toBeTruthy();
});

test("Fan Love restores the named concrete threshold and engine value without vague multipliers", () => {
  const { rerender } = render(effects(101321, course, 1, "Loves Only You"));
  const group = within(screen.getByRole("group", { name: "Effect group 1" }));
  expect(group.getByText("+0.450 m/s")).toBeTruthy();
  expect(group.getByText("assumed")).toBeTruthy();
  expect(group.getByText("Loves Only You’s Fan Love: 3.000.000+ (Assumed)")).toBeTruthy();
  expect(group.queryByText(/3×/)).toBeNull();
  rerender(effects(101321, course, 6, "Loves Only You"));
  expect(within(screen.getByRole("group", { name: "Effect group 1" })).getByText("+0.509 m/s")).toBeTruthy();
});

test("Mile resolves its bonus, Arima assumes only the fan threshold, and other courses have neither bonus", () => {
  const { rerender } = render(effects(120061, { ...course, distance: 2 }));
  let group = within(screen.getByRole("group", { name: "Effect group 1" }));
  expect(group.getByText("+0.450 m/s")).toBeTruthy();
  expect(group.queryByText("assumed")).toBeNull();
  expect(group.queryByText(/146,738/)).toBeNull();
  rerender(effects(120061, { ...course, id: 10506, length: 2500, distance: 4 }));
  group = within(screen.getByRole("group", { name: "Effect group 1" }));
  expect(group.getByText("+0.550 m/s")).toBeTruthy();
  expect(group.getByText("Arima Kinen course and 146,738+ fans (Assumed)")).toBeTruthy();
  rerender(effects(120061));
  group = within(screen.getByRole("group", { name: "Effect group 1" }));
  expect(group.getByText("+0.350 m/s")).toBeTruthy();
  expect(group.queryByText("assumed")).toBeNull();
});

test("Visualizer and inspector windows read profile stats and ground rather than assuming maximum speed", () => {
  const skill = { ...skillsById.get(101291)!, conditionGroups: [
    { condition: "phase==1", base_time: 30000, effects: [{ type: 27, value: 500, value_scale: 22 }] },
  ] };
  const zones = [{ regions: new RegionList(new Region(500, 2000)), isRandom: false, earliestFire: 500 }];
  const props = { skillDetail: skill, skillLoading: false, selectedSkill: null, selectedSkillId: skill.id,
    course, zones, racerCount: 9, evaluation: null, raceImpactProfile: profile, runningStyle: 2 as const };
  const { rerender } = render(<SkillDetailPanel {...props} groundCondition={1} />);
  expect(screen.getByText("+0.05 m/s")).toBeTruthy();
  expect(screen.getByText(/Adjusted Speed: 1700/)).toBeTruthy();
  expect(screen.queryByText("ASSUMED")).toBeNull();
  rerender(<SkillDetailPanel {...props} groundCondition={4} />);
  expect(screen.getByText("+0 m/s")).toBeTruthy();
  expect(screen.getByText(/Adjusted Speed: 1650/)).toBeTruthy();
});

test("inherited effects keep their own metadata and unsupported codes remain visible", () => {
  const { rerender } = render(effects(901321));
  expect(screen.queryByLabelText("Special value")).toBeNull();
  rerender(<EffectBlocks groups={[{ condition: "", base_time: 30000, effects: [{ type: 27, value: 3500, value_scale: 40 }] }]}
    activeIndex={0} courseLength={2200} course={course} profile={profile} level={1} isUnique={false} />);
  expect(screen.getByText("+0.350 m/s")).toBeTruthy();
  expect(screen.getByText("unsupported")).toBeTruthy();
  expect(screen.getByText(/Scaling code 40 is not modeled/)).toBeTruthy();
});


test("modal scoring and trace keep the selected ground condition when a stat-scaled effect crosses its threshold", async () => {
  const original = api.skill;
  api.skill = async () => ({ ...skillsById.get(101291)!, id: -1234, rarity: 1, conditionGroups: [
    { condition: "phase==1", base_time: 30000, effects: [{ type: 27, value: 500, value_scale: 22 }] },
  ] });
  const firm = { groundCondition: 1 };
  const heavy = { groundCondition: 4 };
  try {
    const { result, rerender } = renderHook(({ raceParams }) => useSkillEffect({
      skillId: -1234, course, raceParams, style: 2, racerCount: 9, profile, level: 1,
    }), { initialProps: { raceParams: firm } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.score!.expectedBashin).toBeGreaterThan(0);
    expect(result.current.trace!.bashinGain).toBeGreaterThan(0);
    rerender({ raceParams: heavy });
    await waitFor(() => expect(result.current.score!.expectedBashin).toBe(0));
    expect(result.current.trace!.bashinGain).toBe(0);
    expect(result.current.trace!.distanceGainMeters).toBe(0);
  } finally { api.skill = original; }
});
