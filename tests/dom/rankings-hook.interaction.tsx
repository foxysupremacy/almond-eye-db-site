import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { __clearRankingsCache, useRankings, type RankingsRunner } from "@/features/rankings/hooks/use-rankings";
import { defaultRaceImpactProfile } from "@/lib/race-impact";
import type { RankingResult } from "@/lib/rankings";

afterEach(() => { cleanup(); __clearRankingsCache(); });
const course = (id: number) => ({ id, length: 2200, terrain: 1, turn: 1, distance: 3, inout: 1, corners: [], straights: [], slopes: [] });
const ctx = (id: number) => ({ course: course(id), raceParams: {}, racerCount: 9, profile: defaultRaceImpactProfile() });

function controllableRunner() {
  const jobs: { key: string; resolve: (r: RankingResult) => void; progress: (d: number, t: number) => void; cancelled: boolean }[] = [];
  const runner: RankingsRunner = (req, onProgress) => {
    const job = { key: req.key, resolve: (_: RankingResult) => {}, progress: onProgress, cancelled: false };
    const promise = new Promise<RankingResult>((res) => { job.resolve = res; });
    jobs.push(job);
    return { promise, cancel: () => { job.cancelled = true; } };
  };
  return { runner, jobs };
}

describe("useRankings", () => {
  test("reports progress then ready", async () => {
    const { runner, jobs } = controllableRunner();
    const { result } = renderHook(() => useRankings(ctx(10808), runner));
    expect(result.current.status).toBe("calculating");
    act(() => jobs[0].progress(20, 268));
    expect(result.current.progress).toEqual({ done: 20, total: 268 });
    await act(async () => jobs[0].resolve({ key: jobs[0].key, rows: [], computedMs: 1, errors: [] }));
    expect(result.current.status).toBe("ready");
  });

  test("a stale result never overwrites a newer course, and the old job is cancelled", async () => {
    const { runner, jobs } = controllableRunner();
    const { result, rerender } = renderHook(({ id }) => useRankings(ctx(id), runner), { initialProps: { id: 10808 } });
    rerender({ id: 10810 });
    expect(jobs[0].cancelled).toBe(true);
    await act(async () => jobs[0].resolve({ key: jobs[0].key, rows: [{ costumeId: 1 } as never], computedMs: 1, errors: [] }));
    expect(result.current.result).toBeNull();
    await act(async () => jobs[1].resolve({ key: jobs[1].key, rows: [], computedMs: 1, errors: [] }));
    expect(result.current.result?.key).toBe(jobs[1].key);
  });

  test("cache hit returns instantly without a new job", async () => {
    const { runner, jobs } = controllableRunner();
    const { result, rerender } = renderHook(({ id }) => useRankings(ctx(id), runner), { initialProps: { id: 10808 } });
    await act(async () => jobs[0].resolve({ key: jobs[0].key, rows: [], computedMs: 1, errors: [] }));
    rerender({ id: 10810 });
    await act(async () => jobs[1].resolve({ key: jobs[1].key, rows: [], computedMs: 1, errors: [] }));
    rerender({ id: 10808 });
    expect(jobs).toHaveLength(2);
    expect(result.current.status).toBe("ready");
    expect(result.current.result?.key).toBe(jobs[0].key);
  });

  test("a runner that throws synchronously becomes an error state, and Retry recovers", async () => {
    let throwing = true;
    const { runner: good, jobs } = controllableRunner();
    const runner: RankingsRunner = (req, onProgress) => {
      if (throwing) throw new Error("DataCloneError: could not clone");
      return good(req, onProgress);
    };
    const { result } = renderHook(() => useRankings(ctx(10808), runner));
    await act(async () => {});
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("DataCloneError: could not clone");
    throwing = false;
    act(() => result.current.retry());
    expect(result.current.status).toBe("calculating");
    await act(async () => jobs[0].resolve({ key: jobs[0].key, rows: [], computedMs: 1, errors: [] }));
    expect(result.current.status).toBe("ready");
  });

  test("errors expose retry", async () => {
    const failing: RankingsRunner = () => ({ promise: Promise.reject(new Error("boom")), cancel() {} });
    const { result } = renderHook(() => useRankings(ctx(10808), failing));
    await act(async () => {});
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("boom");
    expect(typeof result.current.retry).toBe("function");
  });
});
