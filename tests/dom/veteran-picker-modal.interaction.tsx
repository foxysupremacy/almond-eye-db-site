import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DeckProvider } from "@/features/deck/state";
import VeteranPickerModal from "@/features/veterans/pickers/veteran-picker-modal";
import { characters } from "@/lib/data/registry";

afterEach(cleanup);

test("template picker paints its dialog before preparing expensive candidates", async () => {
  const originalWorker = window.Worker;
  let worker: { onmessage: ((event: MessageEvent<{ eligibleCardIds: number[]; uniqueEvals: [] }>) => void) | null } | null = null;
  class EvaluationWorker {
    onmessage: ((event: MessageEvent<{ eligibleCardIds: number[]; uniqueEvals: [] }>) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { worker = this; }
    postMessage() {}
    terminate() {}
  }
  window.Worker = EvaluationWorker as unknown as typeof Worker;

  function Probe() {
    const [open, setOpen] = useState(false);
    return <DeckProvider>
      <button onClick={() => setOpen(true)}>Open template picker</button>
      <VeteranPickerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelectVeteran={() => {}}
        targetCharaId={characters[0].charId}
        slotLabel="Grandparent"
        veterans={[]}
        characters={characters}
        initialTab="templates"
      />
    </DeckProvider>;
  }

  try {
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByRole("button", { name: "Open template picker" }));

    expect(screen.getByRole("dialog", { name: "Select Grandparent" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Preparing candidates");
    expect(worker).toBeTruthy();

    act(() => worker?.onmessage?.({
      data: { eligibleCardIds: characters.map((character) => character.id), uniqueEvals: [] },
    } as MessageEvent<{ eligibleCardIds: number[]; uniqueEvals: [] }>));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByText(/Characters$/)).toBeTruthy();
  } finally {
    window.Worker = originalWorker;
  }
});
