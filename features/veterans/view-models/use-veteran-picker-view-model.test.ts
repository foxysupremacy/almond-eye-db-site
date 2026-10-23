import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckProvider } from "@/features/deck/state";
import {
  useVeteranPickerViewModel,
  type VeteranPickerViewModel,
  type UseVeteranPickerViewModelOptions,
} from "./use-veteran-picker-view-model";

function VeteranPickerProbe({
  options,
  onVm,
}: {
  options: UseVeteranPickerViewModelOptions;
  onVm: (vm: VeteranPickerViewModel) => void;
}) {
  const vm = useVeteranPickerViewModel(options);
  onVm(vm);
  return null;
}

describe("useVeteranPickerViewModel", () => {
  it("initializes tabs, search, projections, and commands", () => {
    let vm!: VeteranPickerViewModel;
    renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(VeteranPickerProbe, {
          options: {
            isOpen: true,
            targetCharaId: 1001,
            veterans: [],
            characters: [],
            initialTab: "veterans",
          },
          onVm: (result) => { vm = result; },
        })
      )
    );

    expect(vm.state.activeTab).toBe("veterans");
    expect(vm.state.search).toBe("");
    expect(vm.state.normalizedSearch).toBe("");
    expect(typeof vm.commands.setActiveTab).toBe("function");
    expect(typeof vm.commands.setSortBy).toBe("function");
    expect(typeof vm.commands.setSearch).toBe("function");
    expect(typeof vm.commands.setExpandedCharId).toBe("function");
  });
});
