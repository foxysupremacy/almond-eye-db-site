import { describe, expect, test } from "bun:test";
import { createDefaultPreset } from "./preset-storage";
import {
  RENTAL_LIMIT_BREAK,
  effectiveLimitBreak,
  rentalSlotAfterPick,
  isRentalSlot,
  normalizeRentalSlot,
  rentalSlotOf,
  setRentalSlot,
} from "./rental";

describe("rental slot marks", () => {
  test("a new preset has no rental slot in either deck", () => {
    const preset = createDefaultPreset("p", "P");
    expect(rentalSlotOf(preset, "main")).toBeNull();
    expect(rentalSlotOf(preset, "parent")).toBeNull();
  });

  test("marking a slot is per deck and moves when another slot is marked", () => {
    let preset = createDefaultPreset("p", "P");
    preset = setRentalSlot(preset, "parent", 2);
    expect(rentalSlotOf(preset, "parent")).toBe(2);
    expect(rentalSlotOf(preset, "main")).toBeNull();
    expect(isRentalSlot(preset, "parent", 2)).toBe(true);

    preset = setRentalSlot(preset, "parent", 5);
    expect(rentalSlotOf(preset, "parent")).toBe(5);
    expect(isRentalSlot(preset, "parent", 2)).toBe(false);

    preset = setRentalSlot(preset, "main", 0);
    expect(rentalSlotOf(preset, "main")).toBe(0);
    expect(rentalSlotOf(preset, "parent")).toBe(5);
  });

  test("null unmarks, and out-of-range indices are ignored", () => {
    let preset = setRentalSlot(createDefaultPreset("p", "P"), "main", 3);
    expect(setRentalSlot(preset, "main", 9)).toBe(preset);
    expect(setRentalSlot(preset, "main", -1)).toBe(preset);
    preset = setRentalSlot(preset, "main", null);
    expect(rentalSlotOf(preset, "main")).toBeNull();
  });
});

describe("normalizeRentalSlot", () => {
  test("keeps integer slot indices and drops everything else", () => {
    expect(normalizeRentalSlot(0)).toBe(0);
    expect(normalizeRentalSlot(5)).toBe(5);
    expect(normalizeRentalSlot(6)).toBeNull();
    expect(normalizeRentalSlot(1.5)).toBeNull();
    expect(normalizeRentalSlot("2")).toBeNull();
    expect(normalizeRentalSlot(undefined)).toBeNull();
    expect(normalizeRentalSlot(null)).toBeNull();
  });
});

describe("effectiveLimitBreak", () => {
  test("the rental slot is always MLB, regardless of ownership", () => {
    expect(RENTAL_LIMIT_BREAK).toBe(4);
    expect(effectiveLimitBreak(1, 1, null)).toBe(4);
    expect(effectiveLimitBreak(1, 1, 0)).toBe(4);
  });

  test("other slots keep the owned limit break", () => {
    expect(effectiveLimitBreak(0, 1, 2)).toBe(2);
    expect(effectiveLimitBreak(0, null, null)).toBeNull();
  });
});

describe("rentalSlotAfterPick", () => {
  test("picking as rental marks that slot, moving any other mark", () => {
    expect(rentalSlotAfterPick(null, 2, true)).toBe(2);
    expect(rentalSlotAfterPick(4, 2, true)).toBe(2);
  });

  test("picking an owned card into the rental slot clears the mark", () => {
    expect(rentalSlotAfterPick(2, 2, false)).toBeNull();
  });

  test("picking an owned card elsewhere keeps the mark", () => {
    expect(rentalSlotAfterPick(4, 2, false)).toBe(4);
    expect(rentalSlotAfterPick(null, 2, false)).toBeNull();
  });
});
