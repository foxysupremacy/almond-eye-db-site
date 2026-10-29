import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaminaView } from "@/features/stamina/stamina-view";
import { useStaminaSim, type StaminaRunner } from "@/features/stamina/view-models/use-stamina-sim";
import { STAMINA_PREFS_KEY } from "@/features/stamina/model/stamina-prefs";
import type { StaminaInput, StaminaResult } from "@/lib/stamina-sim";
import { kyoto2200 } from "@/lib/stamina-sim/test-fixtures";

afterEach(() => { cleanup(); localStorage.clear(); });

const fixed: StaminaResult = { runs: 1000, goalReachPct: 97.46, maxSpurtPct: 81.25, avgSurplusHp: 311.6, staminaKeepPct: 12.04 };
const syncRunner: StaminaRunner = () => fixed;

describe("StaminaView", () => {
  test("no course → the same prompt as Rankings", () => {
    render(<StaminaView course={null} loading={false} raceGround={null} runner={syncRunner} />);
    expect(screen.getByText("Pick a race in the header to calculate stamina.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Calculate" })).toBeNull();
  });

  test("renders every input group, no auto-focus, idle results", () => {
    render(<StaminaView course={kyoto2200} loading={false} raceGround={null} runner={syncRunner} />);
    for (const name of ["Speed", "Stamina", "Power", "Guts", "Wit"]) {
      expect((screen.getByRole("spinbutton", { name }) as HTMLInputElement).value).toMatch(/^\d+$/);
    }
    const increases = (region: string) => within(screen.getByRole("region", { name: region })).getAllByRole("button", { name: /^Increase / });
    expect(increases("Green skills")).toHaveLength(4);
    expect(increases("Recovery skills")).toHaveLength(7);
    expect(increases("HP-loss skills")).toHaveLength(6);
    for (const name of ["Dueling 追い比べ", "Spot Struggle 位置取り争い", "Kakari 掛かり"]) {
      expect(screen.getByRole("checkbox", { name })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: /Ground/ }).textContent).toContain("Good (良)");
    expect(document.activeElement === document.body || document.activeElement == null).toBe(true);
    // Idle: labels only, no numbers before the first Calculate.
    expect(screen.queryByText(/HP surplus/)).toBeNull();
    expect(screen.getByText(/Press Calculate/)).toBeTruthy();
    const note = screen.getByRole("note");
    for (const word of ["Zenkai", "Stamina Keep", "Spot Struggle", "Dueling", "Champions Meeting"]) expect(note.textContent).toContain(word);
  });

  test("green counters show a short bonus with the stat underneath, so nothing truncates", () => {
    render(<StaminaView course={kyoto2200} loading={false} raceGround={null} runner={syncRunner} />);
    const greens = screen.getByRole("region", { name: "Green skills" });
    for (const [stat, bonus] of [["Speed", 60], ["Speed", 40], ["Stamina", 60], ["Stamina", 40]] as const) {
      const group = within(greens).getByRole("group", { name: `${stat} +${bonus}` });
      const [label, sublabel] = Array.from(group.querySelectorAll("p")).map((p) => p.textContent);
      expect(label).toBe(`+${bonus}`);
      expect(sublabel).toBe(stat);
    }
  });

  test("ground is pre-filled from the race when the preset sets it", () => {
    render(<StaminaView course={kyoto2200} loading={false} raceGround={3} runner={syncRunner} />);
    expect(screen.getByRole("button", { name: /Ground/ }).textContent).toContain("Heavy (重)");
  });

  test("Calculate shows the three results", async () => {
    const user = userEvent.setup();
    const seen: StaminaInput[] = [];
    render(<StaminaView course={kyoto2200} loading={false} raceGround={null} runner={(input) => { seen.push(input); return fixed; }} />);
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    const results = await screen.findByRole("list", { name: "Results" });
    const goal = within(results).getByRole("listitem", { name: /Goal reach/ });
    expect(goal.textContent).toContain("97.5%");
    const spurt = within(results).getByRole("listitem", { name: /Max spurt/ });
    expect(spurt.textContent).toContain("81.3%");
    expect(spurt.textContent).toContain("≈ 312 HP surplus");
    expect(within(results).getByRole("listitem", { name: /Stamina Keep/ }).textContent).toContain("12.0%");
    expect(seen).toHaveLength(1);
    expect(seen[0].groundCondition).toBe(1);
  });

  test("Goal reach caption explains the reduced-spurt dry-run", async () => {
    const user = userEvent.setup();
    render(<StaminaView course={kyoto2200} loading={false} raceGround={null} runner={syncRunner} />);
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    const results = await screen.findByRole("list", { name: "Results" });
    expect(within(results).getByRole("listitem", { name: /Goal reach/ }).textContent).toContain("A reduced spurt is planned to spend all HP, so it often runs dry just before the line.");
  });

  test("no surplus line when Max spurt is 0%", async () => {
    const user = userEvent.setup();
    render(<StaminaView course={kyoto2200} loading={false} raceGround={null} runner={() => ({ ...fixed, maxSpurtPct: 0, avgSurplusHp: 0 })} />);
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    const results = await screen.findByRole("list", { name: "Results" });
    const spurt = within(results).getByRole("listitem", { name: /Max spurt/ });
    expect(spurt.textContent).not.toContain("HP surplus");
    expect(spurt.textContent).toContain("—");
  });

  test("Reset inputs keeps the race-provided ground", async () => {
    const user = userEvent.setup();
    render(<StaminaView course={kyoto2200} loading={false} raceGround={3} runner={syncRunner} />);
    await user.click(screen.getByRole("button", { name: "Reset inputs" }));
    expect(screen.getByRole("button", { name: /Ground/ }).textContent).toContain("Heavy (重)");
  });

  test("results go stale (dimmed + note) when inputs change, until Calculate", async () => {
    const user = userEvent.setup();
    render(<StaminaView course={kyoto2200} loading={false} raceGround={null} runner={syncRunner} />);
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    const results = await screen.findByRole("list", { name: "Results" });
    expect(results.getAttribute("data-stale")).toBeNull();
    expect(screen.queryByText("Inputs changed — press Calculate")).toBeNull();
    const region = screen.getByRole("region", { name: "Recovery skills" });
    await user.click(within(region).getByRole("button", { name: "Increase 9.5% recovery" }));
    expect(screen.getByText("Inputs changed — press Calculate")).toBeTruthy();
    expect(results.getAttribute("data-stale")).toBe("true");
    expect(results.className).toContain("opacity-");
    // Changing back to the computed input clears it again.
    await user.click(within(region).getByRole("button", { name: "Decrease 9.5% recovery" }));
    expect(screen.queryByText("Inputs changed — press Calculate")).toBeNull();
    await user.click(within(region).getByRole("button", { name: "Increase 9.5% recovery" }));
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.queryByText("Inputs changed — press Calculate")).toBeNull());
    expect(screen.getByRole("list", { name: "Results" }).getAttribute("data-stale")).toBeNull();
  });

  test("counters clamp at 0..20 and inputs persist", async () => {
    const user = userEvent.setup();
    render(<StaminaView course={kyoto2200} loading={false} raceGround={null} runner={syncRunner} />);
    const region = screen.getByRole("region", { name: "Recovery skills" });
    const dec = within(region).getByRole("button", { name: "Decrease 9.5% recovery" }) as HTMLButtonElement;
    expect(dec.disabled).toBe(true);
    await user.click(within(region).getByRole("button", { name: "Increase 9.5% recovery" }));
    expect(within(region).getByText("1", { selector: "output" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STAMINA_PREFS_KEY) ?? "{}").recovery[0]).toBe(1);
    await user.click(screen.getByRole("checkbox", { name: "Kakari 掛かり" }));
    expect(JSON.parse(localStorage.getItem(STAMINA_PREFS_KEY) ?? "{}").toggles.kakari).toBe(true);
  });

  test("stat inputs clamp to 1..2500 on blur", async () => {
    const user = userEvent.setup();
    render(<StaminaView course={kyoto2200} loading={false} raceGround={null} runner={syncRunner} />);
    const stamina = screen.getByRole("spinbutton", { name: "Stamina" }) as HTMLInputElement;
    await user.clear(stamina);
    await user.type(stamina, "9999");
    await user.tab();
    expect(stamina.value).toBe("2500");
    expect(JSON.parse(localStorage.getItem(STAMINA_PREFS_KEY) ?? "{}").stats.stamina).toBe(2500);
  });

  test("stored inputs are restored on mount", async () => {
    localStorage.setItem(STAMINA_PREFS_KEY, JSON.stringify({ stats: { speed: 1800, stamina: 777, power: 1000, guts: 500, wisdom: 900 } }));
    render(<StaminaView course={kyoto2200} loading={false} raceGround={null} runner={syncRunner} />);
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "Stamina" }) as HTMLInputElement).value).toBe("777"));
  });
});

describe("useStaminaSim", () => {
  test("a stale result never overwrites the newest run", async () => {
    const pending: ((r: StaminaResult) => void)[] = [];
    const runner: StaminaRunner = () => new Promise<StaminaResult>((resolve) => { pending.push(resolve); });
    const { result } = renderHook(() => useStaminaSim(runner));
    expect(result.current.status).toBe("idle");
    act(() => result.current.run({} as StaminaInput, kyoto2200));
    act(() => result.current.run({} as StaminaInput, kyoto2200));
    expect(result.current.status).toBe("running");
    await act(async () => pending[0]({ ...fixed, goalReachPct: 1 }));
    expect(result.current.status).toBe("running");
    await act(async () => pending[1](fixed));
    expect(result.current.status).toBe("ready");
    expect(result.current.result?.goalReachPct).toBe(97.46);
  });

  test("a throwing runner becomes an error state", async () => {
    const { result } = renderHook(() => useStaminaSim(() => { throw new Error("boom"); }));
    await act(async () => result.current.run({} as StaminaInput, kyoto2200));
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("boom");
  });
});
