import { describe, expect, test } from 'bun:test';
import { resolveSkillEffectValue, resolveSkillEffects, KNOWN_SKILL_SCALING_CODES } from './index';

describe('special skill effect scaling', () => {
  test('Peerless Heroine adds 0.2 only on Medium courses', () => {
    const medium = resolveSkillEffectValue(4500, 36, { course: { id: 1, length: 2000, terrain: 1, distance: 3, turn: 1, inout: 1, corners: [], straights: [], slopes: [] } });
    const long = resolveSkillEffectValue(4500, 36, { course: { id: 2, length: 2400, terrain: 1, distance: 4, turn: 1, inout: 1, corners: [], straights: [], slopes: [] } });
    expect(medium.value).toBe(6500);
    expect(medium.status).toBe('resolved');
    expect(long.value).toBe(4500);
    expect(long.status).toBe('resolved');
  });

  test('Circulating Love follows every documented Love threshold and assumes the maximum without run data', () => {
    const thresholds: Array<[number, number]> = [[0,1500],[2999,1500],[3000,2100],[49999,2100],[50000,2700],[250000,3300],[750000,3900],[1500000,4200],[3000000,4500]];
    for (const [fanLove, value] of thresholds) expect(resolveSkillEffectValue(1500, 30, { fanLove }).value).toBeCloseTo(value, 8);
    const assumed = resolveSkillEffectValue(1500, 30);
    expect(assumed.value).toBe(4500);
    expect(assumed.status).toBe('assumed');
  });

  test('Inari One uses the overtakes on Final Leg corners table', () => {
    const thresholds: Array<[number, number]> = [[0, 3500], [1, 3500], [2, 3850], [3, 4200], [4, 4375], [9, 4375]];
    for (const [overtakes, value] of thresholds) {
      expect(resolveSkillEffectValue(3500, 11, { finalLegCornerOvertakes: overtakes }).value).toBeCloseTo(value, 8);
    }
    const assumed = resolveSkillEffectValue(3500, 11);
    expect(assumed.value).toBe(4375);
    expect(assumed.status).toBe('assumed');
  });

  test('Nakayama Festa adds the behind-first bonus at 20 metres', () => {
    expect(resolveSkillEffectValue(2500, 34, { distanceBehindFirstMeters: 19.9 }).value).toBe(2500);
    expect(resolveSkillEffectValue(2500, 34, { distanceBehindFirstMeters: 20 }).value).toBe(4500);
    const assumed = resolveSkillEffectValue(2500, 34);
    expect(assumed.value).toBe(4500);
    expect(assumed.status).toBe('assumed');
  });

  test('Oguri Cap applies Mile and Arima Kinen bonuses with the fan threshold', () => {
    const course = (id: number, distance: number) => ({ id, length: 2500, terrain: 1, distance, turn: 1, inout: 1, corners: [], straights: [], slopes: [] });
    const mile = resolveSkillEffectValue(3500, 35, { course: course(1, 2) });
    expect(mile.value).toBe(4500);
    expect(mile.status).toBe('resolved');
    expect(mile.reason).toContain('Mile race');
    expect(resolveSkillEffectValue(3500, 35, { course: course(10506, 4), fanCount: 146737 }).value).toBe(3500);
    expect(resolveSkillEffectValue(3500, 35, { course: course(10506, 4), fanCount: 146738 }).value).toBe(5500);
    const assumed = resolveSkillEffectValue(3500, 35, { course: course(10506, 4) });
    expect(assumed.value).toBe(5500);
    expect(assumed.status).toBe('assumed');
    expect(resolveSkillEffectValue(3500, 35, { course: course(2, 4) }).value).toBe(3500);
    const noCourse = resolveSkillEffectValue(3500, 35);
    expect(noCourse.value).toBe(3500);
    expect(noCourse.status).toBe('resolved');
  });

  test('preserves source effects and flags formulas without evidence as unsupported', () => {
    const source = [{ type: 22, value: 4500, value_scale: 27 }];
    const resolved = resolveSkillEffects(source);
    expect(resolved.effects[0].value).toBe(4500);
    expect(resolved.resolutions[0].status).toBe('unsupported');
    expect(source[0].value).toBe(4500);
    expect(KNOWN_SKILL_SCALING_CODES).toContain(27);
  });
});
