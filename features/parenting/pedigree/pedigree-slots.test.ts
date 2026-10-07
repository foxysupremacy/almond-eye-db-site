import { expect, test } from "bun:test";
import { SLOT_LABEL, childSlots, parentSlot, siblingSlot, slotGeneration } from "./pedigree-slots";

test("slot labels match the existing pedigree aria vocabulary", () => {
  expect(SLOT_LABEL.p1).toBe("P1");
  expect(SLOT_LABEL.p2_gp1).toBe("P2 GP1");
  expect(SLOT_LABEL.p1_gp1_g2).toBe("P1 GP1 GGP2");
  expect(SLOT_LABEL.p1_gp1_g1_g1).toBe("P1 GP1 GGP1 GGGP1");
});

test("generation follows slot depth", () => {
  expect(slotGeneration("p2")).toBe("parent");
  expect(slotGeneration("p2_gp2")).toBe("grandparent");
  expect(slotGeneration("p2_gp2_g1")).toBe("great-grandparent");
  expect(slotGeneration("p2_gp2_g1_g2")).toBe("great-great-grandparent");
});

test("parent / sibling / children navigation", () => {
  expect(parentSlot("p1")).toBeNull();
  expect(parentSlot("p1_gp2")).toBe("p1");
  expect(parentSlot("p1_gp2_g1_g2")).toBe("p1_gp2_g1");
  expect(siblingSlot("p1")).toBe("p2");
  expect(siblingSlot("p2_gp1")).toBe("p2_gp2");
  expect(siblingSlot("p1_gp2_g2")).toBe("p1_gp2_g1");
  expect(childSlots("p1")).toEqual(["p1_gp1", "p1_gp2"]);
  expect(childSlots("p1_gp2")).toEqual(["p1_gp2_g1", "p1_gp2_g2"]);
  expect(childSlots("p1_gp2_g1")).toEqual(["p1_gp2_g1_g1", "p1_gp2_g1_g2"]);
  expect(childSlots("p1_gp2_g1_g1")).toEqual([]);
});
