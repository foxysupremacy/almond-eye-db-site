import type { Course } from '../skill-engine/types';
import type { RawSkillEffect } from '../data/types';

/** Inputs that can refine special effect scaling. Missing values use a documented maximum. */
export interface SkillScalingContext {
  course?: Course | null;
  skillCount?: number;
  aoharuTeamBaseStatTotal?: number;
  trainingRaceWins?: number;
  maximumRawStat?: number;
  activatedGreenSkillCount?: number;
  blockedSideSeconds?: number;
  finalSpeed?: number;
  globalPotentialLevel?: number;
  maximumLeadMeters?: number;
  fanLove?: number;
  /** Number of overtake events during Final Leg corners. */
  finalLegCornerOvertakes?: number;
  /** Distance in metres behind the race leader. */
  distanceBehindFirstMeters?: number;
  /** Uma's fan count, used by course-specific effects. */
  fanCount?: number;
}

export interface SkillEffectScalingResolution {
  effectIndex: number;
  code: number;
  baseValue: number;
  value: number;
  status: 'unchanged' | 'resolved' | 'assumed' | 'unsupported';
  reason?: string;
  needs?: string[];
  /** Engine-provided presentation metadata; no scaling formula lives in the UI. */
  label?: string;
  assumedInputs?: string[];
}

export interface ResolvedSkillEffects {
  effects: RawSkillEffect[];
  resolutions: SkillEffectScalingResolution[];
}

// Codes present in the connected masterdb snapshot. Formula evidence is from
// the local Race Mechanics reference; 11, 30, 34, 35, and 36 use the
// GameTora tooltip details supplied and confirmed during this task.
export const KNOWN_SKILL_SCALING_CODES = [
  2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 19, 20, 22, 23, 24, 25,
  26, 27, 28, 30, 31, 32, 34, 35, 36, 37, 40,
] as const;

export const SKILL_SCALING_LABELS: Record<number, string> = {
  2: 'Skill count scaling', 3: 'Aoharu team stat scaling', 4: 'Aoharu team stat scaling',
  5: 'Aoharu team stat scaling', 6: 'Aoharu team stat scaling', 7: 'Aoharu team stat scaling',
  8: 'Random effect scaling', 10: 'Training race wins scaling', 13: 'Highest raw stat scaling',
  14: 'Activated green skill scaling', 19: 'Distance from leader scaling',
  20: 'Middle Leg blocked-time scaling', 22: 'Final Speed scaling', 23: 'Final Speed scaling',
  24: 'L’Arc potential scaling', 25: 'Maximum lead scaling', 30: 'Fan Love scaling',
  11: 'Final Leg corner overtake scaling', 34: 'Distance behind first scaling',
  35: 'Mile / Arima Kinen scaling',
  36: 'Medium-race effect bonus',
};

export const FAN_LOVE_MAX_THRESHOLD = 3_000_000;

const SCALING_NEEDS: Record<number, string[]> = {
  2: ['Number of skills activated during the race'],
  3: ['Aoharu team total base stats'], 4: ['Aoharu team total base stats'], 5: ['Aoharu team total base stats'],
  6: ['Aoharu team total base stats'], 7: ['Aoharu team total base stats'],
  8: ['Random scaling roll outcome'],
  10: ['Number of races won during training'],
  13: ['Highest raw stat among Speed, Stamina, Power, Guts, and Wit'],
  14: ['Number of activated green skills (tags 601–615) during the race'],
  19: ['Maximum distance from the race leader'],
  20: ['Longest continuous side-blocked duration during the Middle Leg'],
  22: ['Final Speed stat, including race and skill modifiers'],
  23: ['Final Speed stat, including race and skill modifiers'],
  24: ['Total L’Arc global-potential level'],
  25: ['Maximum lead achieved during the first two thirds of the race'],
  30: [
    'Uma’s fan count during training',
    'Love gained from the Start Dash',
    'Position changes during the Middle Leg',
    'Skill activations that grant Love',
  ],
  11: ['Number of overtakes during Final Leg corners (4 or more reaches the maximum value)'],
  34: ['Distance behind first place when the effect activates (20 m threshold)'],
  35: ['Race course (Mile or Arima Kinen)', 'Uma fan count (146,738 threshold on Arima Kinen)'],
  36: ['Race distance category (Medium or not)'],
};

function withNeeds<T extends Omit<SkillEffectScalingResolution, 'effectIndex'>>(result: T, code: number): T & { needs?: string[] } {
  const needs = 'needs' in result ? result.needs : SCALING_NEEDS[code];
  return { ...result, ...(needs ? { needs } : {}) };
}

const multipliers = (base: number, table: Array<[number, number]>, value: number | undefined, code: number, label: string): Omit<SkillEffectScalingResolution, 'effectIndex'> => {
  if (value == null || !Number.isFinite(value)) {
    const factor = table.at(-1)![1];
    const reason = code === 30
      ? `${label} is unavailable; ${FAN_LOVE_MAX_THRESHOLD.toLocaleString('de-DE')}+ assumed from the scaling table`
      : `${label} is unavailable; highest documented effect value used`;
    return { code, baseValue: base, value: base * factor, status: 'assumed', reason };
  }
  const factor = table.find(([upper]) => value < upper)?.[1] ?? table.at(-1)![1];
  return { code, baseValue: base, value: base * factor, status: 'resolved', reason: `${label}=${value}; matching scaling-table value applied` };
};

/** Resolve one non-default ability_value_usage code without mutating source data. */
export function resolveSkillEffectValue(
  baseValue: number,
  code: number | null | undefined,
  context: SkillScalingContext = {},
): Omit<SkillEffectScalingResolution, 'effectIndex'> {
  if (code == null || code === 0 || code === 1) return { code: code ?? 1, baseValue, value: baseValue, status: 'unchanged' };
  const course = context.course;
  let result: Omit<SkillEffectScalingResolution, 'effectIndex'>;
  switch (code) {
    case 2: result = multipliers(baseValue, [[1, 1], [2, 1.01], [3, 1.02], [4, 1.03], [5, 1.04], [6, 1.05], [7, 1.06], [8, 1.07], [9, 1.08], [10, 1.09], [11, 1.1], [12, 1.11], [13, 1.12], [14, 1.13], [15, 1.14], [16, 1.15], [17, 1.16], [18, 1.17], [19, 1.18], [20, 1.19], [Number.POSITIVE_INFINITY, 1.2]], context.skillCount, code, 'Activated skill count'); break;
    case 3: case 4: case 5: case 6: case 7:
      result = multipliers(baseValue, [[1200, .8], [1800, .9], [2600, 1], [3600, 1.1]], context.aoharuTeamBaseStatTotal, code, 'Aoharu team base-stat total'); break;
    case 8: result = { code, baseValue, value: baseValue * 1.04, status: 'assumed', reason: 'Random scaling outcome is unavailable; highest documented effect value used' }; break;
    case 10: result = multipliers(baseValue, [[6, .8], [14, .9], [18, 1], [25, 1.1]], context.trainingRaceWins, code, 'Training race wins'); break;
    case 12: case 26: case 30: case 31: case 32: case 37: case 40:
      if (code === 30) result = multipliers(baseValue, [[3000, 1], [50000, 1.4], [250000, 1.8], [750000, 2.2], [1500000, 2.6], [FAN_LOVE_MAX_THRESHOLD, 2.8], [Number.POSITIVE_INFINITY, 3]], context.fanLove, code, 'Fan Love');
      else result = { code, baseValue, value: baseValue, status: 'unsupported', reason: `Scaling code ${code} is present in masterdb, but its formula has not been verified` };
      break;
    case 11:
      result = multipliers(baseValue, [[2, 1], [3, 1.1], [4, 1.2], [Number.POSITIVE_INFINITY, 1.25]], context.finalLegCornerOvertakes, code, 'Final Leg corner overtakes');
      break;
    case 34: {
      const behind = context.distanceBehindFirstMeters;
      result = behind == null
        ? { code, baseValue, value: baseValue + 2000, status: 'assumed', reason: 'Distance behind first place is unavailable; the documented 20 m bonus assumed' }
        : { code, baseValue, value: baseValue + (behind >= 20 ? 2000 : 0), status: 'resolved', reason: `Distance behind first place is ${behind} m; ${behind >= 20 ? '20 m bonus applied' : 'no bonus'}` };
      break;
    }
    case 35: {
      const course = context.course;
      if (!course) {
        result = { code, baseValue, value: baseValue, status: 'resolved', reason: 'No course is selected; course-specific bonus not assumed', needs: [] };
      } else if (course.distance === 2) {
        result = { code, baseValue, value: baseValue + 1000, status: 'resolved', reason: 'Mile race; +0.1 effect value', needs: [] };
      } else if (course.id === 10506) {
        const fanCount = context.fanCount;
        result = fanCount == null
          ? { code, baseValue, value: baseValue + 2000, status: 'assumed', reason: 'Arima Kinen selected; fan count is unavailable, so the 146,738-fan bonus is assumed', needs: [] }
          : { code, baseValue, value: baseValue + (fanCount >= 146738 ? 2000 : 0), status: 'resolved', reason: `Arima Kinen selected; fan count ${fanCount}${fanCount >= 146738 ? ' meets' : ' does not meet'} the 146,738 threshold`, needs: [] };
      } else {
        result = { code, baseValue, value: baseValue, status: 'resolved', reason: 'No Mile or Arima Kinen bonus applies on this course', needs: [] };
      }
      break;
    }
    case 13: result = multipliers(baseValue, [[600, .8], [800, .9], [1000, 1], [1100, 1.1]], context.maximumRawStat, code, 'Maximum raw stat'); break;
    case 14: {
      const n = context.activatedGreenSkillCount;
      const factor = n == null ? 3 : n <= 2 ? 0 : n <= 4 ? 1 : n === 5 ? 2 : 3;
      result = { code, baseValue, value: baseValue * factor, status: n == null ? 'assumed' : 'resolved', reason: n == null ? 'Activated green-skill count is unavailable; highest documented effect value used' : `${n} activated green skills; matching scaling-table value applied` };
      break;
    }
    case 19: {
      const lead = context.maximumLeadMeters;
      result = { code, baseValue, value: baseValue + (lead == null ? 1000 : lead >= 20 ? 1000 : 0), status: lead == null ? 'assumed' : 'resolved', reason: lead == null ? 'Maximum lead is unavailable; documented +0.1 maximum used' : `Maximum lead ${lead}m` };
      break;
    }
    case 20: result = multipliers(baseValue, [[2, 1], [4, 2], [6, 3]], context.blockedSideSeconds, code, 'Longest side-blocked duration'); break;
    case 21: result = { code, baseValue, value: baseValue, status: 'unsupported', reason: 'Scaling code 21 is documented as not implemented in the available mechanics reference' }; break;
    case 22: result = multipliers(baseValue, [[1700, 0], [1800, 1], [1900, 2], [2000, 3], [Number.POSITIVE_INFINITY, 4]], context.finalSpeed, code, 'Final speed stat'); break;
    case 23: result = multipliers(baseValue, [[1400, 1], [1600, 2]], context.finalSpeed, code, 'Final speed stat'); break;
    case 24: result = multipliers(baseValue, [[10, 1], [20, 1.1], [Number.POSITIVE_INFINITY, 1.2]], context.globalPotentialLevel, code, 'L’Arc global potential level'); break;
    case 25: result = multipliers(baseValue, [[10, 1], [25, 1.4], [Number.POSITIVE_INFINITY, 1.8]], context.maximumLeadMeters, code, 'Maximum lead'); break;
    case 36:
      if (!course) result = { code, baseValue, value: baseValue + 2000, status: 'assumed', reason: 'Course distance type is unavailable; Medium maximum +0.2 used' };
      else result = { code, baseValue, value: baseValue + (course.distance === 3 ? 2000 : 0), status: 'resolved', reason: course.distance === 3 ? 'Medium race; +0.2 effect value' : 'Non-Medium race; base effect value' };
      break;
    default: result = { code, baseValue, value: baseValue, status: 'unsupported', reason: `Unknown scaling code ${code}` };
  }
  return withNeeds(result, code);
}

/** Resolve each effect and retain provenance as metadata separate from source effects. */
export function resolveSkillEffects(effects: readonly RawSkillEffect[] | undefined, context: SkillScalingContext = {}): ResolvedSkillEffects {
  const resolutions: SkillEffectScalingResolution[] = [];
  const resolvedEffects = (effects ?? []).map((effect, effectIndex) => {
    const resolution = { effectIndex, ...resolveSkillEffectValue(effect.value ?? 0, effect.value_scale, context) };
    resolutions.push(resolution);
    return { ...effect, value: resolution.value };
  });
  return { effects: resolvedEffects, resolutions };
}
