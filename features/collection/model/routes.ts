import type { CharacterIndexEntry } from "@/lib/api";

/** A route id is deliberately the game card id, not a character's shared charId. */
export function parseCollectionRouteId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function relatedCostumes(
  characters: CharacterIndexEntry[],
  selected: CharacterIndexEntry,
): CharacterIndexEntry[] {
  return characters.filter((candidate) => candidate.charId === selected.charId && candidate.id !== selected.id);
}
