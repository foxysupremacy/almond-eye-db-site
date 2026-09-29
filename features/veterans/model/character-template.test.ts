import { describe, expect, test } from "bun:test";
import { createCharacterVeteranTemplate } from "./character-template";

describe("character veteran template", () => {
  test("creates a complete, typed untrained record from a character choice", () => {
    expect(createCharacterVeteranTemplate({ id: 100101, nameEn: "Special Week" })).toEqual({
      card_id: 100101,
      name: "Special Week",
      trained_chara_id: 100101,
      speed: 0,
      stamina: 0,
      power: 0,
      guts: 0,
      wiz: 0,
      rank_score: 0,
      rank: 0,
      win_saddle_id_array: [],
    });
  });
});
