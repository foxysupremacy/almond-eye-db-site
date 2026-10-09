import { getParser } from '../skill-engine/parser';
import { Conditions } from '../skill-engine/conditions';
import { Region, RegionList } from '../skill-engine/region';
import type { HorseParameters, RaceParameters } from '../skill-engine/types';
import { STYLE_EXPECTED_RANKS } from '../evaluator/constants';
import { supportsIntrinsicClause } from './intrinsic-conditions';
import { RATING_MODEL_VERSION, type AssumedClause, type RatingContext, type RatingEnvironment, type RatingRequest, type RatingScenario, type SkillAnalysis, type TriggerPath } from './types';

type Comparator = '==' | '!=' | '<' | '<=' | '>' | '>=';
type Clause = { name: string; comparator: Comparator; value: number };
type Expression = { kind: 'comparison'; clause: Clause } | { kind: 'and' | 'or'; left: Expression; right: Expression };
class Comparison {
  readonly kind = 'comparison' as const;
  readonly clause: Clause;
  constructor(name: string, value: number, comparator: Comparator = '==') { this.clause = { name, comparator, value }; }
}
class Neq extends Comparison { constructor(name: string, value: number) { super(name, value, '!='); } }
class Lt extends Comparison { constructor(name: string, value: number) { super(name, value, '<'); } }
class Lte extends Comparison { constructor(name: string, value: number) { super(name, value, '<='); } }
class Gt extends Comparison { constructor(name: string, value: number) { super(name, value, '>'); } }
class Gte extends Comparison { constructor(name: string, value: number) { super(name, value, '>='); } }
class And { readonly kind = 'and' as const; constructor(readonly left: Expression, readonly right: Expression) {} }
class Or { readonly kind = 'or' as const; constructor(readonly left: Expression, readonly right: Expression) {} }
// The existing Pratt parser supplies the grammar and precedence. The identifier
// proxy preserves unknown identifiers so analysis can report them explicitly.
const parser = getParser<string, Expression>(new Proxy({}, { get: (_target, name) => String(name) }), {
  eq: Comparison, neq: Neq, lt: Lt, lte: Lte, gt: Gt, gte: Gte, and: And, or: Or,
});
const MAX_BRANCHES = 64;
function branches(expression: Expression): Clause[][] {
  if (expression.kind === 'comparison') return [[expression.clause]];
  const left = branches(expression.left), right = branches(expression.right);
  const size = expression.kind === 'or' ? left.length + right.length : left.length * right.length;
  if (size > MAX_BRANCHES) throw new Error('Condition exceeds the supported branch budget');
  return expression.kind === 'or' ? [...left, ...right] : left.flatMap(a => right.map(b => [...a, ...b]));
}
function parse(raw: string): Clause[][] { return raw ? branches(parser.parse(parser.tokenize(raw.replace(/\s+/g, '')))) : [[]]; }
function text(clause: Clause): string { return `${clause.name}${clause.comparator}${clause.value}`; }
function modeledIntrinsic(clause: Clause): boolean { return supportsIntrinsicClause({ key: clause.name, comparator: clause.comparator, value: clause.value }); }
function compare(actual: number, operator: Comparator, required: number): boolean {
  switch (operator) {
    case '==': return actual === required;
    case '!=': return actual !== required;
    case '<': return actual < required;
    case '<=': return actual <= required;
    case '>': return actual > required;
    case '>=': return actual >= required;
  }
}

/** Canonical JSON fingerprint, retaining full values rather than risking hash collisions. */
export function stableFingerprint(value: unknown): string {
  function normalize(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, normalize(v)]));
    return input;
  }
  return JSON.stringify(normalize(value)) ?? 'undefined';
}

const GEOMETRY = new Set([
  'phase', 'corner', 'corner_count', 'corner_random', 'all_corner_random', 'is_finalcorner',
  'is_finalcorner_laterhalf', 'is_finalcorner_random', 'is_last_straight', 'is_last_straight_onetime',
  'straight_front_type', 'straight_random', 'phase_straight_random', 'phase_first_half_straight_random',
  'phase_latter_half_straight_random', 'last_straight_random', 'slope', 'up_slope_random',
  'down_slope_random', 'up_slope_random_later_half', 'down_slope_random_later_half', 'distance_rate',
  'distance_rate_after_random', 'remain_distance', 'phase_random', 'phase_corner_random',
  'phase_firsthalf_random', 'phase_laterhalf_random', 'phase_firsthalf', 'phase_laterhalf',
  'phase_firstquarter', 'phase_firstquarter_random', 'furlong',
  'is_tight_track', 'is_dirtgrade', 'is_abroad',
]);
const DYNAMIC_GEOMETRY = new Set(['change_order_up_end_after', 'change_order_up_finalcorner_after', 'change_order_up_middle', 'compete_fight_count', 'activate_count_end_after', 'activate_count_later_half', 'activate_count_middle', 'activate_count_start']);
const INTRINSIC = new Set(['hp_per', 'is_hp_empty_onetime', 'accumulatetime', 'is_lastspurt', 'lastspurt', 'is_fullspeed', 'run_at_full_speed_random']);
// Parameters are from the local reference ActivationConditions.ts. Its
// distribution-random policies approximate opponent dynamics, not telemetry.
const ERLANG: Record<string, { shape: number; rate: number }> = Object.fromEntries([
  'bashin_diff_behind', 'bashin_diff_infront', 'behind_near_lane_time', 'behind_near_lane_time_set1',
  'blocked_all_continuetime', 'blocked_front', 'blocked_front_continuetime', 'blocked_side_continuetime',
  'change_order_onetime', 'change_order_up_end_after', 'change_order_up_finalcorner_after', 'change_order_up_middle',
  'infront_near_lane_time', 'is_surrounded', 'near_count', 'overtake_target_no_order_up_time', 'overtake_target_time',
].map(name => [name, { shape: 3, rate: 2 }]));
ERLANG.is_move_lane = { shape: 5, rate: 1 };
ERLANG.is_overtake = { shape: 1, rate: 2 };
const RACE_GATES: Record<string, keyof RaceParameters> = { season: 'season', weather: 'weather', ground_condition: 'groundCondition', time: 'time', grade: 'grade' };
function scalar(clause: Clause, context: RatingContext): { recognized: boolean; value?: number } {
  const course = context.course!;
  const values: Record<string, number | undefined | null> = {
    always: 1, course_distance: course.length, distance_type: course.distance, ground_type: course.terrain,
    rotation: course.turn, track_id: course.trackId, is_basis_distance: course.length % 400 === 0 ? 1 : 0,
    running_style: context.style, base_speed: context.profile.stats.speed, base_stamina: context.profile.stats.stamina,
    base_power: context.profile.stats.power, base_guts: context.profile.stats.guts, base_wiz: context.profile.stats.wisdom,
  };
  if (Object.hasOwn(values, clause.name)) return { recognized: true, value: values[clause.name] ?? undefined };
  const raceKey = RACE_GATES[clause.name];
  if (raceKey) return { recognized: true, value: context.raceParameters?.[raceKey] as number | undefined };
  return { recognized: false };
}
function rankMatch(clause: Clause, rank: number, count: number): boolean | null {
  if (clause.name === 'order') return compare(rank, clause.comparator, clause.value);
  if (clause.name === 'order_rate') return compare(rank, clause.comparator, Math.round(count * clause.value / 100));
  const continuous = /^order_rate_(in|out)(\d+)_continue$/.exec(clause.name);
  if (continuous) {
    const cutoff = Math.round(count * Number(continuous[2]) / 100);
    const inside = continuous[1] === 'in' ? rank <= cutoff : rank >= cutoff;
    return compare(inside ? 1 : 0, clause.comparator, clause.value);
  }
  return null;
}

interface BranchAnalysis {
  regions: RegionList; ranks: number[]; assumptions: AssumedClause[]; warnings: string[]; partial: string[];
  sampling: TriggerPath['sampling']; distribution?: TriggerPath['distribution']; impossible: boolean;
}
function analyzeBranch(clauses: Clause[], source: AssumedClause['source'], triggerIndex: number, context: RatingContext): BranchAnalysis {
  const course = context.course!;
  const result: BranchAnalysis = { regions: new RegionList(new Region(0, course.length)), ranks: Array.from({ length: context.racerCount }, (_, i) => i + 1), assumptions: [], warnings: [], partial: [], sampling: 'immediate', impossible: false };
  const horse: HorseParameters = { ...context.profile.stats, strategy: context.style ?? 1 };
  const extra: RaceParameters = { ...context.raceParameters, skillId: '', numUmas: context.racerCount };
  const assume = (clause: Clause, kind: AssumedClause['kind'], description: string) => result.assumptions.push({ clause: text(clause), source, triggerIndex, kind, description });
  for (const clause of clauses) {
    const rankResult = rankMatch(clause, 1, context.racerCount);
    if (rankResult !== null) {
      result.ranks = result.ranks.filter(rank => rankMatch(clause, rank, context.racerCount));
      assume(clause, 'rank', source === 'precondition' ? 'Assumed rank prerequisite before activation' : 'Conditional on occupying an allowed race position');
      if (clause.name.endsWith('_continue')) assume(clause, 'dynamic', 'Requires continuous occupation of the rank range');
      continue;
    }
    if (clause.name === 'is_activate_other_skill_detail') {
      assume(clause, 'prerequisite', 'Requires the preceding detail activation state');
      if (clause.comparator !== '==' || (clause.value !== 0 && clause.value !== 1)) result.partial.push(`Unsupported detail dependency ${text(clause)}`);
      if (triggerIndex > 0 && clause.comparator === '==' && clause.value === 0) result.partial.push('Negative detail dependency excludes paths that already activated; exclusion is not modeled');
      continue;
    }
    const gate = scalar(clause, context);
    if (gate.recognized) {
      if (gate.value === undefined) { assume(clause, 'unknown', 'Required context value is not supplied'); result.partial.push(`Missing context for ${text(clause)}`); }
      else if (!compare(gate.value, clause.comparator, clause.value)) result.impossible = true;
      continue;
    }
    const known = Object.hasOwn(Conditions, clause.name) || INTRINSIC.has(clause.name);
    if ((clause.name === 'is_tight_track' || clause.name === 'is_dirtgrade' || clause.name === 'is_abroad') && course.trackId == null) {
      assume(clause, 'unknown', 'Track identifier needed for the course gate is not supplied');
      result.partial.push(`Missing context for ${text(clause)}`);
      continue;
    }
    if (source === 'precondition' && INTRINSIC.has(clause.name)) result.partial.push(`Intrinsic prerequisite ${text(clause)} is assumed satisfied at an earlier race state`);
    if (clause.name === 'run_at_full_speed_random') {
      if (clause.comparator === '==' && clause.value === 1) {
        if (context.profile.stats.speed <= 2000) result.impossible = true;
        const start = context.course?.spurtStart?.meters ?? context.course!.phases?.find(phase => phase.id === 2)?.start ?? course.length * 2 / 3;
        result.regions = result.regions.rmap(region => region.intersect(new Region(start, course.length)));
      } else result.partial.push(`Unsupported zenkai random comparison ${text(clause)}`);
    }
    if (GEOMETRY.has(clause.name) || DYNAMIC_GEOMETRY.has(clause.name)) {
      const methods = { '==': 'filterEq', '!=': 'filterNeq', '<': 'filterLt', '<=': 'filterLte', '>': 'filterGt', '>=': 'filterGte' } as const;
      try {
        const filtered = Conditions[clause.name][methods[clause.comparator]](result.regions, clause.value, course, horse, extra);
        result.regions = filtered instanceof RegionList ? filtered : filtered[0];
      } catch { result.partial.push(`Unsupported geometry comparison ${text(clause)}`); assume(clause, 'unknown', 'Geometry comparator is not implemented'); }
    }
    if (!known) { assume(clause, 'unknown', 'Condition is not implemented by the engine'); result.partial.push(`Unknown condition ${text(clause)}`); }
    else if (INTRINSIC.has(clause.name)) {
      if (source === 'precondition') assume(clause, 'prerequisite', 'Assumed satisfied at an earlier race state; historical intrinsic prerequisites are not modeled');
      else if (!modeledIntrinsic(clause)) {
        result.partial.push(`Intrinsic predicate ${text(clause)} is not modeled`);
        assume(clause, 'dynamic', 'Assumed satisfied; this intrinsic predicate is not modeled');
      }
    } else if (!GEOMETRY.has(clause.name)) assume(clause, 'dynamic', 'Assumed satisfied; single-Uma model does not establish this race condition');
    if (clause.name === 'straight_random') {
      if (result.sampling === 'all-corner') result.partial.push('Straight and all-corner sampling policies cannot be reconciled');
      result.sampling = 'straight';
    } else if (clause.name === 'all_corner_random') {
      if (result.sampling === 'straight') result.partial.push('Straight and all-corner sampling policies cannot be reconciled');
      result.sampling = 'all-corner';
    }
    else if (clause.name.includes('_random') && result.sampling !== 'straight' && result.sampling !== 'all-corner') result.sampling = 'random';
    else if (clause.name === 'compete_fight_count' && result.sampling === 'immediate') result.sampling = 'random';
    else if (ERLANG[clause.name] && result.sampling === 'immediate') { result.sampling = 'distribution'; result.distribution = ERLANG[clause.name]; }
  }
  if (!result.ranks.length || !result.regions.length) result.impossible = true;
  const envelope = context.style == null ? undefined : STYLE_EXPECTED_RANKS[context.style];
  if (envelope && result.ranks.length && !result.ranks.some(rank => rank >= envelope[0] && rank <= envelope[1])) result.warnings.push('Rank window is outside the assumed style envelope; activation remains possible');
  if (result.sampling !== 'distribution') delete result.distribution;
  if (result.sampling === 'distribution') result.warnings.push('Dynamic activation timing uses the reference Erlang approximation; it is not a verified opponent model');
  return result;
}

function duration(group: NonNullable<RatingRequest['skill']['conditionGroups']>[number], length: number): TriggerPath['duration'] {
  const effects = group.effects ?? [];
  if (effects.length && effects.every(effect => effect.type != null && effect.type >= 1 && effect.type <= 5)) return { kind: 'persistent', seconds: null };
  if (effects.length && effects.every(effect => effect.type === 9 || effect.type === 10 || effect.type === 14)) return { kind: 'instant', seconds: 0 };
  if (group.base_time == null || group.base_time <= 0 || (group.time_scale != null && group.time_scale !== 0)) return { kind: 'unknown', seconds: null };
  return { kind: 'timed', seconds: group.base_time / 10_000 * length / 1_000 };
}
function unique<T>(items: T[]): T[] { return [...new Set(items)]; }
function clauseImplies(strong: Clause, weak: Clause): boolean {
  if (strong.name !== weak.name) return false;
  // Every comparator changes truth only at its threshold. Check all resulting
  // numeric intervals, including their boundaries, rather than approximating
  // implication from string prefixes or rank envelope overlap.
  const points = unique([strong.value - 1, strong.value, strong.value + 1, weak.value - 1, weak.value, weak.value + 1, (strong.value + weak.value) / 2, Math.min(strong.value, weak.value) - 100, Math.max(strong.value, weak.value) + 100]);
  return points.every(value => !compare(value, strong.comparator, strong.value) || compare(value, weak.comparator, weak.value));
}
function branchImplies(strong: Clause[], weak: Clause[]): boolean { return weak.every(required => strong.some(clause => clauseImplies(clause, required))); }
function branchesDisjoint(left: Clause[], right: Clause[]): boolean {
  for (const a of left) for (const b of right) {
    if (a.name !== b.name || a.name.startsWith('precondition/')) continue;
    const points = unique([a.value - 1, a.value, a.value + 1, b.value - 1, b.value, b.value + 1, (a.value + b.value) / 2, Math.min(a.value, b.value) - 100, Math.max(a.value, b.value) + 100]);
    if (!points.some(value => compare(value, a.comparator, a.value) && compare(value, b.comparator, b.value))) return true;
  }
  return false;
}

/** Analyze static eligibility and conditional activation paths without scoring. */
export function analyzeSkill(request: RatingRequest, context: RatingContext, environment: RatingEnvironment): SkillAnalysis {
  const variant = request.variant ?? 'original';
  const modelVersion = context.modelVersion ?? RATING_MODEL_VERSION;
  const base: SkillAnalysis = { originalSkillId: request.skill.id, evaluatedSkillId: null, variant, contextFingerprint: stableFingerprint({ ...context, modelVersion }), modelVersion, eligibility: { state: 'unknown', reasons: [] }, scenarios: [], assumptions: [], warnings: [], partialReasons: [] };
  if (!context.course || !Number.isFinite(context.course.length) || context.course.length <= 0 || !Number.isInteger(context.racerCount) || context.racerCount < 1) return { ...base, eligibility: { state: 'missing-context', reasons: ['A valid course and racer count are required'] } };
  const skill = variant === 'original' ? request.skill : environment.resolveVariant?.(request.skill, variant);
  if (!skill) return { ...base, eligibility: { state: 'unknown', reasons: [`Unable to resolve ${variant} skill payload`] }, partialReasons: ['Unresolved variant'] };
  base.evaluatedSkillId = skill.id;
  if (environment.isSkillAllowed?.(skill.id, context) === false) return { ...base, eligibility: { state: 'ineligible', reasons: ['Skill is excluded by the caller policy'] } };
  if (!skill.conditionGroups?.length) return { ...base, eligibility: { state: 'unknown', reasons: ['No condition-group payload'] }, partialReasons: ['Missing condition groups'] };
  const entries: Array<{ path: TriggerPath; clauses: Clause[] }> = [];
  for (const [triggerIndex, group] of skill.conditionGroups.entries()) {
    let conditionBranches: Clause[][], preconditionBranches: Clause[][];
    try { conditionBranches = parse(group.condition ?? ''); preconditionBranches = parse(group.precondition ?? ''); }
    catch (error) { base.partialReasons.push(`Trigger ${triggerIndex}: ${error instanceof Error ? error.message : 'Invalid condition syntax'}`); continue; }
    if (conditionBranches.length * preconditionBranches.length > MAX_BRANCHES) { base.partialReasons.push(`Trigger ${triggerIndex}: prerequisite and condition branches exceed the supported branch budget`); continue; }
    for (const preClauses of preconditionBranches) for (const condClauses of conditionBranches) {
      const pre = analyzeBranch(preClauses, 'precondition', triggerIndex, context), cond = analyzeBranch(condClauses, 'condition', triggerIndex, context);
      if (pre.impossible || cond.impossible) continue;
      const earliest = Math.min(...pre.regions.map(region => region.start));
      const regions = cond.regions.rmap(region => region.intersect(new Region(earliest, context.course!.length))).filter(region => region.end > region.start);
      if (!regions.length) continue;
      const dependency = [...preClauses, ...condClauses].some(clause => clause.name === 'is_activate_other_skill_detail' && clause.comparator === '==' && clause.value === 1);
      // A detail continuation cannot become a standalone root if its earlier
      // detail was filtered by track/style/rank conditions. Keep references to
      // source groups, not only to groups that happened to survive this course.
      const previous = Array.from({ length: triggerIndex }, (_, index) => index);
      if (dependency && previous.length === 0) continue;
      // A prerequisite may refer to another skill outside this payload. Keep it
      // as an explicit conditional assumption instead of declaring no activation.
      const effectDuration = duration(group, context.course.length);
      const partialReasons = [...pre.partial, ...cond.partial];
      if (effectDuration.kind === 'unknown') partialReasons.push('Effect duration or duration-scaling metadata is unsupported');
      const additionalActivations = Math.max(0, ...((group.effects ?? []).map(effect => effect.additional_activation ?? 0)));
      if (additionalActivations > 0) partialReasons.push('Additional activation behavior requires explicit activation-state modeling');
      if ((group.effects ?? []).some(effect => effect.value_scale != null && effect.value_scale !== 0)) partialReasons.push('Effect value-scaling metadata is unsupported');
      const path: TriggerPath = {
        triggerIndex, regions: regions.map(region => ({ start: region.start, end: region.end })),
        rarity: skill.rarity,
        sampling: cond.sampling, ...(cond.distribution ? { distribution: cond.distribution } : {}),
        assumptions: [...pre.assumptions, ...cond.assumptions], rankSet: cond.ranks,
        condition: condClauses.map(text).join('&'), precondition: preClauses.map(text).join('&'),
        dependsOn: dependency ? previous : [], cooldownSeconds: group.cd != null && group.cd >= 0 ? group.cd / 10_000 : null,
        intrinsicClauses: condClauses.filter(modeledIntrinsic).map(clause => ({ key: clause.name, comparator: clause.comparator, value: clause.value })),
        additionalActivations, duration: effectDuration, effects: (group.effects ?? []).map(effect => ({ ...effect })), partialReasons, warnings: [...pre.warnings, ...cond.warnings],
      };
      entries.push({ path, clauses: [...preClauses.map(clause => ({ ...clause, name: `precondition/${clause.name}` })), ...condClauses.map(clause => ({ ...clause, name: `condition/${clause.name}` }))] });
    }
  }
  const roots = entries.filter(entry => !entry.path.dependsOn.length);
  const scenarios: RatingScenario[] = [];
  for (const [rootIndex, root] of roots.entries()) {
    let combinations: TriggerPath[][] = [[root.path]];
    for (const triggerIndex of unique(entries.filter(entry => entry.path.dependsOn.length).map(entry => entry.path.triggerIndex))) {
      const children = entries.filter(entry => entry.path.triggerIndex === triggerIndex);
      combinations = combinations.flatMap(paths => {
        const applicable = children.filter(child => child.path.dependsOn.some(index => paths.some(path => path.triggerIndex === index)));
        return applicable.length ? applicable.map(child => [...paths, child.path]) : [paths];
      });
      if (combinations.length > MAX_BRANCHES) { combinations = combinations.slice(0, MAX_BRANCHES); base.partialReasons.push('Trigger scenarios exceed the supported branch budget'); }
    }
    let relation: RatingScenario['relation'] = roots.length === 1 ? 'single' : 'alternative';
    const stronger = roots.some(other => other.path.triggerIndex !== root.path.triggerIndex && branchImplies(other.clauses, root.clauses) && !branchImplies(root.clauses, other.clauses));
    const weaker = roots.some(other => other.path.triggerIndex !== root.path.triggerIndex && branchImplies(root.clauses, other.clauses) && !branchImplies(other.clauses, root.clauses));
    if (stronger) relation = 'fallback'; else if (weaker) relation = 'enhanced';
    combinations.forEach((paths, branchIndex) => scenarios.push({ id: `trigger-${root.path.triggerIndex}-path-${rootIndex}-${branchIndex}`, relation: paths.length > 1 ? 'chain' : relation, paths }));
  }
  for (const scenario of scenarios) {
    const root = entries.find(entry => entry.path === scenario.paths[0])!;
    const suppressors = scenarios.filter(other => {
      if (other.paths[0].triggerIndex === scenario.paths[0].triggerIndex) return false;
      const candidate = entries.find(entry => entry.path === other.paths[0])!;
      return branchImplies(candidate.clauses, root.clauses) && !branchImplies(root.clauses, candidate.clauses);
    });
    if (suppressors.length) scenario.suppressedBy = suppressors.map(other => other.id);
  }
  for (const root of roots) {
    const ambiguous = roots.some(other => other.path.triggerIndex !== root.path.triggerIndex && !branchImplies(root.clauses, other.clauses) && !branchImplies(other.clauses, root.clauses) && !branchesDisjoint(root.clauses, other.clauses));
    const identicalWithDifferentPayload = roots.some(other => other.path.triggerIndex !== root.path.triggerIndex && branchImplies(root.clauses, other.clauses) && branchImplies(other.clauses, root.clauses) && stableFingerprint(root.path.effects) !== stableFingerprint(other.path.effects));
    if (ambiguous || identicalWithDifferentPayload) root.path.partialReasons.push('Overlapping alternative details have ambiguous precedence; the best conditional scenario is reported');
  }
  base.scenarios = scenarios;
  base.assumptions = [...new Map(entries.flatMap(entry => entry.path.assumptions).map(clause => [stableFingerprint(clause), clause])).values()];
  base.warnings = unique([...base.warnings, ...entries.flatMap(entry => entry.path.warnings)]);
  base.partialReasons = unique(base.partialReasons);
  const hasKnownPath = scenarios.some(scenario => scenario.paths.every(path => !path.assumptions.some(clause => clause.kind === 'unknown')));
  base.eligibility = scenarios.length ? { state: hasKnownPath ? 'eligible' : 'unknown', reasons: [] } : base.partialReasons.length ? { state: 'unknown', reasons: ['No verified activation path'] } : { state: 'ineligible', reasons: ['No activation path satisfies track, style, intrinsic stats and rank constraints'] };
  return base;
}
