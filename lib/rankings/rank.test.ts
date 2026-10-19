import { describe, expect, test } from "bun:test";
import { characters, getCharacterEvolutions, loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { defaultRaceImpactProfile } from "../race-impact/profile";
import { scoreSkill } from "../race-impact/score";
import { buildRankingCandidates, skillIdsReferenced } from "./candidates";
import { allTabRows, rankCharacters, rowsForMetric, rowTotal, styleTabRows } from "./rank";
import { isAtLeastA } from "./aptitude";
import type { RankingRequest, RankingRow } from "./types";
import { zeroScore } from "../race-impact/score";

async function request(courseId: number, ids?: number[], raceParams = {}): Promise<RankingRequest> {
  let course;
  for (const t of await loadRacetracks()) { const r = t.courses.find((c) => c.id === courseId); if (r) course = { ...flattenCourse(r), trackId: t.id }; }
  const pool = ids ? characters.filter((c) => ids.includes(c.id)) : characters;
  const candidates = buildRankingCandidates(pool as never, (id) => getCharacterEvolutions(id));
  const skills = Object.fromEntries(skillIdsReferenced(candidates).flatMap((id) => { const s = skillsById.get(id); return s ? [[id, s]] : []; }));
  return { key: "t", course: course!, raceParams, racerCount: 9, profile: defaultRaceImpactProfile(), candidates, skills };
}

describe("rankCharacters", () => {
  test("slot 3 (rank 7) is scored and counted in the total (101301)", async () => {
    const res = rankCharacters(await request(10808, [101301]));
    expect(res.rows.length).toBeGreaterThan(0);
    for (const row of res.rows) {
      expect(row.slot3.options.map((o) => o.skillId)).toEqual([101301311]);
      expect(row.slot3.chosen?.skillId).toBe(101301311);
      const sum = row.unique.expectedBashin + (row.slot1.chosen?.expectedBashin ?? 0) + (row.slot2.chosen?.expectedBashin ?? 0) + (row.slot3.chosen?.expectedBashin ?? 0);
      expect(row.total).toBeCloseTo(sum, 6);
    }
  });

  test("a costume without slot 3 gets an empty slot 3 and an unchanged total", async () => {
    const res = rankCharacters(await request(10808, [101703]));
    for (const row of res.rows) {
      expect(row.slot3).toEqual({ chosen: null, chosenMax: null, options: [] });
      expect(row.total).toBeCloseTo(row.unique.expectedBashin + (row.slot1.chosen?.expectedBashin ?? 0) + (row.slot2.chosen?.expectedBashin ?? 0), 6);
    }
  });

  test("total = unique + best non-weaker option per slot; sorted desc", async () => {
    const res = rankCharacters(await request(10808, [101703, 109701, 114101]));
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.rows.some((r) => r.slot1.options.length > 0 || r.slot2.options.length > 0)).toBe(true);
    for (const row of res.rows) {
      const sum = row.unique.expectedBashin + (row.slot1.chosen?.expectedBashin ?? 0) + (row.slot2.chosen?.expectedBashin ?? 0);
      expect(row.total).toBeCloseTo(sum, 6);
      for (const slot of [row.slot1, row.slot2]) {
        const eligible = slot.options.filter((o) => !o.weakerThanBase);
        if (eligible.length) expect(slot.chosen?.expectedBashin).toBe(Math.max(...eligible.map((o) => o.expectedBashin)));
      }
    }
    const totals = res.rows.map((r) => r.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  test("All tab keeps one row per costume; style tab filters by style", async () => {
    const res = rankCharacters(await request(10808, [101703, 109701]));
    const all = allTabRows(res.rows);
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all.map((r) => r.costumeId)).size).toBe(all.length);
    expect(styleTabRows(res.rows, 2).every((r) => r.style === 2)).toBe(true);
  });

  test("missing skill detail is reported, not thrown", async () => {
    const req = await request(10808, [109701]);
    delete req.skills[109701111];
    const res = rankCharacters(req);
    expect(res.errors.some((e) => e.skillId === 109701111)).toBe(true);
    expect(res.rows.length).toBeGreaterThan(0);
  });

  test("banned unique still ranks with Banned flag (No Debuffs)", async () => {
    const req = await request(10808, [101703], { noDebuffs: true });
    req.candidates[0] = { ...req.candidates[0], uniqueSkillId: 201151 };
    req.skills[201151] = skillsById.get(201151)!;
    const res = rankCharacters(req);
    expect(res.rows[0].unique.banned).toBe(true);
    expect(res.rows[0].unique.expectedBashin).toBe(0);
  });

  test("progress is reported and ends at total", async () => {
    const calls: [number, number][] = [];
    const req = await request(10808, characters.slice(0, 45).map((c) => c.id));
    rankCharacters(req, (d, t) => calls.push([d, t]));
    expect(calls.at(-1)).toEqual([req.candidates.length, req.candidates.length]);
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });
  test("R8: all-weaker slot still chooses best option (flagged); mixed slot prefers non-weaker", async () => {
    const req = await request(10808, [101703, 109701, 114101]);
    const first = rankCharacters(req);
    const uniq = [...new Map(first.rows.map((r) => [r.unique.skillId, r.unique.expectedBashin] as const)).entries()].filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1]);
    expect(uniq.length).toBeGreaterThan(1);
    const [lo, hi] = [uniq[0], uniq[uniq.length - 1]];
    expect(lo[1]).toBeLessThan(hi[1]);
    const base = req.candidates[0];
    for (const id of [lo[0], hi[0]]) req.skills[id] = skillsById.get(id)!;
    req.candidates = [{ ...base,
      slot1: [{ skillId: lo[0], baseSkillId: hi[0] }],
      slot2: [{ skillId: lo[0], baseSkillId: hi[0] }, { skillId: hi[0], baseSkillId: lo[0] }],
    }];
    const res = rankCharacters(req);
    const row = res.rows[0];
    expect(row.slot1.chosen?.skillId).toBe(lo[0]);
    expect((row.slot1.chosen as { weakerThanBase?: boolean } | null)?.weakerThanBase).toBe(true);
    expect(row.slot2.chosen?.skillId).toBe(hi[0]);
    expect((row.slot2.chosen as { weakerThanBase?: boolean } | null)?.weakerThanBase).toBe(false);
    const sum = row.unique.expectedBashin + row.slot1.chosen!.expectedBashin + row.slot2.chosen!.expectedBashin;
    expect(row.total).toBeCloseTo(sum, 6);
    expect(row.slot1.chosen!.expectedBashin).toBeGreaterThan(0);
  });
});

describe("rankCharacters: R32, prerequisite skills are met for every Uma", () => {
  test("Still in Love 109701 (style 3, Kyoto 10808): the Impulse 203781 prerequisite groups fire", async () => {
    const res = rankCharacters(await request(10808, [109701]));
    const row = res.rows.find((r) => r.costumeId === 109701 && r.style === 3)!;
    expect(row.unique.groupIndex).toBe(0); // Scarlet Lily g0 (names Impulse)
    expect(row.slot1.options.find((o) => o.skillId === 109701111)!.expectedBashin).toBeGreaterThan(0); // Crimson Stirrings
    // Before Option A the row totalled 2.67 (U-tools 9.50).
    expect(row.total).toBeGreaterThan(2 * 2.67);
    // U-tools 9.50 rolls a 0.925 wisdom check on the evolutions (not the unique); R32 does not. Apply that roll to our
    // evolution contribution only, so the comparison is like-for-like, and hold the original 10% tolerance.
    const evolutions = row.total - row.unique.expectedBashin;
    const utoolsLike = row.unique.expectedBashin + 0.925 * evolutions;
    expect(Math.abs(utoolsLike / 9.50 - 1)).toBeLessThanOrEqual(0.10);
  });

  test("Still in Love style 2: Impulse is a Betweener skill, but the prerequisite is met anyway (g0)", async () => {
    const res = rankCharacters(await request(10808, [109701]));
    const row = res.rows.find((r) => r.costumeId === 109701 && r.style === 2)!;
    expect(row.unique.groupIndex).toBe(0);
  });

  test("Red Desire 113601: the 204452 prerequisite (with_detail_one) is met, so her evolutions fire their first group", async () => {
    const res = rankCharacters(await request(10808, [113601]));
    const row = res.rows.find((r) => r.costumeId === 113601 && r.style === 3)!;
    for (const o of [...row.slot1.options, ...row.slot2.options]) {
      if (o.skillId === 113601111 || o.skillId === 113601211) expect(o.groupIndex).toBe(0);
    }
  });

  test("modal-from-row parity: a standalone scoreSkill equals the row's numbers (nothing depends on held skills)", async () => {
    const req = await request(10808, [109701]);
    const res = rankCharacters(req);
    for (const style of [2, 3] as const) {
      const row = res.rows.find((r) => r.costumeId === 109701 && r.style === style)!;
      for (const s of [row.unique, ...row.slot1.options, ...row.slot2.options]) {
        const direct = scoreSkill({ skill: skillsById.get(s.skillId)!, course: req.course, raceParams: req.raceParams, style, racerCount: 9, profile: req.profile });
        expect(direct.expectedBashin).toBeCloseTo(s.expectedBashin, 6);
        expect(direct.groupIndex).toBe(s.groupIndex);
      }
    }
  });
});

describe("rankCharacters: Tokyo 1400 (10601) is a Sprint course", () => {
  // Sakura Bakushin O 104101: Sprint A / Mile B. Oguri Cap 100601: Sprint E / Mile A.
  test("default A-aptitude filter reads Sprint: Bakushin O is eligible, a Mile-only costume is not", async () => {
    const res = rankCharacters(await request(10601, [104101, 100601]));
    const eligible = res.rows.filter((r) => isAtLeastA(r.groundGrade) && isAtLeastA(r.distanceGrade)).map((r) => r.costumeId);
    expect(res.rows.find((r) => r.costumeId === 104101)?.distanceGrade).toBe("A");
    expect(res.rows.find((r) => r.costumeId === 100601)?.distanceGrade).toBe("E");
    expect(eligible).toContain(104101);
    expect(eligible).not.toContain(100601);
  });
});

describe("Best case metric (user decision: Average | Best case switch)", () => {
  test("totalMax = unique max + each slot's highest-max option (computed once in the worker)", async () => {
    const res = rankCharacters(await request(10808, [101301, 101703, 109701]));
    expect(res.rows.length).toBeGreaterThan(0);
    for (const row of res.rows) {
      const slots = [row.slot1, row.slot2, row.slot3];
      for (const slot of slots) {
        if (!slot.options.length) { expect(slot.chosenMax).toBeNull(); continue; }
        // The chosen-by-max option is one of the slot's options, and no option has a higher max.
        expect(slot.options.some((o) => o.skillId === slot.chosenMax!.skillId)).toBe(true);
        for (const o of slot.options) expect(o.maxBashin).toBeLessThanOrEqual(slot.chosenMax!.maxBashin);
      }
      const sum = row.unique.maxBashin + slots.reduce((t, s) => t + (s.chosenMax?.maxBashin ?? 0), 0);
      expect(row.totalMax).toBeCloseTo(sum, 6);
      expect(row.totalMax).toBeGreaterThanOrEqual(row.total - 1e-6);
      expect(rowTotal(row, "average")).toBe(row.total);
      expect(rowTotal(row, "best")).toBe(row.totalMax);
    }
  });

  test("rowsForMetric: Average keeps the worker order; Best case re-sorts by totalMax (stable on ties)", () => {
    const mk = (costumeId: number, style: 1 | 2 | 3 | 4, total: number, totalMax: number): RankingRow => ({
      costumeId, style, total, totalMax, unique: zeroScore(1), slot1: { chosen: null, chosenMax: null, options: [] }, slot2: { chosen: null, chosenMax: null, options: [] },
      slot3: { chosen: null, chosenMax: null, options: [] }, recoveryHpPercent: null, groundGrade: "A", distanceGrade: "A", styleGrade: "A",
    });
    const rows = [mk(1, 2, 9, 10), mk(2, 3, 8, 12), mk(1, 3, 7, 13), mk(3, 2, 6, 10)];
    expect(rowsForMetric(rows, "average")).toBe(rows);
    const best = rowsForMetric(rows, "best");
    expect(best.map((r) => `${r.costumeId}/${r.style}`)).toEqual(["1/3", "2/3", "1/2", "3/2"]);
    // The All tab's best style per Uma follows the metric too.
    expect(allTabRows(best).map((r) => `${r.costumeId}/${r.style}`)).toEqual(["1/3", "2/3", "3/2"]);
    expect(allTabRows(rows).map((r) => `${r.costumeId}/${r.style}`)).toEqual(["1/2", "2/3", "3/2"]);
  });
});
