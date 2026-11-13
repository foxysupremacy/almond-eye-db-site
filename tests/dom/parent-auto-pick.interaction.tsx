import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ParentAutoPick } from "@/features/deck/components/parent-auto-pick-bar";
import { DeckProvider, useDeckSlots, useDeckTrack } from "@/features/deck/state";
import {
  __clearAutoPickCache,
  useParentAutoPickViewModel,
  type AutoPickWorkerFactory,
  type AutoPickWorkerLike,
} from "@/features/deck/view-models";
import type { AutoPickWorkerMessage } from "@/features/deck/workers/parent-auto-pick.worker";
import { cardMetaMap, cardsById, latestScenarioLinks } from "@/lib/data/registry";
import { AUTO_PICK_SETTINGS_KEY, palCardOptions, scenarioLabel, type RawSkillValue, type ScoreRequest } from "@/lib/parent-autopick";

afterEach(() => { cleanup(); localStorage.clear(); __clearAutoPickCache(); });

interface FakeWorker extends AutoPickWorkerLike { posted: ScoreRequest[]; terminated: boolean; emit(m: AutoPickWorkerMessage): void }

function valuesFor(req: ScoreRequest): Record<number, RawSkillValue> {
  const values: Record<number, RawSkillValue> = {};
  for (const id of req.skillIds) values[id] = { skillId: id, bashin: (id % 97) / 10 + 0.1, activates: true, groups: ["target_speed"] };
  return values;
}

function fakeWorkers() {
  const workers: FakeWorker[] = [];
  const posted: ScoreRequest[] = [];
  const factory: AutoPickWorkerFactory = () => {
    const w: FakeWorker = {
      onmessage: null,
      posted,
      terminated: false,
      postMessage(req: ScoreRequest) { posted.push(req); },
      terminate() { w.terminated = true; },
      emit(m) { w.onmessage?.({ data: m } as MessageEvent<AutoPickWorkerMessage>); },
    };
    workers.push(w);
    return w;
  };
  /** Answers the latest request with positive speed values for every requested skill. */
  const respond = () => {
    const req = posted[posted.length - 1];
    const values: Record<number, RawSkillValue> = {};
    for (const id of req.skillIds) values[id] = { skillId: id, bashin: (id % 97) / 10 + 0.1, activates: true, groups: ["target_speed"] };
    const w = workers[workers.length - 1];
    act(() => {
      w.emit({ type: "progress", key: req.key, done: req.skillIds.length, total: req.skillIds.length });
      w.emit({ type: "result", key: req.key, values });
    });
  };
  return { factory, workers, posted, respond };
}

const scenario = latestScenarioLinks()[0];
const palId = palCardOptions(scenario, cardsById)[0].id;
const scenarioEn = scenarioLabel(scenario).en;
const ownedIds = [...cardsById.values()]
  .filter((c) => c.rarity === 3 && (cardMetaMap[String(c.id)]?.hints.length ?? 0) > 0 && !scenario.palCardIds.includes(c.id))
  .slice(0, 12)
  .map((c) => c.id);

function seedOwned(ids: number[]) {
  localStorage.setItem("almondeye_owned_cards", JSON.stringify(Object.fromEntries(ids.map((id) => [String(id), 4]))));
}

const wrapper = ({ children }: { children: ReactNode }) => <DeckProvider>{children}</DeckProvider>;

function renderProbe(factory: AutoPickWorkerFactory) {
  return renderHook(() => ({ vm: useParentAutoPickViewModel(factory), track: useDeckTrack(), slots: useDeckSlots() }), { wrapper });
}

async function withRace(result: { current: ReturnType<typeof renderProbe>["result"]["current"] }) {
  await waitFor(() => expect(result.current.track.course).not.toBeNull());
  act(() => result.current.track.setRunningStyle(2));
  await waitFor(() => expect(result.current.vm.state.disabledReason).toBeNull());
}

describe("useParentAutoPickViewModel", () => {
  test("no owned cards disables run", async () => {
    const { factory, posted } = fakeWorkers();
    const { result } = renderProbe(factory);
    await waitFor(() => expect(result.current.track.course).not.toBeNull());
    act(() => result.current.track.setRunningStyle(2));
    expect(result.current.vm.state.disabledReason).toBe("no-owned-cards");
    act(() => result.current.vm.commands.run());
    expect(result.current.vm.state.previewOpen).toBe(false);
    expect(posted).toHaveLength(0);
  });

  test("run scores, then shows the locked pal card first", async () => {
    seedOwned(ownedIds);
    const { factory, posted, respond } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    expect(result.current.vm.state.scenarioId).toBe(scenario.scenarioId);
    expect(result.current.vm.state.palCardId).toBe(palId);
    act(() => result.current.vm.commands.run());
    expect(result.current.vm.state.previewOpen).toBe(true);
    expect(result.current.vm.state.status).toBe("scoring");
    expect(posted).toHaveLength(1);
    respond();
    expect(result.current.vm.state.status).toBe("ready");
    const { rows, emptySlots, total } = result.current.vm.state;
    expect(rows[0].card.id).toBe(palId);
    expect(rows[0].locked).toBe(true);
    expect(rows.length).toBeGreaterThan(1);
    expect(emptySlots).toBe(6 - rows.length);
    expect(total).toBeCloseTo(rows.reduce((t, r) => t + r.gain, 0));
    expect(result.current.vm.state.flatValue).toBeNull();
  });

  test("a result with a stale key is ignored", async () => {
    seedOwned(ownedIds);
    const { factory, workers, posted } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    act(() => result.current.vm.commands.run());
    // Full, valid values for the real request, but under another key.
    act(() => workers[0].emit({ type: "result", key: `${posted[0].key}|other`, values: valuesFor(posted[0]) }));
    expect(result.current.vm.state.status).not.toBe("ready");
    expect(result.current.vm.state.status).toBe("scoring");
    expect(result.current.vm.state.rows).toHaveLength(0);
  });

  test("a result that arrives while the key is unset is not lost: restoring the key shows it (no stuck scoring)", async () => {
    seedOwned(ownedIds);
    const { factory, workers, posted } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    act(() => result.current.vm.commands.run());
    expect(posted).toHaveLength(1);
    const k1 = posted[0];
    act(() => result.current.track.setRunningStyle(null));
    expect(result.current.vm.state.disabledReason).toBe("no-style");
    act(() => workers[0].emit({ type: "result", key: k1.key, values: valuesFor(k1) }));
    expect(result.current.vm.state.rows).toHaveLength(0);
    act(() => result.current.track.setRunningStyle(2));
    expect(result.current.vm.state.status).toBe("ready");
    expect(result.current.vm.state.rows[0].card.id).toBe(palId);
  });

  test("a result dropped after cancel never blocks a later run on the same key", async () => {
    seedOwned(ownedIds);
    const { factory, workers, posted, respond } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    act(() => result.current.vm.commands.run());
    const k1 = posted[0];
    act(() => result.current.vm.commands.cancel());
    act(() => result.current.track.setRunningStyle(3));
    act(() => workers[0].emit({ type: "error", key: k1.key, message: "late" }));
    act(() => result.current.track.setRunningStyle(2));
    act(() => result.current.vm.commands.run());
    expect(result.current.vm.state.status).toBe("scoring");
    expect(posted).toHaveLength(2);
    expect(posted[1].key).toBe(k1.key);
    respond();
    expect(result.current.vm.state.status).toBe("ready");
  });

  test("changing the race while scoring restarts the worker; a late old answer changes nothing", async () => {
    seedOwned(ownedIds);
    const { factory, workers, posted, respond } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    act(() => result.current.vm.commands.run());
    const k1 = posted[0];
    act(() => result.current.track.setRunningStyle(3));
    expect(posted).toHaveLength(2);
    expect(posted[1].key).not.toBe(k1.key);
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(result.current.vm.state.status).toBe("scoring");
    act(() => workers[0].emit({ type: "result", key: k1.key, values: valuesFor(k1) }));
    expect(result.current.vm.state.status).toBe("scoring");
    expect(result.current.vm.state.rows).toHaveLength(0);
    respond();
    expect(result.current.vm.state.status).toBe("ready");
    expect(result.current.vm.state.rows.length).toBeGreaterThan(0);
  });

  test("toggleGroup persists and re-picks without a second worker request", async () => {
    seedOwned(ownedIds);
    const { factory, posted, respond } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    act(() => result.current.vm.commands.run());
    respond();
    expect(result.current.vm.state.enabledGroups).not.toContain("recovery");
    act(() => result.current.vm.commands.toggleGroup("recovery"));
    expect(result.current.vm.state.enabledGroups).toContain("recovery");
    expect(JSON.parse(localStorage.getItem(AUTO_PICK_SETTINGS_KEY)!).enabledGroups).toContain("recovery");
    expect(posted).toHaveLength(1);
    expect(result.current.vm.state.status).toBe("ready");
  });

  test("apply fills the Parent Deck and closes; cancel changes nothing", async () => {
    seedOwned(ownedIds);
    const { factory, respond } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    act(() => result.current.vm.commands.run());
    respond();
    act(() => result.current.vm.commands.cancel());
    expect(result.current.vm.state.previewOpen).toBe(false);
    expect(result.current.slots.parentSlots.every((s) => s === null)).toBe(true);

    act(() => result.current.vm.commands.run());
    expect(result.current.vm.state.status).toBe("ready");
    const ids = result.current.vm.state.rows.map((r) => r.card.id);
    act(() => result.current.vm.commands.apply());
    expect(result.current.vm.state.previewOpen).toBe(false);
    expect(result.current.slots.parentSlots.slice(0, ids.length).map((c) => c?.id)).toEqual(ids);
  });

  test("a pal card also in the Main Deck stays locked with zero gain; other Main Deck cards are excluded", async () => {
    seedOwned(ownedIds);
    const { factory, respond } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    const other = ownedIds[0];
    act(() => {
      result.current.slots.setMainCard(0, cardsById.get(palId)!);
      result.current.slots.setMainCard(1, cardsById.get(other)!);
    });
    await waitFor(() => expect(result.current.slots.mainSlots.filter(Boolean)).toHaveLength(2));
    act(() => result.current.vm.commands.run());
    respond();
    const { rows } = result.current.vm.state;
    expect(rows[0].card.id).toBe(palId);
    expect(rows[0].locked).toBe(true);
    expect(rows[0].gain).toBe(0);
    expect(rows.some((r) => r.card.id === other)).toBe(false);
  });

  test("Main Deck covers only the event option it uses: the unchosen option's skill is still valued", async () => {
    // Card 30297, event 48: option 1 grants 200232, option 2 grants 200162.
    // Card 30075 has both 200232 and 200162 as hints.
    const mainId = 30297, eventId = 48, chosen = 200232, unchosen = 200162, candidateId = 30075;
    seedOwned([candidateId]);
    const { factory, respond } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    act(() => {
      result.current.slots.setMainCard(0, cardsById.get(mainId)!);
      result.current.slots.setChainChoice("main", mainId, eventId, 1);
    });
    await waitFor(() => expect(result.current.slots.getChainChoice("main", mainId, eventId)).toBe(1));
    act(() => result.current.vm.commands.run());
    respond();
    const row = result.current.vm.state.rows.find((r) => r.card.id === candidateId);
    expect(row).toBeTruthy();
    const listed = row!.skills.map((s) => s.skillId);
    expect(listed).toContain(unchosen);
    expect(listed).not.toContain(chosen);
  });

  test("after Apply, every skill credited in the preview is in the Parent Deck's skill list, even with stale chain choices", async () => {
    seedOwned(ownedIds);
    const { factory, respond } = fakeWorkers();
    const { result } = renderProbe(factory);
    await withRace(result);
    act(() => result.current.vm.commands.run());
    respond();
    const rows = result.current.vm.state.rows;
    expect(rows.length).toBeGreaterThan(1);
    // Stale choices (an index no event has) for every branching event of every picked card.
    // The legacy per-card key is covered by lib/deck/apply-parent-deck.test.ts.
    let staleCount = 0;
    act(() => {
      for (const row of rows) {
        for (const ev of cardMetaMap[String(row.card.id)]?.eventDetails ?? []) {
          if (ev.choices.length < 2) continue;
          result.current.slots.setChainChoice("parent", row.card.id, ev.eventId, 99);
          staleCount++;
        }
      }
    });
    expect(staleCount).toBeGreaterThan(0);
    const credited = rows.flatMap((r) => r.skills.map((s) => s.skillId));
    act(() => result.current.vm.commands.apply());
    await waitFor(() => expect(result.current.slots.parentSkills.length).toBeGreaterThan(0));
    await waitFor(() => {
      const ids = new Set(result.current.slots.parentSkills.map((s) => s.id));
      expect(credited.filter((id) => !ids.has(id))).toEqual([]);
    });
  });

  test("the worker is terminated on unmount", async () => {
    seedOwned(ownedIds);
    const { factory, workers } = fakeWorkers();
    const { result, unmount } = renderProbe(factory);
    await withRace(result);
    expect(workers).toHaveLength(0);
    act(() => result.current.vm.commands.run());
    expect(workers).toHaveLength(1);
    unmount();
    expect(workers[0].terminated).toBe(true);
  });
});

describe("ParentAutoPick views", () => {
  type Track = ReturnType<typeof useDeckTrack>;
  type Slots = ReturnType<typeof useDeckSlots>;

  function renderViews(factory: AutoPickWorkerFactory) {
    const probe: { track: Track | null; slots: Slots | null } = { track: null, slots: null };
    function Probe() {
      probe.track = useDeckTrack();
      probe.slots = useDeckSlots();
      return null;
    }
    render(
      <DeckProvider>
        <Probe />
        <ParentAutoPick createWorker={factory} />
      </DeckProvider>,
    );
    return probe;
  }

  async function pickRace(probe: { track: Track | null }) {
    await waitFor(() => expect(probe.track?.course).not.toBeNull());
    act(() => probe.track!.setRunningStyle(2));
  }

  test("the bar renders the scenario select, seven group toggles and a disabled Auto pick when nothing is owned", async () => {
    const { factory } = fakeWorkers();
    const probe = renderViews(factory);
    await pickRace(probe);
    expect(screen.getByRole("button", { name: /Farming scenario/ })).toBeTruthy();
    const toggles = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
    expect(toggles).toHaveLength(7);
    const pressed = toggles.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent);
    expect(pressed).toEqual(["Target speed", "Current speed", "Acceleration"]);
    const run = screen.getByRole("button", { name: "Auto pick" });
    expect(run.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Import your cards first")).toBeTruthy();
    expect(screen.queryByText("Auto pick preview")).toBeNull();
  });

  test("a group toggle flips aria-pressed", async () => {
    seedOwned(ownedIds);
    const user = userEvent.setup();
    const { factory } = fakeWorkers();
    const probe = renderViews(factory);
    await pickRace(probe);
    const recovery = screen.getByRole("button", { name: "Recovery" });
    expect(recovery.getAttribute("aria-pressed")).toBe("false");
    await user.click(recovery);
    expect(screen.getByRole("button", { name: "Recovery" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("Auto pick opens the preview with the Scenario Link row; Apply fills the deck and closes", async () => {
    seedOwned(ownedIds);
    const user = userEvent.setup();
    const { factory, respond } = fakeWorkers();
    const probe = renderViews(factory);
    await pickRace(probe);
    const run = screen.getByRole("button", { name: "Auto pick" });
    await waitFor(() => expect(run.hasAttribute("disabled")).toBe(false));
    await user.click(run);
    expect(await screen.findByText("Auto pick preview")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply" }).hasAttribute("disabled")).toBe(true);
    respond();
    expect(await screen.findByText("Scenario Link")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(/^\+\d+\.\d{2} Bashin$/)).toBeTruthy();
    const apply = screen.getByRole("button", { name: "Apply" });
    expect(apply.hasAttribute("disabled")).toBe(false);
    await user.click(apply);
    await waitFor(() => expect(screen.queryByText("Auto pick preview")).toBeNull());
    expect(probe.slots!.parentSlots[0]?.id).toBe(palId);
  });

  test("Cancel closes the preview without changing the deck", async () => {
    seedOwned(ownedIds);
    const user = userEvent.setup();
    const { factory, respond } = fakeWorkers();
    const probe = renderViews(factory);
    await pickRace(probe);
    const run = screen.getByRole("button", { name: "Auto pick" });
    await waitFor(() => expect(run.hasAttribute("disabled")).toBe(false));
    await user.click(run);
    respond();
    await screen.findByText("Scenario Link");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Auto pick preview")).toBeNull());
    expect(probe.slots!.parentSlots.every((s) => s === null)).toBe(true);
  });

  test("Import your cards first links to the importer and describes the disabled button", async () => {
    const { factory } = fakeWorkers();
    const probe = renderViews(factory);
    await pickRace(probe);
    const link = screen.getByRole("link", { name: "Import your cards first" });
    expect(link.getAttribute("href")).toBe("/import");
    const run = screen.getByRole("button", { name: "Auto pick" });
    expect(run.getAttribute("aria-describedby")).toBe(link.id);
  });

  test("Pick a race first shows before the race loads; Pick a running style first without a style", async () => {
    seedOwned(ownedIds);
    const { factory } = fakeWorkers();
    const probe = renderViews(factory);
    expect(probe.track?.course ?? null).toBeNull();
    const raceReason = screen.getByText("Pick a race first");
    expect(screen.getByRole("button", { name: "Auto pick" }).getAttribute("aria-describedby")).toBe(raceReason.id);
    await waitFor(() => expect(probe.track?.course).not.toBeNull());
    act(() => probe.track!.setRunningStyle(null));
    expect(await screen.findByText("Pick a running style first")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Auto pick" }).hasAttribute("disabled")).toBe(true);
  });

  test("a flat-valued skill shows the flat suffix and the legend; group labels and the race summary show", async () => {
    seedOwned(ownedIds);
    const user = userEvent.setup();
    const { factory, workers, posted } = fakeWorkers();
    const probe = renderViews(factory);
    await pickRace(probe);
    await user.click(screen.getByRole("button", { name: "Recovery" }));
    const run = screen.getByRole("button", { name: "Auto pick" });
    await waitFor(() => expect(run.hasAttribute("disabled")).toBe(false));
    await user.click(run);
    const req = posted[posted.length - 1];
    const values: Record<number, RawSkillValue> = {};
    for (const id of req.skillIds) {
      values[id] = id % 3 === 0
        ? { skillId: id, bashin: 0, activates: true, groups: ["recovery"] }
        : { skillId: id, bashin: (id % 97) / 10 + 0.1, activates: true, groups: ["target_speed"] };
    }
    act(() => workers[workers.length - 1].emit({ type: "result", key: req.key, values }));
    await screen.findByText("Scenario Link");
    expect(screen.getAllByText(/^\+\d+\.\d{2} flat$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/^flat = counted as one average speed skill \(\d+\.\d{2}\)$/)).toBeTruthy();
    expect(screen.getAllByText("Recovery").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Target speed").length).toBeGreaterThan(1);
    expect(screen.getByText(new RegExp(`· ${scenarioEn}$`))).toBeTruthy();
    expect(screen.getByText(/ · Leader · /)).toBeTruthy();
  });

  test("fewer than six picks shows the empty-slots line", async () => {
    seedOwned([ownedIds[0]]);
    const user = userEvent.setup();
    const { factory, respond } = fakeWorkers();
    const probe = renderViews(factory);
    await pickRace(probe);
    const run = screen.getByRole("button", { name: "Auto pick" });
    await waitFor(() => expect(run.hasAttribute("disabled")).toBe(false));
    await user.click(run);
    respond();
    await screen.findByText("Scenario Link");
    expect(screen.getByText("No remaining owned card adds a counted skill.")).toBeTruthy();
  });

  test("a worker error shows its message", async () => {
    seedOwned(ownedIds);
    const user = userEvent.setup();
    const { factory, workers, posted } = fakeWorkers();
    const probe = renderViews(factory);
    await pickRace(probe);
    const run = screen.getByRole("button", { name: "Auto pick" });
    await waitFor(() => expect(run.hasAttribute("disabled")).toBe(false));
    await user.click(run);
    act(() => workers[0].emit({ type: "error", key: posted[0].key, message: "Scoring blew up" }));
    expect(await screen.findByText("Scoring blew up")).toBeTruthy();
  });
});
