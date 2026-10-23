import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  useCharactersCollectionViewModel,
  type CharactersCollectionViewModel,
} from "./use-characters-collection-view-model";

function CharactersProbe({
  onVm,
}: {
  onVm: (vm: CharactersCollectionViewModel) => void;
}) {
  const vm = useCharactersCollectionViewModel();
  onVm(vm);
  return null;
}

describe("useCharactersCollectionViewModel", () => {
  it("initializes state and commands properly", () => {
    let vm!: CharactersCollectionViewModel;
    renderToStaticMarkup(
      React.createElement(CharactersProbe, {
        onVm: (result) => { vm = result; },
      })
    );

    expect(vm.state.query).toBe("");
    expect(vm.state.charaRarity).toBe("all");
    expect(vm.state.ownedFirst).toBe(false);
    expect(vm.state.isImportModalOpen).toBe(false);
    expect(Array.isArray(vm.state.characters)).toBe(true);
    expect(Array.isArray(vm.state.filteredCharacters)).toBe(true);

    expect(typeof vm.commands.setQuery).toBe("function");
    expect(typeof vm.commands.setCharaRarity).toBe("function");
    expect(typeof vm.commands.setOwnedFirst).toBe("function");
    expect(typeof vm.commands.openImportModal).toBe("function");
    expect(typeof vm.commands.closeImportModal).toBe("function");
    expect(typeof vm.commands.setUmaDetails).toBe("function");
    expect(typeof vm.commands.removeUma).toBe("function");
  });
});
