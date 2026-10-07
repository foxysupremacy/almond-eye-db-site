import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { charactersById } from "@/lib/data/registry";
import type { LineageStatBonuses } from "@/lib/lineage/factor-decoder";
import { TraineeSpotlight } from "./trainee-spotlight";

const bonuses: LineageStatBonuses = { speed: 0, stamina: 0, power: 0, guts: 0, wiz: 0 };
const chara = charactersById.get(106802)!;

test("compact spotlight collapses stats behind a disclosure", () => {
  const html = renderToStaticMarkup(<TraineeSpotlight compact targetChara={chara} statBonuses={bonuses} onSelectTrainee={() => {}} />);
  expect(html).toContain("Trainee stats &amp; aptitudes");
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("h-14 w-14");
  expect(html).toContain("Target trainee");
});

test("compact spotlight without a trainee renders a full-width select button", () => {
  const html = renderToStaticMarkup(<TraineeSpotlight compact targetChara={null} statBonuses={bonuses} onSelectTrainee={() => {}} />);
  expect(html).toContain("Select trainee");
  expect(html).toContain("min-h-11");
  expect(html).not.toContain("autofocus");
});

test("default spotlight is unchanged", () => {
  const html = renderToStaticMarkup(<TraineeSpotlight targetChara={chara} statBonuses={bonuses} onSelectTrainee={() => {}} />);
  expect(html).not.toContain("Trainee stats &amp; aptitudes");
  expect(html).toContain("Target Trainee");
});
