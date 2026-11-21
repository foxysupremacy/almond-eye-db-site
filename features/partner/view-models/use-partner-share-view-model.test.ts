import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ALL_PARTNER_SECTIONS } from "@/lib/veterans/share/partner-codec";
import { buildPartnerShareUrl, sharePngSections, usePartnerShareViewModel, type PartnerShareViewModel } from "./use-partner-share-view-model";

function Probe({ onVm }: { onVm: (vm: PartnerShareViewModel) => void }) {
  onVm(usePartnerShareViewModel(null));
  return null;
}

describe("buildPartnerShareUrl", () => {
  it("puts the code in the hash so it never reaches the server", () => {
    expect(buildPartnerShareUrl("https://database.almond-eye.tech", "abc")).toBe("https://database.almond-eye.tech/partner#v=abc");
    expect(buildPartnerShareUrl("http://localhost:3000/", "x_y-z")).toBe("http://localhost:3000/partner#v=x_y-z");
  });
});

describe("usePartnerShareViewModel", () => {
  it("starts closed with every section selected and no link", () => {
    let vm!: PartnerShareViewModel;
    renderToStaticMarkup(React.createElement(Probe, { onVm: (v) => { vm = v; } }));
    expect(vm.state.isOpen).toBe(false);
    expect(vm.state.sections).toEqual(ALL_PARTNER_SECTIONS);
    expect(vm.state.link).toBeNull();
    expect(vm.state.isEncoding).toBe(false);
    for (const command of Object.values(vm.commands)) expect(typeof command).toBe("function");
  });
});

describe("sharePngSections", () => {
  it("drops Affinity from the sharer's PNG because there is no trainee to compare against", () => {
    expect(sharePngSections(ALL_PARTNER_SECTIONS)).toEqual(["support-cards", "skills", "sparks", "wins"]);
    expect(sharePngSections(["skills"])).toEqual(["skills"]);
  });
});
