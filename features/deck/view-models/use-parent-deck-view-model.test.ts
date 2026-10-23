import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckProvider } from "@/features/deck/state";
import { useParentDeckViewModel, type ParentDeckViewModel } from "./use-parent-deck-view-model";

function ParentDeckProbe({
  onNavigate,
  onVm,
}: {
  onNavigate: () => void;
  onVm: (vm: ParentDeckViewModel) => void;
}) {
  const vm = useParentDeckViewModel(onNavigate);
  onVm(vm);
  return null;
}

describe("useParentDeckViewModel", () => {
  it("initializes with default lineage and affinity calculations", () => {
    let navigated = false;
    let vmResult!: ParentDeckViewModel;

    renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(ParentDeckProbe, {
          onNavigate: () => { navigated = true; },
          onVm: (vm) => { vmResult = vm; },
        })
      )
    );

    expect(vmResult.state.setup).toBeDefined();
    expect(vmResult.state.affinityBreakdown).toBeDefined();
    expect(vmResult.state.affinityBreakdown.totalScore).toBeGreaterThanOrEqual(0);
    expect(typeof vmResult.commands.navigateToParenting).toBe("function");

    vmResult.commands.navigateToParenting();
    expect(navigated).toBe(true);
  });
});
