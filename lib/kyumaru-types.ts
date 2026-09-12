// TypeScript definitions for Kyumaru Hachimi plugin payloads and exports.
// Based on kyumaru/FRONTEND_HANDOFF.md

export interface KyumaruSyncPayload {
  cards?: Record<string, number>; // support_card_id -> limit_break_count (0..4)
  umas?: Record<string, [number, number]>; // card_id -> [rarity (1..5), talent_level (1..7)]
}

export interface KyumaruCardItem {
  viewer_id?: number;
  support_card_id: number;
  exp?: number;
  limit_break_count: number;
  favorite_flag?: number;
  stock?: number;
  possess_time?: string;
  create_time?: string;
}

export interface KyumaruUmaItem {
  card_id: number;
  rarity: number;
  talent_level: number;
  create_time?: string;
  skill_data_array?: unknown[];
}

export interface KyumaruUserInfo {
  name: string;
  viewer_id: number;
  rank_score?: number;
  best_team_evaluation_point?: number;
  support_card_id_array?: number[];
}

export interface KyumaruInventoryDump {
  support_card_list: KyumaruCardItem[];
  card_list: KyumaruUmaItem[];
  user_info?: KyumaruUserInfo;
}

export interface KyumaruFactorInfo {
  factor_id: number;
  level?: number;
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

export interface KyumaruLearnedSkill {
  skill_id: number;
  level: number;
}

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
