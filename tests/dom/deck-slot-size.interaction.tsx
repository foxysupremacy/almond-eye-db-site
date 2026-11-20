import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeckPicker from "@/features/deck/screens/deck-picker";
import { DeckProvider } from "@/features/deck/state";
import { DECK_SLOT_SIZE_STORAGE_KEY } from "@/lib/deck/slot-size-pref";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const COMPACT_CAPTION = /Select a card for event choices and skills/;
const LARGE_CAPTION = /Tap a card for choices and skills/;

describe("Deck slot size toggle", () => {
  test("defaults to compact tiles and switches to the large layout", async () => {
    localStorage.clear();
    render(<DeckProvider><DeckPicker /></DeckProvider>);
    const user = userEvent.setup();

    const group = screen.getByRole("group", { name: "Card size" });
    const compact = within(group).getByRole("button", { name: "Compact" });
    const large = within(group).getByRole("button", { name: "Large" });
    expect(compact.getAttribute("aria-pressed")).toBe("true");
    expect(large.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText(COMPACT_CAPTION)).toBeTruthy();
    // Compact renders one grid: exactly one "Pick Slot 1" tile.
    expect(screen.getAllByRole("button", { name: "Pick Slot 1" })).toHaveLength(1);

    await user.click(large);
    await waitFor(() => expect(large.getAttribute("aria-pressed")).toBe("true"));
    expect(screen.queryByText(COMPACT_CAPTION)).toBeNull();
    expect(screen.getByText(LARGE_CAPTION)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(DECK_SLOT_SIZE_STORAGE_KEY) ?? "null")).toBe("large");
  });

  test("restores the stored Large choice", async () => {
    localStorage.setItem(DECK_SLOT_SIZE_STORAGE_KEY, JSON.stringify("large"));
    render(<DeckProvider><DeckPicker mode="parent" /></DeckProvider>);
    await waitFor(() =>
      expect(within(screen.getByRole("group", { name: "Card size" })).getByRole("button", { name: "Large" }).getAttribute("aria-pressed")).toBe("true"),
    );
    expect(screen.getByText(LARGE_CAPTION)).toBeTruthy();
  });

  test("empty compact tiles open the card picker", async () => {
    localStorage.clear();
    render(<DeckProvider><DeckPicker /></DeckProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Pick Slot 3" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Pick Support Card" })).toBeTruthy());
  });
});
