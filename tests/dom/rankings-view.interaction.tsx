import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeckProvider } from "@/features/deck/state";
import { RankingsFeature } from "@/features/rankings";
import { __clearRankingsCache, type RankingsRunner } from "@/features/rankings/hooks/use-rankings";
import { loadRaceImpactProfile, saveRaceImpactProfile, zeroScore } from "@/lib/race-impact";
import type { RankingRow } from "@/lib/rankings";
import { loadRankingsPrefs, RANKINGS_PREFS_KEY, readStoredStyleTab, saveRankingsPrefs } from "@/features/rankings/model/rankings-prefs";

const originalMatchMedia = window.matchMedia;
afterEach(() => { cleanup(); __clearRankingsCache(); window.matchMedia = originalMatchMedia; localStorage.clear(); });
function viewport(width: number) {
  window.matchMedia = ((q: string) => {
    const min = /min-width:\s*(\d+)px/.exec(q); const max = /max-width:\s*(\d+)px/.exec(q);
    const matches = (min ? width >= +min[1] : true) && (max ? width <= +max[1] : true) && !q.includes("pointer: coarse");
    return { matches, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
  }) as typeof window.matchMedia;
}
function row(costumeId: number, style: 1 | 2 | 3 | 4, total: number, ground: "A" | "B" = "A", totalMax = total * 1.2): RankingRow {
  const s = (id: number, v: number, max: number) => ({ ...zeroScore(id), expectedBashin: v, maxBashin: max, groupIndex: 0, physicsStatus: "modeled" as const });
  const evo = s(101703111, total / 4, totalMax / 4);
  return { costumeId, style, total, totalMax, unique: s(120171, total / 2, totalMax / 2), slot1: { chosen: evo, chosenMax: evo, options: [{ ...evo, weakerThanBase: false }] }, slot2: { chosen: null, chosenMax: null, options: [] }, slot3: { chosen: null, chosenMax: null, options: [] }, recoveryHpPercent: null, groundGrade: ground, distanceGrade: "A", styleGrade: "A" };
}
const stubRunner = (rows: RankingRow[]): RankingsRunner => (req, onProgress) => {
  onProgress(1, 1);
  return { promise: Promise.resolve({ key: req.key, rows, computedMs: 1, errors: [] }), cancel() {} };
};

describe("RankingsFeature", () => {
  test("Evolution 3 pill appears only on rows that have a slot 3", async () => {
    viewport(1440);
    const withSlot3 = row(101301, 2, 9);
    const s3 = { ...zeroScore(101301311), expectedBashin: 1.23, groupIndex: 0, physicsStatus: "modeled" as const };
    withSlot3.slot3 = { chosen: s3, chosenMax: s3, options: [{ ...s3, weakerThanBase: false }] };
    withSlot3.total = 10.23;
    render(<DeckProvider><RankingsFeature runner={stubRunner([withSlot3, row(101703, 2, 7.6)])} /></DeckProvider>);
    const first = await screen.findByRole("listitem", { name: /^Rank 1:/ });
    expect(within(first).getByRole("button", { name: /^Evolution 3: .*, 1\.23 Bashin$/ })).toBeTruthy();
    const second = screen.getByRole("listitem", { name: /^Rank 2:/ });
    expect(within(second).queryByRole("button", { name: /^Evolution 3:/ })).toBeNull();
    expect(within(second).queryByText("Evolution 3")).toBeNull();
    expect(within(second).getAllByRole("button", { name: /^(Unique|Evolution 1):/ }).length).toBe(2);
  });

  test("renders ranked cards, style tabs filter, aptitude toggle, paging", async () => {
    viewport(1440);
    const rows = Array.from({ length: 60 }, (_, i) => row(100101 + i, ((i % 4) + 1) as 1 | 2 | 3 | 4, 100 - i, i === 0 ? "B" : "A"));
    const user = userEvent.setup();
    render(<DeckProvider><RankingsFeature runner={stubRunner(rows)} /></DeckProvider>);
    await waitFor(() => expect(screen.getAllByRole("listitem", { name: /rank/i }).length).toBe(20));
    await user.click(screen.getByRole("button", { name: "Show 20 more" }));
    expect(screen.getAllByRole("listitem", { name: /rank/i }).length).toBe(40);
    await user.click(screen.getByRole("radio", { name: "Leader" }));
    for (const li of screen.getAllByRole("listitem", { name: /rank/i })) expect(within(li).getByText("Leader")).toBeTruthy();
    expect(localStorage.getItem("rankings.v1")).toContain("\"styleTab\":2");
  });

  test("desktop card click selects; pill click opens the details modal", async () => {
    viewport(1440);
    const user = userEvent.setup();
    render(<DeckProvider><RankingsFeature runner={stubRunner([row(101703, 2, 7.6)])} /></DeckProvider>);
    const card = await screen.findByRole("button", { name: /select .* rank 1/i });
    await user.click(card);
    expect(card.getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: /^Unique:/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  test("phone card tap opens the sheet on the unique", async () => {
    viewport(390);
    const user = userEvent.setup();
    render(<DeckProvider><RankingsFeature runner={stubRunner([row(101703, 2, 7.6)])} /></DeckProvider>);
    await user.click(await screen.findByRole("button", { name: /open details .* rank 1/i }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  test("style tabs page by 20 with \"Show 20 more\", capped at 50", async () => {
    viewport(1440);
    const rows = Array.from({ length: 60 }, (_, i) => row(100101 + i, 2, 100 - i));
    const user = userEvent.setup();
    render(<DeckProvider><RankingsFeature runner={stubRunner(rows)} /></DeckProvider>);
    await user.click(await screen.findByRole("radio", { name: "Leader" }));
    await waitFor(() => expect(screen.getAllByRole("listitem", { name: /rank/i }).length).toBe(20));
    await user.click(screen.getByRole("button", { name: "Show 20 more" }));
    expect(screen.getAllByRole("listitem", { name: /rank/i }).length).toBe(40);
    await user.click(screen.getByRole("button", { name: "Show 20 more" }));
    expect(screen.getAllByRole("listitem", { name: /rank/i }).length).toBe(50);
    expect(screen.queryByRole("button", { name: "Show 20 more" })).toBeNull();
  });

  test("\"Include lower aptitude\" reveals the B-ground rank-1 costume", async () => {
    viewport(1440);
    const rows = [row(999001, 2, 50, "B"), row(999002, 2, 40), row(999003, 3, 30)];
    const user = userEvent.setup();
    render(<DeckProvider><RankingsFeature runner={stubRunner(rows)} /></DeckProvider>);
    await waitFor(() => expect(screen.getAllByRole("listitem", { name: /rank/i }).length).toBe(2));
    expect(screen.queryByRole("listitem", { name: /Character 999001/ })).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Include lower aptitude" }));
    expect(screen.getByRole("listitem", { name: "Rank 1: Character 999001" })).toBeTruthy();
  });

  test("progressbar is indeterminate before progress arrives", async () => {
    viewport(1440);
    const pending: RankingsRunner = () => ({ promise: new Promise(() => {}), cancel() {} });
    render(<DeckProvider><RankingsFeature runner={pending} /></DeckProvider>);
    const bar = await screen.findByRole("progressbar", { name: "Ranking progress" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(Number(bar.getAttribute("aria-valuemax"))).toBeGreaterThan(Number(bar.getAttribute("aria-valuemin")));
  });

  test("progressbar with total 0 stays indeterminate and valid", async () => {
    viewport(1440);
    let calls = 0;
    const zero: RankingsRunner = (_req, onProgress) => { calls++; queueMicrotask(() => onProgress(0, 0)); return { promise: new Promise(() => {}), cancel() {} }; };
    render(<DeckProvider><RankingsFeature runner={zero} /></DeckProvider>);
    await waitFor(() => expect(calls).toBeGreaterThan(0));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // deliver the 0/0 progress
    const bar = await screen.findByRole("progressbar", { name: "Ranking progress" });
    expect(screen.getByText("Ranking…")).toBeTruthy();
    expect(screen.queryByText(/0 \/ 0/)).toBeNull();
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(Number(bar.getAttribute("aria-valuemax"))).toBeGreaterThan(Number(bar.getAttribute("aria-valuemin")));
  });

  test("a new result resets paging and the selected card", async () => {
    viewport(1440);
    const rows = Array.from({ length: 60 }, (_, i) => row(100101 + i, ((i % 4) + 1) as 1 | 2 | 3 | 4, 100 - i));
    const user = userEvent.setup();
    render(<DeckProvider><RankingsFeature runner={stubRunner(rows)} /></DeckProvider>);
    await waitFor(() => expect(screen.getAllByRole("listitem", { name: /rank/i }).length).toBe(20));
    await user.click(screen.getByRole("button", { name: "Show 20 more" }));
    expect(screen.getAllByRole("listitem", { name: /rank/i }).length).toBe(40);
    const card = screen.getByRole("button", { name: /select .* rank 1$/i });
    await user.click(card);
    expect(card.getAttribute("aria-pressed")).toBe("true");
    // A profile edit changes the cache key, so a fresh result arrives.
    const p = loadRaceImpactProfile();
    act(() => saveRaceImpactProfile({ ...p, stats: { ...p.stats, speed: p.stats.speed - 10 } }));
    await waitFor(() => expect(screen.getAllByRole("listitem", { name: /rank/i }).length).toBe(20));
    expect(screen.getByRole("button", { name: /select .* rank 1$/i }).getAttribute("aria-pressed")).toBe("false");
  });

  test("progress text and error retry", async () => {
    viewport(1440);
    let calls = 0;
    const failing: RankingsRunner = (req, onProgress) => { calls++; onProgress(120, 268); return { promise: calls === 1 ? Promise.reject(new Error("boom")) : new Promise(() => {}), cancel() {} }; };
    const user = userEvent.setup();
    render(<DeckProvider><RankingsFeature runner={failing} /></DeckProvider>);
    await user.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/Ranking 120 \/ 268/)).toBeTruthy();
  });
});

describe("Rankings score switch: Average | Best case", () => {
  test("prefs: defaults to Average, round-trips Best case, and falls back to Average on an invalid value", () => {
    expect(loadRankingsPrefs()).toEqual({ styleTab: "all", score: "average" });
    saveRankingsPrefs({ styleTab: 2, score: "best" });
    expect(loadRankingsPrefs()).toEqual({ styleTab: 2, score: "best" });
    expect(readStoredStyleTab()).toBe(2);
    localStorage.setItem(RANKINGS_PREFS_KEY, JSON.stringify({ styleTab: 3, score: "max" }));
    expect(loadRankingsPrefs()).toEqual({ styleTab: 3, score: "average" });
    localStorage.setItem(RANKINGS_PREFS_KEY, JSON.stringify({ styleTab: 4 }));
    expect(loadRankingsPrefs()).toEqual({ styleTab: 4, score: "average" });
    localStorage.setItem(RANKINGS_PREFS_KEY, "not json");
    expect(loadRankingsPrefs()).toEqual({ styleTab: "all", score: "average" });
  });

  test("radiogroup 'Score' offers Average (default) and Best case", async () => {
    viewport(1440);
    render(<DeckProvider><RankingsFeature runner={stubRunner([row(101703, 2, 7.6)])} /></DeckProvider>);
    const group = await screen.findByRole("radiogroup", { name: "Score" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Average", "Best case"]);
    expect(within(group).getByRole("radio", { name: "Average" }).getAttribute("aria-checked")).toBe("true");
    expect(within(group).getByRole("radio", { name: "Best case" }).getAttribute("aria-checked")).toBe("false");
  });

  test("cards show both values, the active metric primary; switching re-sorts and persists", async () => {
    viewport(1440);
    // Average order A > B; Best case order B > A.
    const rows = [row(900001, 2, 8, "A", 9), row(900002, 2, 7.99, "A", 9.4)];
    const user = userEvent.setup();
    render(<DeckProvider><RankingsFeature runner={stubRunner(rows)} /></DeckProvider>);
    const first = await screen.findByRole("listitem", { name: /^Rank 1:/ });
    expect(first.getAttribute("aria-label")).toBe("Rank 1: Character 900001");
    expect(within(first).getByText("8.00 avg")).toBeTruthy();
    expect(within(first).getByText("9.00 max")).toBeTruthy();
    expect(within(first).getByText("8.00 avg").className).toContain("font-semibold");
    expect(within(first).getByText("9.00 max").className).not.toContain("font-semibold");
    // Pills follow the active metric.
    expect(within(first).getByRole("button", { name: /^Unique: .*, 4\.00 Bashin$/ })).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "Best case" }));
    const top = screen.getByRole("listitem", { name: /^Rank 1:/ });
    expect(top.getAttribute("aria-label")).toBe("Rank 1: Character 900002");
    expect(within(top).getByText("9.40 max").className).toContain("font-semibold");
    expect(within(top).getByText("7.99 avg").className).not.toContain("font-semibold");
    expect(within(top).getByRole("button", { name: /^Unique: .*, 4\.70 Bashin$/ })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("rankings.v1")!).score).toBe("best");
  });

  test("a stored Best case choice is restored on mount", async () => {
    viewport(1440);
    saveRankingsPrefs({ styleTab: "all", score: "best" });
    render(<DeckProvider><RankingsFeature runner={stubRunner([row(900001, 2, 8, "A", 9), row(900002, 2, 7.99, "A", 9.4)])} /></DeckProvider>);
    await waitFor(() => expect(screen.getByRole("radio", { name: "Best case" }).getAttribute("aria-checked")).toBe("true"));
    await waitFor(() => expect(screen.getByRole("listitem", { name: /^Rank 1:/ }).getAttribute("aria-label")).toBe("Rank 1: Character 900002"));
  });

  test("the modal rail shows Bashin in the active metric", async () => {
    viewport(1440);
    const user = userEvent.setup();
    render(<DeckProvider><RankingsFeature runner={stubRunner([row(900002, 2, 7.99, "A", 9.4)])} /></DeckProvider>);
    await user.click(await screen.findByRole("radio", { name: "Best case" }));
    await user.click(screen.getByRole("button", { name: /^Unique:/ }));
    const rail = await screen.findByRole("complementary", { name: "Skill choices" });
    expect(within(rail).getByText(/\+4\.70/)).toBeTruthy();
  });
});
