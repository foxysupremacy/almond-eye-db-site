"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { rankingCacheKey, type ProgressFn, type RankingRequest, type RankingResult, type RankingsWorkerMessage } from "@/lib/rankings";
import { buildRankingRequest, type RankingsContext } from "../model/build-request";

export interface RankingsRunHandle { promise: Promise<RankingResult>; cancel(): void }
export type RankingsRunner = (req: RankingRequest, onProgress: ProgressFn) => RankingsRunHandle;
export type RankingsStatus = "idle" | "calculating" | "ready" | "error";
export interface UseRankings { status: RankingsStatus; result: RankingResult | null; progress: { done: number; total: number } | null; error: string | null; retry(): void }

export function createWorkerRunner(): RankingsRunner {
  return (req, onProgress) => {
    const worker = new Worker(new URL("../workers/rankings.worker.ts", import.meta.url), { type: "module" });
    const promise = new Promise<RankingResult>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<RankingsWorkerMessage>) => {
        const m = event.data;
        if (m.type === "progress") onProgress(m.done, m.total);
        else if (m.type === "result") { resolve(m.result); worker.terminate(); }
        else { reject(new Error(m.message)); worker.terminate(); }
      };
      worker.onerror = (e) => { reject(new Error(e.message || "Ranking worker failed")); worker.terminate(); };
      worker.onmessageerror = () => { reject(new Error("Ranking worker sent an unreadable message")); worker.terminate(); };
    });
    try {
      worker.postMessage(req);
    } catch (e) {
      worker.terminate();
      throw e;
    }
    return { promise, cancel: () => worker.terminate() };
  };
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const CACHE_LIMIT = 8;
const cache = new Map<string, RankingResult>();
function remember(result: RankingResult) {
  cache.delete(result.key);
  cache.set(result.key, result);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

export function useRankings(ctx: RankingsContext | null, runner?: RankingsRunner): UseRankings {
  const [state, setState] = useState<Omit<UseRankings, "retry">>({ status: "idle", result: null, progress: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const runnerRef = useRef<RankingsRunner | null>(runner ?? null);
  const key = ctx ? rankingCacheKey({ courseId: ctx.course.id, raceParams: ctx.raceParams, racerCount: ctx.racerCount, profile: ctx.profile }) : null;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    const current = ctxRef.current;
    if (!key || !current) { setState({ status: "idle", result: null, progress: null, error: null }); return; }
    const hit = cache.get(key);
    if (hit) { remember(hit); setState({ status: "ready", result: hit, progress: null, error: null }); return; }
    let live = true;
    setState({ status: "calculating", result: null, progress: null, error: null });
    let handle: RankingsRunHandle;
    try {
      // `new Worker`, building the request and postMessage (DataCloneError) can all throw synchronously.
      runnerRef.current ??= createWorkerRunner();
      handle = runnerRef.current(buildRankingRequest(current), (done, total) => { if (live) setState((s) => ({ ...s, progress: { done, total } })); });
    } catch (e: unknown) {
      setState({ status: "error", result: null, progress: null, error: errorMessage(e) });
      return;
    }
    handle.promise.then(
      (result) => { if (!live || result.key !== key) return; remember(result); setState({ status: "ready", result, progress: null, error: null }); },
      (e: unknown) => { if (live) setState({ status: "error", result: null, progress: null, error: errorMessage(e) }); },
    );
    return () => { live = false; handle.cancel(); };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/** Test-only: clear the module cache between tests. */
export function __clearRankingsCache() { cache.clear(); }
