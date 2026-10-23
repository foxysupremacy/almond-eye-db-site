import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckProvider } from "@/features/deck/state";
import { useDeckSkillListViewModel, type DeckSkillListViewModel } from "./use-deck-skill-list-view-model";

function SkillListProbe({
  onVm,
}: {
  onVm: (vm: DeckSkillListViewModel) => void;
}) {
  const vm = useDeckSkillListViewModel();
  onVm(vm);
  return null;
}

describe("useDeckSkillListViewModel", () => {
  it("initializes with default filters, view mode, and skill categories", () => {
    let vmResult!: DeckSkillListViewModel;

    renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(SkillListProbe, {
          onVm: (vm) => { vmResult = vm; },
        })
      )
    );

    expect(vmResult.state.sourceFilter).toBe("all");
    expect(vmResult.state.rarityFilter).toBe("all");
    expect(["list", "card"]).toContain(vmResult.state.viewMode);
    expect(vmResult.state.search).toBe("");
    expect(typeof vmResult.commands.setSourceFilter).toBe("function");
    expect(typeof vmResult.commands.setRarityFilter).toBe("function");
    expect(typeof vmResult.commands.setViewMode).toBe("function");
    expect(typeof vmResult.commands.setSearch).toBe("function");
  });
});
