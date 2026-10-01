import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@react-aria/test-utils";
import { useState } from "react";
import { AppSelect } from "@/app/common/ui/controls/app-select";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { PickerSearchBar } from "@/app/common/ui/controls/picker-search-bar";

afterEach(() => cleanup());

function SelectProbe({ onValueChange }: { onValueChange: (value: string) => void }) {
  const [value, setValue] = useState("");
  return <><AppSelect label="Race filter" value={value} onValueChange={(next) => { setValue(next); onValueChange(next); }} options={[
    { value: "", label: "Any course", group: "Course" },
    { value: "short", label: "Short course", group: "Course" },
    { value: "mile", label: "Mile course" },
    { value: "hidden", label: "Unavailable", disabled: true },
  ]} /><output>{value}</output></>;
}

describe("React Aria shared controls", () => {
  test("select keeps the empty-string option and emits one selection", async () => {
    let calls: string[] = [];
    render(<SelectProbe onValueChange={(value) => calls.push(value)} />);

    const trigger = screen.getByRole("button", { name: /Race filter/ });
    const select = new User({ interactionType: "keyboard" }).createTester("Select", { root: trigger });
    await select.open();
    expect(select.getOptions().map((option) => option.textContent)).toContain("Any course");
    expect(screen.getByRole("option", { name: "Unavailable" }).getAttribute("aria-disabled")).toBe("true");
    await select.toggleOptionSelection({ option: "Short course" });
    await waitFor(() => expect(screen.getByText("short")).toBeTruthy());
    expect(calls).toEqual(["short"]);
  });

  test("select opens and changes value through pointer clicks", async () => {
    const user = userEvent.setup();
    let calls: string[] = [];
    render(<SelectProbe onValueChange={(value) => calls.push(value)} />);

    await user.click(screen.getByRole("button", { name: /Race filter/ }));
    const popover = screen.getByRole("dialog");
    expect(popover.querySelector('[role="listbox"]')).toBeTruthy();
    await user.click(screen.getByRole("option", { name: "Short course" }));
    await waitFor(() => expect(screen.getByText("short")).toBeTruthy());
    expect(calls).toEqual(["short"]);
  });

  test("select handles ungrouped options through pointer clicks", async () => {
    const user = userEvent.setup();
    let calls: string[] = [];
    render(<SelectProbe onValueChange={(value) => calls.push(value)} />);
    await user.click(screen.getByRole("button", { name: /Race filter/ }));
    await user.click(screen.getByRole("option", { name: "Mile course" }));
    await waitFor(() => expect(screen.getByText("mile")).toBeTruthy());
    expect(calls).toEqual(["mile"]);
  });

  test("modal closes on Escape and restores trigger focus", async () => {
    function Probe() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open settings</button><AppDialog isOpen={open} onOpenChange={setOpen} title="Settings"><p>Dialog body</p></AppDialog></>;
    }
    render(<Probe />);
    const opener = screen.getByRole("button", { name: "Open settings" });
    const dialog = new User({ interactionType: "keyboard" }).createTester("Dialog", { root: opener, overlayType: "modal" });
    await dialog.open();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await dialog.close();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  test("Escape closes an open select before its parent modal", async () => {
    function NestedProbe() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open picker</button><AppDialog isOpen={open} onOpenChange={setOpen} title="Picker"><AppSelect label="Course" value="" onValueChange={() => {}} options={[{ value: "", label: "Any course" }, { value: "short", label: "Short course" }]} /></AppDialog></>;
    }
    render(<NestedProbe />);
    const opener = screen.getByRole("button", { name: "Open picker" });
    const dialog = new User({ interactionType: "keyboard" }).createTester("Dialog", { root: opener, overlayType: "modal" });
    await dialog.open();
    const select = new User({ interactionType: "keyboard" }).createTester("Select", { root: screen.getByRole("button", { name: /Course/ }) });
    await select.open();
    await select.close();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await dialog.close();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  test("search clear action emits the empty value", async () => {
    const user = userEvent.setup();
    let nextQuery = "no query yet";
    render(<PickerSearchBar value="runner" onChange={(next) => { nextQuery = next; }} placeholder="Search cards" />);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(nextQuery).toBe("");
  });

  test("search autofocus runs only for a fine pointer", async () => {
    const originalMatchMedia = window.matchMedia;
    try {
      window.matchMedia = ((query: string) => ({ matches: query.includes("pointer: fine"), media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } })) as typeof window.matchMedia;
      const fine = render(<PickerSearchBar value="" onChange={() => {}} placeholder="Search cards" autoFocus />);
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search cards" })));
      fine.unmount();

      window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } })) as typeof window.matchMedia;
      render(<PickerSearchBar value="" onChange={() => {}} placeholder="Search skills" autoFocus />);
      await waitFor(() => expect(document.activeElement).not.toBe(screen.getByRole("searchbox", { name: "Search skills" })));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
