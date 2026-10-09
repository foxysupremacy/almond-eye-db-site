export interface SpurtPlan { start: number; speed: number; maximum: boolean; estimatedHP: number; estimatedTime: number }
export interface SpurtPlanningInput { meter: number; length: number; hp: number; cruise: number; maximum: number; limitBreak: number; consumption: (speed: number) => number; alreadySpurting?: boolean }
/** Budget excludes the final 60m. Integration still consumes HP all the way to the goal.
 * Best feasible candidate is a conditional convention, not a Wisdom acceptance roll. */
export function planLastSpurt(input: SpurtPlanningInput): SpurtPlan {
  const { meter,length,hp,cruise,maximum,limitBreak,consumption } = input;
  const remaining = Math.max(0,length - 60 - meter), cruiseCost = consumption(cruise);
  const candidate = (speed: number, full: boolean): SpurtPlan | null => {
    const rate = consumption(speed), fullHP = rate * remaining / speed;
    let seconds: number;
    if (remaining === 0 || hp + 1e-8 >= fullHP) seconds = remaining / speed;
    else {
      if (input.alreadySpurting) return null;
      const denominator = cruise * rate - cruiseCost * speed;
      if (denominator <= 1e-9) return null;
      seconds = Math.max(0,Math.min(remaining / speed,(cruise * hp - cruiseCost * remaining) / denominator));
    }
    const normalDistance = Math.max(0,remaining - seconds * speed);
    const estimatedHP = normalDistance / cruise * cruiseCost + seconds * rate;
    if (estimatedHP > hp + 1e-7) return null;
    return { start: meter + normalDistance,speed,maximum:full,estimatedHP,estimatedTime: normalDistance / cruise + seconds + Math.min(60,length-meter) / speed };
  };
  const fastest = candidate(maximum + limitBreak,true);
  if (fastest && fastest.start <= meter + 1e-8) return fastest;
  let best = fastest;
  for (let i = 1; maximum - i * .1 > cruise; i++) {
    const next = candidate(maximum - i * .1,false);
    if (next && (!best || next.estimatedTime < best.estimatedTime)) best = next;
  }
  const slowest = candidate(cruise,false);
  if (slowest && (!best || slowest.estimatedTime < best.estimatedTime)) best = slowest;
  // Even cruising cannot satisfy the budget: physical integration will handle depletion.
  return best ?? { start: meter,speed:cruise,maximum:false,estimatedHP:cruiseCost * remaining / cruise,estimatedTime:(length-meter)/cruise };
}
