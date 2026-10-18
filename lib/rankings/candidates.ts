import type { CharacterEvolutionDetail, CharacterIndexEntry } from "../data/types";
import type { EvolutionOption, RankingCandidate } from "./types";

type CharacterInput = Pick<CharacterIndexEntry, "id" | "charId" | "nameEn" | "nameJp" | "titleEn" | "titleJp" | "imgUrl" | "release" | "aptitude" | "uniqueSkillId">;
type EvolutionInput = Pick<CharacterEvolutionDetail, "rank" | "skillId" | "baseSkillId" | "branchTag">;

const toOption = (e: EvolutionInput): EvolutionOption => ({ skillId: e.skillId, baseSkillId: e.baseSkillId, branchTag: e.branchTag });

export function buildRankingCandidates(characters: CharacterInput[], evolutionsFor: (costumeId: number) => EvolutionInput[]): RankingCandidate[] {
  const out: RankingCandidate[] = [];
  for (const c of characters) {
    if (!c.uniqueSkillId) continue;
    const evos = evolutionsFor(c.id) ?? [];
    out.push({
      costumeId: c.id, charId: c.charId, nameEn: c.nameEn, nameJp: c.nameJp, titleEn: c.titleEn, titleJp: c.titleJp,
      imgUrl: c.imgUrl, release: c.release ?? null, aptitude: c.aptitude ?? [], uniqueSkillId: c.uniqueSkillId,
      slot1: evos.filter((e) => e.rank === 3).map(toOption),
      slot2: evos.filter((e) => e.rank === 5).map(toOption),
      slot3: evos.filter((e) => e.rank === 7).map(toOption),
    });
  }
  return out;
}

export function skillIdsReferenced(candidates: RankingCandidate[]): number[] {
  const ids = new Set<number>();
  for (const c of candidates) {
    ids.add(c.uniqueSkillId);
    for (const o of [...c.slot1, ...c.slot2, ...(c.slot3 ?? [])]) { ids.add(o.skillId); if (o.baseSkillId) ids.add(o.baseSkillId); }
  }
  return [...ids];
}
