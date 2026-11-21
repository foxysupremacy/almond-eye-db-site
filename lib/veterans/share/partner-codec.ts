// Partner Card share codec: one trained uma packed into a URL-safe string.
//
// Wire format: versioned compact JSON → raw DEFLATE → unpadded base64url.
// The payload deliberately carries no account identity (viewer ids, trained
// chara ids, trainer names, friend summaries). Sections the sharer turns off
// are omitted from the payload, not merely hidden.

import { deflateToBase64Url, inflateFromBase64Url } from "../../share-link/deflate";
import type {
  KyumaruFactorInfo,
  KyumaruLearnedSkill,
  KyumaruSuccessionChara,
  KyumaruVeteranItem,
  KyumaruVeteranSupportCard,
} from "../types";

export const PARTNER_CODEC_VERSION = 1;

export const ALL_PARTNER_SECTIONS = ["support-cards", "skills", "sparks", "affinity", "wins"] as const;
export type PartnerSection = (typeof ALL_PARTNER_SECTIONS)[number];

export interface SharedPartner {
  readonly veteran: KyumaruVeteranItem;
  readonly sections: PartnerSection[];
}

const SECTION_BIT: Record<PartnerSection, number> = {
  "support-cards": 1,
  skills: 2,
  sparks: 4,
  affinity: 8,
  wins: 16,
};

const APTITUDE_FIELDS = [
  "proper_ground_turf",
  "proper_ground_dirt",
  "proper_distance_short",
  "proper_distance_mile",
  "proper_distance_middle",
  "proper_distance_long",
  "proper_running_style_nige",
  "proper_running_style_senko",
  "proper_running_style_sashi",
  "proper_running_style_oikomi",
] as const;

const MAX_ID = 2_147_483_647; // int32; evolved skill ids are 9 digits
const MAX_LIST = 200;

type Pair = [number, number];

interface WireSuccession {
  p: number;
  c: number;
  rk?: number;
  r?: number;
  t?: number;
  f?: Pair[];
  w?: number[];
}

interface WirePayload {
  v: number;
  s: number;
  c: number;
  r?: number;
  t?: number;
  rk?: number;
  rs?: number;
  rn?: number;
  sc?: number;
  st: number[];
  ap: number[];
  sk?: Pair[];
  f?: Pair[];
  w?: number[];
  cd?: [number, number, number][];
  g?: WireSuccession[];
}

export function sectionsToMask(sections: readonly PartnerSection[]): number {
  return sections.reduce((mask, section) => mask | SECTION_BIT[section], 0);
}

export function maskToSections(mask: number): PartnerSection[] {
  return ALL_PARTNER_SECTIONS.filter((section) => (mask & SECTION_BIT[section]) !== 0);
}

const factorPairs = (factors: KyumaruFactorInfo[] | undefined): Pair[] =>
  (factors ?? []).map((f) => [f.factor_id, f.level ?? 0]);

export async function encodePartner(vet: KyumaruVeteranItem, sections: readonly PartnerSection[]): Promise<string> {
  const has = (section: PartnerSection) => sections.includes(section);
  const needsSaddles = has("affinity") || has("wins");
  const needsLineage = has("affinity") || has("sparks");

  const payload: WirePayload = {
    v: PARTNER_CODEC_VERSION,
    s: sectionsToMask(sections),
    c: vet.card_id,
    r: vet.rarity,
    t: vet.talent_level,
    rk: vet.rank,
    rs: vet.rank_score,
    rn: vet.running_style,
    sc: vet.scenario_id,
    st: [vet.speed, vet.stamina, vet.power, vet.guts, vet.wiz],
    ap: APTITUDE_FIELDS.map((field) => vet[field] ?? 1),
  };
  if (has("skills")) payload.sk = (vet.skill_array ?? []).map((s) => [s.skill_id, s.level]);
  if (has("sparks")) payload.f = factorPairs(vet.factor_info_array);
  if (needsSaddles) payload.w = [...(vet.win_saddle_id_array ?? [])];
  if (has("support-cards")) {
    payload.cd = (vet.support_card_list ?? []).map((c) => [c.position, c.support_card_id, c.limit_break_count]);
  }
  if (needsLineage) {
    payload.g = (vet.succession_chara_array ?? []).map((s) => {
      const entry: WireSuccession = { p: s.position_id, c: s.card_id, rk: s.rank, r: s.rarity, t: s.talent_level };
      if (has("sparks")) entry.f = factorPairs(s.factor_info_array);
      if (has("affinity")) entry.w = [...(s.win_saddle_id_array ?? [])];
      return entry;
    });
  }
  return deflateToBase64Url(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const optInt = (value: unknown, min: number, max: number) => value === undefined || isInt(value, min, max);

const isIntList = (value: unknown, min: number, max: number, maxLength = MAX_LIST): value is number[] =>
  Array.isArray(value) && value.length <= maxLength && value.every((v) => isInt(v, min, max));

const isPairList = (value: unknown, maxSecond: number): value is Pair[] =>
  Array.isArray(value) &&
  value.length <= MAX_LIST &&
  value.every((p) => Array.isArray(p) && p.length === 2 && isInt(p[0], 1, MAX_ID) && isInt(p[1], 0, maxSecond));

function isSuccession(value: unknown): value is WireSuccession {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    isInt(s.p, 0, 99) &&
    isInt(s.c, 1, MAX_ID) &&
    optInt(s.rk, 0, 999) &&
    optInt(s.r, 0, 10) &&
    optInt(s.t, 0, 10) &&
    (s.f === undefined || isPairList(s.f, 99)) &&
    (s.w === undefined || isIntList(s.w, 0, MAX_ID))
  );
}

function isWirePayload(value: unknown): value is WirePayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    p.v === PARTNER_CODEC_VERSION &&
    isInt(p.s, 0, 31) &&
    isInt(p.c, 1, MAX_ID) &&
    optInt(p.r, 0, 10) &&
    optInt(p.t, 0, 10) &&
    optInt(p.rk, 0, 999) &&
    optInt(p.rs, 0, 10_000_000) &&
    optInt(p.rn, 0, 10) &&
    optInt(p.sc, 0, 999) &&
    isIntList(p.st, 0, 9_999, 5) &&
    (p.st as number[]).length === 5 &&
    isIntList(p.ap, 1, 8, 10) &&
    (p.ap as number[]).length === 10 &&
    (p.sk === undefined || isPairList(p.sk, 99)) &&
    (p.f === undefined || isPairList(p.f, 99)) &&
    (p.w === undefined || isIntList(p.w, 0, MAX_ID)) &&
    (p.cd === undefined ||
      (Array.isArray(p.cd) &&
        p.cd.length <= 6 &&
        p.cd.every((c) => Array.isArray(c) && c.length === 3 && isInt(c[0], 0, 9) && isInt(c[1], 1, MAX_ID) && isInt(c[2], 0, 4)))) &&
    (p.g === undefined || (Array.isArray(p.g) && p.g.length <= 6 && p.g.every(isSuccession)))
  );
}

const toFactors = (pairs: Pair[] | undefined): KyumaruFactorInfo[] | undefined =>
  pairs?.map(([factor_id, level]) => ({ factor_id, level }));

export async function decodePartner(code: string): Promise<SharedPartner | null> {
  if (!code) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(await inflateFromBase64Url(code));
  } catch {
    return null;
  }
  if (!isWirePayload(payload)) return null;

  const [speed, stamina, power, guts, wiz] = payload.st;
  const veteran: KyumaruVeteranItem = {
    card_id: payload.c,
    rarity: payload.r,
    talent_level: payload.t,
    rank: payload.rk ?? 0,
    rank_score: payload.rs ?? 0,
    running_style: payload.rn,
    scenario_id: payload.sc,
    speed,
    stamina,
    power,
    guts,
    wiz,
  };
  APTITUDE_FIELDS.forEach((field, i) => {
    veteran[field] = payload.ap[i];
  });
  if (payload.sk) veteran.skill_array = payload.sk.map(([skill_id, level]): KyumaruLearnedSkill => ({ skill_id, level }));
  if (payload.f) veteran.factor_info_array = toFactors(payload.f);
  if (payload.w) veteran.win_saddle_id_array = payload.w;
  if (payload.cd) {
    veteran.support_card_list = payload.cd.map(
      ([position, support_card_id, limit_break_count]): KyumaruVeteranSupportCard => ({ position, support_card_id, limit_break_count })
    );
  }
  if (payload.g) {
    veteran.succession_chara_array = payload.g.map((g): KyumaruSuccessionChara => {
      const entry: KyumaruSuccessionChara = { position_id: g.p, card_id: g.c };
      if (g.rk !== undefined) entry.rank = g.rk;
      if (g.r !== undefined) entry.rarity = g.r;
      if (g.t !== undefined) entry.talent_level = g.t;
      if (g.f) entry.factor_info_array = toFactors(g.f);
      if (g.w) entry.win_saddle_id_array = g.w;
      return entry;
    });
  }
  return { veteran, sections: maskToSections(payload.s) };
}
