import type { SkillDetailInput } from "../evaluator/types";
import type { RunningStyle } from "../deck/types";
import { scoreSkill, type RaceImpactProfile } from "../race-impact";
import { rankingCacheKey } from "../rankings";
import type { Course, RaceParameters } from "../skill-engine/types";
import { SPEED_GROUPS, isCounted, skillGroupsOf, type SkillGroup } from "./skill-groups";

export interface RawSkillValue { skillId: number; bashin: number; activates: boolean; groups: SkillGroup[] }
export interface SkillValue extends RawSkillValue { value: number; flat: boolean }
export interface ScoreRequest {
  key: string; skillIds: number[]; skills: Record<number, SkillDetailInput>;
  course: Course; raceParams: Partial<RaceParameters>; style: RunningStyle; racerCount: number; profile: RaceImpactProfile;
}

export function autoPickCacheKey(input: { courseId: number; raceParams: Partial<RaceParameters>; racerCount: number; profile: RaceImpactProfile; style: RunningStyle }): string {
  return `${rankingCacheKey(input)}|style=${input.style}|autopick=v1`;
}

export function scoreSkillValues(req: ScoreRequest, onProgress?: (done: number, total: number) => void): Record<number, RawSkillValue> {
  const out: Record<number, RawSkillValue> = {};
  const total = req.skillIds.length;
  let done = 0;
  for (const skillId of req.skillIds) {
    const skill = req.skills[skillId];
    if (!skill) {
      out[skillId] = { skillId, bashin: 0, activates: false, groups: ["other"] };
    } else {
      const groups = skillGroupsOf(skill);
      try {
        const score = scoreSkill({ skill, course: req.course, raceParams: req.raceParams, style: req.style, racerCount: req.racerCount, profile: req.profile });
        out[skillId] = { skillId, bashin: Math.max(0, score.expectedBashin), activates: score.groupIndex !== null && !score.banned, groups };
      } catch {
        out[skillId] = { skillId, bashin: 0, activates: false, groups };
      }
    }
    done++;
    onProgress?.(done, total);
  }
  return out;
}

export function buildValueTable(raw: Record<number, RawSkillValue>, enabled: ReadonlySet<SkillGroup>): Map<number, SkillValue> {
  const speed = Object.values(raw).filter((r) => r.bashin > 0 && r.groups.some((g) => SPEED_GROUPS.includes(g)));
  const flatValue = speed.length === 0 ? 0 : speed.reduce((t, r) => t + r.bashin, 0) / speed.length;
  const table = new Map<number, SkillValue>();
  for (const r of Object.values(raw)) {
    let value = 0;
    let flat = false;
    if (r.activates && isCounted(r.groups, enabled)) {
      if (r.bashin > 0) value = r.bashin;
      else if (r.groups.some((g) => enabled.has(g) && (g === "recovery" || g === "debuff"))) { value = flatValue; flat = true; }
    }
    table.set(r.skillId, { ...r, value, flat });
  }
  return table;
}
