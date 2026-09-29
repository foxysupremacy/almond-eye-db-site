import { describe, expect, test } from "bun:test";
import { veteranPickerAdapter, type VeteranPickerInput } from "./picker-state";

const input: VeteranPickerInput = {
  initialTab: "owned",
  initialSort: "blue_stars",
  recommendationsAvailable: true,
};

describe("veteran picker state adapter", () => {
  test("initializes search empty and preserves the supplied tab and sort defaults", () => {
    expect(veteranPickerAdapter.initialState(input)).toEqual({
      activeTab: "owned",
      search: "",
      sortBy: "blue_stars",
    });
  });

  test("reduces tab, search, and sort changes independently", () => {
    const initial = veteranPickerAdapter.initialState(input);
    const tabbed = veteranPickerAdapter.reduce(initial, { type: "tabSelected", tab: "templates" });
    const searched = veteranPickerAdapter.reduce(tabbed, { type: "searchChanged", value: " Alpha " });
    const sorted = veteranPickerAdapter.reduce(searched, { type: "sortChanged", value: "unique_tier" });

    expect(sorted).toEqual({ activeTab: "templates", search: " Alpha ", sortBy: "unique_tier" });
    expect(initial).toEqual({ activeTab: "owned", search: "", sortBy: "blue_stars" });
  });

  test("derives normalized search and falls back from unavailable recommendations", () => {
    const state = veteranPickerAdapter.reduce(
      veteranPickerAdapter.initialState({ ...input, initialTab: "recommended" }),
      { type: "searchChanged", value: "  Tokai Teio " },
    );
    expect(veteranPickerAdapter.derive({ ...input, recommendationsAvailable: false }, state)).toEqual({
      activeTab: "veterans",
      normalizedSearch: "tokai teio",
    });
  });
});
