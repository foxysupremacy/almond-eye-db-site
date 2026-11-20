import { afterAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { DECK_SLOT_SIZE_STORAGE_KEY } from "@/lib/deck/slot-size-pref";

// renderHook needs a DOM; register one only for this file so plain `bun test` stays DOM-free elsewhere.
GlobalRegistrator.register({ url: "http://localhost/" });
const hook = await import("@testing-library/react");
const { useDeckSlotSize } = await import("./use-deck-slot-size");
afterAll(async () => {
  hook.cleanup();
  await GlobalRegistrator.unregister();
});

describe("useDeckSlotSize", () => {
  test("defaults to compact and persists the Large choice", () => {
    localStorage.clear();
    const { result } = hook.renderHook(() => useDeckSlotSize());
    expect(result.current[0]).toBe("compact");

    hook.act(() => result.current[1]("large"));
    expect(result.current[0]).toBe("large");
    expect(JSON.parse(localStorage.getItem(DECK_SLOT_SIZE_STORAGE_KEY) ?? "null")).toBe("large");
  });

  test("every mounted picker shares one preference", () => {
    localStorage.clear();
    const main = hook.renderHook(() => useDeckSlotSize());
    const parent = hook.renderHook(() => useDeckSlotSize());

    hook.act(() => parent.result.current[1]("large"));
    expect(main.result.current[0]).toBe("large");

    hook.act(() => main.result.current[1]("compact"));
    expect(parent.result.current[0]).toBe("compact");
  });

  test("restores a stored choice and ignores corrupt values", () => {
    localStorage.setItem(DECK_SLOT_SIZE_STORAGE_KEY, JSON.stringify("large"));
    expect(hook.renderHook(() => useDeckSlotSize()).result.current[0]).toBe("large");

    localStorage.setItem(DECK_SLOT_SIZE_STORAGE_KEY, JSON.stringify("poster"));
    expect(hook.renderHook(() => useDeckSlotSize()).result.current[0]).toBe("compact");
  });
});
