// State persistence and URL serialization for the Parenting Hub.
// Manages Trainee, Parents, Grandparent overrides, and Parent Support Deck slots.

import type { KyumaruVeteranItem } from "../veterans/types";
import { APTITUDE_KEYS, DEFAULT_APTITUDE_GOALS, LOOP_ANCESTOR_SLOTS, LOOP_UMA_SLOTS, FARM_APTITUDES, GGGP_SPARK_SLOTS, PARENT_WHITE_TARGET_SLOTS } from "./loop-planner";
import { extractSlotPrimaryFactors } from "../lineage/factor-decoder";
import {
  readJsonStorage,
  writeJsonStorage,
  notifyLocalUpdate,
} from "../storage/persistence";

export interface GrandparentSlot {
  card_id: number;
  name?: string;
  rank?: number;
  rarity?: number;
  win_saddle_id_array?: number[];
  trained_chara_id?: number;
  factor_info_array?: { factor_id: number }[];
  isBorrow?: boolean;
}

export interface ParentingSetup {
  targetCharaId: number | null;
  targetCharaCardId: number | null;
  parent1: KyumaruVeteranItem | null;
  parent2: KyumaruVeteranItem | null;
  p1IsBorrow?: boolean;
  p2IsBorrow?: boolean;
  gpOverrides: {
    p1_gp1?: GrandparentSlot | null;
    p1_gp2?: GrandparentSlot | null;
    p2_gp1?: GrandparentSlot | null;
    p2_gp2?: GrandparentSlot | null;
  };
  supportCardIds: (number | null)[];
  loopConfig?: import("./loop-planner").ParentingLoopConfig;
}

export type PickerSlotKey = import("./loop-planner").LoopAncestorSlot;

export interface RunBorrowState {
  /** True when this run's single friend-borrow slot is already occupied. */
  used: boolean;
  /** Human label of the run the slot belongs to ("Target run", "P1 training run", …). */
  runLabel: string;
}

/**
 * "1 friend borrow per training run" accounting. Each pedigree slot belongs to
 * one training run, and each run allows exactly one borrow:
 * - Target run: the P1/P2 slots share one borrow.
 * - P1's run: P1's two grandparent slots share one borrow (same for P2's run).
 * Display-only — selection is never blocked.
 */
export function getRunBorrowState(
  setup: ParentingSetup,
  slotKey: PickerSlotKey
): RunBorrowState {
  const isBorrowKey = (key?: string) => key?.startsWith("b:") ?? false;
  switch (slotKey) {
    case "p1":
      return { used: !!setup.p2IsBorrow, runLabel: "Target run" };
    case "p2":
      return { used: !!setup.p1IsBorrow, runLabel: "Target run" };
    case "p1_gp1":
      return { used: !!setup.gpOverrides.p1_gp2?.isBorrow, runLabel: "P1 training run" };
    case "p1_gp2":
      return { used: !!setup.gpOverrides.p1_gp1?.isBorrow, runLabel: "P1 training run" };
    case "p2_gp1":
      return { used: !!setup.gpOverrides.p2_gp2?.isBorrow, runLabel: "P2 training run" };
    case "p2_gp2":
      return { used: !!setup.gpOverrides.p2_gp1?.isBorrow, runLabel: "P2 training run" };
    default: {
      if (slotKey.split("_").length === 4) return { used: false, runLabel: "GGP spark inputs" };
      const parent = slotKey.slice(0, slotKey.lastIndexOf("_"));
      const donor = slotKey.slice(slotKey.lastIndexOf("_") + 1);
      const sibling = `${parent}_${donor === "g1" ? "g2" : "g1"}` as PickerSlotKey;
      const segments = parent.split("_");
      const familyPath = segments.length === 2
        ? `${segments[0].toUpperCase()} ${segments[1].toUpperCase()}`
        : segments.slice(1).map((part) => part.toUpperCase()).join(" ");
      return {
        used: isBorrowKey(setup.loopConfig?.lockedSlots[sibling]),
        runLabel: `${familyPath} training run`,
      };
    }
  }
}

export const DEFAULT_PARENTING_SETUP: ParentingSetup = {
  targetCharaId: null,
  targetCharaCardId: null,
  parent1: null,
  parent2: null,
  p1IsBorrow: false,
  p2IsBorrow: true,
  gpOverrides: {},
  supportCardIds: [null, null, null, null, null, null],
  loopConfig: { geneGoals: {}, aptitudeGoals: DEFAULT_APTITUDE_GOALS, selectedSlots: {}, lockedSlots: {}, includeTripleCrownAffinity: false, includeTiaraAffinity: false },
};

/**
 * Normalize a potentially incomplete parenting setup (e.g. from localStorage
 * or a legacy save) into a fully populated ParentingSetup with safe defaults.
 */
export function normalizeParentingSetup(parsed: Partial<ParentingSetup>): ParentingSetup {
  return {
    targetCharaId: typeof parsed.targetCharaId === "number" ? parsed.targetCharaId : null,
    targetCharaCardId: typeof parsed.targetCharaCardId === "number" ? parsed.targetCharaCardId : null,
    parent1: parsed.parent1 ?? null,
    parent2: parsed.parent2 ?? null,
    p1IsBorrow: parsed.p1IsBorrow ?? false,
    p2IsBorrow: parsed.p2IsBorrow ?? true,
    gpOverrides: parsed.gpOverrides ?? {},
    supportCardIds: Array.isArray(parsed.supportCardIds)
      ? parsed.supportCardIds
      : [null, null, null, null, null, null],
    loopConfig: normalizeLoopConfig(parsed.loopConfig),
  };
}

export function normalizeLoopConfig(value?: import("./loop-planner").ParentingLoopConfig, veterans: KyumaruVeteranItem[] = []): import("./loop-planner").ParentingLoopConfig {
  const validGeneGroups: Record<string, Set<number>> = {
    distance: new Set([50003, 50004, 50005, 50006]),
    surface: new Set([50001, 50002]),
    style: new Set([50007, 50008, 50009, 50010]),
  };
  const geneGoals: import("./loop-planner").ParentingLoopConfig["geneGoals"] = {};
  if (value?.geneGoals && typeof value.geneGoals === "object") {
    for (const [key, ids] of Object.entries(value.geneGoals)) {
      const allowed = validGeneGroups[key];
      if (allowed && Array.isArray(ids)) geneGoals[key as "distance" | "style" | "surface"] = ids.filter((id) => Number.isInteger(id) && allowed.has(id));
    }
  }
  const whiteFactorGoals: NonNullable<import("./loop-planner").ParentingLoopConfig["whiteFactorGoals"]> = {};
  const validWhiteFactors = new Set([50001, 50002, 50003, 50004, 50005, 50006, 50007, 50008, 50009, 50010]);
  for (const [id, stars] of Object.entries(value?.whiteFactorGoals ?? {})) {
    const factorGroupId = Number(id);
    if (validWhiteFactors.has(factorGroupId) && Number.isInteger(stars) && Number(stars) >= 1 && Number(stars) <= 3) {
      whiteFactorGoals[factorGroupId] = Number(stars);
    }
  }
  // Older saved plans used geneGoals without output rarity. Preserve those targets
  // as one-star white-factor goals when upgrading their local/share state.
  for (const ids of Object.values(geneGoals)) for (const id of ids ?? []) {
    if (!Object.prototype.hasOwnProperty.call(whiteFactorGoals, id)) whiteFactorGoals[id] = 1;
  }
  const aptitudeGoals: import("./loop-planner").ParentingLoopConfig["aptitudeGoals"] = { ...DEFAULT_APTITUDE_GOALS };
  const ranks = new Set(["G", "F", "E", "D", "C", "B", "A", "S"]);
  for (const aptitude of APTITUDE_KEYS) {
    const goal = value?.aptitudeGoals?.[aptitude];
    if (typeof goal === "string" && ranks.has(goal)) aptitudeGoals[aptitude] = goal;
  }
  const allowedSlots = new Set<string>(LOOP_ANCESTOR_SLOTS);
  const normalizeSlots = (slots?: Partial<Record<import("./loop-planner").LoopAncestorSlot, string>>) =>
    Object.fromEntries(Object.entries(slots ?? {}).filter(([slot, candidate]) => allowedSlots.has(slot) && typeof candidate === "string"));
  const selectedSlots = normalizeSlots(value?.selectedSlots);
  const lockedSlots = normalizeSlots(value?.lockedSlots);
  const aptitudeKeySet = new Set<string>(APTITUDE_KEYS);
  const slotAptitudeGoals: NonNullable<import("./loop-planner").ParentingLoopConfig["slotAptitudeGoals"]> = {};
  for (const slot of LOOP_UMA_SLOTS) {
    const goals = value?.slotAptitudeGoals?.[slot];
    if (!goals || typeof goals !== "object") continue;
    for (const aptitude of FARM_APTITUDES) {
      const rank = goals[aptitude];
      if (rank === "C" || rank === "D" || rank === "E") (slotAptitudeGoals[slot] ??= {})[aptitude] = rank;
    }
  }
  const slotWhiteTargets: NonNullable<import("./loop-planner").ParentingLoopConfig["slotWhiteTargets"]> = {};
  for (const slot of PARENT_WHITE_TARGET_SLOTS) {
    const targets = value?.slotWhiteTargets?.[slot];
    if (Array.isArray(targets)) slotWhiteTargets[slot] = [...new Set(targets.filter((key) => aptitudeKeySet.has(key)))];
  }
  const factorGoals: NonNullable<import("./loop-planner").ParentingLoopConfig["factorGoals"]> = {};
  for (const [slot, goal] of Object.entries(value?.factorGoals ?? {})) {
    if (!allowedSlots.has(slot) || !goal || typeof goal !== "object") continue;
    const blue = goal.blue;
    const blueStars = goal.blueStars;
    const pink = goal.pink;
    const pinkStars = goal.pinkStars;
    factorGoals[slot as PickerSlotKey] = {
      ...(blue === null ? { blue: null } : Number.isInteger(blue) && Number(blue) >= 1 && Number(blue) <= 5 ? { blue: Number(blue) } : {}),
      ...(blueStars === null ? { blueStars: null } : Number.isInteger(blueStars) && Number(blueStars) >= 0 && Number(blueStars) <= 3 ? { blueStars: Number(blueStars) } : {}),
      ...(pink === null ? { pink: null } : typeof pink === "string" && aptitudeKeySet.has(pink) ? { pink: pink as import("./loop-planner").AptitudeKey } : {}),
      ...(pinkStars === null ? { pinkStars: null } : Number.isInteger(pinkStars) && Number(pinkStars) >= 0 && Number(pinkStars) <= 3 ? { pinkStars: Number(pinkStars) } : {}),
    };
    if (!Object.keys(factorGoals[slot as PickerSlotKey] ?? {}).length) delete factorGoals[slot as PickerSlotKey];
  }
  for (const slot of GGGP_SPARK_SLOTS) {
    const saved = factorGoals[slot];
    const key = selectedSlots[slot];
    const [source, identityText, createTime] = (key ?? "").split(":");
    const identity = Number(identityText);
    const veteran = source === "v" ? veterans.find((entry) =>
      (entry.trained_chara_id === identity || entry.card_id === identity) && (!createTime || String(entry.create_time ?? "") === createTime)) : undefined;
    const known = Array.isArray(veteran?.factor_info_array);
    const actual = known ? extractSlotPrimaryFactors(veteran!.factor_info_array).pink : null;
    const actualName = actual?.nameEn === "Med" ? "Medium" : actual?.nameEn;
    const hasChoice = saved != null && Object.prototype.hasOwnProperty.call(saved, "pink");
    const pink = hasChoice ? saved.pink : known ? actualName && aptitudeKeySet.has(actualName) ? actualName as import("./loop-planner").AptitudeKey : null : undefined;
    if (pink !== undefined) factorGoals[slot] = { pink, pinkStars: saved?.pinkStars ?? actual?.stars ?? (pink ? 3 : 0) };
    else if (saved) factorGoals[slot] = {};
    if (hasChoice || known || source === "r" || source === "b") delete selectedSlots[slot];
    delete lockedSlots[slot];
  }
  return {
    slotAptitudeGoals,
    slotWhiteTargets,
    geneGoals,
    whiteFactorGoals,
    aptitudeGoals,
    selectedSlots,
    lockedSlots,
    factorGoals,
    includeTripleCrownAffinity: Boolean(value?.includeTripleCrownAffinity),
    includeTiaraAffinity: Boolean(value?.includeTiaraAffinity),
  };
}

const STORAGE_KEY = "almondeye_parenting_setup";
export const PARENTING_EVENT_KEY = "almondeye_parenting_updated";

export function loadParentingSetup(): ParentingSetup {
  const parsed = readJsonStorage<Partial<ParentingSetup>>(STORAGE_KEY);
  if (!parsed) return DEFAULT_PARENTING_SETUP;
  return normalizeParentingSetup(parsed);
}

export function saveParentingSetup(setup: ParentingSetup): void {
  writeJsonStorage(STORAGE_KEY, setup);
  notifyLocalUpdate(PARENTING_EVENT_KEY);
}

/** Serialize parenting setup to a URL-safe deflated Base64 hash */
export async function serializeParentingToHash(setup: ParentingSetup): Promise<string> {
  const shareVeteran = (vet: KyumaruVeteranItem | null) => vet ? ({
    card_id: vet.card_id,
    trained_chara_id: vet.trained_chara_id,
    create_time: vet.create_time,
    name: vet.name,
    rank: vet.rank,
    rank_score: vet.rank_score,
    proper_ground_turf: vet.proper_ground_turf,
    proper_ground_dirt: vet.proper_ground_dirt,
    proper_distance_short: vet.proper_distance_short,
    proper_distance_mile: vet.proper_distance_mile,
    proper_distance_middle: vet.proper_distance_middle,
    proper_distance_long: vet.proper_distance_long,
    proper_running_style_nige: vet.proper_running_style_nige,
    proper_running_style_senko: vet.proper_running_style_senko,
    proper_running_style_sashi: vet.proper_running_style_sashi,
    proper_running_style_oikomi: vet.proper_running_style_oikomi,
    factor_info_array: vet.factor_info_array,
    win_saddle_id_array: vet.win_saddle_id_array,
    succession_chara_array: vet.succession_chara_array,
  }) : null;
  const minimalPayload = {
    t: setup.targetCharaId,
    tc: setup.targetCharaCardId,
    p1: setup.parent1 ? setup.parent1.trained_chara_id || setup.parent1.card_id : null,
    p2: setup.parent2 ? setup.parent2.trained_chara_id || setup.parent2.card_id : null,
    p1v: shareVeteran(setup.parent1),
    p2v: shareVeteran(setup.parent2),
    b1: setup.p1IsBorrow ? 1 : 0,
    b2: setup.p2IsBorrow ? 1 : 0,
    gpo: setup.gpOverrides,
    cards: setup.supportCardIds,
    lc: setup.loopConfig,
  };

  const jsonStr = JSON.stringify(minimalPayload);
  const bytes = new TextEncoder().encode(jsonStr);

  const stream = new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"))
  );
  const compressedBuffer = await stream.arrayBuffer();
  const binary = String.fromCharCode(...new Uint8Array(compressedBuffer));
  const b64 = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `parenting=${b64}`;
}

/** Restore current and legacy Parenting hashes. The separate deck share V4 codec is unaffected. */
export async function deserializeParentingFromHash(hash: string, veterans: KyumaruVeteranItem[] = []): Promise<ParentingSetup> {
  const encoded = hash.replace(/^#?parenting=/, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("Invalid Parenting share hash");
  const binary = atob(encoded + "=".repeat((4 - encoded.length % 4) % 4));
  const compressed = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const stream = new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate")));
  const payload = JSON.parse(new TextDecoder().decode(await stream.arrayBuffer())) as Record<string, unknown>;
  const validVet = (value: unknown): KyumaruVeteranItem | null => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    return Number.isFinite(record.card_id) && Number(record.card_id) > 0 ? record as unknown as KyumaruVeteranItem : null;
  };
  const resolveLegacyVet = (value: unknown) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return veterans.find((vet) => vet.trained_chara_id === value || vet.card_id === value) ?? null;
  };
  const p1 = validVet(payload.p1v) ?? resolveLegacyVet(payload.p1);
  const p2 = validVet(payload.p2v) ?? resolveLegacyVet(payload.p2);
  const setup: Partial<ParentingSetup> = {
    targetCharaId: typeof payload.t === "number" ? payload.t : null,
    targetCharaCardId: typeof payload.tc === "number" ? payload.tc : null,
    parent1: p1,
    parent2: p2,
    p1IsBorrow: payload.b1 === 1,
    p2IsBorrow: payload.b2 === 1,
    gpOverrides: payload.gpo && typeof payload.gpo === "object" ? payload.gpo as ParentingSetup["gpOverrides"] : {},
    supportCardIds: Array.isArray(payload.cards) ? payload.cards.map((id) => typeof id === "number" && Number.isFinite(id) ? id : null) : undefined,
    loopConfig: normalizeLoopConfig(payload.lc && typeof payload.lc === "object" ? payload.lc as ParentingSetup["loopConfig"] : undefined, veterans),
  };
  return normalizeParentingSetup(setup);
}
