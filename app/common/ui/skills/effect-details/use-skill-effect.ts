"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type SkillDetail } from "@/lib/api";
import type { RunningStyle } from "@/lib/deck/types";
import { computePvpSkillZones } from "@/lib/pvp/skill-zones";
import {
  generateRaceTrace,
  isUniqueSkill,
  resolveConditionGroup,
  scoreSkill,
  simulateBaseline,
  type RaceEffectTrace,
  type RaceImpactProfile,
  type SkillScore,
} from "@/lib/race-impact";
import { horseForStrategy, type SkillZoneResult } from "@/lib/skill-engine/zones";
import type { Course, RaceParameters } from "@/lib/skill-engine/types";

/** "fetch" can be retried; "evaluate" is a deterministic engine throw, so retrying is pointless. */
export type SkillEffectErrorKind = "fetch" | "evaluate";

export const EVALUATE_ERROR_MESSAGE = "This skill's conditions can't be evaluated yet.";
export const FETCH_ERROR_MESSAGE = "Could not load this skill.";

export interface SkillEffectState {
  status: "loading" | "ready" | "error";
  /** Set when status is "error". */
  errorKind: SkillEffectErrorKind | null;
  /** Set when status is "error". */
  errorMessage: string | null;
  /** True while `skill` is the previous id's skill, kept on screen as the next one loads. */
  switching: boolean;
  /** While a new id loads, this keeps the previous skill so the layout does not blank. */
  skill: SkillDetail | null;
  resolvedIndex: number | null;
  allZones: SkillZoneResult[];
  /** Score at the chosen level, with samples. */
  score: SkillScore | null;
  lv1Score: SkillScore | null;
  /** Activation at the weighted-mean sample meter. */
  trace: RaceEffectTrace | null;
  retry(): void;
}

export interface UseSkillEffectInput {
  skillId: number | null;
  course: Course | null;
  /** Must be a stable reference (memo dependency). */
  raceParams: Partial<RaceParameters>;
  style: RunningStyle;
  racerCount: number;
  /** Must be a stable reference (memo dependency). */
  profile: RaceImpactProfile;
  level: number;
}

const EMPTY_ZONES: SkillZoneResult[] = [];

type Guarded<T> = { ok: true; value: T } | { ok: false };
function guard<T>(fn: () => T): Guarded<T> {
  try {
    return { ok: true, value: fn() };
  } catch {
    // A condition the zone engine does not know throws; keep the modal alive and show the error block.
    return { ok: false };
  }
}

export function useSkillEffect(input: UseSkillEffectInput): SkillEffectState {
  const { skillId, course, raceParams, style, racerCount, profile, level: requestedLevel } = input;
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setStatus("loading");
    // A null id (a closed modal) resets to blank. Switching ids keeps the previous
    // skill on screen until the next one arrives (no skeleton flash).
    if (skillId == null) { setSkill(null); return; }
    let live = true;
    api.skill(skillId).then(
      (detail) => { if (live) { setSkill(detail); setStatus("ready"); } },
      () => { if (live) setStatus("error"); },
    );
    return () => { live = false; };
  }, [skillId, nonce]);

  // Level-independent work: zones and the no-skill baseline run. Changing the
  // level stepper must not recompute these.
  const zones = useMemo(() => {
    if (!skill || !course) return null;
    return guard(() => {
      const resolved = resolveConditionGroup(skill, course, raceParams, style);
      if (resolved) return { resolved, allZones: resolved.allZones };
      const groups = skill.conditionGroups ?? [];
      const allZones = groups.length
        ? computePvpSkillZones(
          course,
          groups.map((g) => ({ condition: g.condition ?? "", precondition: g.precondition ?? null })),
          horseForStrategy(style),
          { ...raceParams, skillId: String(skill.id) },
        )
        : EMPTY_ZONES;
      return { resolved: null, allZones };
    });
  }, [skill, course, raceParams, style]);

  const baseline = useMemo(() => (course ? simulateBaseline(course, style, profile) : null), [course, style, profile]);

  const lv1Score = useMemo(() => {
    if (!skill || !course || !baseline || !zones?.ok) return null;
    return guard(() => scoreSkill({ skill, course, raceParams, style, racerCount, profile, baseline, uniqueLevel: 1, withSamples: true }));
  }, [skill, course, raceParams, style, racerCount, profile, baseline, zones]);

  // Level-dependent work: only the focused skill's score and its trace.
  // Non-unique skills have no level; pin them to Lv1 so the stepper never recomputes them.
  const level = skill && isUniqueSkill(skill) ? requestedLevel : 1;
  const levelled = useMemo(() => {
    if (!skill || !course || !baseline || !lv1Score?.ok || !zones?.ok) return null;
    const lv1 = lv1Score.value;
    const resolved = zones.value.resolved;
    return guard(() => {
      const score = level === 1
        ? lv1
        : scoreSkill({ skill, course, raceParams, style, racerCount, profile, baseline, uniqueLevel: level, withSamples: true });
      let trace: RaceEffectTrace | null = null;
      if (resolved) {
        const sumW = score.samples.reduce((t, s) => t + s.weight, 0) || 1;
        const meanMeter = score.samples.reduce((t, s) => t + s.meter * s.weight, 0) / sumW;
        const chained = resolved.triggers.slice(1).map((t) => ({ groupIndex: t.index, regions: [...t.zones.regions], isRandom: t.zones.isRandom }));
        trace = generateRaceTrace(
          skill,
          { course, profile, runningStyle: style, racerCount },
          score.samples.length ? meanMeter : null,
          [resolved.zones],
          { groupIndex: resolved.index, uniqueLevel: level, chained },
        );
      }
      return { score, trace };
    });
  }, [skill, course, raceParams, style, racerCount, profile, level, baseline, lv1Score, zones]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const evaluateFailed = (zones != null && !zones.ok) || (lv1Score != null && !lv1Score.ok) || (levelled != null && !levelled.ok);
  // The held skill belongs to a previous id while the next one loads.
  const stale = skill != null && skill.id !== skillId;
  // A previous skill's evaluate error is not kept across an id change: blank to the skeleton instead.
  const shownSkill = stale && evaluateFailed ? null : skill;
  const errorKind: SkillEffectErrorKind | null = status === "error" ? "fetch" : shownSkill && evaluateFailed ? "evaluate" : null;

  return {
    status: errorKind ? "error" : status,
    errorKind,
    errorMessage: errorKind === "fetch" ? FETCH_ERROR_MESSAGE : errorKind === "evaluate" ? EVALUATE_ERROR_MESSAGE : null,
    switching: !errorKind && stale && shownSkill != null,
    skill: shownSkill,
    resolvedIndex: zones?.ok ? zones.value.resolved?.index ?? null : null,
    allZones: zones?.ok ? zones.value.allZones : EMPTY_ZONES,
    score: levelled?.ok ? levelled.value.score : null,
    lv1Score: lv1Score?.ok ? lv1Score.value : null,
    trace: levelled?.ok ? levelled.value.trace : null,
    retry,
  };
}
