import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { OwnedFirstToggle } from "@/features/collection/components/owned-first-toggle";

afterEach(cleanup);

test("Owned first is a keyboard-accessible React Aria toggle", async () => {
  const user = userEvent.setup();
  function Probe() {
    const [ownedFirst, setOwnedFirst] = useState(false);
    return <><OwnedFirstToggle isSelected={ownedFirst} onChange={setOwnedFirst} controls="results" /><div id="results" /></>;
  }

  render(<Probe />);
  const toggle = screen.getByRole("button", { name: "Owned first" });
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(toggle.getAttribute("aria-controls")).toBe("results");
  toggle.focus();
  await user.keyboard(" ");
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
});
