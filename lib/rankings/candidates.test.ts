import { describe, expect, test } from "bun:test";
import { buildRankingCandidates, skillIdsReferenced } from "./candidates";
import { rankedStylesFor } from "./aptitude";

const chars = [{ id: 101703, charId: 1017, nameEn: "Symboli Rudolf", nameJp: "シンボリルドルフ", titleEn: "Halloween", titleJp: "ハロウィン", imgUrl: "x", release: "2025-10-01", aptitude: ["A","G","G","C","A","A","G","A","A","G"], uniqueSkillId: 120171 }];
const evos = () => [
  { rank: 3, skillId: 101703111, baseSkillId: 200001, branchTag: undefined },
  { rank: 5, skillId: 101703211, baseSkillId: 200002, branchTag: "Leader" },
  { rank: 5, skillId: 101703221, baseSkillId: 200003, branchTag: "Betweener" },
  { rank: 7, skillId: 101703311, baseSkillId: 200004, branchTag: undefined },
];

describe("buildRankingCandidates", () => {
  test("maps rank 3 → slot 1, rank 5 → slot 2 and rank 7 → slot 3", () => {
    const [c] = buildRankingCandidates(chars, evos);
    expect(c.slot1.map((o) => o.skillId)).toEqual([101703111]);
    expect(c.slot2.map((o) => o.skillId)).toEqual([101703211, 101703221]);
    expect(c.slot3.map((o) => o.skillId)).toEqual([101703311]);
  });
  test("skips costumes without a unique skill", () => {
    expect(buildRankingCandidates([{ ...chars[0], uniqueSkillId: null as unknown as number }], evos)).toHaveLength(0);
  });
  test("ranked styles are the ≥A styles; tie keeps both", () => {
    const [c] = buildRankingCandidates(chars, evos);
    expect(rankedStylesFor(c)).toEqual([2, 3]);
  });
  test("no ≥A style falls back to best grade", () => {
    const [c] = buildRankingCandidates([{ ...chars[0], aptitude: ["A","G","G","C","A","A","C","B","B","D"] }], evos);
    expect(rankedStylesFor(c)).toEqual([2, 3]);
  });
  test("R32: candidates carry no held (innate) skills; prerequisites are met without them", () => {
    const [c] = buildRankingCandidates(chars, evos);
    expect("heldSkillIds" in c).toBe(false);
  });
  test("referenced skill ids include base skills, deduped", () => {
    const ids = skillIdsReferenced(buildRankingCandidates(chars, evos));
    for (const id of [120171, 101703111, 200001, 101703211, 200003, 101703311, 200004]) expect(ids.includes(id)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
