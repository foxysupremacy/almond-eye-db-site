import { describe, expect, test } from "bun:test";
import { DEFAULT_PARENTING_SETUP } from "./parenting-state";
import { buildVisualizerSkillPools, getVisualizerOriginOrder, matchesVisualizerFilter, type VisualizerSkill, type VisualizerSkillOrigin } from "./visualizer-skills";

describe("buildVisualizerSkillPools", () => {
  test("adds the exact trainee costume Unique and EVO candidates to Main", () => {
    const pools = buildVisualizerSkillPools({
      mainSkills: [],
      parentSkills: [],
      setup: {
        ...DEFAULT_PARENTING_SETUP,
        targetCharaId: 1033,
        targetCharaCardId: 103302,
      },
    });

    expect(pools.main.find((s) => s.id === 110331)?.filterCategory).toBe("unique");
    const evoCandidateIds = pools.main.filter((s) => s.filterCategory === "evolved").map((s) => s.id).sort();
    expect(evoCandidateIds).toEqual([103302111, 103302211]);
    expect(pools.main.find((s) => s.id === 103302111)?.origins[0].evolvedFrom?.id).toBe(203341);
    expect(pools.main.find((s) => s.id === 103302211)?.origins[0].evolvedFrom?.id).toBe(203171);
    expect(pools.main.some((s) => s.id === 103301111)).toBe(false);
  });

  test("falls back to the selected base character when the exact costume is missing", () => {
    const pools = buildVisualizerSkillPools({
      mainSkills: [],
      parentSkills: [],
      setup: {
        ...DEFAULT_PARENTING_SETUP,
        targetCharaId: 1033,
        targetCharaCardId: null,
      },
    });
    expect(pools.main.find((s) => s.id === 110331)?.filterCategory).toBe("unique");
    expect(pools.main.filter((s) => s.filterCategory === "evolved").map((s) => s.id).sort()).toEqual([103302111, 103302211]);
  });

  test("always adds mapped inherited uniques from both parents and all grandparents", () => {
    const pools = buildVisualizerSkillPools({
      mainSkills: [],
      parentSkills: [],
      setup: {
        ...DEFAULT_PARENTING_SETUP,
        parent1: {
          card_id: 100101,
          succession_chara_array: [
            { position_id: 10, card_id: 100201 },
            { position_id: 20, card_id: 100301 },
          ],
        } as never,
        parent2: { card_id: 100401 } as never,
        gpOverrides: {
          p2_gp1: { card_id: 100101 },
          p2_gp2: { card_id: 100201 },
        },
      },
    });

    const parentSkillIds = pools.parent.map((s) => s.id).sort();
    expect(parentSkillIds).toEqual([900011, 900021, 900031, 900041]);
    expect(pools.main.map((s) => s.id).sort()).toEqual([900011, 900021, 900031, 900041]);
    expect(pools.parent.find((s) => s.id === 900011)?.filterCategory).toBe("unique");
    expect(pools.parent.find((s) => s.id === 900011)?.rarity).toBe(1);
    const origins = pools.parent.find((s) => s.id === 900011)?.origins ?? [];
    expect(origins.some((o) => o.slotLabel === "Parent 1" && o.availability === "guaranteed")).toBe(true);
    expect(origins.some((o) => o.slotLabel === "P2 - GP1" && o.availability === "possible")).toBe(true);
    const mainOrigins = pools.main.find((s) => s.id === 900011)?.origins ?? [];
    expect(mainOrigins).toHaveLength(2);
  });

  test("keeps valid skills when another lineage slot cannot resolve", () => {
    const pools = buildVisualizerSkillPools({
      mainSkills: [],
      parentSkills: [],
      setup: {
        ...DEFAULT_PARENTING_SETUP,
        parent1: { card_id: 100101 } as never,
        parent2: { card_id: 999999 } as never,
      },
    });
    expect(pools.parent.map((s) => s.id)).toContain(900011);
  });

  test("adds each direct parent's Succession EVO as an evolved planning candidate", () => {
    const cases = [
      { cardId: 110902, skillId: 92111091, name: "Rhein Kraft", parentKey: "parent1", slotLabel: "Parent 1" },
      { cardId: 113501, skillId: 91101351, name: "Stay Gold", parentKey: "parent2", slotLabel: "Parent 2" },
      { cardId: 114101, skillId: 91101411, name: "Epiphaneia", parentKey: "parent1", slotLabel: "Parent 1" },
    ];

    for (const entry of cases) {
      const pools = buildVisualizerSkillPools({
        mainSkills: [],
        parentSkills: [],
        setup: {
          ...DEFAULT_PARENTING_SETUP,
          [entry.parentKey]: { card_id: entry.cardId } as never,
        },
      });

      const successionEvo = pools.parent.find((skill) => skill.id === entry.skillId);
      expect(successionEvo?.filterCategory).toBe("evolved");
      expect(successionEvo?.origins).toEqual([
        {
          kind: "parent-succession-evo",
          label: `${entry.name} · ${entry.slotLabel} Succession EVO`,
          slotLabel: entry.slotLabel,
          availability: "candidate",
          cardId: entry.cardId,
        },
      ]);
      expect(matchesVisualizerFilter(successionEvo!, "evolved")).toBe(true);
    }
  });

  test("does not add a Succession EVO when the special character is only a grandparent", () => {
    const pools = buildVisualizerSkillPools({
      mainSkills: [],
      parentSkills: [],
      setup: {
        ...DEFAULT_PARENTING_SETUP,
        parent1: { card_id: 100101 } as never,
        gpOverrides: {
          p1_gp1: { card_id: 114101 },
        },
      },
    });

    expect(pools.parent.some((skill) => skill.id === 91101411)).toBe(false);
  });

  test("returns empty pools with no setup", () => {
    const pools = buildVisualizerSkillPools({
      mainSkills: [],
      parentSkills: [],
      setup: DEFAULT_PARENTING_SETUP,
    });
    expect(pools.main).toEqual([]);
    expect(pools.parent).toEqual([]);
  });
});

describe("matchesVisualizerFilter", () => {
  test("filters an inherited white Unique by its Visualizer category", () => {
    const inherited = buildVisualizerSkillPools({
      mainSkills: [],
      parentSkills: [],
      setup: {
        ...DEFAULT_PARENTING_SETUP,
        parent1: { card_id: 100101 } as never,
      },
    }).parent.find((s) => s.id === 900011)!;

    expect(inherited.rarity).toBe(1);
    expect(matchesVisualizerFilter(inherited, "unique")).toBe(true);
    expect(matchesVisualizerFilter(inherited, "white")).toBe(false);
    expect(matchesVisualizerFilter(inherited, "all")).toBe(true);
  });
});

describe("getVisualizerOriginOrder", () => {
  const skill = (origins: VisualizerSkillOrigin[]): VisualizerSkill => ({
    id: 1,
    nameEn: "Test",
    nameJp: "テスト",
    rarity: 1,
    filterCategory: "unique",
    origins,
  });

  test("orders trainee, parents, and grandparents in lineage order", () => {
    expect(getVisualizerOriginOrder(skill([{ kind: "grandparent-unique", label: "GP", slotLabel: "P2 - GP2", availability: "possible" }]))).toBe(6);
    expect(getVisualizerOriginOrder(skill([
      { kind: "grandparent-unique", label: "GP", slotLabel: "P1 - GP1", availability: "possible" },
      { kind: "parent-unique", label: "Parent", slotLabel: "Parent 1", availability: "guaranteed" },
    ]))).toBe(1);
    expect(getVisualizerOriginOrder(skill([{ kind: "trainee-unique", label: "Trainee", availability: "owned" }]))).toBe(0);
  });
});
