import type { PickerAdapter } from "@/app/common/hooks/use-picker-controller";
import type { RarityFilterKey } from "@/lib/skills/rarity";
import {
  filterParentSkills,
  type ParentSkillFilterOptions,
  type ParentSkillFilterTab,
  type ParentSkillSourceFilter,
} from "./parent-skill-projections";
import type { DisplayParentSkill } from "../../hooks/use-lineage-skills";

export type ParentSkillViewMode = "list" | "card" | "parent";

export interface ParentSkillPickerState {
  filter: ParentSkillFilterTab;
  sourceFilter: ParentSkillSourceFilter;
  rarityFilter: RarityFilterKey;
  viewMode: ParentSkillViewMode;
  search: string;
}

export type ParentSkillPickerAction =
  | { type: "filterChanged"; value: ParentSkillFilterTab }
  | { type: "sourceFilterChanged"; value: ParentSkillSourceFilter }
  | { type: "rarityFilterChanged"; value: RarityFilterKey }
  | { type: "viewModeChanged"; value: ParentSkillViewMode }
  | { type: "searchChanged"; value: string };

export interface ParentSkillPickerInput {
  skills: readonly DisplayParentSkill[];
  options: Omit<ParentSkillFilterOptions, "filter" | "sourceFilter" | "rarityFilter" | "search">;
}

export interface ParentSkillPickerViewModel {
  filteredSkills: DisplayParentSkill[];
  normalizedSearch: string;
}

export const parentSkillPickerAdapter: PickerAdapter<
  ParentSkillPickerInput,
  ParentSkillPickerState,
  ParentSkillPickerAction,
  ParentSkillPickerViewModel
> = {
  initialState: () => ({
    filter: "unique",
    sourceFilter: "all",
    rarityFilter: "all",
    viewMode: "list",
    search: "",
  }),
  reduce: (state, action) => {
    switch (action.type) {
      case "filterChanged": return { ...state, filter: action.value };
      case "sourceFilterChanged": return action.value === "hard_to_get"
        ? { ...state, sourceFilter: action.value, filter: "all", viewMode: "list" }
        : { ...state, sourceFilter: action.value };
      case "rarityFilterChanged": return { ...state, rarityFilter: action.value };
      case "viewModeChanged": return { ...state, viewMode: action.value };
      case "searchChanged": return { ...state, search: action.value };
    }
  },
  derive: (input, state) => ({
    filteredSkills: filterParentSkills(input.skills, {
      ...input.options,
      filter: state.filter,
      sourceFilter: state.sourceFilter,
      rarityFilter: state.rarityFilter,
      search: state.search,
    }),
    normalizedSearch: state.search.trim().toLowerCase(),
  }),
};
