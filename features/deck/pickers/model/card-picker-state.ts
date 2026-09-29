import type { SkillDetail } from "@/lib/api";
import type { SkillEffectCategory } from "@/lib/skills/effects";
import type { PickerAdapter } from "@/app/common/hooks/use-picker-controller";
import type { CardPickerSort, CardPickerType, PickerMode } from "./card-filter";

export interface CardPickerState {
  query: string;
  sort: CardPickerSort;
  type: CardPickerType;
  selectedEffects: SkillEffectCategory[];
  onlyOwned: boolean;
  selectedSkills: SkillDetail[];
  skillMatchMode: "OR" | "AND";
  skillQuery: string;
  isSkillDropdownOpen: boolean;
  isSkillPanelOpen: boolean;
}

export type CardPickerAction =
  | { type: "queryChanged"; value: string }
  | { type: "sortChanged"; value: CardPickerSort }
  | { type: "typeChanged"; value: CardPickerType }
  | { type: "effectToggled"; value: SkillEffectCategory }
  | { type: "effectsCleared" }
  | { type: "ownershipToggled" }
  | { type: "skillAdded"; skill: SkillDetail }
  | { type: "skillRemoved"; skillId: number }
  | { type: "skillsCleared" }
  | { type: "skillMatchModeChanged"; value: "OR" | "AND" }
  | { type: "skillQueryChanged"; value: string }
  | { type: "skillDropdownToggled"; value: boolean }
  | { type: "skillPanelToggled" };

export interface CardPickerViewModel {
  normalizedSkillQuery: string;
  selectedSkillIds: ReadonlySet<number>;
}

export const cardPickerAdapter: PickerAdapter<PickerMode, CardPickerState, CardPickerAction, CardPickerViewModel> = {
  initialState: (mode) => ({
    query: "",
    sort: mode === "parent" ? "recommended" : "rarity",
    type: "all",
    selectedEffects: [],
    onlyOwned: false,
    selectedSkills: [],
    skillMatchMode: "OR",
    skillQuery: "",
    isSkillDropdownOpen: false,
    isSkillPanelOpen: true,
  }),
  reduce: (state, action) => {
    switch (action.type) {
      case "queryChanged": return { ...state, query: action.value };
      case "sortChanged": return { ...state, sort: action.value };
      case "typeChanged": return { ...state, type: action.value };
      case "effectToggled": return {
        ...state,
        selectedEffects: state.selectedEffects.includes(action.value)
          ? state.selectedEffects.filter((effect) => effect !== action.value)
          : [...state.selectedEffects, action.value],
      };
      case "effectsCleared": return { ...state, selectedEffects: [] };
      case "ownershipToggled": return { ...state, onlyOwned: !state.onlyOwned };
      case "skillAdded": return state.selectedSkills.some((skill) => skill.id === action.skill.id)
        ? state
        : { ...state, selectedSkills: [...state.selectedSkills, action.skill] };
      case "skillRemoved": return { ...state, selectedSkills: state.selectedSkills.filter((skill) => skill.id !== action.skillId) };
      case "skillsCleared": return { ...state, selectedSkills: [] };
      case "skillMatchModeChanged": return { ...state, skillMatchMode: action.value };
      case "skillQueryChanged": return { ...state, skillQuery: action.value };
      case "skillDropdownToggled": return { ...state, isSkillDropdownOpen: action.value };
      case "skillPanelToggled": return { ...state, isSkillPanelOpen: !state.isSkillPanelOpen };
    }
  },
  derive: (_mode, state) => ({
    normalizedSkillQuery: state.skillQuery.trim().toLowerCase(),
    selectedSkillIds: new Set(state.selectedSkills.map((skill) => skill.id)),
  }),
};
