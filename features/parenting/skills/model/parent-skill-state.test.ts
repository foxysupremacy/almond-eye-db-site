import { describe, expect, it } from "bun:test";
import type { DisplayParentSkill } from "../../hooks/use-lineage-skills";
import { parentSkillPickerAdapter, type ParentSkillPickerInput } from "./parent-skill-state";

const skills: DisplayParentSkill[] = [
  {
    id: 1,
    nameEn: "Speed Hint",
    nameJp: "速度ヒント",
    descEn: "Raises speed",
    rarity: 2,
    source: "hint",
    sourceLabel: "Card (Example)",
    isInheritOnly: false,
  },
  {
    id: 2,
    nameEn: "Lineage Unique",
    nameJp: "継承ユニーク",
    rarity: 3,
    source: "unique",
    sourceLabel: "Parent: Example",
    isUniqueToParent: true,
    isInheritOnly: true,
  },
];

const input: ParentSkillPickerInput = {
  skills,
  options: { uniqueTargetIds: new Set([2]), duplicateInParentIds: new Set() },
};

describe("parentSkillPickerAdapter", () => {
  it("initializes every filter and view control to its default", () => {
    expect(parentSkillPickerAdapter.initialState(input)).toEqual({
      filter: "all",
      sourceFilter: "all",
      rarityFilter: "all",
      viewMode: "list",
      hideParentDuplicates: false,
      search: "",
    });
  });

  it("reduces each action without mutating the previous state", () => {
    const initial = parentSkillPickerAdapter.initialState(input);
    const next = parentSkillPickerAdapter.reduce(initial, { type: "filterChanged", value: "unique" });
    const view = parentSkillPickerAdapter.reduce(next, { type: "viewModeChanged", value: "parent" });
    const hidden = parentSkillPickerAdapter.reduce(view, { type: "hideParentDuplicatesChanged", value: true });
    const searched = parentSkillPickerAdapter.reduce(hidden, { type: "searchChanged", value: " Speed " });

    expect(initial.filter).toBe("all");
    expect(searched).toEqual({
      ...initial,
      filter: "unique",
      viewMode: "parent",
      hideParentDuplicates: true,
      search: " Speed ",
    });
  });

  it("derives filtered skills from current input as well as current state", () => {
    const initial = parentSkillPickerAdapter.initialState(input);
    const uniqueState = parentSkillPickerAdapter.reduce(initial, { type: "filterChanged", value: "unique" });
    expect(parentSkillPickerAdapter.derive(input, uniqueState).filteredSkills.map((skill) => skill.id)).toEqual([2]);

    const changedInput = { ...input, skills: [skills[0]!] };
    expect(parentSkillPickerAdapter.derive(changedInput, initial).filteredSkills.map((skill) => skill.id)).toEqual([1]);
  });
});
