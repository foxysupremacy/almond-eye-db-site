import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { api, type SkillDetail } from "@/lib/api";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { SkillHoverCard, SkillInspectorProvider } from "@/app/common/ui/skills/details/skill-hover-card";
import DuplicateSkillBadge from "@/app/common/ui/skills/provenance/duplicate-skill-badge";
import { TrackSkillSidebar } from "@/features/visualizer/components/track-skill-sidebar";
import { RaceImpactProfilePanel } from "@/features/visualizer/components/race-impact-profile-panel";
import { defaultRaceImpactProfile, type RaceImpactProfile } from "@/lib/race-impact";

const originalMatchMedia = window.matchMedia;
const originalWidth = window.innerWidth;
afterEach(() => {
  cleanup();
  window.matchMedia = originalMatchMedia;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
});

function replaceSkillRequest(implementation: typeof api.skill) {
  const original = api.skill;
  api.skill = implementation;
  return { mockRestore() { api.skill = original; } };
}
function finePointer() {
  window.matchMedia = ((query: string) => ({ matches: query.includes("pointer: fine"), media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } })) as typeof window.matchMedia;
}
function detail(id: number): SkillDetail {
  return { id, nameEn: `Loaded skill ${id}`, nameJp: "テストスキル", descEn: "Inspection data", rarity: 1, conditionGroups: [] };
}
function Inspector({ children }: { children: React.ReactNode }) {
  return <SkillInspectorProvider course={null} racerCount={12} runningStyle={null} activePvpEvent={null} raceParams={{}}>{children}</SkillInspectorProvider>;
}

describe("skill inspection overlays", () => {
  test("keyboard pins asynchronous details and Escape restores its trigger", async () => {
    finePointer();
    const pending = Promise.withResolvers<SkillDetail>();
    const request = replaceSkillRequest(() => pending.promise);
    try {
      const user = userEvent.setup();
      render(<Inspector><SkillHoverCard skillId={980001} fallbackSkill={{ nameEn: "First skill" }}>First skill</SkillHoverCard></Inspector>);
      const trigger = screen.getByRole("button", { name: "Inspect First skill" });
      act(() => trigger.focus());
      await user.keyboard("{Enter}");
      expect(screen.getByRole("dialog", { name: "Skill details" })).toBeTruthy();
      expect(screen.getByText("Loading skill…")).toBeTruthy();
      await act(async () => { pending.resolve(detail(980001)); });
      await screen.findByText("Loaded skill 980001");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog") === null).toBe(true));
      expect(document.activeElement === trigger).toBe(true);
    } finally { request.mockRestore(); }
  });

  test("hover preview remains passive and keyboard activation upgrades it to pinned", async () => {
    finePointer();
    const request = replaceSkillRequest(async () => detail(980002));
    try {
      const user = userEvent.setup();
      render(<Inspector><SkillHoverCard skillId={980002} fallbackSkill={{ nameEn: "Preview skill" }}>Preview skill</SkillHoverCard></Inspector>);
      const trigger = screen.getByRole("button", { name: "Inspect Preview skill" });
      act(() => trigger.focus());
      fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
      expect(document.querySelector('[aria-label="Skill details"]')).toBeNull();
      await waitFor(() => expect(document.querySelector('[aria-label="Skill details"][inert]')).toBeTruthy());
      expect(document.activeElement === trigger).toBe(true);
      expect(screen.queryByRole("dialog") === null).toBe(true);
      await user.keyboard("{Enter}");
      expect(screen.getByRole("dialog", { name: "Skill details" })).toBeTruthy();
      fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
      expect(screen.getByRole("dialog", { name: "Skill details" })).toBeTruthy();
    } finally { request.mockRestore(); }
  });

  test("singleton inspector dismisses before its parent dialog", async () => {
    const request = replaceSkillRequest(async () => detail(980003));
    try {
      const user = userEvent.setup();
      function Probe() {
        const [open, setOpen] = useState(false);
        return <Inspector><button onClick={() => setOpen(true)}>Open card picker</button><AppDialog isOpen={open} onOpenChange={setOpen} title="Card picker"><SkillHoverCard skillId={980003} fallbackSkill={{ nameEn: "Nested skill" }}>Nested skill</SkillHoverCard></AppDialog></Inspector>;
      }
      render(<Probe />);
      await user.click(screen.getByRole("button", { name: "Open card picker" }));
      const trigger = screen.getByRole("button", { name: "Inspect Nested skill" });
      act(() => trigger.focus());
      await user.keyboard("{Enter}");
      expect(screen.getByRole("dialog", { name: "Skill details" })).toBeTruthy();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skill details" }) === null).toBe(true));
      expect(screen.getByRole("dialog", { name: "Card picker" })).toBeTruthy();
      expect(document.activeElement === trigger).toBe(true);
    } finally { request.mockRestore(); }
  });

  test("touch-sized inspection uses a modal without focusing an input", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const request = replaceSkillRequest(async () => detail(980004));
    try {
      const user = userEvent.setup();
      render(<Inspector><SkillHoverCard skillId={980004} fallbackSkill={{ nameEn: "Touch skill" }}>Touch skill</SkillHoverCard></Inspector>);
      await user.click(screen.getByRole("button", { name: "Inspect Touch skill" }));
      const dialog = screen.getByRole("dialog", { name: "Skill details" });
      expect(dialog).toBeTruthy();
      expect(dialog.className).toContain("rounded-t-3xl");
      expect(document.activeElement?.tagName).not.toBe("INPUT");
      await user.click(screen.getByRole("button", { name: "Close skill details" }));
      await waitFor(() => expect(screen.queryByRole("dialog") === null).toBe(true));
    } finally { request.mockRestore(); }
  });

  test("duplicate sources open above their inspection parent and close first", async () => {
    const user = userEvent.setup();
    function Probe() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Inspect card</button><AppDialog isOpen={open} onOpenChange={setOpen} title="Card inspection" overlayClassName="z-[350]"><DuplicateSkillBadge cards={[{ cardId: 1, cardName: "Card A", source: "hint" }, { cardId: 2, cardName: "Card B", source: "event" }]} currentCardId={1} skillName="Shared skill" /></AppDialog></>;
    }
    render(<Probe />);
    await user.click(screen.getByRole("button", { name: "Inspect card" }));
    const trigger = screen.getByRole("button", { name: /duplicate with Card B/i });
    // Tailwind is not loaded in Happy DOM; provide the parent's computed layer.
    let ancestor: HTMLElement | null = trigger;
    while (ancestor) {
      if (ancestor.classList.contains("z-[350]")) ancestor.style.zIndex = "350";
      ancestor = ancestor.parentElement;
    }
    act(() => trigger.focus());
    await user.keyboard("{Enter}");
    const popover = screen.getByRole("dialog", { name: "Duplicate sources for Shared skill" });
    expect(popover.className).toContain("z-[360]");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Duplicate sources for Shared skill" }) === null).toBe(true));
    expect(screen.getByRole("dialog", { name: "Card inspection" })).toBeTruthy();
    expect(document.activeElement === trigger).toBe(true);
  });
});

describe("visualizer controls", () => {
  test("rarity selection exposes its selected state and cannot deselect", async () => {
    const user = userEvent.setup();
    let selections: string[] = [];
    render(<TrackSkillSidebar visualizerDeck="main" onVisualizerDeckChange={() => {}} rarityFilter="all" onRarityFilterChange={(next) => selections.push(next)} activeSkills={[]} displayedSkills={[]} selectedSkillId={null} onSelectSkill={() => {}} firesOnCourse={() => false} />);
    const all = screen.getByRole("radio", { name: "All" });
    expect(all.getAttribute("aria-checked")).toBe("true");
    await user.click(all);
    expect(selections).toEqual([]);
    await user.click(screen.getByRole("radio", { name: "Gold" }));
    expect(selections).toEqual(["gold"]);
  });

  test("profile disclosure supports number-field keyboard changes and cleared overrides", async () => {
    const user = userEvent.setup();
    function Probe() {
      const [profile, setProfile] = useState<RaceImpactProfile>(() => ({ ...defaultRaceImpactProfile(), dynamicOverrides: { blocked: 0.3 } }));
      return <><RaceImpactProfilePanel profile={profile} dynamicKeys={["blocked"]} onChange={setProfile} /><output>{profile.stats.speed}:{profile.dynamicOverrides.blocked ?? "telemetry"}</output></>;
    }
    render(<Probe />);
    await user.click(screen.getByRole("button", { name: /Race-impact profile/ }));
    const speed = screen.getByRole("textbox", { name: "Speed" });
    const previous = Number((speed as HTMLInputElement).value.replaceAll(",", ""));
    act(() => speed.focus());
    await user.keyboard("{ArrowUp}");
    expect((speed as HTMLInputElement).value.replaceAll(",", "")).toBe(String(previous + 1));
    const blocked = screen.getByRole("textbox", { name: "Blocked" });
    await user.clear(blocked);
    await user.tab();
    await waitFor(() => expect(screen.getByText(/:telemetry$/)).toBeTruthy());
  });
});
