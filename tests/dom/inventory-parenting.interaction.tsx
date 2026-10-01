import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@react-aria/test-utils";
import { useState } from "react";
import type { CharacterIndexEntry } from "@/lib/api";
import { getCompatibilityRating } from "@/lib/lineage/affinity-engine";
import { CharacterItem } from "@/features/collection/components/character-item";
import CharacterPickerModal from "@/features/parenting/components/character-picker-modal";
import InheritedSkillsModal from "@/features/parenting/components/inherited-skills-modal";
import { LineageAffinityHeader } from "@/features/parenting/components/lineage-affinity-header";

afterEach(() => cleanup());

const character: CharacterIndexEntry = {
  id: 100101, charId: 1001, variant: "01", nameEn: "Special Week", nameJp: "スペシャルウィーク",
  titleEn: "Special Dreamer", titleJp: "スペシャルドリーマー", rarity: 3,
  aptitude: [], baseStats: [], imgUrl: "/character.png",
};

describe("Collection and Parenting interactions", () => {
  test("custom character card activates once from the keyboard", async () => {
    const user = userEvent.setup();
    const selected: number[] = [];
    render(<CharacterItem character={character} details={undefined} onSelect={(value) => selected.push(value.id)} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button"));
    await user.keyboard(" ");
    expect(selected).toEqual([character.id]);
  });

  test("character picker filters on touch without focusing search and selects once", async () => {
    const user = userEvent.setup();
    const selected: number[] = [];
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } })) as typeof window.matchMedia;
    try {
      function Probe() {
        const [open, setOpen] = useState(false);
        return <><button onClick={() => setOpen(true)}>Choose trainee</button><CharacterPickerModal isOpen={open} onClose={() => setOpen(false)} characters={[character, { ...character, id: 100201, nameEn: "Silence Suzuka", nameJp: "サイレンススズカ", titleEn: "Silent Innocence", titleJp: "サイレントイノセンス" }]} onSelect={(value) => selected.push(value.id)} /></>;
      }
      render(<Probe />);
      const trigger = screen.getByRole("button", { name: "Choose trainee" });
      await user.click(trigger);
      const search = await screen.findByRole("searchbox");
      expect(document.activeElement).not.toBe(search);
      await user.type(search, "スペシャル");
      expect(screen.queryByRole("button", { name: /Silence Suzuka/ }) === null).toBe(true);
      await user.click(screen.getByRole("button", { name: /Special Week/ }));
      await waitFor(() => expect(screen.queryByRole("dialog") === null).toBe(true));
      expect(selected).toEqual([character.id]);
      expect(document.activeElement === trigger).toBe(true);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  test("inherited skill tabs support arrow keys and Escape restores the opener", async () => {
    const user = userEvent.setup();
    function Probe() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Inspect inheritance</button><InheritedSkillsModal isOpen={open} onClose={() => setOpen(false)} participants={[]} /></>;
    }
    render(<Probe />);
    const trigger = screen.getByRole("button", { name: "Inspect inheritance" });
    const dialog = new User({ interactionType: "keyboard" }).createTester("Dialog", { root: trigger, overlayType: "modal" });
    await dialog.open();
    screen.getByRole("tab", { name: "Unique Skills" }).focus();
    await user.keyboard("[ArrowRight]");
    await waitFor(() => expect(screen.getByRole("tab", { name: /White Factors/ }).getAttribute("aria-selected")).toBe("true"));
    expect(screen.getByText(/No white skill or race factors detected/)).toBeTruthy();
    await user.keyboard("[Escape]");
    await waitFor(() => expect(screen.queryByRole("dialog") === null).toBe(true));
    expect(document.activeElement === trigger).toBe(true);
  });

  test("affinity breakdown portals outside the header and dismisses on Escape", async () => {
    const user = userEvent.setup();
    const view = render(<LineageAffinityHeader affinityBreakdown={{ targetCharaId: null, p1Affinity: null, p2Affinity: null, pairAffinity: null, totalScore: 0, rating: getCompatibilityRating(0) }} onOpenInheritedSkills={() => {}} />);
    const trigger = screen.getByRole("button", { name: "View affinity score breakdown" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Affinity breakdown" });
    expect(view.container.contains(dialog)).toBe(false);
    await user.keyboard("[Escape]");
    await waitFor(() => expect(screen.queryByRole("dialog") === null).toBe(true));
    expect(document.activeElement === trigger).toBe(true);
  });
});
