import { expect, test } from "bun:test";
import { createRng } from "./rng";

test("same seed gives the same first 5 numbers", () => {
  const a = createRng(42), b = createRng(42);
  const xs = Array.from({ length: 5 }, () => a.next());
  expect(xs).toEqual(Array.from({ length: 5 }, () => b.next()));
  expect(new Set(xs).size).toBe(5);
});

test("different seeds differ", () => {
  expect(createRng(1).next()).not.toBe(createRng(2).next());
});

test("all values are in [0, 1)", () => {
  const r = createRng(7);
  for (let i = 0; i < 10_000; i++) {
    const v = r.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
