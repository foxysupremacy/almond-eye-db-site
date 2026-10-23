import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { DeckProvider } from "@/features/deck/state";
import { CharacterDetailSheet } from "@/features/collection/components/character-detail-sheet";
import { SupportCardDetailSheet } from "@/features/collection/components/support-card-detail-sheet";
import type { CharacterIndexEntry, CardIndexEntry } from "@/lib/api";

afterEach(cleanup);

const mockCharacter: CharacterIndexEntry = {
  id: 110801,
  charId: 1108,
  variant: "01",
  nameEn: "Duramente",
  nameJp: "ドゥラメンテ",
  titleEn: "Red in Black",
  titleJp: "Red in Black",
  rarity: 3,
  release: "2023-12-28",
  aptitude: ["A", "G", "G", "A", "A", "B", "A", "A", "C", "G"],
  baseStats: [100, 100, 100, 100, 100],
  uniqueSkillId: 101081,
  innateSkills: [20001],
  awakeningSkills: [20002, 20003, 20004, 20005],
  eventSkills: [],
  growthRates: [20, 0, 10, 0, 0],
  imgUrl: "https://cdn.almond-eye.tech/assets/chara_stand/110801/001108/01.png",
};

const mockCard: CardIndexEntry = {
  id: 30188,
  nameEn: "Fine Motion",
  nameJp: "ファインモーション",
  charName: "Fine Motion",
  titleEn: "Thank you for the meal!",
  titleJa: "感謝感激雨あられ",
  rarity: 3,
  type: "wit",
  release: "2021-02-24",
  imgUrl: "https://cdn.almond-eye.tech/support/30188/30188/01.png",
  portraitUrl: "https://cdn.almond-eye.tech/support/30188/30188/02.png",
  eventSkills: [],
  hintSkills: [],
  eventDetails: [],
};

test("CharacterDetailSheet renders hero banner with stacked bilingual typography and release date", () => {
  render(
    <DeckProvider>
      <CharacterDetailSheet
        page
        character={mockCharacter}
        isOpen
        onClose={() => {}}
        details={[3, 5]}
        onSetUmaDetails={() => {}}
        onRemoveUma={() => {}}
      />
    </DeckProvider>
  );

  // English primary title
  const heading = screen.getByRole("heading", { level: 3, name: "Duramente" });
  expect(heading).toBeDefined();

  // Japanese subtitle
  expect(screen.getByText("ドゥラメンテ")).toBeDefined();

  // Release date
  expect(screen.getByText(/Release date/i)).toBeDefined();
  expect(screen.getByText("2023-12-28")).toBeDefined();

  // Stand portrait image
  const img = screen.getByAltText("Duramente") as HTMLImageElement;
  expect(img).toBeDefined();
  expect(img.src).toContain("110801");
});

test("SupportCardDetailSheet displays centered artwork and continuous layout with both Skills and Training Effects", () => {
  render(
    <DeckProvider>
      <SupportCardDetailSheet
        page
        card={mockCard}
        isOpen
        onClose={() => {}}
        limitBreak={4}
        onSetLimitBreak={() => {}}
        onRemoveCard={() => {}}
      />
    </DeckProvider>
  );

  // Centered artwork
  const img = screen.getByAltText("Fine Motion") as HTMLImageElement;
  expect(img).toBeDefined();
  expect(img.src).toContain("01.png");

  // Title and subtitle
  expect(screen.getByText("Fine Motion")).toBeDefined();
  expect(screen.getByText("Thank you for the meal!")).toBeDefined();

  // Continuous layout: Training Effects section header is present directly on the page without tab clicking
  expect(screen.getByText(/Training Effects/i)).toBeDefined();
  expect(screen.getByText(/Limit Break:/i)).toBeDefined();
});
