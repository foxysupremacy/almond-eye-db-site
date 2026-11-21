import { describe, expect, test } from "bun:test";
import { decodeFactor } from "./factor-decoder";
import { localizeSpark } from "./spark-names";

const name = (factorId: number) => localizeSpark(decodeFactor(factorId)).name;

describe("localizeSpark — sparks use the site's JP-server skill names", () => {
  test("skill sparks take the skill name from skills.json, not GameTora's Global name", () => {
    expect(decodeFactor(2003602).name).toBe("Straightaway Adept");
    expect(name(2003602)).toBe("Straight Adept");
  });

  test("unique (green) sparks get the English skill name instead of raw Japanese", () => {
    expect(name(10060301)).toBe("Ashen Trail: Cinderella Gray");
  });

  test("race sparks keep the race name even though they grant a racecourse skill", () => {
    expect(name(1000302)).toBe("Osaka Hai");
  });

  test("sparks missing from the GameTora list resolve through the Japanese factor name", () => {
    expect(decodeFactor(2047902).name).toBe("Factor");
    expect(name(2047902)).toBe("Playful Spirit");
    expect(name(2047302)).toBe("On the Ball");
  });

  test("unlisted sparks with no matching skill fall back to the Japanese name, never 'Factor'", () => {
    expect(name(3103101)).toBe("駿大祭シナリオ");
  });

  test("stars, colour and id are untouched", () => {
    const before = decodeFactor(2003602);
    const after = localizeSpark(before);
    expect([after.factorId, after.type, after.stars]).toEqual([before.factorId, before.type, before.stars]);
  });
});
