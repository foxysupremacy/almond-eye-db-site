"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Course } from "@/lib/skill-engine/types";
import type { StaminaInput, StaminaResult } from "@/lib/stamina-sim";
import type { StaminaWorkerRequest, StaminaWorkerResponse } from "../workers/stamina.worker";

/** Test seam: replaces the worker (sync or async). */
export type StaminaRunner = (input: StaminaInput, course: Course) => StaminaResult | Promise<StaminaResult>;
export type StaminaStatus = "idle" | "running" | "ready" | "error";
export interface UseStaminaSim {
  status: StaminaStatus;
  result: StaminaResult | null;
  error: string | null;
  run(input: StaminaInput, course: Course): void;
  /** Drop any shown or pending result (e.g. the course changed). */
  reset(): void;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Runs the sim off the main thread; only the newest run's result is ever shown. */
export function useStaminaSim(runner?: StaminaRunner): UseStaminaSim {
  const [state, setState] = useState<Pick<UseStaminaSim, "status" | "result" | "error">>({ status: "idle", result: null, error: null });
  const latest = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const runnerRef = useRef(runner);
  runnerRef.current = runner;

  useEffect(() => () => {
    latest.current++;
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const finish = useCallback((id: number, next: Pick<UseStaminaSim, "status" | "result" | "error">) => {
    if (id === latest.current) setState(next);
  }, []);

  const worker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL("../workers/stamina.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (event: MessageEvent<StaminaWorkerResponse>) => {
      const m = event.data;
      if ("result" in m) finish(m.id, { status: "ready", result: m.result, error: null });
      else finish(m.id, { status: "error", result: null, error: m.error });
    };
    w.onerror = (e) => {
      finish(latest.current, { status: "error", result: null, error: e.message || "Stamina worker failed" });
      w.terminate();
      if (workerRef.current === w) workerRef.current = null;
    };
    workerRef.current = w;
    return w;
  }, [finish]);

  const run = useCallback((input: StaminaInput, course: Course) => {
    const id = ++latest.current;
    setState({ status: "running", result: null, error: null });
    const custom = runnerRef.current;
    try {
      if (custom) {
        Promise.resolve(custom(input, course)).then(
          (result) => finish(id, { status: "ready", result, error: null }),
          (e: unknown) => finish(id, { status: "error", result: null, error: errorMessage(e) }),
        );
        return;
      }
      const request: StaminaWorkerRequest = { id, input, course };
      worker().postMessage(request);
    } catch (e: unknown) {
      // A sync runner, `new Worker` and postMessage (DataCloneError) can all throw.
      finish(id, { status: "error", result: null, error: errorMessage(e) });
    }
  }, [finish, worker]);

  const reset = useCallback(() => {
    latest.current++;
    setState({ status: "idle", result: null, error: null });
  }, []);

  return { ...state, run, reset };
}
