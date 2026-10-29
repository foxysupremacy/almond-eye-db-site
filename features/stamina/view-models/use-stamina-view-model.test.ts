import { afterAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { StaminaResult } from "@/lib/stamina-sim";
import { kyoto2200 } from "@/lib/stamina-sim/test-fixtures";
import { STAMINA_PREFS_KEY } from "../model/stamina-prefs";
import type { StaminaTrack } from "./use-stamina-view-model";

// renderHook needs a DOM; register one only for this file so plain `bun test` stays DOM-free elsewhere.
GlobalRegistrator.register({ url: "http://localhost/" });
const hook = await import("@testing-library/react");
const { useStaminaCalculator: calc } = await import("./use-stamina-view-model");
afterAll(async () => {
  hook.cleanup();
  await GlobalRegistrator.unregister();
});

const fixed: StaminaResult = { runs: 1000, goalReachPct: 97.46, maxSpurtPct: 81.25, avgSurplusHp: 311.6, staminaKeepPct: 12.04 };
const runner = () => fixed;
const track = (over: Partial<StaminaTrack> = {}): StaminaTrack => ({ course: kyoto2200, loading: false, raceGround: null, ...over });
const setup = (t: StaminaTrack, r = runner) => hook.renderHook(({ t }) => calc(t, r), { initialProps: { t } });

describe("useStaminaCalculator", () => {
  test("update merges a patch and persists it", () => {
    localStorage.clear();
    const { result } = setup(track());
    hook.act(() => result.current.commands.update({ style: 4 }));
    expect(result.current.state.input.style).toBe(4);
    expect(JSON.parse(localStorage.getItem(STAMINA_PREFS_KEY) ?? "{}").style).toBe(4);
    hook.act(() => result.current.commands.setCount("recovery", 1, 3));
    expect(result.current.state.input.recovery[1]).toBe(3);
  });

  test("calculate runs the injected runner and exposes the result", async () => {
    const { result } = setup(track());
    expect(result.current.state.status).toBe("idle");
    await hook.act(async () => result.current.commands.calculate());
    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.result).toEqual(fixed);
    expect(result.current.state.stale).toBe(false);
  });

  test("changing an input after Calculate marks the result stale", async () => {
    const { result } = setup(track());
    await hook.act(async () => result.current.commands.calculate());
    hook.act(() => result.current.commands.update({ motivation: "bad" }));
    expect(result.current.state.stale).toBe(true);
    await hook.act(async () => result.current.commands.calculate());
    expect(result.current.state.stale).toBe(false);
  });

  test("resetInputs restores defaults but keeps the race-provided ground", () => {
    const { result } = setup(track({ raceGround: 3 }));
    expect(result.current.state.input.groundCondition).toBe(3);
    hook.act(() => result.current.commands.update({ style: 4 }));
    hook.act(() => result.current.commands.resetInputs());
    expect(result.current.state.input.style).toBe(2);
    expect(result.current.state.input.groundCondition).toBe(3);
  });

  test("a course change clears the result", async () => {
    const { result, rerender } = setup(track());
    await hook.act(async () => result.current.commands.calculate());
    expect(result.current.state.status).toBe("ready");
    hook.act(() => rerender({ t: track({ course: { ...kyoto2200, id: kyoto2200.id + 1 } }) }));
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.result).toBeNull();
  });

  test("calculate is a no-op without a course", () => {
    const { result } = setup(track({ course: null }));
    hook.act(() => result.current.commands.calculate());
    expect(result.current.state.status).toBe("idle");
  });
});
