import { describe, expect, test } from "bun:test";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import { listShareableParents } from "./shareable-parents";

const real = (card_id: number) => ({ card_id, create_time: "2026-03-20 22:39:51", skill_array: [{ skill_id: 1, level: 1 }] }) as KyumaruVeteranItem;
const template = (card_id: number) => ({ card_id, trained_chara_id: card_id, skill_array: [] }) as unknown as KyumaruVeteranItem;

describe("listShareableParents", () => {
  test("lists own trained parents in slot order", () => {
    expect(listShareableParents(real(1), false, real(2), false).map((p) => p.slot)).toEqual(["p1", "p2"]);
  });

  test("skips empty slots, borrowed parents and untrained templates", () => {
    expect(listShareableParents(null, false, real(2), true)).toEqual([]);
    expect(listShareableParents(template(1), false, null, false)).toEqual([]);
    expect(listShareableParents(real(1), true, real(2), false).map((p) => p.slot)).toEqual(["p2"]);
  });

  test("labels each choice with its slot", () => {
    const [choice] = listShareableParents(real(1), false, null, false);
    expect(choice.label).toBe("Parent 1");
    expect(choice.veteran.card_id).toBe(1);
  });
});
