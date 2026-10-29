import { afterEach, beforeEach, expect, test } from "bun:test";
import type { StaminaInput } from "@/lib/stamina-sim";
import { DEFAULT_STAMINA_INPUT, loadStaminaPrefs, saveStaminaPrefs, STAMINA_PREFS_KEY } from "./stamina-prefs";

// Fake window.localStorage per test, as in lib/deck/preset-storage.test.ts (no DOM preload in unit tests).
let store: Map<string, string>;
const localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
beforeEach(() => {
  store = new Map();
  (globalThis as Record<string, unknown>).window = { localStorage };
});
afterEach(() => { delete (globalThis as Record<string, unknown>).window; });

const custom: StaminaInput = {
  stats: { speed: 2100, stamina: 900, power: 1300, guts: 700, wisdom: 1100 },
  style: 5,
  aptitude: { ground: "S", distance: "B", style: "G" },
  motivation: "best",
  greens: { spd60: 1, spd40: 0, sta60: 2, sta40: 3 },
  recovery: [1, 2, 0, 0, 0, 0, 20],
  hpLoss: [0, 1, 0, 0, 0, 4],
  toggles: { dueling: true, spotStruggle: false, kakari: true },
  groundCondition: 3,
};

test("key is versioned", () => {
  expect(STAMINA_PREFS_KEY).toBe("stamina.v1");
});

test("nothing stored → defaults (firm ground)", () => {
  expect(loadStaminaPrefs()).toEqual(DEFAULT_STAMINA_INPUT);
  expect(DEFAULT_STAMINA_INPUT.groundCondition).toBe(1);
});

test("round-trip", () => {
  saveStaminaPrefs(custom);
  expect(loadStaminaPrefs()).toEqual(custom);
});

test("corrupt JSON → defaults", () => {
  localStorage.setItem(STAMINA_PREFS_KEY, "{not json");
  expect(loadStaminaPrefs()).toEqual(DEFAULT_STAMINA_INPUT);
});

test("wrong shape → defaults", () => {
  localStorage.setItem(STAMINA_PREFS_KEY, JSON.stringify([1, 2, 3]));
  expect(loadStaminaPrefs()).toEqual(DEFAULT_STAMINA_INPUT);
  localStorage.setItem(STAMINA_PREFS_KEY, JSON.stringify("stamina"));
  expect(loadStaminaPrefs()).toEqual(DEFAULT_STAMINA_INPUT);
});

test("out-of-range and invalid fields fall back field by field", () => {
  localStorage.setItem(STAMINA_PREFS_KEY, JSON.stringify({
    ...custom,
    stats: { speed: 0, stamina: 2501, power: 1.5, guts: "700", wisdom: 1100 },
    style: 6,
    aptitude: { ground: "SS", distance: "B", style: null },
    motivation: "great",
    greens: { spd60: -1, spd40: 21, sta60: 2.5, sta40: 3 },
    recovery: [1, 2, 0],
    hpLoss: [0, 1, 0, 0, 0, 21],
    toggles: { dueling: "yes", spotStruggle: false, kakari: true },
    groundCondition: 5,
  }));
  const d = DEFAULT_STAMINA_INPUT;
  expect(loadStaminaPrefs()).toEqual({
    stats: { speed: d.stats.speed, stamina: d.stats.stamina, power: d.stats.power, guts: d.stats.guts, wisdom: 1100 },
    style: d.style,
    aptitude: { ground: d.aptitude.ground, distance: "B", style: d.aptitude.style },
    motivation: d.motivation,
    greens: { spd60: d.greens.spd60, spd40: d.greens.spd40, sta60: d.greens.sta60, sta40: 3 },
    recovery: d.recovery,
    hpLoss: [0, 1, 0, 0, 0, d.hpLoss[5]],
    toggles: { dueling: d.toggles.dueling, spotStruggle: false, kakari: true },
    groundCondition: d.groundCondition,
  });
});

test("defaults are not shared by reference", () => {
  const a = loadStaminaPrefs();
  a.recovery[0] = 9;
  a.stats.speed = 1;
  expect(loadStaminaPrefs()).toEqual(DEFAULT_STAMINA_INPUT);
  expect(DEFAULT_STAMINA_INPUT.recovery[0]).toBe(0);
});
