import { describe, expect, test } from "bun:test";
import {
  createDeferredDataset,
  getCardSupportEffects,
  loadCardEffects,
  loadCharacterEvolutions,
  loadPvpRecommendations,
  peekPvpRecommendations,
} from "./registry";

describe("createDeferredDataset", () => {
  test("loads once, unwraps the default export, and exposes the value via peek", async () => {
    let calls = 0;
    const dataset = createDeferredDataset<{ n: number }>(async () => {
      calls += 1;
      return { default: { n: 7 } };
    });

    expect(dataset.peek()).toBeUndefined();
    const [a, b] = await Promise.all([dataset.load(), dataset.load()]);
    expect(a).toEqual({ n: 7 });
    expect(b).toBe(a);
    expect(await dataset.load()).toBe(a);
    expect(dataset.peek()).toBe(a);
    expect(calls).toBe(1);
  });

  test("a failed load can be retried", async () => {
    let calls = 0;
    const dataset = createDeferredDataset<string>(async () => {
      calls += 1;
      if (calls === 1) throw new Error("chunk fetch failed");
      return { default: "ok" };
    });

    let failure: unknown;
    try {
      await dataset.load();
    } catch (error) {
      failure = error;
    }
    expect((failure as Error).message).toBe("chunk fetch failed");
    expect(dataset.peek()).toBeUndefined();
    expect(await dataset.load()).toBe("ok");
    expect(calls).toBe(2);
  });
});

describe("deferred registry datasets", () => {
  test("character evolutions resolve to a non-empty map and memoize", async () => {
    const first = await loadCharacterEvolutions();
    expect(Object.keys(first).length).toBeGreaterThan(0);
    expect(await loadCharacterEvolutions()).toBe(first);
  });

  test("card effects resolve and back the async per-card lookup", async () => {
    const effects = await loadCardEffects();
    const [cardId] = Object.keys(effects);
    expect(cardId).toBeDefined();
    expect(await getCardSupportEffects(Number(cardId))).toBe(effects[cardId]);
    expect(await getCardSupportEffects(-1)).toBeUndefined();
  });

  test("PvP recommendations resolve and become visible to peek", async () => {
    const payload = await loadPvpRecommendations();
    expect(Array.isArray(payload.raceFitAssistance)).toBe(true);
    expect(peekPvpRecommendations()).toBe(payload);
  });
});
