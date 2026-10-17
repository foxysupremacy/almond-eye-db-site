import { describe, expect, it } from "bun:test";
import { api } from "@/lib/api";
import { collectSkillSources, groupSkillSources } from "./skill-sources";
import type { CardIndexEntry, CharacterIndexEntry } from "../data/types";

const card = (overrides: Partial<CardIndexEntry>): CardIndexEntry => ({
  id: 1, nameJp: "", nameEn: "Card", rarity: 3, type: "speed", imgUrl: "", portraitUrl: "", eventSkills: [], hintSkills: [], ...overrides,
});
const character = (overrides: Partial<CharacterIndexEntry>): CharacterIndexEntry => ({
  id: 100101, charId: 1001, variant: "01", nameEn: "Trainee", nameJp: "", titleEn: "", titleJp: "", rarity: 3, aptitude: [], baseStats: [], imgUrl: "", ...overrides,
});

describe("collectSkillSources", () => {
  it("classifies card hints, chain/random events and trainee grants", () => {
    const sources = collectSkillSources(
      10,
      [
        card({ id: 1, hintSkills: [10] }),
        card({
          id: 2,
          eventSkills: [10],
          eventDetails: [{ eventId: 5, nameEn: "Chain", nameJp: "", eventType: "chain", chainStep: 2, choices: [{ index: 1, textEn: "Go", textJp: "", skillIds: [10] }] }],
        }),
      ],
      [character({ id: 1, eventSkills: [10] }), character({ id: 2, awakeningSkills: [1, 2, 10] }), character({ id: 3, innateSkills: [10] })],
    );
    expect(sources.map((source) => source.kind).sort()).toEqual(
      ["card-chain", "card-hint", "character-awakening", "character-event", "character-innate"].sort(),
    );
    const awakening = sources.find((source) => source.kind === "character-awakening");
    expect(awakening && "awakeningLevel" in awakening ? awakening.awakeningLevel : null).toBe(4);
    expect(groupSkillSources(sources)[0].kind).toBe("card-chain");
  });

  it("finds the Meisho Doto support card for Roused Spirit in the shipped data", async () => {
    const [cards, characters] = await Promise.all([api.listCardIndex(), api.listCharacters()]);
    const sources = collectSkillSources(204472, cards, characters);
    expect(sources.some((source) => "card" in source && source.card.nameEn.includes("Meisho Doto"))).toBe(true);
  });
});
