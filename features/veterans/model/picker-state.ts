import type { PickerAdapter } from "@/app/common/hooks/use-picker-controller";
import type { VeteranPickerSort } from "./picker-utils";

export type VeteranPickerTab = "recommended" | "owned" | "veterans" | "templates";

export interface VeteranPickerInput {
  initialTab: VeteranPickerTab;
  initialSort: VeteranPickerSort;
  recommendationsAvailable: boolean;
}

export interface VeteranPickerState {
  activeTab: VeteranPickerTab;
  search: string;
  sortBy: VeteranPickerSort;
}

export type VeteranPickerAction =
  | { type: "tabSelected"; tab: VeteranPickerTab }
  | { type: "searchChanged"; value: string }
  | { type: "sortChanged"; value: VeteranPickerSort };

export interface VeteranPickerViewModel {
  activeTab: VeteranPickerTab;
  normalizedSearch: string;
}

export const veteranPickerAdapter: PickerAdapter<
  VeteranPickerInput,
  VeteranPickerState,
  VeteranPickerAction,
  VeteranPickerViewModel
> = {
  initialState: (input) => ({
    activeTab: input.initialTab,
    search: "",
    sortBy: input.initialSort,
  }),
  reduce: (state, action) => {
    switch (action.type) {
      case "tabSelected": return { ...state, activeTab: action.tab };
      case "searchChanged": return { ...state, search: action.value };
      case "sortChanged": return { ...state, sortBy: action.value };
    }
  },
  derive: (input, state) => ({
    activeTab:
      state.activeTab === "recommended" && !input.recommendationsAvailable
        ? "veterans"
        : state.activeTab,
    normalizedSearch: state.search.trim().toLowerCase(),
  }),
};
