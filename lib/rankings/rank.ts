import { scoreSkill, simulateBaseline, zeroScore, type BaselineRun } from "../race-impact/score";
import type { SkillScore } from "../race-impact/types";
import { distanceIndex, gradeAt, groundIndex, rankedStylesFor, styleIndex } from "./aptitude";
import type { EvolutionOption, ProgressFn, RankedStyle, RankingMetric, RankingRequest, RankingResult, RankingRow, SlotScore } from "./types";

export function rankCharacters(req: RankingRequest, onProgress?: ProgressFn): RankingResult {
  const started = Date.now();
  const errors: RankingResult["errors"] = [];
  const baselines = new Map<RankedStyle, BaselineRun>();
  const memo = new Map<string, SkillScore>();
  const baseline = (style: RankedStyle) => {
    let b = baselines.get(style);
    if (!b) { b = simulateBaseline(req.course, style, req.profile, req.raceParams.groundCondition); baselines.set(style, b); }
    return b;
  };
  // R32: a skill's score depends only on the map and style (no held skills), so it is scored once per style.
  const score = (skillId: number, style: RankedStyle): SkillScore => {
    const key = `${skillId}|${style}`;
    const hit = memo.get(key);
    if (hit) return hit;
    const skill = req.skills[skillId];
    let result: SkillScore;
    if (!skill) {
      errors.push({ skillId, message: "skill detail missing" });
      result = zeroScore(skillId);
    } else {
      try {
        result = scoreSkill({
          skill, course: req.course, raceParams: req.raceParams, style, racerCount: req.racerCount, profile: req.profile, baseline: baseline(style),
        });
      } catch (e) {
        errors.push({ skillId, message: e instanceof Error ? e.message : String(e) });
        result = zeroScore(skillId);
      }
    }
    memo.set(key, result);
    return result;
  };
  const slot = (options: EvolutionOption[], style: RankedStyle): SlotScore => {
    const scored = options.map((o) => {
      const s = score(o.skillId, style);
      const base = o.baseSkillId && req.skills[o.baseSkillId] ? score(o.baseSkillId, style) : null;
      return { ...s, weakerThanBase: base != null && s.expectedBashin < base.expectedBashin };
    });
    const best = (eligible: SkillScore[], value: (s: SkillScore) => number) =>
      eligible.reduce<SkillScore | null>((top, s) => (!top || value(s) > value(top) ? s : top), null);
    // R8: if every option is weakerThanBase, still pick the best one (flag kept for the UI badge).
    const nonWeaker = scored.filter((s) => !s.weakerThanBase);
    const chosen = best(nonWeaker.length ? nonWeaker : scored, (s) => s.expectedBashin);
    // Best case (user decision): the option with the highest best-point Bashin.
    const chosenMax = best(scored, (s) => s.maxBashin);
    return { chosen, chosenMax, options: scored };
  };

  const rows: RankingRow[] = [];
  const total = req.candidates.length;
  req.candidates.forEach((c, i) => {
    for (const style of rankedStylesFor(c)) {
      const unique = score(c.uniqueSkillId, style);
      const s1 = slot(c.slot1, style);
      const s2 = slot(c.slot2, style);
      const s3 = slot(c.slot3 ?? [], style);
      const heal = [unique, s1.chosen, s2.chosen, s3.chosen].reduce((t, s) => t + (s?.recoveryHpPercent ?? 0), 0);
      rows.push({
        costumeId: c.costumeId, style,
        total: Math.round((unique.expectedBashin + (s1.chosen?.expectedBashin ?? 0) + (s2.chosen?.expectedBashin ?? 0) + (s3.chosen?.expectedBashin ?? 0)) * 1e6) / 1e6,
        totalMax: Math.round((unique.maxBashin + (s1.chosenMax?.maxBashin ?? 0) + (s2.chosenMax?.maxBashin ?? 0) + (s3.chosenMax?.maxBashin ?? 0)) * 1e6) / 1e6,
        unique, slot1: s1, slot2: s2, slot3: s3, recoveryHpPercent: heal || null,
        groundGrade: gradeAt(c.aptitude, groundIndex(req.course)),
        distanceGrade: gradeAt(c.aptitude, distanceIndex(req.course)),
        styleGrade: gradeAt(c.aptitude, styleIndex(style)),
      });
    }
    if ((i + 1) % 20 === 0 && i + 1 < total) onProgress?.(i + 1, total);
  });
  onProgress?.(total, total);

  const release = new Map(req.candidates.map((c) => [c.costumeId, c.release ?? ""]));
  rows.sort((a, b) => b.total - a.total || (release.get(b.costumeId) ?? "").localeCompare(release.get(a.costumeId) ?? "") || a.costumeId - b.costumeId);
  return { key: req.key, rows, computedMs: Date.now() - started, errors };
}

export function allTabRows(rows: RankingRow[]): RankingRow[] {
  const seen = new Set<number>();
  return rows.filter((r) => (seen.has(r.costumeId) ? false : (seen.add(r.costumeId), true)));
}

export function styleTabRows(rows: RankingRow[], style: RankedStyle): RankingRow[] {
  return rows.filter((r) => r.style === style);
}

/** A row's total in the chosen metric. */
export function rowTotal(row: RankingRow, metric: RankingMetric): number {
  return metric === "best" ? row.totalMax : row.total;
}

/**
 * Rows in the chosen metric's order. The worker already sorts by the average total; Best case re-sorts by totalMax.
 * The sort is stable, so ties keep the worker order (average total, then newer release, then costume id).
 */
export function rowsForMetric(rows: RankingRow[], metric: RankingMetric): RankingRow[] {
  if (metric === "average") return rows;
  return rows.map((row, i) => ({ row, i })).sort((a, b) => b.row.totalMax - a.row.totalMax || a.i - b.i).map(({ row }) => row);
}
