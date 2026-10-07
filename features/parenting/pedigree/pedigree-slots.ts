import { LOOP_ANCESTOR_SLOTS, type LoopAncestorSlot } from "@/lib/parenting/loop-planner";

export type SlotGeneration = "parent" | "grandparent" | "great-grandparent" | "great-great-grandparent";
const GENERATIONS: SlotGeneration[] = ["parent", "grandparent", "great-grandparent", "great-great-grandparent"];

export const SLOT_LABEL = Object.fromEntries(LOOP_ANCESTOR_SLOTS.map((slot) => {
  const [branch, gp, ...descendants] = slot.split("_");
  const labels = descendants.map((part, index) => `${index === 0 ? "GGP" : "GGGP"}${part.slice(1)}`);
  return [slot, [branch.toUpperCase(), gp?.toUpperCase(), ...labels].filter(Boolean).join(" ")];
})) as Record<LoopAncestorSlot, string>;

export function slotGeneration(slot: LoopAncestorSlot): SlotGeneration {
  return GENERATIONS[slot.split("_").length - 1];
}

export function parentSlot(slot: LoopAncestorSlot): LoopAncestorSlot | null {
  const index = slot.lastIndexOf("_");
  return index < 0 ? null : (slot.slice(0, index) as LoopAncestorSlot);
}

export function siblingSlot(slot: LoopAncestorSlot): LoopAncestorSlot {
  return slot.replace(/[12]$/, (digit) => (digit === "1" ? "2" : "1")) as LoopAncestorSlot;
}

export function childSlots(slot: LoopAncestorSlot): LoopAncestorSlot[] {
  const depth = slot.split("_").length;
  if (depth >= 4) return [];
  const segment = depth === 1 ? "gp" : "g";
  return [`${slot}_${segment}1`, `${slot}_${segment}2`] as LoopAncestorSlot[];
}
