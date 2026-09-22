import { describe, expect, test } from "bun:test";
import { charactersByCharId, charactersById } from "../data/registry";
import { DEFAULT_PARENTING_SETUP } from "../parenting-state";
import { resolveTargetCharacter } from "./pedigree-resolvers";

describe("resolveTargetCharacter", () => {
  test("prefers the exact selected costume", () => {
    const result = resolveTargetCharacter(
      { ...DEFAULT_PARENTING_SETUP, targetCharaId: 1033, targetCharaCardId: 103302 },
      charactersById,
      charactersByCharId,
    );
    expect(result?.id).toBe(103302);
  });

  test("falls back to the base character lookup for legacy saves", () => {
    const result = resolveTargetCharacter(
      { ...DEFAULT_PARENTING_SETUP, targetCharaId: 1033, targetCharaCardId: null },
      charactersById,
      charactersByCharId,
    );
    expect(result?.charId).toBe(1033);
  });

  test("returns null when both fields are null", () => {
    const result = resolveTargetCharacter(
      { ...DEFAULT_PARENTING_SETUP, targetCharaId: null, targetCharaCardId: null },
      charactersById,
      charactersByCharId,
    );
    expect(result).toBeNull();
  });

  test("falls back to charId when targetCharaCardId is invalid", () => {
    const result = resolveTargetCharacter(
      { ...DEFAULT_PARENTING_SETUP, targetCharaId: 1033, targetCharaCardId: 999999 },
      charactersById,
      charactersByCharId,
    );
    // Should fall back to charId-based lookup
    expect(result?.charId).toBe(1033);
  });
});
