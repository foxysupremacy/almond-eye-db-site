/**
 * Test support for the U-tools benchmark (benchmark.test.ts): ranks the costumes of one reduced U-tools fixture
 * (scripts/reduce-utools-fixtures.ts) with the production rankings engine and compares the totals. Not part of the
 * race-impact barrel, so the rankings worker never reaches it.
 */
import { characters, getCharacterEvolutions, loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { defaultRaceImpactProfile } from "./profile";
import { buildRankingCandidates, rankCharacters, skillIdsReferenced } from "../rankings";
import type { RankingRequest, RankingRow } from "../rankings";
import type { RaceImpactProfile } from "./types";

export interface UtoolsFixture {
  courseId: number;
  racerCount: number;
  source: string;
  rows: { c: number; s: number; t: number; u: [number, number]; p: number[][] }[];
}

export interface BenchmarkMetrics {
  courseId: number;
  n: number;
  /** Spearman ρ over every matched row (ordinal ranks, descending). */
  rho: number;
  /** Spearman ρ over U-tools' top 20 rows (the old gate; informational). */
  rhoTop20: number;
  medianRatio: number;
  within5: number;
  within10: number;
  top10Overlap: number;
}

export interface BenchmarkPair { costumeId: number; style: number; utools: number; ours: number; row: RankingRow }

export function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]) => {
    const s = xs.map((x, i) => [x, i] as const).sort((p, q) => q[0] - p[0]);
    const r: number[] = Array(xs.length);
    s.forEach(([, i], k) => (r[i] = k + 1));
    return r;
  };
  const ra = rank(a), rb = rank(b), n = a.length;
  return 1 - (6 * ra.reduce((t, x, i) => t + (x - rb[i]) ** 2, 0)) / (n * (n * n - 1));
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const STYLE_APTITUDE_INDEX = 5; // aptitude[6..9] = runner, leader, betweener, chaser (style 1..4)
let tracks: Awaited<ReturnType<typeof loadRacetracks>> | null = null;

/** Rank the fixture's costumes, each in the style U-tools scored it in, and pair the totals. */
export async function benchmarkPairs(fx: UtoolsFixture, profile: RaceImpactProfile = defaultRaceImpactProfile()): Promise<BenchmarkPair[]> {
  tracks ??= await loadRacetracks();
  let course: (ReturnType<typeof flattenCourse> & { trackId: number }) | undefined;
  for (const t of tracks) {
    const r = t.courses.find((c) => c.id === fx.courseId);
    if (r) course = { ...flattenCourse(r), trackId: t.id };
  }
  if (!course) throw new Error(`course ${fx.courseId} not found`);
  const styleOf = new Map(fx.rows.map((r) => [r.c, r.s]));
  // Force the U-tools style: that style is the only one graded A, so rankedStylesFor returns exactly it.
  const chars = characters.filter((c) => styleOf.has(c.id)).map((c) => {
    const aptitude = [...(c.aptitude ?? [])];
    for (let s = 1; s <= 4; s++) aptitude[STYLE_APTITUDE_INDEX + s] = s === styleOf.get(c.id) ? "A" : "G";
    return { ...c, aptitude };
  });
  const candidates = buildRankingCandidates(chars, (i) => getCharacterEvolutions(i));
  const skills: RankingRequest["skills"] = {};
  for (const i of skillIdsReferenced(candidates)) {
    const s = skillsById.get(i);
    if (s) skills[i] = { id: s.id, rarity: s.rarity, conditionGroups: s.conditionGroups };
  }
  const res = rankCharacters({
    key: `bench-${fx.courseId}`, course: course as never, raceParams: { groundCondition: 1, weather: 2, season: 3, time: 2, grade: 100 },
    racerCount: fx.racerCount, profile, candidates, skills,
  });
  const out: BenchmarkPair[] = [];
  for (const r of fx.rows) {
    const row = res.rows.find((x) => x.costumeId === r.c && x.style === r.s);
    if (row) out.push({ costumeId: r.c, style: r.s, utools: r.t, ours: row.total, row });
  }
  return out;
}

export function benchmarkMetrics(courseId: number, pairs: BenchmarkPair[]): BenchmarkMetrics {
  const u = pairs.map((p) => p.utools), o = pairs.map((p) => p.ours);
  const n = pairs.length;
  const ratios = pairs.filter((p) => p.utools).map((p) => p.ours / p.utools);
  const within = (tol: number) => ratios.filter((r) => Math.abs(r - 1) <= tol).length / n;
  const order = (xs: number[]) => xs.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  const topU = order(u), topO = order(o);
  const top10 = new Set(topU.slice(0, 10));
  const top20 = [...topU.slice(0, 20)].sort((a, b) => a - b);
  return {
    courseId, n,
    rho: spearman(u, o),
    rhoTop20: spearman(top20.map((i) => u[i]), top20.map((i) => o[i])),
    medianRatio: median(ratios),
    within5: within(0.05),
    within10: within(0.10),
    top10Overlap: topO.slice(0, 10).filter((i) => top10.has(i)).length,
  };
}
