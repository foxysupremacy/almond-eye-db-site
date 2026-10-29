"use client";

import { useCallback, useEffect, useState } from "react";
import { useDeckTrack } from "@/features/deck/state";
import { terrainLabel } from "@/lib/api";
import type { Course } from "@/lib/skill-engine/types";
import type { StaminaInput, StaminaResult } from "@/lib/stamina-sim";
import { defaultStaminaInput, GROUNDS, loadStaminaPrefs, saveStaminaPrefs } from "../model/stamina-prefs";
import { useStaminaSim, type StaminaRunner, type StaminaStatus } from "./use-stamina-sim";

type Ground = StaminaInput["groundCondition"];
const isGround = (v: unknown): v is Ground => GROUNDS.includes(v as Ground);

/** The race context the calculator runs against (normally read from the global race bar). */
export interface StaminaTrack {
  course: Course | null;
  loading: boolean;
  /** Ground condition set by the active race (1..4), or null when the race leaves it open. */
  raceGround: number | null;
  caption?: string;
}

export interface StaminaViewModel {
  readonly state: {
    readonly course: Course | null;
    readonly loading: boolean;
    readonly caption: string | undefined;
    readonly input: StaminaInput;
    readonly status: StaminaStatus;
    readonly result: StaminaResult | null;
    readonly error: string | null;
    /** The shown result was computed from different inputs or another course. */
    readonly stale: boolean;
  };
  readonly commands: {
    /** Merge a partial change into the inputs and persist them. */
    readonly update: (patch: Partial<StaminaInput>) => void;
    /** Set one recovery / HP-loss bucket count. */
    readonly setCount: (field: "recovery" | "hpLoss", index: number, n: number) => void;
    /** Back to defaults; the race-provided ground, when set, is kept. */
    readonly resetInputs: () => void;
    readonly calculate: () => void;
  };
}

/** Stamina calculator state for an explicit race context (the seam DOM tests and the page share). */
export function useStaminaCalculator(track: StaminaTrack, runner?: StaminaRunner): StaminaViewModel {
  const { course, loading, raceGround, caption } = track;
  const [input, setInput] = useState<StaminaInput>(defaultStaminaInput);
  const sim = useStaminaSim(runner);
  // The input + course behind the shown result; any difference marks it stale.
  const [computed, setComputed] = useState<{ key: string; courseId: number } | null>(null);

  // Stored inputs load after mount (no storage during SSR); the race's ground, when set, then wins.
  useEffect(() => { setInput(loadStaminaPrefs()); }, []);
  useEffect(() => {
    if (isGround(raceGround)) setInput((prev) => ({ ...prev, groundCondition: raceGround }));
  }, [raceGround]);

  // A result belongs to the course it was run on.
  const courseId = course?.id ?? null;
  const { reset, run } = sim;
  useEffect(() => { reset(); }, [courseId, reset]);

  const update = useCallback((patch: Partial<StaminaInput>) => {
    const next = { ...input, ...patch };
    setInput(next);
    saveStaminaPrefs(next);
  }, [input]);

  const setCount = useCallback(
    (field: "recovery" | "hpLoss", i: number, n: number) => update({ [field]: input[field].map((v, j) => (j === i ? n : v)) }),
    [input, update],
  );
  const resetInputs = useCallback(
    () => update({ ...defaultStaminaInput(), ...(isGround(raceGround) ? { groundCondition: raceGround } : {}) }),
    [raceGround, update],
  );
  const calculate = useCallback(() => {
    if (!course) return;
    setComputed({ key: JSON.stringify(input), courseId: course.id });
    run(input, course);
  }, [course, input, run]);

  const stale = sim.status === "ready" && computed != null && (computed.courseId !== courseId || computed.key !== JSON.stringify(input));

  return {
    state: { course, loading, caption, input, status: sim.status, result: sim.result, error: sim.error, stale },
    commands: { update, setCount, resetInputs, calculate },
  };
}

/** Stamina page: course and ground come from the global race bar. */
export function useStaminaViewModel(runner?: StaminaRunner): StaminaViewModel {
  const { course, trackDetail, activeRaceParameters, loading } = useDeckTrack();
  const caption = course
    ? [`${trackDetail?.nameEn ?? ""} ${course.length.toLocaleString("en-US")}m`.trim(), terrainLabel(course.terrain)].join(" · ")
    : undefined;
  return useStaminaCalculator({ course, loading, raceGround: activeRaceParameters.groundCondition ?? null, caption }, runner);
}
