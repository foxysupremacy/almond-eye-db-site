import { describe, expect, test } from "bun:test";
import type { KyumaruVeteranItem } from "../types";
import { deflateToBase64Url } from "../../share-link/deflate";
import {
  ALL_PARTNER_SECTIONS,
  PARTNER_CODEC_VERSION,
  decodePartner,
  encodePartner,
  type PartnerSection,
} from "./partner-codec";

const VETERAN = {
  viewer_id: 408582049,
  trained_chara_id: 469,
  owner_viewer_id: 0,
  name: "Secret trainer",
  card_id: 111401,
  speed: 2187,
  stamina: 1551,
  power: 1551,
  guts: 950,
  wiz: 1243,
  rank_score: 57000,
  rank: 81,
  rarity: 4,
  talent_level: 5,
  running_style: 4,
  scenario_id: 13,
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
    { skill_id: 101141, level: 5 },
    { skill_id: 200012, level: 1 },
    { skill_id: 111401111, level: 1 }, // evolved skills use 9-digit ids
  ],
  factor_info_array: [
    { factor_id: 202, level: 0 },
    { factor_id: 2202, level: 0 },
  ],
  win_saddle_id_array: [11, 12, 33],
  support_card_list: [
    { position: 1, support_card_id: 30242, limit_break_count: 4, exp: 118185, is_rental: 0 },
    { position: 2, support_card_id: 30290, limit_break_count: 1, exp: 37785, is_rental: 1 },
  ],
  succession_chara_array: [
    {
      position_id: 10,
      card_id: 106201,
      rank: 72,
      rarity: 3,
      talent_level: 1,
      factor_info_array: [{ factor_id: 203, level: 0 }],
      win_saddle_id_array: [11],
      user_info_summary: { viewer_id: 123, name: "Someone" },
    },
    {
      position_id: 20,
      card_id: 100101,
      factor_info_array: [{ factor_id: 101, level: 0 }],
      win_saddle_id_array: [12],
    },
  ],
} as unknown as KyumaruVeteranItem;

async function roundTrip(sections: readonly PartnerSection[] = ALL_PARTNER_SECTIONS) {
  const code = await encodePartner(VETERAN, sections);
  const decoded = await decodePartner(code);
  if (!decoded) throw new Error("decode failed");
  return { code, decoded };
}

describe("partner codec", () => {
  test("round-trips header, skills, sparks, wins, cards and grandparents", async () => {
    const { decoded } = await roundTrip();
    const v = decoded.veteran;
    expect(decoded.sections).toEqual([...ALL_PARTNER_SECTIONS]);
    expect(v.card_id).toBe(111401);
    expect([v.speed, v.stamina, v.power, v.guts, v.wiz]).toEqual([2187, 1551, 1551, 950, 1243]);
    expect(v.rank).toBe(81);
    expect(v.rank_score).toBe(57000);
    expect(v.proper_distance_long).toBe(8);
    expect(v.proper_running_style_nige).toBe(1);
    expect(v.skill_array).toEqual(VETERAN.skill_array!);
    expect(v.factor_info_array).toEqual(VETERAN.factor_info_array!);
    expect(v.win_saddle_id_array).toEqual([11, 12, 33]);
    expect(v.support_card_list).toEqual([
      { position: 1, support_card_id: 30242, limit_break_count: 4 },
      { position: 2, support_card_id: 30290, limit_break_count: 1 },
    ]);
    expect(v.succession_chara_array?.map((s) => [s.position_id, s.card_id])).toEqual([
      [10, 106201],
      [20, 100101],
    ]);
    expect(v.succession_chara_array?.[0].win_saddle_id_array).toEqual([11]);
    expect(v.succession_chara_array?.[0].factor_info_array).toEqual([{ factor_id: 203, level: 0 }]);
  });

  test("never encodes account identity", async () => {
    const { decoded, code } = await roundTrip();
    const json = JSON.stringify(decoded);
    for (const leaked of ["408582049", "Secret trainer", "Someone", "viewer_id", "trained_chara_id", "user_info_summary"]) {
      expect(json).not.toContain(leaked);
    }
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("excluded sections are absent from the payload", async () => {
    const { decoded } = await roundTrip(["skills"]);
    const v = decoded.veteran;
    expect(decoded.sections).toEqual(["skills"]);
    expect(v.skill_array?.length).toBe(3);
    expect(v.support_card_list).toBeUndefined();
    expect(v.factor_info_array).toBeUndefined();
    expect(v.win_saddle_id_array).toBeUndefined();
    expect(v.succession_chara_array).toBeUndefined();
  });

  test("affinity keeps saddles and grandparents but not sparks", async () => {
    const { decoded } = await roundTrip(["affinity"]);
    const v = decoded.veteran;
    expect(v.win_saddle_id_array).toEqual([11, 12, 33]);
    expect(v.succession_chara_array?.[0].win_saddle_id_array).toEqual([11]);
    expect(v.succession_chara_array?.[0].factor_info_array).toBeUndefined();
    expect(v.factor_info_array).toBeUndefined();
  });

  test("rejects garbage, wrong versions and out-of-range fields", async () => {
    expect(await decodePartner("")).toBeNull();
    expect(await decodePartner("not base64 !!")).toBeNull();
    expect(await decodePartner("AAAA")).toBeNull();

    const valid = JSON.parse(JSON.stringify({ v: PARTNER_CODEC_VERSION, s: 1, c: 111401, st: [1, 1, 1, 1, 1], ap: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }));
    expect(await decodePartner(await deflateToBase64Url(JSON.stringify(valid)))).not.toBeNull();
    expect(await decodePartner(await deflateToBase64Url(JSON.stringify({ ...valid, v: 99 })))).toBeNull();
    expect(await decodePartner(await deflateToBase64Url(JSON.stringify({ ...valid, c: -5 })))).toBeNull();
    expect(await decodePartner(await deflateToBase64Url(JSON.stringify({ ...valid, ap: [9, 1, 1, 1, 1, 1, 1, 1, 1, 1] })))).toBeNull();
    expect(await decodePartner(await deflateToBase64Url(JSON.stringify({ ...valid, sk: [["x", 1]] })))).toBeNull();
    expect(await decodePartner(await deflateToBase64Url("[1,2,3]"))).toBeNull();
  });

  test("stays small enough for a URL", async () => {
    const { code } = await roundTrip();
    expect(code.length).toBeLessThan(1000);
  });
});
