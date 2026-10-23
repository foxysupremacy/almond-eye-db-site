import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckProvider } from "@/features/deck/state";
import { useParentingViewModel, type ParentingViewModel } from "./use-parenting-view-model";

function ParentingProbe({
  onVm,
}: {
  onVm: (vm: ParentingViewModel) => void;
}) {
  const vm = useParentingViewModel();
  onVm(vm);
  return null;
}

describe("useParentingViewModel", () => {
  it("initializes state, modals, and commands properly", () => {
    let vmResult!: ParentingViewModel;

    renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(ParentingProbe, {
          onVm: (vm) => { vmResult = vm; },
        })
      )
    );

    expect(vmResult.state.setup).toBeDefined();
    expect(vmResult.state.isTraineeModalOpen).toBe(false);
    expect(vmResult.state.activePickerSlot).toBeNull();
    expect(vmResult.state.isInheritedSkillsOpen).toBe(false);
    expect(vmResult.state.statBonuses).toBeDefined();
    expect(typeof vmResult.commands.openTraineeModal).toBe("function");
    expect(typeof vmResult.commands.closeTraineeModal).toBe("function");
    expect(typeof vmResult.commands.openPicker).toBe("function");
    expect(typeof vmResult.commands.closePicker).toBe("function");
    expect(typeof vmResult.commands.handleShare).toBe("function");
    expect(typeof vmResult.commands.resetParenting).toBe("function");
  });
});
