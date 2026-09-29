import { describe, expect, test } from "bun:test";
import { cardPickerAdapter } from "./card-picker-state";

describe("card picker state adapter", () => {
  test("chooses the original mode-specific default sort", () => {
    expect(cardPickerAdapter.initialState("main").sort).toBe("rarity");
    expect(cardPickerAdapter.initialState("parent").sort).toBe("recommended");
  });

  test("toggles effect filters and supports clearing them", () => {
    const initial = cardPickerAdapter.initialState("main");
    const filtered = cardPickerAdapter.reduce(initial, { type: "effectToggled", value: "acceleration" });
    expect(filtered.selectedEffects).toEqual(["acceleration"]);
    expect(cardPickerAdapter.reduce(filtered, { type: "effectToggled", value: "acceleration" }).selectedEffects).toEqual([]);
    expect(cardPickerAdapter.reduce(filtered, { type: "effectsCleared" }).selectedEffects).toEqual([]);
  });

  test("derives normalized autocomplete input and selected skill IDs", () => {
    const initial = cardPickerAdapter.initialState("parent");
    const state = cardPickerAdapter.reduce(initial, { type: "skillQueryChanged", value: "  Arc Maestro " });
    const view = cardPickerAdapter.derive("parent", state);
    expect(view.normalizedSkillQuery).toBe("arc maestro");
    expect(view.selectedSkillIds.size).toBe(0);
  });
});
