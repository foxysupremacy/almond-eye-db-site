import type { KyumaruVeteranItem } from "@/lib/veterans/types";

export interface ShareableParent {
  readonly slot: "p1" | "p2";
  readonly label: string;
  readonly veteran: KyumaruVeteranItem;
}

/** A real Kyumaru veteran (not an untrained character template or roster stand-in). */
function isTrainedVeteran(vet: KyumaruVeteranItem | null): vet is KyumaruVeteranItem {
  return !!vet && !!vet.create_time && (vet.skill_array?.length ?? 0) > 0;
}

/** Parenting parents the user can share as a Partner Card: their own trained umas only. */
export function listShareableParents(
  parent1: KyumaruVeteranItem | null,
  p1IsBorrow: boolean,
  parent2: KyumaruVeteranItem | null,
  p2IsBorrow: boolean,
): ShareableParent[] {
  const out: ShareableParent[] = [];
  if (!p1IsBorrow && isTrainedVeteran(parent1)) out.push({ slot: "p1", label: "Parent 1", veteran: parent1 });
  if (!p2IsBorrow && isTrainedVeteran(parent2)) out.push({ slot: "p2", label: "Parent 2", veteran: parent2 });
  return out;
}
