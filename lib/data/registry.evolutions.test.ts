import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import { characterEvolutions, characters, getCharacterEvolutions, getEvolutionSlots, skillsById } from "./registry";
import { buildRankingCandidates } from "../rankings/candidates";

const getRankingCandidates = () => buildRankingCandidates(characters, (id) => getCharacterEvolutions(id));

describe("evolution slots (master.mdb skill_upgrade_description)", () => {
  test("Halloween Rudolf 101703 has one option per slot", () => {
    expect(getEvolutionSlots(101703)).toEqual({ slot1: [101703111], slot2: [101703211], slot3: [] });
  });
  test("a slot can hold two options (110602 rank 3)", () => {
    const { slot1 } = getEvolutionSlots(110602);
    expect(slot1).toContain(110602111);
    expect(slot1).toContain(110602121);
  });
  test("rank 7 is slot 3 and reaches rankings only as slot 3", () => {
    expect(getEvolutionSlots(101301).slot3).toEqual([101301311]);
    const c = getRankingCandidates().find((x) => x.costumeId === 101301)!;
    expect(c).toBeDefined();
    expect(c.slot3.map((o) => o.skillId)).toEqual([101301311]);
    expect([...c.slot1, ...c.slot2].map((o) => o.skillId)).not.toContain(101301311);
  });
  test("unknown costume has empty slots", () => {
    expect(getEvolutionSlots(1)).toEqual({ slot1: [], slot2: [], slot3: [] });
  });
  test("every evolution's condition1 display text equals its skill's first condition in skills.json", () => {
    const stale: string[] = [];
    let checked = 0;
    for (const [cardId, evos] of Object.entries(characterEvolutions)) {
      for (const e of evos) {
        const skill = skillsById.get(e.skillId);
        expect(skill).toBeDefined();
        checked++;
        const want = skill!.conditionGroups[0]?.condition || undefined;
        if ((e.condition1 || undefined) !== want) stale.push(`${cardId}:${e.skillId} "${e.condition1}" != "${want}"`);
      }
    }
    expect(checked).toBe(631);
    expect(stale).toEqual([]);
  });

  // Needs the local game database; set UMAMUSUME_MDB_PATH to run it.
  const mdbPath = process.env.UMAMUSUME_MDB_PATH ?? "";
  const hasMdb = !!mdbPath && fs.existsSync(mdbPath);
  const mdbTest = hasMdb ? test : (test as unknown as { skip: typeof test }).skip;
  mdbTest("every rankings candidate matches the mdb for ranks 3, 5 and 7", async () => {
    // Read-only; bun:sqlite is imported lazily so the module typechecks without Bun's sqlite types.
    type Db = { query(sql: string): { all(): unknown[] }; close(): void };
    const { Database } = (await import("bun:sqlite" as string)) as { Database: new (path: string, opts: { readonly: boolean }) => Db };
    const db = new Database(mdbPath, { readonly: true });
    const rows = db.query("SELECT card_id, rank, skill_id FROM skill_upgrade_description").all() as { card_id: number; rank: number; skill_id: number }[];
    db.close();
    const expected = (cardId: number, rank: number) => rows.filter((r) => r.card_id === cardId && r.rank === rank).map((r) => r.skill_id).sort();
    const candidates = getRankingCandidates();
    expect(candidates.length).toBeGreaterThan(200);
    for (const c of candidates) {
      expect({ id: c.costumeId, slot1: c.slot1.map((o) => o.skillId).sort() }).toEqual({ id: c.costumeId, slot1: expected(c.costumeId, 3) });
      expect({ id: c.costumeId, slot2: c.slot2.map((o) => o.skillId).sort() }).toEqual({ id: c.costumeId, slot2: expected(c.costumeId, 5) });
      expect({ id: c.costumeId, slot3: c.slot3.map((o) => o.skillId).sort() }).toEqual({ id: c.costumeId, slot3: expected(c.costumeId, 7) });
    }
  });
});
