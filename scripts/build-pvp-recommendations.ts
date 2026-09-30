/**
 * Normalize the game's race_fit_assistance response into the site's committed
 * runtime dataset. Personal response headers are deliberately discarded.
 *
 * Usage:
 *   bun run data:build:pvp-recommendations -- path/to/game-response.json
 *   PVP_RECOMMENDATIONS_SOURCE=path/to/game-response.json bun run data:refresh
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_SOURCE = path.join(SITE_ROOT, "lib/data/source/game/pvp-recommendations.json");
const OUTPUT = path.join(SITE_ROOT, "lib/data/generated/pvp-recommendations.json");
const SKILLS_INDEX = path.join(SITE_ROOT, "lib/data/generated/skills.json");
const CARDS_INDEX = path.join(SITE_ROOT, "lib/data/generated/cards.json");
const CHARACTERS_INDEX = path.join(SITE_ROOT, "lib/data/generated/characters.json");

type JsonObject = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(message);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function integer(value: unknown, label: string, min = 0): number {
  if (!Number.isInteger(value) || (value as number) < min) fail(`${label} must be an integer >= ${min}`);
  return value as number;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") fail(`${label} must be a string`);
  return value;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") fail(`${label} must be a boolean`);
  return value;
}

function normalizeResponse(input: unknown) {
  const response = object(input, "response");
  const data = object(response.data, "response.data");
  const assistance = array(data.race_fit_assistance_array, "data.race_fit_assistance_array");
  const scenarioCards = array(
    data.recommended_scenario_support_card_array,
    "data.recommended_scenario_support_card_array",
  );

  const raceFitAssistance = assistance.map((rawEvent, eventIndex) => {
    const event = object(rawEvent, `race_fit_assistance_array[${eventIndex}]`);
    const races = array(event.target_race_array, `event ${eventIndex}.target_race_array`);
    return {
      assistanceId: integer(event.assistance_id, `event ${eventIndex}.assistance_id`, 1),
      eventType: integer(event.event_type, `event ${eventIndex}.event_type`, 1),
      eventId: integer(event.event_id, `event ${eventIndex}.event_id`, 1),
      eventStartTime: text(event.event_start_time, `event ${eventIndex}.event_start_time`),
      endTime: text(event.end_time, `event ${eventIndex}.end_time`),
      schedule: text(event.schedule, `event ${eventIndex}.schedule`),
      races: races.map((rawRace, raceIndex) => {
        const race = object(rawRace, `event ${eventIndex}.race[${raceIndex}]`);
        const successionCards = array(
          race.recommended_succession_card_array ?? [],
          `event ${eventIndex}.race[${raceIndex}].recommended_succession_card_array`,
        );
        const skills = array(
          race.recommended_skill_array ?? [],
          `event ${eventIndex}.race[${raceIndex}].recommended_skill_array`,
        );
        const styleBoolean = (source: JsonObject, style: string, label: string) =>
          bool(source[`running_style_${style}`], `${label}.running_style_${style}`);
        const styleValue = (source: JsonObject, style: string, label: string) =>
          integer(source[`running_style_${style}`], `${label}.running_style_${style}`);

        return {
          eventSubId: integer(race.event_sub_id, `event ${eventIndex}.race[${raceIndex}].event_sub_id`),
          season: integer(race.season, `event ${eventIndex}.race[${raceIndex}].season`),
          timezone: integer(race.timezone, `event ${eventIndex}.race[${raceIndex}].timezone`),
          weather: integer(race.weather, `event ${eventIndex}.race[${raceIndex}].weather`),
          ground: integer(race.ground, `event ${eventIndex}.race[${raceIndex}].ground`),
          entryCount: integer(race.entry_num, `event ${eventIndex}.race[${raceIndex}].entry_num`, 1),
          raceCourseSetId: integer(race.race_course_set_id, `event ${eventIndex}.race[${raceIndex}].race_course_set_id`, 1),
          recommendedSuccessionCharacters: successionCards.map((rawCard, cardIndex) => {
            const card = object(rawCard, `event ${eventIndex}.race[${raceIndex}].succession[${cardIndex}]`);
            const label = `event ${eventIndex}.race[${raceIndex}].succession[${cardIndex}]`;
            return {
              cardId: integer(card.card_id, `${label}.card_id`, 1),
              runningStyle: {
                nige: styleBoolean(card, "nige", label),
                senko: styleBoolean(card, "senko", label),
                sashi: styleBoolean(card, "sashi", label),
                oikomi: styleBoolean(card, "oikomi", label),
              },
            };
          }),
          recommendedSkills: skills.map((rawSkill, skillIndex) => {
            const skill = object(rawSkill, `event ${eventIndex}.race[${raceIndex}].skills[${skillIndex}]`);
            const label = `event ${eventIndex}.race[${raceIndex}].skills[${skillIndex}]`;
            return {
              skillId: integer(skill.skill_id, `${label}.skill_id`, 1),
              supportCardIds: array(skill.support_card_ids, `${label}.support_card_ids`).map((id, idIndex) =>
                integer(id, `${label}.support_card_ids[${idIndex}]`, 1),
              ),
              runningStyleValues: {
                nige: styleValue(skill, "nige", label),
                senko: styleValue(skill, "senko", label),
                sashi: styleValue(skill, "sashi", label),
                oikomi: styleValue(skill, "oikomi", label),
              },
            };
          }),
        };
      }),
    };
  });

  const recommendedScenarioSupportCards = scenarioCards.map((rawCard, index) => {
    const card = object(rawCard, `recommended_scenario_support_card_array[${index}]`);
    return {
      supportCardId: integer(card.support_card_id, `scenario card ${index}.support_card_id`, 1),
      scenarioId: integer(card.scenario_id, `scenario card ${index}.scenario_id`, 1),
    };
  });

  return {
    version: 1 as const,
    raceFitAssistance,
    recommendedScenarioSupportCards,
  };
}

function warnUnresolvedReferences(payload: ReturnType<typeof normalizeResponse>) {
  const readIds = (file: string): Set<number> => {
    if (!fs.existsSync(file)) return new Set();
    const rows = JSON.parse(fs.readFileSync(file, "utf8")) as Array<{ id: number }>;
    return new Set(rows.map((row) => row.id));
  };
  const skills = readIds(SKILLS_INDEX);
  const cards = readIds(CARDS_INDEX);
  const characters = readIds(CHARACTERS_INDEX);
  if (!skills.size || !cards.size || !characters.size) return;

  const missingSkills = new Set<number>();
  const missingSupportCards = new Set<number>();
  const missingCharacters = new Set<number>();
  for (const event of payload.raceFitAssistance) {
    for (const race of event.races) {
      for (const skill of race.recommendedSkills) {
        if (!skills.has(skill.skillId)) missingSkills.add(skill.skillId);
        for (const cardId of skill.supportCardIds) {
          if (!cards.has(cardId)) missingSupportCards.add(cardId);
        }
      }
      for (const character of race.recommendedSuccessionCharacters) {
        if (!characters.has(character.cardId)) missingCharacters.add(character.cardId);
      }
    }
  }
  if (missingSkills.size) console.warn(`Unresolved skill IDs: ${[...missingSkills].sort((a, b) => a - b).join(", ")}`);
  if (missingSupportCards.size) console.warn(`Unresolved support card IDs: ${[...missingSupportCards].sort((a, b) => a - b).join(", ")}`);
  if (missingCharacters.size) console.warn(`Unresolved character IDs: ${[...missingCharacters].sort((a, b) => a - b).join(", ")}`);
}

const sourceArg = process.argv.slice(2).find((arg) => arg !== "--");
const sourcePath = path.resolve(process.env.PVP_RECOMMENDATIONS_SOURCE || sourceArg || DEFAULT_SOURCE);

try {
  if (!fs.existsSync(sourcePath)) {
    fail(`Input file not found: ${sourcePath}\nPass a response path or set PVP_RECOMMENDATIONS_SOURCE.`);
  }
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const normalized = normalizeResponse(source);
  warnUnresolvedReferences(normalized);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(normalized)}\n`);

  const raceCount = normalized.raceFitAssistance.reduce((sum, event) => sum + event.races.length, 0);
  const skillCount = normalized.raceFitAssistance.reduce(
    (sum, event) => sum + event.races.reduce((raceSum, race) => raceSum + race.recommendedSkills.length, 0),
    0,
  );
  console.log(`Wrote ${path.relative(SITE_ROOT, OUTPUT)}: ${normalized.raceFitAssistance.length} events, ${raceCount} races, ${skillCount} skill recommendations, ${normalized.recommendedScenarioSupportCards.length} scenario cards.`);
  const eventTypeNames: Record<number, string> = { 1: "Champions Meeting", 2: "League of Heroes", 3: "Master Challenge" };
  for (const event of normalized.raceFitAssistance) {
    const skills = event.races.reduce((sum, race) => sum + race.recommendedSkills.length, 0);
    console.log(`  ${eventTypeNames[event.eventType] ?? `Event type ${event.eventType}`} #${event.eventId}: ${event.races.length} races, ${skills} skill recommendations.`);
  }
} catch (error) {
  console.error(`Failed to build PvP recommendations: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
