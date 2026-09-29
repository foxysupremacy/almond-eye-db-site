import { RegionList } from "./region";
import type { Condition, Course, DynamicCondition, HorseParameters, Operator, RaceParameters, SamplePolicy } from "./types";

function kTrue(): boolean {
  return true;
}

function withDefaultCond(r: RegionList | [RegionList, DynamicCondition]): [RegionList, DynamicCondition] {
  if (r instanceof RegionList) return [r, kTrue];
  return r;
}

class CmpOperatorBase implements Operator {
  constructor(
    readonly condition: Condition,
    readonly argument: number,
  ) {}
  get samplePolicy(): SamplePolicy {
    return this.condition.samplePolicy;
  }
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterEq(regions, this.argument, course, horse, extra));
  }
}

export class EqOperator extends CmpOperatorBase {}
export class NeqOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterNeq(regions, this.argument, course, horse, extra));
  }
}
export class LtOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterLt(regions, this.argument, course, horse, extra));
  }
}
export class LteOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterLte(regions, this.argument, course, horse, extra));
  }
}
export class GtOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterGt(regions, this.argument, course, horse, extra));
  }
}
export class GteOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterGte(regions, this.argument, course, horse, extra));
  }
}

export class AndOperator implements Operator {
  constructor(
    readonly left: Operator,
    readonly right: Operator,
  ) {}
  get samplePolicy(): SamplePolicy {
    return this.left.samplePolicy.reconcile(this.right.samplePolicy);
  }
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    const [leftval, leftcond] = this.left.apply(regions, course, horse, extra);
    const [rightval, rightcond] = this.right.apply(leftval, course, horse, extra);
    if (leftcond === kTrue && rightcond === kTrue) {
      return [rightval, kTrue] as [RegionList, DynamicCondition];
    }
    return [rightval, (s: unknown) => leftcond(s) && rightcond(s)] as [RegionList, DynamicCondition];
  }
}

export class OrOperator implements Operator {
  constructor(
    readonly left: Operator,
    readonly right: Operator,
  ) {}
  get samplePolicy(): SamplePolicy {
    return this.left.samplePolicy.reconcile(this.right.samplePolicy);
  }
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    const [leftval, leftcond] = this.left.apply(regions, course, horse, extra);
    const [rightval, rightcond] = this.right.apply(regions, course, horse, extra);
    return [leftval.union(rightval), (s: unknown) => leftcond(s) || rightcond(s)] as [
      RegionList,
      DynamicCondition,
    ];
  }
}
