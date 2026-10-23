import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  useSupportsCollectionViewModel,
  type SupportsCollectionViewModel,
} from "./use-supports-collection-view-model";

function SupportsProbe({
  onVm,
}: {
  onVm: (vm: SupportsCollectionViewModel) => void;
}) {
  const vm = useSupportsCollectionViewModel();
  onVm(vm);
  return null;
}

describe("useSupportsCollectionViewModel", () => {
  it("initializes state and commands properly", () => {
    let vm!: SupportsCollectionViewModel;
    renderToStaticMarkup(
      React.createElement(SupportsProbe, {
        onVm: (result) => { vm = result; },
      })
    );

    expect(vm.state.query).toBe("");
    expect(vm.state.cardType).toBe("all");
    expect(vm.state.cardRarity).toBe("all");
    expect(vm.state.ownedFirst).toBe(false);
    expect(vm.state.isImportModalOpen).toBe(false);
    expect(Array.isArray(vm.state.cards)).toBe(true);
    expect(Array.isArray(vm.state.filteredCards)).toBe(true);

    expect(typeof vm.commands.setQuery).toBe("function");
    expect(typeof vm.commands.setCardType).toBe("function");
    expect(typeof vm.commands.setCardRarity).toBe("function");
    expect(typeof vm.commands.setOwnedFirst).toBe("function");
    expect(typeof vm.commands.openImportModal).toBe("function");
    expect(typeof vm.commands.closeImportModal).toBe("function");
    expect(typeof vm.commands.setLimitBreak).toBe("function");
    expect(typeof vm.commands.removeCard).toBe("function");
  });
});
