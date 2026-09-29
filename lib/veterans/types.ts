/** Persisted Kyumaru veteran data shared by import, storage, and lineage domains. */
export interface KyumaruFactorInfo {
  factor_id: number;
  level?: number;
}

export interface KyumaruLearnedSkill {
  skill_id: number;
  level: number;
}

/**
 * Veteran records are stored in IndexedDB and embedded in parenting state.
 * Keep these field names aligned with Kyumaru's serialized payload.
 */
export interface KyumaruVeteranItem {
  trained_chara_id?: number;
  owner_trained_chara_id?: number;
  use_type?: number;
  card_id: number;
  name?: string | null;
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wiz: number;
  fans?: number;
  rank_score: number;
  rank: number;
  proper_distance_short?: number;
  proper_distance_mile?: number;
  proper_distance_middle?: number;
  proper_distance_long?: number;
  proper_running_style_nige?: number;
  proper_running_style_senko?: number;
  proper_running_style_sashi?: number;
  proper_running_style_oikomi?: number;
  proper_ground_turf?: number;
  proper_ground_dirt?: number;
  succession_num?: number;
  is_locked?: number;
  rarity?: number;
  talent_level?: number;
  chara_grade?: number;
  running_style?: number;
  nickname_id?: number;
  wins?: number;
  total_skill_pt?: number;
  skill_array?: KyumaruLearnedSkill[];
  support_card_list?: unknown[];
  is_saved?: number;
  race_result_list?: unknown[];
  win_saddle_id_array?: number[];
  nickname_id_array?: number[];
  factor_info_array?: KyumaruFactorInfo[];
  factor_extend_array?: unknown[];
  succession_chara_array?: KyumaruSuccessionChara[];
  scenario_data_array?: unknown[];
  scenario_id?: number;
  create_time?: string;
}

export interface KyumaruSuccessionChara {
  position_id: number;
  card_id: number;
  rank?: number;
  rarity?: number;
  talent_level?: number;
  factor_info_array?: KyumaruFactorInfo[];
  win_saddle_id_array?: number[];
  user_info_summary?: unknown;
}
