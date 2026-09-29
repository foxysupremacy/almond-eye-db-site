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

export type {
  KyumaruFactorInfo,
  KyumaruLearnedSkill,
  KyumaruSuccessionChara,
  KyumaruVeteranItem,
} from "../types";

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
