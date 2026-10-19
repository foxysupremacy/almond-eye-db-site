import { describe, expect, test } from 'bun:test';
import { analyzeSkill, stableFingerprint } from './conditions';
import type { RatingContext, RatingEnvironment, RatingRequest } from './types';
import { RATING_MODEL_VERSION } from './types';

const context: RatingContext = {
  course: { id: 1, length: 2400, terrain: 1, distance: 3, turn: 1, inout: 1, trackId: 10001,
    corners: [{ start: 400, end: 800 }, { start: 1600, end: 1800 }],
    straights: [{ start: 0, end: 400, frontType: 1 }, { start: 800, end: 1600, frontType: 2 }, { start: 1800, end: 2400, frontType: 1 }],
    slopes: [], spurtStart: { meters: 1600 } },
  style: 2, racerCount: 9,
  profile: { version: 2, bashinReferenceSpeed: null, stats: { speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1800 }, dynamicOverrides: {} },
};
const environment: RatingEnvironment = { benchmarks: { modelVersion: RATING_MODEL_VERSION, convention: 'test', families: {}, provenance: [] } };
function request(condition: string, precondition?: string): RatingRequest {
  return { skill: { id: 123, conditionGroups: [{ condition, precondition, base_time: 30000, effects: [{ type: 27, value: 3500, target: 1 }] }] } };
}
function analyze(condition: string, overrides: Partial<RatingContext> = {}, precondition?: string) {
  return analyzeSkill(request(condition, precondition), { ...context, ...overrides }, environment);
}

describe('canonical condition analysis', () => {
  test('preserves separate OR rank sets and AND precedence', () => {
    const result = analyze('order<=2&phase==1@order>=7&phase==2');
    expect(result.scenarios).toHaveLength(2);
    expect(result.scenarios[0].paths[0].rankSet).toEqual([1, 2]);
    expect(result.scenarios[1].paths[0].rankSet).toEqual([7, 8, 9]);
    expect(result.scenarios[0].paths[0].regions).toEqual([{ start: 400, end: 1600 }]);
    expect(result.scenarios[1].paths[0].regions).toEqual([{ start: 1600, end: 2000 }]);
  });
  test('handles exact rank comparisons including disconnected !=', () => {
    expect(analyze('order!=3').scenarios[0].paths[0].rankSet).toEqual([1, 2, 4, 5, 6, 7, 8, 9]);
    expect(analyze('order>3&order<7').scenarios[0].paths[0].rankSet).toEqual([4, 5, 6]);
    expect(analyze('order==3&order!=3').eligibility.state).toBe('ineligible');
    expect(analyze('order>9').eligibility.state).toBe('ineligible');
  });
  test('uses discrete rounded rate thresholds for every comparator', () => {
    expect(analyze('order_rate>50').scenarios[0].paths[0].rankSet).toEqual([6, 7, 8, 9]);
    expect(analyze('order_rate<50').scenarios[0].paths[0].rankSet).toEqual([1, 2, 3, 4]);
    expect(analyze('order_rate==50').scenarios[0].paths[0].rankSet).toEqual([5]);
    expect(analyze('order_rate!=50').scenarios[0].paths[0].rankSet).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
    expect(analyze('order_rate>=50', { racerCount: 12 }).scenarios[0].paths[0].rankSet).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });
  test('rank outside a style envelope warns without banning', () => {
    const result = analyze('order>=7', { style: 1 });
    expect(result.eligibility.state).toBe('eligible');
    expect(result.warnings[0]).toContain('activation remains possible');
  });
  test('hard track, style, intrinsic stats and configured race gates reject', () => {
    for (const condition of ['running_style==1', 'distance_type==2', 'base_power>=2000', 'ground_type==2', 'course_distance<2000']) expect(analyze(condition).eligibility.state).toBe('ineligible');
    expect(analyze('season==3', { raceParameters: { season: 1 } }).eligibility.state).toBe('ineligible');
    expect(analyze('base_speed>=2200').eligibility.state).toBe('eligible');
  });
  test('missing race context and unknown conditions stay unverified', () => {
    const missing = analyze('season==3');
    expect(missing.eligibility.state).toBe('unknown');
    expect(missing.assumptions[0].kind).toBe('unknown');
    const unknown = analyze('unrecognized_gate==1');
    expect(unknown.eligibility.state).toBe('unknown');
    expect(unknown.scenarios[0].paths[0].partialReasons).toContain('Unknown condition unrecognized_gate==1');
  });
  test('prerequisite geometry gates fire time but prerequisite rank is an earlier snapshot', () => {
    const result = analyze('order==2&is_last_straight==1', {}, 'order==1&phase==1');
    expect(result.eligibility.state).toBe('eligible');
    expect(result.scenarios[0].paths[0].rankSet).toEqual([2]);
    expect(result.scenarios[0].paths[0].regions).toEqual([{ start: 1800, end: 2400 }]);
    expect(result.assumptions.find(clause => clause.source === 'precondition')?.clause).toBe('order==1');
  });
  test('separates immediate, uniform, straight, all-corner and distribution policies', () => {
    const expected = [['phase==1', 'immediate'], ['phase_random==1', 'random'], ['straight_random==1', 'straight'], ['all_corner_random==1', 'all-corner'], ['blocked_front==1', 'distribution']] as const;
    for (const [condition, policy] of expected) expect(analyze(condition).scenarios[0].paths[0].sampling).toBe(policy);
    const distribution = analyze('blocked_front==1').scenarios[0].paths[0];
    expect(distribution.distribution).toEqual({ shape: 3, rate: 2 });
    expect(analyze('is_overtake==1').scenarios[0].paths[0].distribution).toEqual({ shape: 1, rate: 2 });
    expect(analyze('is_move_lane==1').scenarios[0].paths[0].distribution).toEqual({ shape: 5, rate: 1 });
    expect(analyze('blocked_front==1&phase_random==1').scenarios[0].paths[0].sampling).toBe('random');
  });
  test('does not use the accumulatetime distance approximation as a hard gate', () => {
    const result = analyze('accumulatetime>=200');
    expect(result.scenarios[0].paths[0].regions).toEqual([{ start: 0, end: 2400 }]);
    expect(result.assumptions).toEqual([]);
    expect(result.scenarios[0].paths[0].intrinsicClauses).toEqual([{ key: 'accumulatetime', comparator: '>=', value: 200 }]);
  });
  test('inactive detail effects do not leak into remaining alternatives', () => {
    const result = analyzeSkill({ skill: { id: 1, conditionGroups: [
      { condition: 'distance_type==1', base_time: 20000, effects: [{ type: 21, value: 5000 }] },
      { condition: 'distance_type==3', base_time: 40000, effects: [{ type: 27, value: 3500 }] },
    ] } }, context, environment);
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].paths[0].triggerIndex).toBe(1);
    expect(result.scenarios[0].paths[0].effects).toEqual([{ type: 27, value: 3500 }]);
  });
  test('keeps explicit chains together and rejects orphan continuation', () => {
    const result = analyzeSkill({ skill: { id: 1, conditionGroups: [
      { condition: 'phase==1', base_time: 20000, effects: [{ type: 27, value: 3500 }] },
      { condition: 'is_activate_other_skill_detail==1&phase==2', base_time: 40000, effects: [{ type: 31, value: 4000 }] },
    ] } }, context, environment);
    expect(result.scenarios[0].relation).toBe('chain');
    expect(result.scenarios[0].paths[1].dependsOn).toEqual([0]);
    expect(analyze('is_activate_other_skill_detail==1').eligibility.state).toBe('ineligible');
  });
  test('marks strict stronger conditions as enhanced and weaker ones as fallback', () => {
    const result = analyzeSkill({ skill: { id: 1, conditionGroups: [
      { condition: 'phase==1&order<=2', base_time: 20000, effects: [{ type: 27, value: 4500 }] },
      { condition: 'phase==1&order<=5', base_time: 20000, effects: [{ type: 27, value: 2500 }] },
    ] } }, context, environment);
    expect(result.scenarios.map(scenario => scenario.relation)).toEqual(['enhanced', 'fallback']);
    expect(result.scenarios[1].suppressedBy).toEqual([result.scenarios[0].id]);
  });
  test('resolved parent payload is evaluated instead of relabeling the gold payload', () => {
    const result = analyzeSkill({ ...request('always==1'), variant: 'parent-factor' }, context, { ...environment, resolveVariant: () => ({ id: 456, conditionGroups: [{ condition: 'always==1', base_time: 20000, effects: [{ type: 27, value: 1500 }] }] }) });
    expect(result.originalSkillId).toBe(123);
    expect(result.evaluatedSkillId).toBe(456);
    expect(result.scenarios[0].paths[0].effects[0].value).toBe(1500);
    expect(analyzeSkill({ ...request('always==1'), variant: 'inherited-unique' }, context, environment).eligibility.state).toBe('unknown');
  });
  test('retains cooldown, additional activation and duration metadata', () => {
    const input = request('always==1');
    Object.assign(input.skill.conditionGroups![0], { cd: 50000, base_time: 20000 });
    input.skill.conditionGroups![0].effects![0].additional_activation = 1;
    const path = analyzeSkill(input, context, environment).scenarios[0].paths[0];
    expect(path.cooldownSeconds).toBe(5);
    expect(path.additionalActivations).toBe(1);
    expect(path.duration).toEqual({ kind: 'timed', seconds: 4.8 });
    expect(path.partialReasons).toContain('Additional activation behavior requires explicit activation-state modeling');
  });
  test('distinguishes persistent, instant and missing duration', () => {
    const input = request('always==1');
    input.skill.conditionGroups![0].effects = [{ type: 1, value: 60 }];
    expect(analyzeSkill(input, context, environment).scenarios[0].paths[0].duration.kind).toBe('persistent');
    input.skill.conditionGroups![0].effects = [{ type: 9, value: 550 }];
    expect(analyzeSkill(input, context, environment).scenarios[0].paths[0].duration.kind).toBe('instant');
    input.skill.conditionGroups![0].effects = [{ type: 27, value: 3500 }];
    delete input.skill.conditionGroups![0].base_time;
    expect(analyzeSkill(input, context, environment).scenarios[0].paths[0].duration.kind).toBe('unknown');
  });
  test('stable context fingerprint ignores key insertion order but tracks data changes', () => {
    expect(stableFingerprint({ b: 2, a: [1, 3] })).toBe(stableFingerprint({ a: [1, 3], b: 2 }));
    expect(analyze('always==1').contextFingerprint).not.toBe(analyze('always==1', { style: 4 }).contextFingerprint);
    expect(analyze('always==1', { course: null }).eligibility.state).toBe('missing-context');
  });
  test('zenkai candidate region does not require corners and gates on raw panel speed', () => {
    const noCorners = { ...context.course!, corners: [] };
    const active = analyze('run_at_full_speed_random==1', { course: noCorners });
    expect(active.eligibility.state).toBe('eligible');
    expect(active.scenarios[0].paths[0].regions).toEqual([{ start: 1600, end: 2400 }]);
    expect(active.scenarios[0].paths[0].intrinsicClauses).toEqual([{ key: 'run_at_full_speed_random', comparator: '==', value: 1 }]);
    const capped = { ...context.profile, stats: { ...context.profile.stats, speed: 2000 } };
    expect(analyze('run_at_full_speed_random==1', { profile: capped }).eligibility.state).toBe('ineligible');
  });
  test('temporal intrinsic predicates are carried for timeline evaluation', () => {
    const path = analyze('hp_per>=30&is_lastspurt==1').scenarios[0].paths[0];
    expect(path.intrinsicClauses).toEqual([{ key: 'hp_per', comparator: '>=', value: 30 }, { key: 'is_lastspurt', comparator: '==', value: 1 }]);
    expect(path.regions).toEqual([{ start: 0, end: 2400 }]);
    expect(path.assumptions).toEqual([]);
  });
  test('only unsupported intrinsic conditions and historical prerequisites stay assumed and partial', () => {
    for (const condition of ['lastspurt==1', 'lastspurt==2', 'lastspurt==3', 'is_hp_empty_onetime==1', 'run_at_full_speed_random!=0']) {
      const path = analyze(condition).scenarios[0].paths[0];
      expect(path.intrinsicClauses).toEqual([]);
      expect(path.assumptions.some(a => a.clause === condition)).toBe(true);
      expect(path.partialReasons.some(reason => reason.includes('not modeled'))).toBe(true);
    }
    const pre = analyze('phase==3', {}, 'is_lastspurt==1').scenarios[0].paths[0];
    expect(pre.assumptions[0].source).toBe('precondition');
    expect(pre.assumptions[0].kind).toBe('prerequisite');
    expect(pre.partialReasons.some(reason => reason.includes('earlier race state'))).toBe(true);
    const current = analyze('accumulatetime>=5&is_fullspeed==1&hp_per>30&is_lastspurt!=0').scenarios[0].paths[0];
    expect(current.assumptions).toEqual([]);
    expect(current.intrinsicClauses).toHaveLength(4);
  });
  test('no fallback suppression across snapshots and no suppression within one OR group', () => {
    const result = analyzeSkill({ skill: { id: 1, conditionGroups: [
      { condition: 'phase==1', precondition: 'order<=2', base_time: 20000, effects: [{ type: 27, value: 4500 }] },
      { condition: 'phase==1&order<=5', base_time: 20000, effects: [{ type: 27, value: 2500 }] },
    ] } }, context, environment);
    expect(result.scenarios.every(scenario => !scenario.suppressedBy)).toBe(true);
    expect(analyze('order<=2@order<=5').scenarios.every(scenario => !scenario.suppressedBy)).toBe(true);
  });
  test('unknown geometry operators do not become false no-activation verdicts', () => {
    const result = analyze('remain_distance>300');
    expect(result.eligibility.state).toBe('unknown');
    expect(result.scenarios[0].paths[0].partialReasons).toContain('Unsupported geometry comparison remain_distance>300');
    expect(result.scenarios).toHaveLength(1);
  });
  test('a known OR branch retains eligibility and does not inherit unsupported sibling reasons', () => {
    const result = analyze('unknown_condition==1@phase==1');
    expect(result.eligibility.state).toBe('eligible');
    expect(result.partialReasons).toEqual([]);
    expect(result.scenarios[1].paths[0].partialReasons).toEqual([]);
    expect(result.scenarios[0].paths[0].partialReasons).toContain('Unknown condition unknown_condition==1');
  });
  test('start-delay types are instant and do not require a duration', () => {
    const input = request('always==1');
    input.skill.conditionGroups![0] = { condition: 'always==1', effects: [{ type: 10, value: 9000 }, { type: 14, value: 1000 }] };
    expect(analyzeSkill(input, context, environment).scenarios[0].paths[0].duration.kind).toBe('instant');
  });
});
