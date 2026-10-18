import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { api, type SkillDetail } from "@/lib/api";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { SkillHoverCard, SkillInspectorProvider } from "@/app/common/ui/skills/details/skill-hover-card";
import DuplicateSkillBadge from "@/app/common/ui/skills/provenance/duplicate-skill-badge";
import { TrackSkillSidebar } from "@/features/visualizer/components/track-skill-sidebar";
import { RaceImpactProfilePanel } from "@/app/common/ui/skills/effect-details/race-impact-profile-panel";
import { defaultRaceImpactProfile, saveRaceImpactProfile, type RaceImpactProfile } from "@/lib/race-impact";
import { loadRacetracks } from "@/lib/data/registry";
import { flattenCourse } from "@/lib/api/course-format";

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
  const descEn = id === 980006 ? `Long inspection data ${"tactical verdict mechanics ".repeat(80)}` : "Inspection data";
  return { id, nameEn: `Loaded skill ${id}`, nameJp: "テストスキル", descEn, rarity: 1, conditionGroups: [] };
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

  test("rapidly hovering different skills reuses the same preview popover", async () => {
    finePointer();
    const request = replaceSkillRequest(async (id) => detail(id));
    try {
      render(
        <Inspector>
          <SkillHoverCard skillId={980005} fallbackSkill={{ nameEn: "First rapid skill" }}>First</SkillHoverCard>
          <SkillHoverCard skillId={980006} fallbackSkill={{ nameEn: "Second rapid skill" }}>Second</SkillHoverCard>
        </Inspector>,
      );
      const first = screen.getByRole("button", { name: "Inspect First rapid skill" });
      const second = screen.getByRole("button", { name: "Inspect Second rapid skill" });

      fireEvent.pointerEnter(first, { pointerType: "mouse" });
      await screen.findByText("Loaded skill 980005");
      const preview = document.querySelector('[aria-label="Skill details"]');
      expect(preview).toBeTruthy();
      await waitFor(() => expect(preview?.getAttribute("data-inspector-placement")).toBe("right"));
      expect(preview?.className).toContain("[overflow-anchor:none]");

      fireEvent.pointerLeave(first, { pointerType: "mouse" });
      fireEvent.pointerEnter(second, { pointerType: "mouse" });
      await screen.findByText("Loaded skill 980006");
      expect(screen.getByText("Tactical Verdict & Mechanics")).toBeTruthy();
      expect(screen.getByText(/Long inspection data tactical verdict mechanics/)).toBeTruthy();
      expect(document.querySelector('[aria-label="Skill details"]')).toBe(preview);
    } finally { request.mockRestore(); }
  });

  test("coalesces ResizeObserver bursts into one animation-frame position update", async () => {
    const originalResizeObserver = window.ResizeObserver;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    const observers: Array<{ fire: () => void }> = [];
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        observers.push({ fire: () => callback([], this as unknown as ResizeObserver) });
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", { configurable: true, value: MockResizeObserver });
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const id = ++frameId;
      frames.set(id, callback);
      return id;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) => { frames.delete(id); }) as typeof window.cancelAnimationFrame;

    const request = replaceSkillRequest(async () => detail(980007));
    try {
      const user = userEvent.setup();
      render(<Inspector><SkillHoverCard skillId={980007} fallbackSkill={{ nameEn: "Measured skill" }}>Measured</SkillHoverCard></Inspector>);
      const trigger = screen.getByRole("button", { name: "Inspect Measured skill" });
      act(() => trigger.focus());
      await user.keyboard("{Enter}");
      await screen.findByText("Loaded skill 980007");
      const popover = document.querySelector<HTMLElement>('[aria-label="Skill details"]');
      expect(popover).toBeTruthy();

      act(() => {
        const initialFrames = [...frames.values()];
        frames.clear();
        initialFrames.forEach((callback) => callback(performance.now()));
      });
      frames.clear();
      for (let i = 0; i < 12; i++) observers.forEach((observer) => observer.fire());
      expect(frames.size).toBe(1);
      act(() => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(performance.now()));
      });
      expect(popover?.style.transform).toMatch(/^translate3d\(/);
    } finally {
      request.mockRestore();
      window.ResizeObserver = originalResizeObserver;
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
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

async function kyotoCourse() {
  for (const t of await loadRacetracks()) { const r = t.courses.find((c) => c.id === 10808); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error("Kyoto 10808 missing");
}
const OVERTAKE_ID = 980010;
function overtakeSkill(): SkillDetail {
  return { id: OVERTAKE_ID, nameEn: "Overtake skill", nameJp: "テスト", descEn: "x", rarity: 1, conditionGroups: [{ condition: "is_overtake==1&phase>=2", precondition: null, base_time: 30000, effects: [{ type: 27, value: 3500 }] }] } as SkillDetail;
}

describe("skill inspector race impact", () => {
  afterEach(() => { saveRaceImpactProfile(defaultRaceImpactProfile()); });

  test("M2: with no override the Activation factor reads 'Assumed', matching the modal (R32)", async () => {
    finePointer();
    saveRaceImpactProfile(defaultRaceImpactProfile());
    const request = replaceSkillRequest(async () => overtakeSkill());
    try {
      const user = userEvent.setup();
      const course = await kyotoCourse();
      render(<SkillInspectorProvider course={course} racerCount={9} runningStyle={2} activePvpEvent={null} raceParams={{ groundCondition: 1 }}><SkillHoverCard skillId={OVERTAKE_ID} fallbackSkill={{ nameEn: "Overtake skill" }}>Overtake skill</SkillHoverCard></SkillInspectorProvider>);
      await user.click(screen.getByRole("button", { name: "Inspect Overtake skill" }));
      await screen.findByText("Race impact");
      const row = screen.getByText("Activation", { selector: "span" }).parentElement!;
      expect(row.textContent).toContain("Assumed");
      expect(row.textContent).not.toContain("100%");
    } finally { request.mockRestore(); }
  });

  test("M3: the inspector scores with the user's race-impact profile (same as Visualizer and modal)", async () => {
    finePointer();
    saveRaceImpactProfile({ ...defaultRaceImpactProfile(), dynamicOverrides: { overtake: 0.3 } });
    const request = replaceSkillRequest(async () => overtakeSkill());
    try {
      const user = userEvent.setup();
      const course = await kyotoCourse();
      render(<SkillInspectorProvider course={course} racerCount={9} runningStyle={2} activePvpEvent={null} raceParams={{ groundCondition: 1 }}><SkillHoverCard skillId={OVERTAKE_ID} fallbackSkill={{ nameEn: "Overtake skill" }}>Overtake skill</SkillHoverCard></SkillInspectorProvider>);
      await user.click(screen.getByRole("button", { name: "Inspect Overtake skill" }));
      await screen.findByText("Race impact");
      const row = screen.getByText("Activation", { selector: "span" }).parentElement!;
      expect(row.textContent).toContain("30%");
      expect(screen.getByText(/situational override 30%/)).toBeTruthy();
    } finally { request.mockRestore(); }
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
