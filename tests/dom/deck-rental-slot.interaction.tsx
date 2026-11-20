import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeckPicker from "@/features/deck/screens/deck-picker";
import { DeckProvider } from "@/features/deck/state";
import { PRESETS_STORAGE_KEY } from "@/lib/deck/constants";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function storePreset(extra: Record<string, unknown>) {
  localStorage.setItem(
    PRESETS_STORAGE_KEY,
    JSON.stringify([{ id: "r", name: "Rental", mainDeckIds: [null, null, null, null, null, null], parentDeckIds: [null, null, null, null, null, null], ...extra }]),
  );
}

const RENTAL_TOGGLE = { name: "Use as rental (any card, MLB)" };

describe("Deck rental slot", () => {
  test("the marked empty slot is labelled and opens the picker in rental mode", async () => {
    storePreset({ parentRentalSlot: 2 });
    render(<DeckProvider><DeckPicker mode="parent" /></DeckProvider>);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText("Rental · any card, MLB")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "Pick Slot 3" }));
    const toggle = await screen.findByRole("button", RENTAL_TOGGLE);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/any card works and counts as MLB/)).toBeTruthy();
  });

  test("other slots open the picker with rental off, and it can be switched on", async () => {
    storePreset({ parentRentalSlot: 2 });
    render(<DeckProvider><DeckPicker mode="parent" /></DeckProvider>);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Pick Slot 1" }));
    const toggle = await screen.findByRole("button", RENTAL_TOGGLE);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText(/any card works and counts as MLB/)).toBeNull();
    await user.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("true"));
  });

  test("Main and Parent Deck keep separate rental marks", async () => {
    storePreset({ parentRentalSlot: 2 });
    render(<DeckProvider><DeckPicker mode="main" /></DeckProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Pick Slot 3" })).toBeTruthy());
    expect(screen.queryByText("Rental · any card, MLB")).toBeNull();
  });
});
