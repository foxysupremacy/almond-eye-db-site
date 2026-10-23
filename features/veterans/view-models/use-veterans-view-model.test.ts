import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckProvider } from "@/features/deck/state";
import { useVeteransViewModel, type VeteransViewModel } from "./use-veterans-view-model";

function VeteransProbe({
  onVm,
}: {
  onVm: (vm: VeteransViewModel) => void;
}) {
  const vm = useVeteransViewModel();
  onVm(vm);
  return null;
}

describe("useVeteransViewModel", () => {
  it("initializes with default query, sort, filters, and command handlers", () => {
    let vm!: VeteransViewModel;
    renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(VeteransProbe, {
          onVm: (result) => { vm = result; },
        })
      )
    );

    expect(vm.state.query).toBe("");
    expect(vm.state.sortBy).toBe("newest");
    expect(vm.state.minBlueStars).toBe(0);
    expect(vm.state.onlyParents).toBe(false);
    expect(vm.state.isDetailModalOpen).toBe(false);
    expect(vm.state.isImportModalOpen).toBe(false);
    expect(vm.state.selectedVeteran).toBeNull();
    expect(Array.isArray(vm.state.veterans)).toBe(true);
    expect(Array.isArray(vm.state.filteredVeterans)).toBe(true);

    expect(typeof vm.commands.setQuery).toBe("function");
    expect(typeof vm.commands.setSortBy).toBe("function");
    expect(typeof vm.commands.setMinBlueStars).toBe("function");
    expect(typeof vm.commands.setOnlyParents).toBe("function");
    expect(typeof vm.commands.toggleParent).toBe("function");
    expect(typeof vm.commands.inspectVeteran).toBe("function");
    expect(typeof vm.commands.closeDetailModal).toBe("function");
    expect(typeof vm.commands.openImportModal).toBe("function");
    expect(typeof vm.commands.closeImportModal).toBe("function");
    expect(typeof vm.commands.handleFileDrop).toBe("function");
    expect(typeof vm.commands.handleClear).toBe("function");
  });
});
