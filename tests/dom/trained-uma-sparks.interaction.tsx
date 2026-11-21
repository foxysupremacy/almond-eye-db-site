import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeckProvider } from "@/features/deck/state";
import TrainedUmaModal from "@/features/veterans/components/trained-uma-modal";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";

afterEach(cleanup);

const VET = {
  card_id: 111401,
  create_time: "2026-03-20 22:39:51",
  rank: 81,
  rank_score: 57000,
  speed: 1200,
  stamina: 900,
  power: 800,
  guts: 400,
  wiz: 600,
  skill_array: [{ skill_id: 200362, level: 1 }],
  // Straightaway Adept (GameTora/Global) = Straight Adept (site), plus an unlisted spark
  factor_info_array: [{ factor_id: 2003602 }, { factor_id: 2047902 }],
} as KyumaruVeteranItem;

test("the Sparks tab uses the site's skill names, not GameTora's Global names", async () => {
  const user = userEvent.setup();
  render(
    <DeckProvider>
      <TrainedUmaModal isOpen onClose={() => {}} veteran={VET} />
    </DeckProvider>,
  );
  await user.click(screen.getByRole("button", { name: /Sparks & Factors/ }));
  expect(screen.getAllByText("Straight Adept").length).toBeGreaterThan(0);
  expect(screen.queryByText("Straightaway Adept")).toBeNull();
  expect(screen.getAllByText("Playful Spirit").length).toBeGreaterThan(0);
  expect(screen.queryByText("Factor")).toBeNull();
});
