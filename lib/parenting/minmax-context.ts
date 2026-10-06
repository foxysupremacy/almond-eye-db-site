import type { CharacterIndexEntry } from "../data/types";
import type { KyumaruVeteranItem } from "../veterans/types";
import { buildLoopCandidates, LOOP_UMA_SLOTS, type LoopAncestorSlot, type LoopCandidate } from "./loop-planner";
import { normalizeLoopConfig, type ParentingSetup } from "./state";
import { resolveGrandparentSlot } from "./pedigree-resolvers";

/** Resolve saved selections and actual P/GP captures consistently for UI/worker. */
export function resolveMinmaxPedigree(setup: ParentingSetup, veterans: KyumaruVeteranItem[], roster: CharacterIndexEntry[]) {
  // Parent Planning has always fallen back to succession history after an
  // override is cleared (null). Keep that behavior when resolving its tree.
  const defaults: Partial<Record<LoopAncestorSlot, KyumaruVeteranItem | null>> = {
    p1: setup.parent1, p2: setup.parent2,
    p1_gp1: resolveGrandparentSlot(setup.gpOverrides.p1_gp1 ?? undefined, setup.parent1, 10) as KyumaruVeteranItem | null,
    p1_gp2: resolveGrandparentSlot(setup.gpOverrides.p1_gp2 ?? undefined, setup.parent1, 20) as KyumaruVeteranItem | null,
    p2_gp1: resolveGrandparentSlot(setup.gpOverrides.p2_gp1 ?? undefined, setup.parent2, 10) as KyumaruVeteranItem | null,
    p2_gp2: resolveGrandparentSlot(setup.gpOverrides.p2_gp2 ?? undefined, setup.parent2, 20) as KyumaruVeteranItem | null,
  };
  const captures = [...veterans, ...Object.values(defaults).filter((entry): entry is KyumaruVeteranItem => entry != null)];
  const config = normalizeLoopConfig(setup.loopConfig, captures);
  const candidates = buildLoopCandidates(captures, roster);
  const ancestors: Partial<Record<LoopAncestorSlot, LoopCandidate | null>> = {};
  for (const slot of LOOP_UMA_SLOTS) {
    const key = config.selectedSlots[slot];
    if (key) {
      const [source, identity, createTime] = key.split(":");
      ancestors[slot] = candidates.find((entry) => entry.key === key) ?? candidates.find((entry) =>
        source === "v" ? entry.source === "veteran" &&
          (entry.veteran?.trained_chara_id === Number(identity) || entry.cardId === Number(identity)) &&
          (!createTime || String(entry.veteran?.create_time ?? "") === createTime)
          : entry.cardId === Number(identity) && entry.source === (source === "b" ? "borrow-placeholder" : "roster-goal")) ?? null;
    } else {
      const capture = defaults[slot];
      ancestors[slot] = capture ? buildLoopCandidates([capture], [])[0] ?? null : null;
    }
  }
  return { ancestors, config, captures };
}
