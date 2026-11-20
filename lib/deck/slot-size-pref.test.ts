import { afterEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_DECK_SLOT_SIZE,
  DECK_SLOT_SIZE_STORAGE_KEY,
  loadDeckSlotSize,
  parseDeckSlotSize,
  saveDeckSlotSize,
} from "./slot-size-pref";

describe("parseDeckSlotSize", () => {
  test("accepts the two known sizes", () => {
    expect(parseDeckSlotSize("compact")).toBe("compact");
    expect(parseDeckSlotSize("large")).toBe("large");
  });

  test("falls back to the default for anything else", () => {
    for (const value of [null, undefined, "", "huge", 1, {}, ["large"]]) {
      expect(parseDeckSlotSize(value)).toBe(DEFAULT_DECK_SLOT_SIZE);
    }
    expect(DEFAULT_DECK_SLOT_SIZE).toBe("compact");
  });
});

describe("load/save", () => {
  const store = new Map<string, string>();
  const originalWindow = (globalThis as { window?: unknown }).window;
  const events: string[] = [];

  function installWindow() {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
      dispatchEvent: (event: Event) => {
        events.push(event.type);
        return true;
      },
    };
  }

  afterEach(() => {
    store.clear();
    events.length = 0;
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  test("round-trips a saved size and notifies listeners", () => {
    installWindow();
    saveDeckSlotSize("large");
    expect(store.get(DECK_SLOT_SIZE_STORAGE_KEY)).toBe(JSON.stringify("large"));
    expect(loadDeckSlotSize()).toBe("large");
    expect(events).toContain(DECK_SLOT_SIZE_STORAGE_KEY);
  });

  test("ignores a corrupt stored value", () => {
    installWindow();
    store.set(DECK_SLOT_SIZE_STORAGE_KEY, JSON.stringify("gigantic"));
    expect(loadDeckSlotSize()).toBe("compact");
    store.set(DECK_SLOT_SIZE_STORAGE_KEY, "{not json");
    expect(loadDeckSlotSize()).toBe("compact");
  });

  test("defaults when nothing is stored", () => {
    installWindow();
    expect(loadDeckSlotSize()).toBe("compact");
  });
});
