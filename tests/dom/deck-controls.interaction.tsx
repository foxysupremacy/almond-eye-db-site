import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CardTargetSkillSearch } from "@/features/deck/pickers/card-target-skill-search";
import CardPickerPopover from "@/features/deck/pickers/card-picker-popover";
import { DeckProvider } from "@/features/deck/state";
import type { SkillDetail } from "@/lib/api";

afterEach(() => cleanup());

const skills: SkillDetail[] = [
  { id: 200014, nameEn: "Clockwise Demon", nameJp: "右回りの鬼", descEn: "Improve right turns.", rarity: 2, conditionGroups: [] },
  { id: 200011, nameEn: "Right Turns", nameJp: "右回り", descEn: "Improve right turns.", rarity: 1, conditionGroups: [] },
];

describe("Deck React Aria controls", () => {
  test("target skill autocomplete supports keyboard addition and tag removal", async () => {
    function Probe() {
      const [query, setQuery] = useState("");
      const [selected, setSelected] = useState<SkillDetail[]>([]);
      return <CardTargetSkillSearch query={query} results={query ? skills.filter((skill) => !selected.some((item) => item.id === skill.id) && skill.nameEn.toLowerCase().includes(query.toLowerCase())) : []}
        selected={selected} onQueryChange={setQuery} onAdd={(skill) => setSelected((current) => [...current, skill])} onRemove={(id) => setSelected((current) => current.filter((skill) => skill.id !== id))} />;
    }
    render(<Probe />);
    const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: "Search target skills" });
    await user.type(input, "clockwise");
    await waitFor(() => expect(screen.getByRole("option", { name: /Clockwise Demon/ })).toBeTruthy());
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.getByRole("button", { name: /Remove.*Clockwise Demon/ })).toBeTruthy());
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("listbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Remove.*Clockwise Demon/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Remove.*Clockwise Demon/ })).toBeNull());
  });

  test("card picker exposes a named dialog, keyboard type filters and independent effects", async () => {
    render(<DeckProvider><CardPickerPopover mode="parent" onClose={() => {}} onPick={() => {}} /></DeckProvider>);
    const dialog = screen.getByRole("dialog", { name: "Pick Support Card" });
    expect(within(dialog).getByRole("searchbox", { name: "Search support cards" })).toBeTruthy();
    expect(within(dialog).getByRole("status", { name: "Loading support cards" })).toBeTruthy();
    expect(within(dialog).getByRole("combobox", { name: "Search target skills" })).toBeTruthy();
    const user = userEvent.setup();
    const group = within(dialog).getByRole("radiogroup", { name: "Support card type" });
    const all = within(group).getByRole("radio", { name: /^all$/i });
    const speed = within(group).getByRole("radio", { name: /speed/i });
    act(() => all.focus());
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect((speed as HTMLInputElement).checked).toBe(true));
    const effects = within(dialog).getByRole("toolbar", { name: "Filter cards by skill effect" });
    const targetSpeed = within(effects).getByRole("button", { name: "Target Speed" });
    const acceleration = within(effects).getByRole("button", { name: "Acceleration" });
    await user.click(targetSpeed);
    await user.click(acceleration);
    expect(targetSpeed.getAttribute("aria-pressed")).toBe("true");
    expect(acceleration.getAttribute("aria-pressed")).toBe("true");
    await user.click(within(dialog).getByRole("button", { name: "All Effects" }));
    expect(targetSpeed.getAttribute("aria-pressed")).toBe("false");
    expect(acceleration.getAttribute("aria-pressed")).toBe("false");
  });

  test("Escape dismisses the sort popup before the picker and restores its opener", async () => {
    function Probe() {
      const [open, setOpen] = useState(false);
      return <DeckProvider><button onClick={() => setOpen(true)}>Pick a support card</button>{open && <CardPickerPopover onPick={() => {}} onClose={() => setOpen(false)} />}</DeckProvider>;
    }
    render(<Probe />);
    const user = userEvent.setup();
    const opener = screen.getByRole("button", { name: "Pick a support card" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Pick Support Card" });
    await user.click(within(dialog).getByRole("button", { name: /Sort cards/ }));
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(screen.getByRole("dialog", { name: "Pick Support Card" })).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
