/** Predicates whose current race state the single-Uma simulator can establish.
 * Historical prerequisites and lastspurt's transition cases need separate models. */
const VALUES = {
  hp_per: (s: IntrinsicState) => s.hp / s.maxHP * 100,
  accumulatetime: (s: IntrinsicState) => s.time,
  is_lastspurt: (s: IntrinsicState) => Number(s.spurt),
  is_fullspeed: (s: IntrinsicState) => Number(s.velocity >= s.target - .02),
  run_at_full_speed_random: (s: IntrinsicState) => Number(s.zenkai),
};
const COMPARATORS = new Set(['==', '!=', '<', '<=', '>', '>=']);
export interface IntrinsicClause { key: string; comparator: string; value: number }
export interface IntrinsicState { hp: number; maxHP: number; time: number; spurt: boolean; zenkai: boolean; velocity: number; target: number }

export function supportsIntrinsicClause(clause: IntrinsicClause): boolean {
  return Object.hasOwn(VALUES, clause.key) && COMPARATORS.has(clause.comparator)
    && (clause.key !== 'run_at_full_speed_random' || (clause.comparator === '==' && clause.value === 1));
}

export function intrinsicMatch(clause: IntrinsicClause, state: IntrinsicState): boolean {
  if (!supportsIntrinsicClause(clause)) return false;
  const actual = VALUES[clause.key as keyof typeof VALUES](state);
  switch (clause.comparator) {
    case '==': return actual === clause.value;
    case '!=': return actual !== clause.value;
    case '<': return actual < clause.value;
    case '<=': return actual <= clause.value;
    case '>': return actual > clause.value;
    case '>=': return actual >= clause.value;
    default: return false;
  }
}
