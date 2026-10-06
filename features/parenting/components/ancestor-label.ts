import type { LoopAncestorSlot } from "@/lib/parenting/loop-planner";

export function ancestorLabel(slot: LoopAncestorSlot) {
  const [parent, ...path] = slot.split("_");
  const generation = ["Parent", "GP", "GGP", "GGGP"][path.length];
  const branch = `Parent ${parent.slice(1)}`;
  return {
    generation,
    location: path.length ? `${branch} · ${path.map((part) => part.endsWith("1") ? "left" : "right").join(" → ")}` : branch,
  };
}
