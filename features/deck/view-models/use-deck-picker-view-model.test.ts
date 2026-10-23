import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckProvider } from "@/features/deck/state";
import { useDeckPickerViewModel, type DeckPickerViewModel } from "./use-deck-picker-view-model";
import type { CardIndexEntry } from "@/lib/api";

function DeckPickerProbe({
  mode,
  onVm,
}: {
  mode?: "main" | "parent";
  onVm: (vm: DeckPickerViewModel) => void;
}) {
  const vm = useDeckPickerViewModel(mode);
  onVm(vm);
  return null;
}

describe("useDeckPickerViewModel", () => {
  it("initializes with 6 slots, empty openSlot, and correct mode properties", () => {
    let mainVm!: DeckPickerViewModel;
    renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(DeckPickerProbe, {
          mode: "main",
          onVm: (vm) => { mainVm = vm; },
        })
      )
    );

    expect(mainVm.state.isParent).toBe(false);
    expect(mainVm.state.activeSlots).toHaveLength(6);
    expect(mainVm.state.openSlot).toBeNull();
    expect(mainVm.state.mobileSlot).toBeNull();
    expect(mainVm.state.inspectCard).toBeNull();
    expect(typeof mainVm.commands.openSlotPicker).toBe("function");
    expect(typeof mainVm.commands.pickCard).toBe("function");

    let parentVm!: DeckPickerViewModel;
    renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(DeckPickerProbe, {
          mode: "parent",
          onVm: (vm) => { parentVm = vm; },
        })
      )
    );

    expect(parentVm.state.isParent).toBe(true);
    expect(parentVm.state.activeSlots).toHaveLength(6);
  });
});
