import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckProvider } from "@/features/deck/state";
import { partnerCodeFromHash, usePartnerCardViewModel, type PartnerCardViewModel } from "./use-partner-card-view-model";

function Probe({ code, onVm }: { code: string | null; onVm: (vm: PartnerCardViewModel) => void }) {
  onVm(usePartnerCardViewModel(code));
  return null;
}

function render(code: string | null): PartnerCardViewModel {
  let vm!: PartnerCardViewModel;
  renderToStaticMarkup(React.createElement(DeckProvider, null, React.createElement(Probe, { code, onVm: (v) => { vm = v; } })));
  return vm;
}

describe("partnerCodeFromHash", () => {
  it("reads the v= payload and rejects anything else", () => {
    expect(partnerCodeFromHash("#v=abc_DEF-123")).toBe("abc_DEF-123");
    expect(partnerCodeFromHash("v=xyz")).toBe("xyz");
    expect(partnerCodeFromHash("#s=abc")).toBeNull();
    expect(partnerCodeFromHash("#v=")).toBeNull();
    expect(partnerCodeFromHash("#v=a b")).toBeNull();
    expect(partnerCodeFromHash("")).toBeNull();
  });
});

describe("usePartnerCardViewModel", () => {
  it("starts loading with no model, no affinity and borrowing disabled", () => {
    const vm = render("abc");
    expect(vm.state.status).toBe("loading");
    expect(vm.state.model).toBeNull();
    expect(vm.state.visibleSections).toEqual([]);
    expect(vm.state.affinity).toBeNull();
    expect(vm.state.canBorrow).toBe(false);
    expect(vm.state.characters.length).toBeGreaterThan(0);
    for (const command of Object.values(vm.commands)) expect(typeof command).toBe("function");
  });
});
