import type { CharacterIndexEntry } from "@/lib/api";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";

/** Create a typed, untrained veteran record for an owned character template. */
export function createCharacterVeteranTemplate(
  character: Pick<CharacterIndexEntry, "id" | "nameEn">,
): KyumaruVeteranItem {
  return {
    card_id: character.id,
    name: character.nameEn,
    trained_chara_id: character.id,
    speed: 0,
    stamina: 0,
    power: 0,
    guts: 0,
    wiz: 0,
    rank_score: 0,
    rank: 0,
    win_saddle_id_array: [],
  };
}
