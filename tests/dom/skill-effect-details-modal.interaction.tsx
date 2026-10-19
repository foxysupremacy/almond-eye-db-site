// tests/dom/skill-effect-details-modal.interaction.tsx
import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/api";
import { loadRacetracks, skillsById } from "@/lib/data/registry";
import { flattenCourse } from "@/lib/api/course-format";
import { activationLabel, ModelAssumptions, SkillEffectDetailsModal } from "@/app/common/ui/skills/effect-details";
import { defaultRaceImpactProfile } from "@/lib/race-impact";

const originalMatchMedia = window.matchMedia;
afterEach(() => { cleanup(); window.matchMedia = originalMatchMedia; });
/** Width-based stub: the modal shares useTier's phone breakpoint (<640). */
function viewport(width: number) {
  window.matchMedia = ((q: string) => {
    const min = /min-width:\s*(\d+)px/.exec(q);
    const matches = min ? width >= +min[1] : q.includes("pointer: fine");
    return { matches, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
  }) as typeof window.matchMedia;
}
async function kyoto() { for (const t of await loadRacetracks()) { const r = t.courses.find((c) => c.id === 10808); if (r) return { ...flattenCourse(r), trackId: t.id }; } throw new Error(); }

// No real skill throws in the zone engine any more; this stub's condition name is unknown to it, which throws.
const THROWING_ID = 999_991;
const throwingSkill = { ...skillsById.get(110991)!, id: THROWING_ID, nameEn: "Broken", conditionGroups: [{ condition: "not_a_real_condition==1", precondition: null, base_time: 30000, effects: [{ type: 27, value: 3500 }] }] };
const skillOrStub = (id: number) => (id === THROWING_ID ? throwingSkill : skillsById.get(id)!);

describe("SkillEffectDetailsModal", () => {
  test("desktop: rail switching, active group, level delta, Escape closes", async () => {
    viewport(1440);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      const user = userEvent.setup();
      let closed = false;
      render(<SkillEffectDetailsModal open onClose={() => { closed = true; }} course={await kyoto()} raceParams={{ groundCondition: 1 }} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171}
        rail={{ portraitUrl: "", characterName: "Symboli Rudolf", totals: { unique: 4.5, slot1: 1.1, slot2: 2, total: 7.6 }, slots: [
          { label: "Unique", options: [{ skillId: 120171, nameEn: "Cascading Might", nameJp: "Cascading Might", iconId: null, bashin: 4.5, best: true }] },
          { label: "Evolution 1", options: [{ skillId: 101703111, nameEn: "大望は煌めきとなりて", nameJp: "大望は煌めきとなりて", iconId: null, bashin: 1.1, best: true }] },
          { label: "Evolution 2", options: [] },
        ] }} />);
      await waitFor(() => expect(screen.getByText("Applies on Kyoto")).toBeTruthy());
      // PositionDots (Task 13) exposes the position label as the list's accessible name, not as text.
      // Both of Cascading Might's groups carry the same position rule, so more than one list matches.
      expect(screen.getAllByRole("list", { name: /CM condition: 1st–6th/ }).length).toBeGreaterThan(0);
      await user.click(screen.getByRole("button", { name: "Increase unique level" }));
      await waitFor(() => expect(screen.getByRole("status", { name: /level delta/i }).textContent).toMatch(/Bashin vs Lv1/));
      await user.click(screen.getByRole("button", { name: /大望は煌めきとなりて/ }));
      await waitFor(() => expect(screen.queryByRole("button", { name: "Increase unique level" })).toBeNull()); // non-unique hides stepper
      await user.keyboard("{Escape}");
      expect(closed).toBe(true);
    } finally { api.skill = original; }
  });

  test("Summary: an evolution reads 'Assumed to activate' (R32: no wisdom roll), not 93%", async () => {
    viewport(1440);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{ groundCondition: 1 }} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={101703111} />);
      const summary = await screen.findByRole("region", { name: "Summary" });
      await waitFor(() => expect(within(summary).getByText("Activation")).toBeTruthy());
      expect(within(summary).getByText("Assumed to activate")).toBeTruthy();
      expect(within(summary).queryByText(/9\d%/)).toBeNull();
    } finally { api.skill = original; }
  });

  test("activationLabel: only a set override that lowers the rate is blamed on the user", () => {
    expect(activationLabel({ activationRate: 0.3, banned: false, groupIndex: 0 }, { overtake: 0.3 })).toBe("30% (your situational override)");
    expect(activationLabel({ activationRate: 1, banned: false, groupIndex: 0 }, { overtake: 1 })).toBe("Assumed to activate");
    expect(activationLabel({ activationRate: 1, banned: false, groupIndex: 0 }, {})).toBe("Assumed to activate");
    expect(activationLabel({ activationRate: 0, banned: false, groupIndex: null }, { overtake: 0.3 })).toBe("Cannot activate on this map / style");
    expect(activationLabel({ activationRate: 0, banned: true, groupIndex: null }, {})).toBe("Banned in this event");
  });

  test("Summary: a style-locked skill in the wrong style reads 'Cannot activate on this map / style', not a user override", async () => {
    viewport(1440);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      // Escape Artist (200541) is Front Runner only; style 2 is Pace Chaser.
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{ groundCondition: 1 }} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={200541} />);
      const summary = await screen.findByRole("region", { name: "Summary" });
      await waitFor(() => expect(within(summary).getByText("Activation")).toBeTruthy());
      expect(within(summary).getByText("Cannot activate on this map / style")).toBeTruthy();
      expect(within(summary).queryByText(/situational override/)).toBeNull();
    } finally { api.skill = original; }
  });

  test("Summary: a skill banned under No Debuffs reads 'Banned in this event' once, not a user override", async () => {
    viewport(1440);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      // Keen Insight (200691) is on the No Debuffs ban list.
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{ groundCondition: 1, noDebuffs: true }} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={200691} />);
      const summary = await screen.findByRole("region", { name: "Summary" });
      await waitFor(() => expect(within(summary).getByText("Activation")).toBeTruthy());
      expect(within(summary).getAllByText("Banned in this event")).toHaveLength(1);
      expect(within(summary).queryByText(/situational override/)).toBeNull();
    } finally { api.skill = original; }
  });

  test("the shared Assumptions copy states the R32 principle: situational conditions met, no wisdom or lottery roll, map facts real", () => {
    render(<ModelAssumptions profile={defaultRaceImpactProfile()} racerCount={9} />);
    expect(screen.getByText("Scores assume the skill activates: situational conditions (position, overtakes, counts, prerequisite skills, popularity) are treated as met.")).toBeTruthy();
    expect(screen.getByText("No wisdom or lottery roll.")).toBeTruthy();
    expect(screen.getByText("Course geometry, distance, surface and running style still decide where and whether a skill can fire.")).toBeTruthy();
    expect(screen.getByText("Race-state skills (overtaking, blocked, Umas nearby) fire where a race-state timing model, fitted to umasim results, first allows; other situational skills are sampled across their zone.")).toBeTruthy();
    expect(screen.getByText("Passive stat skills re-run the race with the stat added to the final stat (not halved past 1200).")).toBeTruthy();
    // Obsolete under R32.
    expect(screen.queryByText("Popularity: assumed favourite (3rd or better).")).toBeNull();
    expect(screen.queryByText(/innate skills/)).toBeNull();
    expect(screen.queryByText(/Count conditions/)).toBeNull();
    expect(screen.queryByText(/must pass a wisdom check/)).toBeNull();
  });

  test("the shared Assumptions copy states the in-game stat adjustment, mood/aptitude and physics rules", () => {
    render(<ModelAssumptions profile={defaultRaceImpactProfile()} racerCount={9} />);
    expect(screen.getByText("Stats are adjusted as in-game: above 1200 counts half, course stat bonus, ground and mood modifiers.")).toBeTruthy();
    expect(screen.getByText("Normal / A")).toBeTruthy();
    expect(screen.getByText("Slopes: uphill lowers target speed (slope x 200 / Power) and acceleration; downhill accel mode is counted at its expected bonus.")).toBeTruthy();
    expect(screen.getByText("Section randomness: counted at its mean (wisdom-based), outside the last spurt.")).toBeTruthy();
    expect(screen.getByText("HP: assumed sufficient to finish at full spurt speed.")).toBeTruthy();
    expect(screen.getByText("Situational scaling uses its strongest version: most passes, longest blocked time, far from the lead, maximum lead, team and career bonuses. HP-based durations use the HP left at activation. Green-skill scaling assumes 6 green skills (typical after scrims).")).toBeTruthy();
    expect(screen.queryByText(/isolated-horse/)).toBeNull();
    expect(screen.getByText("Corner lane loss: counted on a modelled expected lane (mechanics doc lane rules, fitted to umasim results), with minimum speed after the start dash and the start run-up.")).toBeTruthy();
    expect(screen.getByText("Not modeled: blocking, position keeping, skill interactions")).toBeTruthy();
    expect(screen.getByText("Additional activation: counted from activation at its maximum, 3 passes or 3 other skills (2 for the up-to-twice type).")).toBeTruthy();
    expect(screen.getByText("Cooldown: each skill fires at most once per race.")).toBeTruthy();
  });

  test("rail and Overall performance include Evolution 3 when the costume has it", async () => {
    viewport(1440);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{ groundCondition: 1 }} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171}
        rail={{ portraitUrl: "", characterName: "Mejiro McQueen", totals: { unique: 4.5, slot1: 1.1, slot2: 2, slot3: 0.75, total: 8.35 }, slots: [
          { label: "Unique", options: [{ skillId: 120171, nameEn: "Cascading Might", nameJp: "Cascading Might", iconId: null, bashin: 4.5, best: true }] },
          { label: "Evolution 1", options: [] },
          { label: "Evolution 2", options: [] },
          { label: "Evolution 3", options: [{ skillId: 101301311, nameEn: "Thespian Ascent", nameJp: "名優、昇るは天の果て", iconId: null, bashin: 0.75, best: true }] },
        ] }} />);
      const rail = await screen.findByRole("complementary", { name: "Skill choices" });
      const slot3 = within(rail).getByRole("region", { name: "Evolution 3" });
      expect(within(slot3).getByRole("button", { name: /Thespian Ascent/ })).toBeTruthy();
      const overall = await screen.findByRole("region", { name: "Overall performance" });
      expect(within(overall).getByText("Evolution 3")).toBeTruthy();
      expect(within(overall).getByText("+0.75 Bashin")).toBeTruthy();
    } finally { api.skill = original; }
  });

  test("Overall performance has no Evolution 3 row without a slot 3", async () => {
    viewport(1440);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{ groundCondition: 1 }} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171}
        rail={{ portraitUrl: "", characterName: "Symboli Rudolf", totals: { unique: 4.5, slot1: 1.1, slot2: 0, total: 5.6 }, slots: [
          { label: "Unique", options: [{ skillId: 120171, nameEn: "Cascading Might", nameJp: "Cascading Might", iconId: null, bashin: 4.5, best: true }] },
          { label: "Evolution 1", options: [] },
          { label: "Evolution 2", options: [] },
        ] }} />);
      const overall = await screen.findByRole("region", { name: "Overall performance" });
      expect(within(overall).queryByText("Evolution 3")).toBeNull();
    } finally { api.skill = original; }
  });

  test("phone: full-height sheet, chip row toggles focus, Escape closes", async () => {
    viewport(390);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      const user = userEvent.setup();
      let closed = false;
      render(<SkillEffectDetailsModal open onClose={() => { closed = true; }} course={await kyoto()} raceParams={{}} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171}
        rail={{ portraitUrl: "", characterName: "Symboli Rudolf", totals: { unique: 4.5, slot1: 1.1, slot2: 0, total: 5.6 }, slots: [
          { label: "Unique", options: [{ skillId: 120171, nameEn: "Cascading Might", nameJp: "Cascading Might", iconId: null, bashin: 4.5, best: true }] },
          { label: "Evolution 1", options: [{ skillId: 101703111, nameEn: "大望は煌めきとなりて", nameJp: "大望は煌めきとなりて", iconId: null, bashin: 1.1, best: true }] },
        ] }} />);
      await waitFor(() => expect(screen.getByRole("list", { name: "Skill options" })).toBeTruthy());
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("h-dvh");
      expect(/rounded-t-|h-\[88dvh\]/.test(dialog.className)).toBe(false);
      // phone-full is edge to edge: no base `border` competing with `border-0`.
      const classes = dialog.className.split(/\s+/);
      expect(classes).not.toContain("border");
      expect(classes).not.toContain("border-0");
      const chip = screen.getByRole("button", { name: "大望は煌めきとなりて" });
      expect(chip.getAttribute("aria-pressed")).toBe("false");
      await user.click(chip);
      expect(chip.getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: "Cascading Might" }).getAttribute("aria-pressed")).toBe("false");
      await user.keyboard("{Escape}");
      expect(closed).toBe(true);
    } finally { api.skill = original; }
  });

  for (const [label, width] of [["desktop", 1440], ["phone", 390]] as const) {
    test(`${label}: header reads "Skill effect · venue"; the skill name is shown once, in the skill section (R18)`, async () => {
      viewport(width);
      const original = api.skill;
      api.skill = async (id: number) => skillsById.get(id)! as never;
      try {
        const skill = skillsById.get(120171)!;
        const name = skill.nameEn || skill.nameJp!;
        render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{}} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171} />);
        await waitFor(() => expect(screen.getByText("Applies on Kyoto")).toBeTruthy());
        const dialog = screen.getByRole("dialog", { name: `${name} skill effect` });
        expect(within(dialog).getByRole("heading", { name: "Skill effect · Kyoto" })).toBeTruthy();
        expect(within(dialog).queryByRole("heading", { name })).toBeNull();
        expect(within(dialog).getAllByText(name)).toHaveLength(1);
        const section = within(dialog).getByRole("region", { name: "Skill" });
        expect(within(section).getByText(name).className).toContain("font-semibold");
      } finally { api.skill = original; }
    });
  }

  test("tablet width (700px) uses the dialog layout, not the phone sheet (one phone breakpoint)", async () => {
    viewport(700);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{}} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171} />);
      const dialog = await screen.findByRole("dialog");
      expect(dialog.className).not.toContain("h-dvh");
      expect(dialog.className).toContain("max-w-3xl");
    } finally { api.skill = original; }
  });

  test("a skill whose conditions throw in the zone engine shows the error block instead of crashing", async () => {
    viewport(1440);
    const original = api.skill;
    api.skill = async (id: number) => skillOrStub(id) as never;
    try {
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{}} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={THROWING_ID} />);
      await waitFor(() => expect(screen.getByText("This skill's conditions can't be evaluated yet.")).toBeTruthy());
      expect(screen.getByRole("alert")).toBeTruthy();
      // A deterministic throw cannot be retried away.
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    } finally { api.skill = original; }
  });

  test("rail switch keeps the previous skill's content while the next one loads (no skeleton flash)", async () => {
    viewport(1440);
    const original = api.skill;
    let release: (() => void) | null = null;
    api.skill = async (id: number) => {
      if (id === 101703111) await new Promise<void>((r) => { release = r; });
      return skillsById.get(id)! as never;
    };
    try {
      const user = userEvent.setup();
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{}} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171}
        rail={{ portraitUrl: "", characterName: "Symboli Rudolf", totals: { unique: 4.5, slot1: 1.1, slot2: 0, total: 5.6 }, slots: [
          { label: "Unique", options: [{ skillId: 120171, nameEn: "Cascading Might", nameJp: "Cascading Might", iconId: null, bashin: 4.5, best: true }] },
          { label: "Evolution 1", options: [{ skillId: 101703111, nameEn: "大望は煌めきとなりて", nameJp: "大望は煌めきとなりて", iconId: null, bashin: 1.1, best: true }] },
        ] }} />);
      await waitFor(() => expect(screen.getByText("Applies on Kyoto")).toBeTruthy());
      await user.click(screen.getByRole("button", { name: "大望は煌めきとなりて" }));
      await waitFor(() => expect(release).not.toBeNull()); // the next skill is in flight
      expect(document.querySelector('[aria-label="Loading skill effect"]')).toBeNull();
      expect(screen.getByText("Applies on Kyoto")).toBeTruthy();
      // The kept content is marked busy and dimmed while the next skill loads.
      const content = screen.getByRole("complementary", { name: "Skill choices" }).nextElementSibling as HTMLElement;
      expect(content.getAttribute("aria-busy")).toBe("true");
      expect(content.className).toContain("opacity-60");
      expect(content.className).toContain("motion-reduce:transition-none");
      await act(async () => { (release as unknown as () => void)(); await new Promise((r) => setTimeout(r, 0)); });
      expect(document.querySelector('[aria-label="Increase unique level"]')).toBeNull();
      expect(content.getAttribute("aria-busy")).toBe("false");
      expect(content.className).not.toContain("opacity-60");
    } finally { (release as (() => void) | null)?.(); api.skill = original; }
  });

  test("switching away from a skill with an evaluate error shows the skeleton, not the stale error", async () => {
    viewport(1440);
    const original = api.skill;
    let release: (() => void) | null = null;
    api.skill = async (id: number) => {
      if (id === 120171) await new Promise<void>((r) => { release = r; });
      return skillOrStub(id) as never;
    };
    try {
      const user = userEvent.setup();
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{}} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={THROWING_ID}
        rail={{ portraitUrl: "", characterName: "Test", totals: { unique: 0, slot1: 0, slot2: 0, total: 0 }, slots: [
          { label: "Unique", options: [{ skillId: THROWING_ID, nameEn: "Broken", nameJp: "Broken", iconId: null, bashin: 0, best: true }] },
          { label: "Evolution 1", options: [{ skillId: 120171, nameEn: "Cascading Might", nameJp: "Cascading Might", iconId: null, bashin: 4.5, best: true }] },
        ] }} />);
      await waitFor(() => expect(screen.getByText("This skill's conditions can't be evaluated yet.")).toBeTruthy());
      await user.click(screen.getByRole("button", { name: "Cascading Might" }));
      await waitFor(() => expect(release).not.toBeNull());
      expect(screen.queryByText("This skill's conditions can't be evaluated yet.")).toBeNull();
      expect(document.querySelector('[aria-label="Loading skill effect"]')).toBeTruthy();
    } finally { (release as (() => void) | null)?.(); api.skill = original; }
  });

  test("tablet width (700px) with a rail: grid body and a scrollable content column", async () => {
    viewport(700);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      render(<SkillEffectDetailsModal open onClose={() => {}} course={await kyoto()} raceParams={{}} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171}
        rail={{ portraitUrl: "", characterName: "Symboli Rudolf", totals: { unique: 4.5, slot1: 0, slot2: 0, total: 4.5 }, slots: [
          { label: "Unique", options: [{ skillId: 120171, nameEn: "Cascading Might", nameJp: "Cascading Might", iconId: null, bashin: 4.5, best: true }] },
        ] }} />);
      const aside = await screen.findByRole("complementary", { name: "Skill choices" });
      // The dialog branch starts at the tablet tier (>=640, Tailwind `sm:`), so its layout must too.
      const body = aside.parentElement!.className.split(/\s+/);
      expect(body).toContain("sm:grid");
      expect(body).toContain("sm:grid-cols-[200px_1fr]");
      expect(body.some((c) => c.startsWith("md:"))).toBe(false);
      const content = (aside.nextElementSibling as HTMLElement).className.split(/\s+/);
      expect(content).toContain("overflow-y-auto");
      expect(content).toContain("sm:h-full");
      expect(aside.className.split(/\s+/)).toContain("sm:border-r");
    } finally { api.skill = original; }
  });

  test("closed: does not fetch the skill", async () => {
    viewport(1440);
    const original = api.skill;
    let calls = 0;
    api.skill = async (id: number) => { calls++; return skillsById.get(id)! as never; };
    try {
      render(<SkillEffectDetailsModal open={false} onClose={() => {}} course={await kyoto()} raceParams={{}} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171} />);
      await new Promise((r) => setTimeout(r, 20));
      expect(calls).toBe(0);
    } finally { api.skill = original; }
  });

  test("reopen resets the focused skill and the level", async () => {
    viewport(1440);
    const original = api.skill;
    api.skill = async (id: number) => skillsById.get(id)! as never;
    try {
      const user = userEvent.setup();
      const course = await kyoto();
      const raceParams = {};
      const rail = { portraitUrl: "", characterName: "Symboli Rudolf", totals: { unique: 4.5, slot1: 1.1, slot2: 0, total: 5.6 }, slots: [
        { label: "Unique" as const, options: [{ skillId: 120171, nameEn: "Cascading Might", nameJp: "Cascading Might", iconId: null, bashin: 4.5, best: true, badge: "Partially modeled" as const }] },
        { label: "Evolution 1" as const, options: [{ skillId: 101703111, nameEn: "大望は煌めきとなりて", nameJp: "大望は煌めきとなりて", iconId: null, bashin: 1.1, best: true }] },
      ] };
      const ui = (open: boolean) => <SkillEffectDetailsModal open={open} onClose={() => {}} course={course} raceParams={raceParams} racerCount={9} style={2} venueLabel="Kyoto" focusSkillId={120171} rail={rail} />;
      const { rerender } = render(ui(true));
      await waitFor(() => expect(screen.getByText("Applies on Kyoto")).toBeTruthy());
      // Rail buttons keep a name-only label and describe the badge / Bashin text.
      const uniqueBtn = screen.getByRole("button", { name: "Cascading Might" });
      const describedBy = uniqueBtn.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const description = describedBy!.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
      expect(description).toMatch(/4\.50/);
      expect(description).toMatch(/Partially modeled/);

      await user.click(screen.getByRole("button", { name: "Increase unique level" }));
      await waitFor(() => expect(screen.getByRole("status", { name: /level delta/i }).textContent).toMatch(/Bashin vs Lv1/));
      await user.click(screen.getByRole("button", { name: "大望は煌めきとなりて" }));
      await waitFor(() => expect(screen.queryByRole("button", { name: "Increase unique level" })).toBeNull());

      rerender(ui(false));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      rerender(ui(true));
      await waitFor(() => expect(screen.getByRole("button", { name: "Increase unique level" })).toBeTruthy());
      expect(screen.getByRole("button", { name: "Cascading Might" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByText("Lv1")).toBeTruthy();
      expect(screen.getByRole("status", { name: /level delta/i }).textContent).toBe("");
    } finally { api.skill = original; }
  });
});
