import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useRaceImpactProfile } from "@/app/common/hooks/use-race-impact-profile";
import { loadRaceImpactProfile } from "@/lib/race-impact";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("useRaceImpactProfile", () => {
  test("an unrelated storage event keeps the same profile object", () => {
    const { result } = renderHook(() => useRaceImpactProfile());
    const first = result.current[0];
    act(() => {
      localStorage.setItem("some.other.key", "1");
      window.dispatchEvent(new StorageEvent("storage", { key: "some.other.key" }));
    });
    expect(result.current[0]).toBe(first);
  });

  test("setProfile saves, and every subscriber sees one new object", () => {
    const a = renderHook(() => useRaceImpactProfile());
    const b = renderHook(() => useRaceImpactProfile());
    const before = a.result.current[0];
    const next = { ...before, stats: { ...before.stats, speed: before.stats.speed - 100 } };
    act(() => a.result.current[1](next));
    expect(a.result.current[0]).not.toBe(before);
    expect(a.result.current[0].stats.speed).toBe(before.stats.speed - 100);
    expect(b.result.current[0]).toBe(a.result.current[0]);
    expect(loadRaceImpactProfile().stats.speed).toBe(before.stats.speed - 100);
  });

  test("an edit renders the consumer once per change, not twice", () => {
    let renders = 0;
    const { result } = renderHook(() => { renders++; return useRaceImpactProfile(); });
    const base = renders;
    const p = result.current[0];
    act(() => result.current[1]({ ...p, stats: { ...p.stats, power: p.stats.power - 50 } }));
    expect(renders - base).toBe(1);
  });
});
