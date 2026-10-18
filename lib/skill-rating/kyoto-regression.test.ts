import { describe, expect, test } from 'bun:test';
import { loadRacetracks, skillsById } from '../data/registry';
import { flattenCourse } from '../api/course-format';
import { defaultRaceImpactProfile } from '../race-impact/profile';
import { evaluateSkillForTrack } from '../evaluator/evaluator';
import { createApplicationRatingSession } from './application';
import { runTimeline, simulateTimeline } from './simulator';
import { RATING_MODEL_VERSION, type RatingContext, type TriggerPath } from './types';

const tracks = await loadRacetracks();
const row = tracks.find(track => track.id === 10008)!.courses.find(course => course.id === 10810)!;
const course = flattenCourse(row);
const context: RatingContext = { course, style: 3, racerCount: 9, raceParameters: { groundCondition: 1 }, profile: defaultRaceImpactProfile() };
const skill = skillsById.get(203561)!; // With All My Might / 一所懸命
const nonStopGirl = skillsById.get(200491)!;
const withCondition = (condition: string) => ({ ...skill, conditionGroups: skill.conditionGroups!.map(group => ({ ...group, condition })) });

describe('Kyoto 3000m Betweener rating regression', () => {
  test('raw slope units preserve a finite baseline and a beneficial last-spurt skill', () => {
    expect(course.slopes[0].slope).toBe(20000);
    const baseline = runTimeline(context, []);
    // A deliberately broad sanity range, not a claim about real race times.
    expect(baseline.finish).toBeGreaterThan(100);
    expect(baseline.finish).toBeLessThan(200);
    const session = createApplicationRatingSession(context);
    const summary = session.evaluate({ skill });
    const full = session.evaluate({ skill }, { detail: 'full' });
    expect(summary.score).toBeGreaterThan(0);
    expect(summary.simulatedBenefit).toBeGreaterThan(0);
    expect(summary.activationOutcome).toBe('activated');
    expect(summary.status).toBe('provisional');
    expect(summary.assumptions).toEqual([]);
    expect(summary.selectedPaths[0].regions).toEqual([{ start: 2500, end: 2750 }]);
    expect(full.trace!.activationMeter!).toBeGreaterThanOrEqual(2500);
    expect(full.trace!.activationMeter!).toBeLessThan(2750);
    expect(full.score).toBe(summary.score);
    expect(full.eligibility).toEqual(summary.eligibility);
    expect(full.activationOutcome).toBe(summary.activationOutcome);
    expect(full.modelVersion).toBe(RATING_MODEL_VERSION);
    expect(full.benchmarkVersion).toBe(RATING_MODEL_VERSION);
    const facade = evaluateSkillForTrack(skill, course, 3, 9, false, [], context.raceParameters, { raceImpactProfile: context.profile, session });
    expect(facade.score).toBe(summary.score);
    expect(facade.tier).toBe(summary.tier);
    expect(facade.canonicalRating!.eligibility).toEqual(summary.eligibility);
    expect(course.slopes).toEqual(row.slopes ?? row.data!.slopes!);
  });

  test('assumed rank and opponent dynamics do not erase conditional value at the same random timing', () => {
    const session = createApplicationRatingSession(context);
    const condition = skill.conditionGroups![0].condition!;
    const plain = session.evaluate({ skill });
    const assumed = session.evaluate({ skill: withCondition(`${condition}&order<=6&blocked_front==1&is_overtake==1`) });
    expect(assumed.score).toBeGreaterThan(0);
    expect(assumed.score).toBe(plain.score);
    expect(assumed.assumptions.map(a => a.clause)).toEqual(['order<=6', 'blocked_front==1', 'is_overtake==1']);
  });

  test('Non-stop Girl scores its lane movement instead of reporting type 28 as unsupported', () => {
    const result = createApplicationRatingSession(context).evaluate({ skill: nonStopGirl });
    const lane = result.contributions.find(contribution => contribution.family === 'lane_movement');
    expect(lane?.attributedBenefit ?? 0).toBeGreaterThan(0);
    expect(lane?.points ?? 0).toBeGreaterThan(0);
    expect(result.status).toBe('provisional');
    expect(result.partialReasons).not.toContain('No handler for effect types 28.');
    expect(result.assumptions.some(assumption => assumption.clause === 'type 28 lane movement')).toBe(true);
  });

  test('low HP permits a slower spurt; unsatisfied intrinsic conditions remain a genuine no-activation zero', () => {
    const tired = { ...context, profile: { ...context.profile, stats: { ...context.profile.stats, stamina: 400 } } };
    const session = createApplicationRatingSession(tired);
    const lowHP = session.evaluate({ skill });
    expect(lowHP.activationOutcome).toBe('activated');
    expect(lowHP.hp!.baseline.plannedSpeed!).toBeLessThan(createApplicationRatingSession(context).evaluate({skill}).hp!.baseline.plannedSpeed!);
    const impossible = withCondition(`${skill.conditionGroups![0].condition}&hp_per>=100`);
    const result = session.evaluate({ skill: impossible }, { detail: 'full' });
    expect(result.score).toBe(0);
    expect(result.activationOutcome).toBe('not-activated');
    expect(result.trace!.activationMeter).toBeNull();
    expect(result.distribution!.samples.every(sample => sample.activationRate === 0)).toBe(true);
    expect(result.breakdown).toContain('No selected trigger activated in the modeled timeline samples.');
    const facade = evaluateSkillForTrack(impossible, course, 3, 9, false, [], tired.raceParameters, { session });
    expect(facade.raceImpact!.activation.activationRate).toBe(0);
    const unsupported = session.evaluate({ skill: withCondition('phase_firsthalf_random==3&lastspurt==2') });
    expect(unsupported.status).toBe('partial');
    expect(unsupported.tier).toBeNull();
    expect(unsupported.partialReasons).toContain('Intrinsic predicate lastspurt==2 is not modeled');
  });

  test('recovery before last spurt restores a later speed effect on the same timeline', () => {
    const tired = { ...context, profile: { ...context.profile, stats: { ...context.profile.stats, stamina: 400 } } };
    const guarded = withCondition(`${skill.conditionGroups![0].condition}&hp_per>=15`);
    const speed = createApplicationRatingSession(tired).analyze({ skill:guarded }).scenarios[0].paths[0];
    const heal: TriggerPath = { ...speed, triggerIndex: 1, condition: '', intrinsicClauses: [],
      regions: [{ start: 1800, end: 1900 }], duration: { kind: 'instant', seconds: 0 }, effects: [{ type: 9, value: 1000 }] };
    expect(simulateTimeline(tired, [{ path: speed, meter: 2600 }]).activated).toBe(false);
    const recoveryOnly = runTimeline(tired, [{ path: heal, meter: 1800 }]);
    const combined = runTimeline(tired, [{ path: heal, meter: 1800 }, { path: speed, meter: 2600 }]);
    expect(combined.finish).toBeLessThan(recoveryOnly.finish);
  });
});
