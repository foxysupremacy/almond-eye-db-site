import { describe, expect, test } from "bun:test";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import { ALL_PARTNER_SECTIONS } from "@/lib/veterans/share/partner-codec";
import {
  aptitudeLetter,
  buildPartnerCardModel,
  computePartnerAffinity,
  ltbLabel,
  visiblePartnerSections,
} from "./partner-card-model";

const VET = {
  card_id: 111401,
  rank: 81,
  rank_score: 57000,
  rarity: 4,
  talent_level: 5,
  speed: 2187,
  stamina: 1551,
  power: 1551,
  guts: 950,
  wiz: 1243,
  proper_ground_turf: 7,
  proper_ground_dirt: 4,
  proper_distance_short: 1,
  proper_distance_mile: 7,
  proper_distance_middle: 7,
  proper_distance_long: 8,
  proper_running_style_nige: 1,
  proper_running_style_senko: 7,
  proper_running_style_sashi: 8,
  proper_running_style_oikomi: 7,
  skill_array: [
    { skill_id: 200012, level: 1 },
    { skill_id: 111401111, level: 1 },
  ],
  factor_info_array: [{ factor_id: 203, level: 0 }, { factor_id: 2402, level: 0 }],
  win_saddle_id_array: [11, 99999],
  support_card_list: [
    { position: 2, support_card_id: 30290, limit_break_count: 1 },
    { position: 1, support_card_id: 30242, limit_break_count: 4 },
  ],
  succession_chara_array: [
    { position_id: 10, card_id: 106201, factor_info_array: [{ factor_id: 101 }], win_saddle_id_array: [11] },
    { position_id: 20, card_id: 100101, factor_info_array: [] },
  ],
} as unknown as KyumaruVeteranItem;

describe("partner card model", () => {
  test("labels", () => {
    expect([1, 4, 7, 8].map(aptitudeLetter)).toEqual(["G", "D", "A", "S"]);
    expect(aptitudeLetter(undefined)).toBe("G");
    expect([0, 1, 3, 4].map(ltbLabel)).toEqual(["0 LB", "1 LB", "3 LB", "MLB"]);
  });

  test("builds header, stats and aptitudes", () => {
    const m = buildPartnerCardModel(VET);
    expect(m.cardId).toBe(111401);
    expect(m.nameEn.length).toBeGreaterThan(0);
    expect(m.rankIconSrc).toBe("/assets/statusrank/utx_ico_statusrank_81.png");
    expect(m.stats.map((s) => s.value)).toEqual([2187, 1551, 1551, 950, 1243]);
    expect(m.aptitudes.surface.map((a) => a.grade)).toEqual(["A", "D"]);
    expect(m.aptitudes.distance.map((a) => a.grade)).toEqual(["G", "A", "A", "S"]);
    expect(m.aptitudes.style.map((a) => a.grade)).toEqual(["G", "A", "S", "A"]);
  });

  test("orders support cards by deck position and names them", () => {
    const m = buildPartnerCardModel(VET);
    expect(m.supportCards.map((c) => [c.id, c.lbLabel])).toEqual([
      [30242, "MLB"],
      [30290, "1 LB"],
    ]);
    expect(m.supportCards[0].nameEn).toBe("Almond Eye");
  });

  test("keeps every skill, unknown ids fall back to a placeholder name", () => {
    const m = buildPartnerCardModel(VET);
    expect(m.skills.map((s) => s.id).sort()).toEqual([111401111, 200012].sort());
    for (const s of m.skills) expect(s.nameEn.length).toBeGreaterThan(0);
  });

  test("groups sparks for the uma and its two parents", () => {
    const m = buildPartnerCardModel(VET);
    expect(m.sparks.map((g) => g.owner)).toEqual(["self", "parent1", "parent2"]);
    expect(m.sparks[0].blue.map((f) => f.factorId)).toEqual([203]);
    expect(m.sparks[0].pink.map((f) => f.factorId)).toEqual([2402]);
    expect(m.sparks[1].blue.map((f) => f.factorId)).toEqual([101]);
  });

  test("lists named G1 wins and drops unknown saddles", () => {
    const m = buildPartnerCardModel(VET);
    expect(m.wins.map((w) => w.id)).toEqual([11]);
    expect(m.wins[0].name.length).toBeGreaterThan(0);
  });

  test("absent data yields empty sections", () => {
    const bare = { ...VET, skill_array: undefined, support_card_list: undefined, factor_info_array: undefined, win_saddle_id_array: undefined, succession_chara_array: undefined } as KyumaruVeteranItem;
    const m = buildPartnerCardModel(bare);
    expect(m.skills).toEqual([]);
    expect(m.supportCards).toEqual([]);
    expect(m.wins).toEqual([]);
    expect(m.sparks).toEqual([]);
  });

  test("visible sections = shared minus hidden, in canonical order", () => {
    expect(visiblePartnerSections(["wins", "skills"], new Set())).toEqual(["skills", "wins"]);
    expect(visiblePartnerSections([...ALL_PARTNER_SECTIONS], new Set(["skills", "affinity"]))).toEqual(["support-cards", "sparks", "wins"]);
  });

  test("affinity against a trainee counts race bonus from shared wins", () => {
    const result = computePartnerAffinity(VET, 1001);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(result!.base + result!.raceBonus);
    expect(result!.raceBonus).toBeGreaterThanOrEqual(0);
    expect(computePartnerAffinity(VET, null)).toBeNull();
  });
});

describe("partner card sparks use the site's skill names", () => {
  test("a Global-named skill spark shows the JP-server translation", () => {
    const vet = { ...VET, factor_info_array: [{ factor_id: 2003602, level: 0 }] } as KyumaruVeteranItem;
    expect(buildPartnerCardModel(vet).sparks[0].white.map((f) => f.name)).toEqual(["Straight Adept"]);
  });
});
