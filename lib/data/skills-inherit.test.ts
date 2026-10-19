import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import { skillsById, skillsInherit } from "./registry";
import fixture from "./fixtures/mdb-skill-data-inherit.json";
import { mdbActivation, mdbConditionGroups, readInheritRows, type MdbLike, type MdbRow } from "../../scripts/inherit-skill-triggers";

const inherit = (id: number) => skillsInherit.find((s) => s.id === id);
const HEAL = 9;
const healGroups = (id: number) => (inherit(id)?.conditionGroups ?? []).filter((g) => g.effects.some((e) => e.type === HEAL));

describe("skills-inherit.json: instant (zero-duration) triggers are kept", () => {
  for (const id of [900451, 900521, 910111, 920251]) {
    test(`${id} has at least one trigger, including its instant heal`, () => {
      expect(inherit(id)?.conditionGroups.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(healGroups(id).length).toBeGreaterThanOrEqual(1);
      expect(healGroups(id).every((g) => g.base_time === 0)).toBe(true);
    });
  }

  test("920451 keeps both details, the second being its heal", () => {
    const groups = inherit(920451)!.conditionGroups;
    expect(groups.length).toBe(2);
    expect(groups[1]).toEqual({ condition: "phase==1&corner!=0&order_rate>=20&order_rate<=50", precondition: null, base_time: 0, effects: [{ type: HEAL, value: 150 }] });
  });

  test("901021's first slot is the mdb's first detail (heal), not the speed detail", () => {
    const [g1, g2] = inherit(901021)!.conditionGroups;
    expect(g1.condition?.startsWith("distance_rate<=50&order_rate>=40&order_rate<=80&")).toBe(true);
    expect(g1.base_time).toBe(0);
    expect(g1.effects).toEqual([{ type: HEAL, value: 35 }]);
    expect(g2.condition).toBe("distance_rate<=60&distance_rate>=45&corner==0&is_activate_other_skill_detail==1");
    expect(g2.effects).toEqual([{ type: 27, value: 2500 }]);
  });

  test("every inherited unique carries activation (activate_lot)", () => {
    expect(skillsInherit.length).toBe(274);
    expect(skillsInherit.every((s) => s.activation === 1)).toBe(true);
  });

  test("the registry exposes the inherited skills by id", () => {
    expect(skillsById.get(900451)?.conditionGroups.length).toBeGreaterThan(0);
  });
});

describe("skills-inherit.json matches skill_data (fixture spot-check)", () => {
  for (const row of fixture.rows as MdbRow[]) {
    test(`${row.id}: triggers and activation equal the mdb row`, () => {
      const s = inherit(Number(row.id))!;
      expect(s.conditionGroups).toEqual(mdbConditionGroups(row) as never);
      expect(s.activation).toBe(mdbActivation(row));
    });
  }
});

describe("skills-inherit.json matches skill_data (all rows)", () => {
  // Needs the local game database; set UMAMUSUME_MDB_PATH to run it.
  const mdbPath = process.env.UMAMUSUME_MDB_PATH ?? "";
  const hasMdb = !!mdbPath && fs.existsSync(mdbPath);
  const mdbTest = hasMdb ? test : (test as unknown as { skip: typeof test }).skip;
  mdbTest("every inherited unique's triggers equal skill_data for its id", async () => {
    // Read-only; bun:sqlite is imported lazily so the module typechecks without Bun's sqlite types.
    const { Database } = (await import("bun:sqlite" as string)) as { Database: new (p: string, o: { readonly: boolean }) => MdbLike & { close(): void } };
    const db = new Database(mdbPath, { readonly: true });
    const rows = readInheritRows(db);
    db.close();
    expect(rows.length).toBe(skillsInherit.length);
    for (const row of rows) {
      const s = inherit(Number(row.id));
      expect({ id: row.id, groups: s?.conditionGroups, activation: s?.activation })
        .toEqual({ id: row.id, groups: mdbConditionGroups(row) as never, activation: mdbActivation(row) });
    }
  });
});
