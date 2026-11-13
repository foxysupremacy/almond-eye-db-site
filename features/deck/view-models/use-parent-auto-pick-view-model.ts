"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOwnedCards } from "@/app/common/hooks/use-owned-cards";
import { useRaceImpactProfile } from "@/app/common/hooks/use-race-impact-profile";
import { cardMetaMap, cardsById, latestScenarioLinks, skillIconById, skillMetaMap, skillsById } from "@/lib/data/registry";
import type { CardIndexEntry } from "@/lib/data/types";
import {
  autoPickCacheKey,
  buildAutoPickCard,
  buildValueTable,
  candidateCardIds,
  collectSkillIds,
  defaultAutoPickSettings,
  grantedSkillIds,
  loadAutoPickSettings,
  palCardOptions,
  pickParentDeck,
  resolvePalCard,
  resolveSkillId,
  saveAutoPickSettings,
  scenarioLabel,
  toggleGroup as toggleSkillGroup,
  type AutoPickCard,
  type AutoPickResult,
  type AutoPickSettings,
  type RawSkillValue,
  type ScoreRequest,
  type SkillGroup,
} from "@/lib/parent-autopick";
import { distanceLabel, terrainLabel } from "@/lib/api";
import { DECK_SIZE, RUNNING_STYLE_LABELS } from "@/lib/deck/constants";
import { getDefaultChoiceIndex } from "@/lib/deck/event-choices";
import { useDeckSlots } from "../state/deck-slots-context";
import { useDeckTrack } from "../state/deck-track-context";
import type { AutoPickWorkerMessage } from "../workers/parent-auto-pick.worker";

export type { AutoPickWorkerMessage } from "../workers/parent-auto-pick.worker";

export type AutoPickDisabledReason = "no-owned-cards" | "no-race" | "no-style" | null;
export interface AutoPickPreviewSkill { skillId: number; nameEn: string; nameJp: string; iconId: number | null; groups: SkillGroup[]; value: number; flat: boolean; source: "hint" | "event"; choiceTextEn?: string }
export interface AutoPickPreviewRow { card: CardIndexEntry; locked: boolean; limitBreak: number | undefined; gain: number; skills: AutoPickPreviewSkill[] }
export type AutoPickStatus = "idle" | "scoring" | "ready" | "error";

export interface ParentAutoPickViewModel {
  readonly state: {
    readonly scenarios: readonly { id: number; en: string; jp: string }[];
    readonly scenarioId: number | null;
    readonly palOptions: readonly { card: CardIndexEntry; limitBreak: number | undefined }[];
    readonly palCardId: number | null;
    readonly enabledGroups: readonly SkillGroup[];
    readonly disabledReason: AutoPickDisabledReason;
    readonly status: AutoPickStatus;
    readonly progress: { done: number; total: number } | null;
    readonly errorMessage: string | null;
    readonly previewOpen: boolean;
    readonly rows: readonly AutoPickPreviewRow[];
    readonly emptySlots: number;
    readonly total: number;
    readonly flatValue: number | null;
    /** One-line context for the preview header; empty strings when unknown. */
    readonly summary: { readonly raceLabel: string; readonly styleLabel: string; readonly scenarioLabel: string };
  };
  readonly commands: {
    readonly selectScenario: (id: number) => void;
    readonly selectPalCard: (cardId: number) => void;
    readonly toggleGroup: (group: SkillGroup) => void;
    readonly run: () => void;
    readonly apply: () => void;
    readonly cancel: () => void;
  };
}

/** The subset of `Worker` the view model uses; tests inject a fake through the factory parameter. */
export interface AutoPickWorkerLike {
  onmessage: ((event: MessageEvent<AutoPickWorkerMessage>) => void) | null;
  onerror?: ((event: ErrorEvent) => void) | null;
  postMessage(req: ScoreRequest): void;
  terminate(): void;
}
export type AutoPickWorkerFactory = () => AutoPickWorkerLike;

export function createAutoPickWorker(): AutoPickWorkerLike {
  return new Worker(new URL("../workers/parent-auto-pick.worker.ts", import.meta.url), { type: "module" }) as unknown as AutoPickWorkerLike;
}



// Raw skill values per race key (last 4 keys). Entries grow when a later request scores missing ids.
const CACHE_LIMIT = 4;
const cache = new Map<string, Record<number, RawSkillValue>>();
function remember(key: string, values: Record<number, RawSkillValue>) {
  const merged = { ...cache.get(key), ...values };
  cache.delete(key);
  cache.set(key, merged);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

/** Test-only: clear the module cache between tests. */
export function __clearAutoPickCache() { cache.clear(); }

const rarityOf = (id: number): number | undefined => skillMetaMap[id]?.rarity ?? skillsById.get(id)?.rarity;

function toAutoPickCard(card: CardIndexEntry): AutoPickCard {
  return buildAutoPickCard(card, cardMetaMap[String(card.id)], rarityOf);
}

function buildRequest(key: string, skillIds: number[], base: Omit<ScoreRequest, "key" | "skillIds" | "skills">): ScoreRequest {
  const skills: ScoreRequest["skills"] = {};
  for (const id of skillIds) {
    const s = skillsById.get(id);
    if (s) skills[id] = { id: s.id, rarity: s.rarity, conditionGroups: s.conditionGroups };
  }
  return { key, skillIds, skills, ...base };
}

function choiceText(cardId: number, eventId: number | undefined, choiceIndex: number | undefined): string | undefined {
  if (eventId === undefined || choiceIndex === undefined) return undefined;
  const detail = cardMetaMap[String(cardId)]?.eventDetails?.find((d) => d.eventId === eventId);
  return detail?.choices.find((c) => c.index === choiceIndex)?.textEn;
}

/** Turns picker output into display rows. */
export function buildPreviewRows(result: AutoPickResult, groupsOf: (id: number) => SkillGroup[], owned: Readonly<Record<string, number>>): AutoPickPreviewRow[] {
  const rows: AutoPickPreviewRow[] = [];
  for (const pick of result.picks) {
    const card = cardsById.get(pick.cardId);
    if (!card) continue;
    rows.push({
      card,
      locked: pick.locked,
      limitBreak: owned[String(pick.cardId)],
      gain: pick.gain,
      skills: pick.skills.map((s) => {
        const detail = skillsById.get(s.skillId);
        const meta = skillMetaMap[s.skillId];
        return {
          skillId: s.skillId,
          nameEn: detail?.nameEn || meta?.nameEn || String(s.skillId),
          nameJp: detail?.nameJp || meta?.nameJp || "",
          iconId: skillIconById.get(s.skillId) ?? null,
          groups: groupsOf(s.skillId),
          value: s.value,
          flat: s.flat,
          source: s.source,
          choiceTextEn: choiceText(pick.cardId, s.eventId, s.choiceIndex),
        };
      }),
    });
  }
  return rows;
}

interface Job { key: string; idsKey: string; status: "scoring" | "error"; progress: { done: number; total: number } | null; errorMessage: string | null }

export function useParentAutoPickViewModel(createWorker?: AutoPickWorkerFactory): ParentAutoPickViewModel {
  const { mainSlots, mainSkillIdSet, applyParentDeck, getChainChoice } = useDeckSlots();
  const { course, runningStyle, racerCount, activeRaceParameters, trackDetail, activeCourseRow } = useDeckTrack();
  const { ownedCards } = useOwnedCards();
  const [profile] = useRaceImpactProfile();

  // --- Settings (loaded once on mount, saved on every change) ---
  const [settings, setSettings] = useState<AutoPickSettings>(defaultAutoPickSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => { setSettings(loadAutoPickSettings()); }, []);
  const updateSettings = useCallback((next: AutoPickSettings) => {
    settingsRef.current = next;
    setSettings(next);
    saveAutoPickSettings(next);
  }, []);

  // --- Scenario and pal card ---
  const scenarioEntries = useMemo(() => latestScenarioLinks(), []);
  const scenarios = useMemo(() => scenarioEntries.map((e) => ({ id: e.scenarioId, ...scenarioLabel(e) })), [scenarioEntries]);
  const scenarioEntry = scenarioEntries.find((e) => e.scenarioId === settings.scenarioId) ?? scenarioEntries[0] ?? null;
  const scenarioId = scenarioEntry?.scenarioId ?? null;
  const palCards = useMemo(() => (scenarioEntry ? palCardOptions(scenarioEntry, cardsById) : []), [scenarioEntry]);
  const preferredPalId = scenarioId === null ? null : settings.palCardByScenario[String(scenarioId)] ?? null;
  const palCard = useMemo(() => resolvePalCard(palCards, ownedCards, preferredPalId), [palCards, ownedCards, preferredPalId]);
  const palOptions = useMemo(() => palCards.map((card) => ({ card, limitBreak: ownedCards[String(card.id)] })), [palCards, ownedCards]);

  // --- Disabled reason ---
  const hasOwned = Object.keys(ownedCards).length > 0;
  const disabledReason: AutoPickDisabledReason = !hasOwned ? "no-owned-cards" : !course ? "no-race" : !runningStyle ? "no-style" : null;

  // --- Cards ---
  const mainCards = useMemo(() => mainSlots.filter((c): c is CardIndexEntry => c !== null), [mainSlots]);
  const mainDeckIdsKey = mainCards.map((c) => c.id).join(",");
  const lockedCard = useMemo(() => (palCard ? toAutoPickCard(palCard) : null), [palCard]);
  const palAutoCards = useMemo(() => palCards.map(toAutoPickCard), [palCards]);
  const candidates = useMemo(() => {
    const mainIds = new Set(mainDeckIdsKey ? mainDeckIdsKey.split(",").map(Number) : []);
    return candidateCardIds(ownedCards, cardsById, mainIds, palCard?.id ?? null).map((id) => toAutoPickCard(cardsById.get(id)!));
  }, [ownedCards, mainDeckIdsKey, palCard]);
  // Every pal option is scored too, so switching the pal card re-picks without rescoring.
  const neededIds = useMemo(() => collectSkillIds([...palAutoCards, ...candidates]), [palAutoCards, candidates]);

  // --- Request key and cached values ---
  const key = course && runningStyle
    ? autoPickCacheKey({ courseId: course.id, raceParams: activeRaceParameters, racerCount, profile, style: runningStyle })
    : null;
  const keyRef = useRef(key);
  keyRef.current = key;
  const [cacheVersion, setCacheVersion] = useState(0);
  const cachedValues = useMemo(() => (key ? cache.get(key) ?? null : null), [key, cacheVersion]);
  const missingIds = useMemo(() => neededIds.filter((id) => !cachedValues || !(id in cachedValues)), [neededIds, cachedValues]);
  const missingKey = missingIds.join(",");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [runNonce, setRunNonce] = useState(0);
  const inFlightRef = useRef<{ key: string; idsKey: string } | null>(null);

  // --- Worker (lazy, terminated on unmount) ---
  const factoryRef = useRef<AutoPickWorkerFactory>(createWorker ?? createAutoPickWorker);
  const workerRef = useRef<AutoPickWorkerLike | null>(null);

  const ensureWorker = useCallback((): AutoPickWorkerLike => {
    if (workerRef.current) return workerRef.current;
    const worker = factoryRef.current();
    worker.onmessage = (event) => {
      const m = event.data;
      // A finished job always releases its in-flight marker, whatever the current key is;
      // otherwise returning to that key later would wait forever on an answer already dropped.
      if (m.type !== "progress" && inFlightRef.current?.key === m.key) inFlightRef.current = null;
      const isCurrent = m.key === keyRef.current;
      if (m.type === "progress") {
        if (isCurrent) setJob((j) => (j && j.key === m.key ? { ...j, progress: { done: m.done, total: m.total } } : j));
      } else if (m.type === "result") {
        // The values are valid for their own key: cache them even when that key is not current.
        // They only become visible if/when the current key equals m.key.
        remember(m.key, m.values);
        setCacheVersion((v) => v + 1);
        setJob((j) => (j && j.key === m.key ? null : j));
      } else if (isCurrent) {
        setJob((j) => ({ key: m.key, idsKey: j?.idsKey ?? "", status: "error", progress: null, errorMessage: m.message }));
      } else {
        setJob((j) => (j && j.key === m.key ? null : j));
      }
    };
    worker.onerror = (e) => {
      inFlightRef.current = null;
      const k = keyRef.current;
      if (k) setJob({ key: k, idsKey: "", status: "error", progress: null, errorMessage: e.message || "Auto pick worker failed" });
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => () => { workerRef.current?.terminate(); workerRef.current = null; }, []);

  const disabled = disabledReason !== null;
  useEffect(() => {
    if (!previewOpen || !key || disabled || !course || !runningStyle) return;
    if (missingKey === "") return;
    const inFlight = inFlightRef.current;
    if (inFlight && inFlight.key === key && inFlight.idsKey === missingKey) return;
    // A job for another race would only delay this one: restart the worker.
    if (inFlight && inFlight.key !== key && workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    try {
      const req = buildRequest(key, missingKey.split(",").map(Number), {
        course, raceParams: activeRaceParameters, style: runningStyle, racerCount, profile,
      });
      inFlightRef.current = { key, idsKey: missingKey };
      setJob({ key, idsKey: missingKey, status: "scoring", progress: null, errorMessage: null });
      ensureWorker().postMessage(req);
    } catch (e) {
      inFlightRef.current = null;
      setJob({ key, idsKey: missingKey, status: "error", progress: null, errorMessage: e instanceof Error ? e.message : String(e) });
    }
    // course/style/params/profile are all captured by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, key, missingKey, disabled, runNonce, ensureWorker]);

  // --- Status ---
  const complete = key !== null && cachedValues !== null && missingIds.length === 0;
  let status: AutoPickStatus;
  if (!previewOpen || key === null || disabled) status = "idle";
  else if (complete) status = "ready";
  else if (job && job.key === key) status = job.status;
  else status = "scoring";
  const progress = status === "scoring" && job && job.key === key ? job.progress : null;
  const errorMessage = status === "error" && job ? job.errorMessage : null;

  // --- Pick (re-derived without rescoring) ---
  const enabledGroups = settings.enabledGroups;
  const pickResult = useMemo<{ result: AutoPickResult; groupsOf: (id: number) => SkillGroup[] } | null>(() => {
    if (status !== "ready" || !cachedValues) return null;
    const table = buildValueTable(cachedValues, new Set(enabledGroups));
    const covered = new Set<number>();
    for (const id of mainSkillIdSet) {
      covered.add(id);
      const resolved = resolveSkillId(id, rarityOf);
      if (resolved !== null) covered.add(resolved);
    }
    // Main Deck grants only the event option it uses (its chosen or default choice), like the deck's resolver.
    const mainChoiceOf = (cardId: number, eventId: number) => {
      const detail = cardMetaMap[String(cardId)]?.eventDetails?.find((d) => d.eventId === eventId);
      const fallback = detail ? getDefaultChoiceIndex(detail, (sid) => rarityOf(sid) ?? 1) : 1;
      return getChainChoice("main", cardId, eventId, fallback);
    };
    for (const id of grantedSkillIds(mainCards.map(toAutoPickCard), mainChoiceOf)) covered.add(id);
    const result = pickParentDeck({ cards: candidates, values: table, coveredSkillIds: covered, locked: lockedCard });
    return { result, groupsOf: (id) => table.get(id)?.groups ?? cachedValues[id]?.groups ?? ["other"] };
  }, [status, cachedValues, enabledGroups, mainSkillIdSet, mainCards, candidates, lockedCard, getChainChoice]);

  const rows = useMemo(
    () => (pickResult ? buildPreviewRows(pickResult.result, pickResult.groupsOf, ownedCards) : []),
    [pickResult, ownedCards],
  );
  const total = pickResult?.result.total ?? 0;
  const flatValue = useMemo(() => {
    for (const row of rows) for (const s of row.skills) if (s.flat) return s.value;
    return null;
  }, [rows]);

  const scenarioEn = scenarios.find((s) => s.id === scenarioId)?.en ?? "";
  const summary = useMemo(() => ({
    raceLabel: activeCourseRow
      ? [trackDetail?.nameEn, terrainLabel(activeCourseRow.terrain), distanceLabel(activeCourseRow.distance, activeCourseRow.length)].filter(Boolean).join(" ")
      : "",
    styleLabel: runningStyle ? RUNNING_STYLE_LABELS[runningStyle] : "",
    scenarioLabel: scenarioEn,
  }), [activeCourseRow, trackDetail, runningStyle, scenarioEn]);

  // --- Commands ---
  const selectScenario = useCallback((id: number) => {
    updateSettings({ ...settingsRef.current, scenarioId: id });
  }, [updateSettings]);

  const scenarioIdRef = useRef(scenarioId);
  scenarioIdRef.current = scenarioId;
  const selectPalCard = useCallback((cardId: number) => {
    const sid = scenarioIdRef.current;
    if (sid === null) return;
    const current = settingsRef.current;
    updateSettings({ ...current, palCardByScenario: { ...current.palCardByScenario, [String(sid)]: cardId } });
  }, [updateSettings]);

  const toggleGroup = useCallback((group: SkillGroup) => {
    const current = settingsRef.current;
    updateSettings({ ...current, enabledGroups: toggleSkillGroup(current.enabledGroups, group) });
  }, [updateSettings]);

  const run = useCallback(() => {
    if (disabled) return;
    setPreviewOpen(true);
    setRunNonce((n) => n + 1);
  }, [disabled]);

  const pickRef = useRef(pickResult);
  pickRef.current = pickResult;
  const apply = useCallback(() => {
    const current = pickRef.current;
    if (!current) return;
    const chainChoices: Record<string, number> = {};
    for (const p of current.result.picks) Object.assign(chainChoices, p.chainChoices);
    applyParentDeck(current.result.picks.map((p) => p.cardId), chainChoices);
    setPreviewOpen(false);
  }, [applyParentDeck]);

  const cancel = useCallback(() => setPreviewOpen(false), []);

  return {
    state: {
      scenarios,
      scenarioId,
      palOptions,
      palCardId: palCard?.id ?? null,
      enabledGroups,
      disabledReason,
      status,
      progress,
      errorMessage,
      previewOpen,
      rows,
      emptySlots: DECK_SIZE - rows.length,
      total,
      flatValue,
      summary,
    },
    commands: { selectScenario, selectPalCard, toggleGroup, run, apply, cancel },
  };
}
