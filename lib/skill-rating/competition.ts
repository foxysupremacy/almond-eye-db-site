export interface CompetitionState { nextCheck: number; activeUntil: number; cooldownUntil: number; keeping: boolean }
export const createCompetitionState = (): CompetitionState => ({ nextCheck: -Infinity,activeUntil:-Infinity,cooldownUntil:-Infinity,keeping:false });
const SPEED_COEFF: Record<number, number> = { 1:.8,2:1,3:1,4:1,5:.2 };
const HP_COEFF: Record<number, number> = { 1:1.2,2:1,3:1,4:1,5:1.5 };
export const competitionDistanceFactor = (length: number) => length < 1801 ? .3 : length < 2101 ? .5 : length < 2201 ? .8 : length < 2401 ? 1 : length < 2601 ? 1.1 : 1.2;
export function competitionSpeed(power: number,guts: number,style: number): number { return (Math.sqrt(power/1500)*2 + Math.pow(guts/3000,.2))*.1*(SPEED_COEFF[style]??1); }
export function competitionCost(length: number,style: number): number { return 20*((HP_COEFF[style]??1)*competitionDistanceFactor(length)+.5); }
/** One nearby representative opponent. Cost is once per activation, not per frame.
 * Detection is immediate at each 2s check; both assumptions are provisional. */
export function updateCompetition(state: CompetitionState,time: number,meter: number,length: number,hp: number,requiredHP: number,recovered: boolean) {
  const inZone = meter >= length * 10/24 && meter < length * 15/24;
  const previousKeeping = state.keeping;
  if (recovered) state.keeping = hp < requiredHP * 1.0375;
  let started = false;
  if (inZone && time + 1e-9 >= state.nextCheck) {
    state.nextCheck = time + 2;
    state.keeping = hp < requiredHP * 1.0375;
    if (!state.keeping && time + 1e-9 >= state.cooldownUntil) {
      started = true; state.activeUntil = time + 2; state.cooldownUntil = time + 3;
    }
  }
  if (!inZone || state.keeping) state.activeUntil = -Infinity;
  return { started,active:inZone && !state.keeping && time < state.activeUntil,keepingChanged:state.keeping !== previousKeeping };
}
