import { describe, expect, test } from "bun:test";
import { deckSlotTransitionName, runViewTransition } from "./view-transition";

describe("runViewTransition", () => {
  test("runs the update inside startViewTransition when supported", () => {
    const calls: string[] = [];
    const started = runViewTransition(() => { calls.push("update"); }, {
      startViewTransition: (update) => {
        calls.push("start");
        update();
      },
      prefersReducedMotion: () => false,
    });
    expect(started).toBe(true);
    expect(calls).toEqual(["start", "update"]);
  });

  test("updates directly when the API is missing", () => {
    let updated = 0;
    expect(runViewTransition(() => { updated++; }, { prefersReducedMotion: () => false })).toBe(false);
    expect(updated).toBe(1);
  });

  test("updates directly under prefers-reduced-motion", () => {
    let started = false;
    let updated = 0;
    const result = runViewTransition(() => { updated++; }, {
      startViewTransition: () => {
        started = true;
      },
      prefersReducedMotion: () => true,
    });
    expect(result).toBe(false);
    expect(started).toBe(false);
    expect(updated).toBe(1);
  });

  test("never loses the update when startViewTransition throws", () => {
    let updated = 0;
    const result = runViewTransition(() => { updated++; }, {
      startViewTransition: () => {
        throw new Error("InvalidStateError");
      },
      prefersReducedMotion: () => false,
    });
    expect(result).toBe(false);
    expect(updated).toBe(1);
  });

  test("updates directly outside the browser", () => {
    let updated = 0;
    runViewTransition(() => { updated++; }, null);
    expect(updated).toBe(1);
  });
});

test("deck slot transition names are stable per index", () => {
  expect(deckSlotTransitionName(0)).toBe("deck-slot-0");
  expect(deckSlotTransitionName(5)).toBe("deck-slot-5");
});
