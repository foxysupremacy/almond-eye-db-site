"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDeckTrack } from "@/features/deck/state";
import { terrainLabel, turnLabel } from "@/lib/api";
import { skillsById } from "@/lib/data/registry";
import { computePvpSkillZones } from "@/lib/pvp/skill-zones";
import { horseForStrategy, type SkillZoneResult } from "@/lib/skill-engine/zones";
import type { SkillScore } from "@/lib/race-impact";
import { useRaceImpactProfile } from "@/app/common/hooks/use-race-impact-profile";
import { allTabRows, isAtLeastA, rowsForMetric, rowTotal, styleTabRows, type RankingCandidate, type RankingMetric, type RankingRow, type SlotScore } from "@/lib/rankings";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { XIcon } from "@/app/common/ui/primitives/icons";
import {
  ModelAssumptions,
  SkillEffectDetailsModal,
  type RailOption,
  type SkillEffectRail,
} from "@/app/common/ui/skills/effect-details";
import { CourseStrip } from "./components/course-strip";
import { StyleTabs, STYLE_TABS } from "./components/style-tabs";
import { ScoreSwitch } from "./components/score-switch";
import { CharacterCard, type CharacterCardModel, type PillBadge, type PillModel } from "./components/character-card";
import { CharacterCardSkeleton } from "./components/character-card-skeleton";
import { useRankings, type RankingsRunner } from "./hooks/use-rankings";
import { useTier } from "@/app/common/hooks/use-tier";
import { getRankingCandidates } from "./model/build-request";
import { readStoredScore, readStoredStyleTab, saveRankingsPrefs, type StyleTab } from "./model/rankings-prefs";

const PAGE = 20;
const SCORE_CAPTION = "Average = mean over every possible activation point on this map; Best case = the best point.";
// Every tab pages by 20 up to the same cap of 50 (R15).
const LIST_CAP = 50;

const styleLabel = (style: number) => STYLE_TABS.find((t) => t.id === style)?.label ?? "";
const skillName = (id: number) => {
  const s = skillsById.get(id);
  return s?.nameEn || s?.nameJp || `Skill ${id}`;
};

function pillBadge(score: SkillScore): PillBadge | undefined {
  if (score.banned) return "Banned";
  if (score.physicsStatus === "partial") return "Partially modeled";
  if (score.physicsStatus === "not-modeled") return "Not modeled";
  return undefined;
}

/** A skill's value in the chosen metric: expected (average) Bashin, or its best activation point. */
const metricBashin = (score: SkillScore, metric: RankingMetric) => (metric === "best" ? score.maxBashin : score.expectedBashin);
/** The slot's chosen option in the chosen metric. */
const chosenFor = (slot: SlotScore, metric: RankingMetric) => (metric === "best" ? slot.chosenMax : slot.chosen);

function pill(slot: PillModel["slot"], score: SkillScore | null, metric: RankingMetric): PillModel {
  if (!score) return { slot, skillId: null, name: "", iconId: null, bashin: 0 };
  return { slot, skillId: score.skillId, name: skillName(score.skillId), iconId: skillsById.get(score.skillId)?.iconId ?? null, bashin: metricBashin(score, metric), badge: pillBadge(score) };
}

function railOption(score: SkillScore, best: boolean, metric: RankingMetric, weakerThanBase = false): RailOption {
  const s = skillsById.get(score.skillId);
  const badge: RailOption["badge"] = score.banned ? "Banned"
    : weakerThanBase ? "Weaker than base"
    : score.physicsStatus === "partial" ? "Partially modeled"
    : score.physicsStatus === "not-modeled" ? "Not modeled"
    : undefined;
  return { skillId: score.skillId, nameEn: s?.nameEn ?? `Skill ${score.skillId}`, nameJp: s?.nameJp ?? "", iconId: s?.iconId ?? null, bashin: metricBashin(score, metric), best, badge };
}

/** The modal rail in the chosen metric: option Bashin, the "Best" pick and the totals all follow it. */
function buildRail(row: RankingRow, candidate: RankingCandidate | undefined, metric: RankingMetric): SkillEffectRail {
  const slotOptions = (slot: SlotScore) =>
    slot.options.map((o) => railOption(o, o.skillId === chosenFor(slot, metric)?.skillId, metric, o.weakerThanBase));
  const slotValue = (slot: SlotScore) => { const c = chosenFor(slot, metric); return c ? metricBashin(c, metric) : 0; };
  const slot1 = slotValue(row.slot1);
  const slot2 = slotValue(row.slot2);
  const hasSlot3 = row.slot3.options.length > 0;
  return {
    portraitUrl: candidate?.imgUrl ?? "",
    characterName: candidate?.nameEn || candidate?.nameJp || `Character ${row.costumeId}`,
    slots: [
      { label: "Unique", options: [railOption(row.unique, true, metric)] },
      { label: "Evolution 1", options: slotOptions(row.slot1) },
      { label: "Evolution 2", options: slotOptions(row.slot2) },
      ...(hasSlot3 ? [{ label: "Evolution 3" as const, options: slotOptions(row.slot3) }] : []),
    ],
    totals: { unique: metricBashin(row.unique, metric), slot1, slot2, ...(hasSlot3 ? { slot3: slotValue(row.slot3) } : {}), total: rowTotal(row, metric) },
  };
}

function zonesForRow(row: RankingRow, course: NonNullable<ReturnType<typeof useDeckTrack>["course"]>, raceParams: object, metric: RankingMetric): SkillZoneResult[] {
  const horse = horseForStrategy(row.style);
  const out: SkillZoneResult[] = [];
  for (const score of [row.unique, chosenFor(row.slot1, metric), chosenFor(row.slot2, metric), chosenFor(row.slot3, metric)]) {
    if (!score) continue;
    const skill = skillsById.get(score.skillId);
    if (!skill) continue;
    try {
      const groups = (skill.conditionGroups ?? []).map((g) => ({ condition: g.condition ?? "", precondition: g.precondition ?? null }));
      const zones = computePvpSkillZones(course, groups, horse, { ...raceParams, skillId: String(score.skillId) });
      const chosen = (score.groupIndex != null ? zones[score.groupIndex] : undefined) ?? zones.find((z) => z.regions.length > 0);
      if (chosen) out.push(chosen);
    } catch {
      // Unparseable condition: skip this skill's band rather than break the strip.
    }
  }
  return out;
}

export function RankingsFeature({ runner }: { runner?: RankingsRunner } = {}) {
  const { course, trackDetail, runningStyle, racerCount, activePvpEvent, activeRaceParameters, loading } = useDeckTrack();
  const tier = useTier();

  const [profile] = useRaceImpactProfile();

  const ctx = useMemo(
    () => (course ? { course, raceParams: activeRaceParameters, racerCount, profile } : null),
    [course, activeRaceParameters, racerCount, profile],
  );
  const rankings = useRankings(ctx, runner);

  // Initial tab: stored pref, else the header style once, else "all".
  const [styleTab, setStyleTab] = useState<StyleTab>("all");
  const decidedRef = useRef(false);
  useEffect(() => {
    const stored = readStoredStyleTab();
    if (stored != null) { decidedRef.current = true; setStyleTab(stored); }
  }, []);
  useEffect(() => {
    if (decidedRef.current) return;
    if (runningStyle != null && runningStyle >= 1 && runningStyle <= 4) {
      decidedRef.current = true;
      setStyleTab(runningStyle as 1 | 2 | 3 | 4);
    }
  }, [runningStyle]);

  // Score metric: stored pref, else Average.
  const [metric, setMetric] = useState<RankingMetric>("average");
  useEffect(() => {
    const stored = readStoredScore();
    if (stored != null) setMetric(stored);
  }, []);

  const [includeLower, setIncludeLower] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const onTabChange = useCallback((tab: StyleTab) => {
    decidedRef.current = true;
    setStyleTab(tab);
    setVisible(PAGE);
    saveRankingsPrefs({ styleTab: tab });
  }, []);
  const onMetricChange = useCallback((next: RankingMetric) => {
    setMetric(next);
    setVisible(PAGE);
    saveRankingsPrefs({ score: next });
  }, []);

  const candidatesById = useMemo(() => new Map(getRankingCandidates().map((c) => [c.costumeId, c])), []);

  const listRows = useMemo(() => {
    // Sorted by the active metric first, so paging, the All tab's best style per Uma and the style tabs all use it.
    const rows = rowsForMetric(rankings.result?.rows ?? [], metric);
    const eligible = includeLower ? rows : rows.filter((r) => isAtLeastA(r.groundGrade) && isAtLeastA(r.distanceGrade));
    return styleTab === "all" ? allTabRows(eligible).slice(0, LIST_CAP) : styleTabRows(eligible, styleTab).slice(0, LIST_CAP);
  }, [rankings.result, includeLower, styleTab, metric]);
  const shownRows = useMemo(() => listRows.slice(0, visible), [listRows, visible]);

  const groundName = course ? terrainLabel(course.terrain) : "";
  const cardModels = useMemo<CharacterCardModel[]>(() => shownRows.map((row, i) => {
    const c = candidatesById.get(row.costumeId);
    return {
      costumeId: row.costumeId,
      rank: i + 1,
      name: c?.nameEn || c?.nameJp || `Character ${row.costumeId}`,
      nameJp: c?.nameJp ?? "",
      portraitUrl: c?.imgUrl ?? "",
      chips: [`Distance ${row.distanceGrade}`, `${groundName} ${row.groundGrade}`],
      styleLabel: styleLabel(row.style),
      total: row.total,
      totalMax: row.totalMax,
      metric,
      recoveryHpPercent: row.recoveryHpPercent,
      pills: [
        pill("Unique", row.unique, metric), pill("Evolution 1", chosenFor(row.slot1, metric), metric), pill("Evolution 2", chosenFor(row.slot2, metric), metric),
        // Only the few costumes with an Evolution 3 slot get a fourth pill.
        ...(row.slot3.options.length ? [pill("Evolution 3", chosenFor(row.slot3, metric), metric)] : []),
      ],
    };
  }), [shownRows, candidatesById, groundName, metric]);

  // Tablet/desktop selection draws her chosen skills (three, or four with Evolution 3) on the strip.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // A new result (course, race, racers or profile changed) starts from page 1 with nothing selected.
  // Adjusted during render so the stale page/selection never paints against the new rows.
  const resultKey = rankings.result?.key ?? null;
  const [seenResultKey, setSeenResultKey] = useState(resultKey);
  if (seenResultKey !== resultKey) {
    setSeenResultKey(resultKey);
    setVisible(PAGE);
    setSelectedId(null);
  }
  const selectedRow = tier === "phone" ? null : listRows.find((r) => r.costumeId === selectedId) ?? null;
  const stripZones = useMemo(
    () => (selectedRow && course ? zonesForRow(selectedRow, course, activeRaceParameters, metric) : undefined),
    [selectedRow, course, activeRaceParameters, metric],
  );

  // One modal instance, toggled by `open`.
  const [modal, setModal] = useState<{ open: boolean; row: RankingRow | null; skillId: number }>({ open: false, row: null, skillId: 0 });
  const openModal = useCallback((costumeId: number, skillId: number) => {
    const row = listRows.find((r) => r.costumeId === costumeId) ?? null;
    if (row) setModal({ open: true, row, skillId });
  }, [listRows]);
  const closeModal = useCallback(() => setModal((m) => ({ ...m, open: false })), []);
  const rail = useMemo(() => (modal.row ? buildRail(modal.row, candidatesById.get(modal.row.costumeId), metric) : undefined), [modal.row, candidatesById, metric]);

  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  const trackName = trackDetail?.nameEn ?? "";
  const venueCaption = course
    ? [`${trackName} ${course.length.toLocaleString("en-US")}m`.trim(), terrainLabel(course.terrain), turnLabel(course.turn), activePvpEvent?.shortName]
      .filter(Boolean).join(" · ")
    : "";
  const characterCount = useMemo(() => allTabRows(rankings.result?.rows ?? []).length, [rankings.result]);

  if (!course) {
    return (
      <section aria-label="Rankings" className="relative flex flex-col gap-3">
        {!loading && (
          <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">Pick a race in the header to see rankings.</p>
        )}
        <LoadingAnimation
          active={loading}
          label="Loading deck track..."
          fallback={
            <ul aria-busy="true" className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {Array.from({ length: 4 }, (_, i) => <CharacterCardSkeleton key={i} />)}
            </ul>
          }
        />
      </section>
    );
  }

  const progress = rankings.progress;
  let body: ReactNode;
  if (rankings.status === "error") {
    body = (
      <div role="alert" className="flex flex-col items-start gap-2 py-8">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Rankings could not be calculated.</p>
        {rankings.error ? <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{rankings.error}</p> : null}
        <AppButton variant="secondary" onPress={rankings.retry}>Retry</AppButton>
      </div>
    );
  } else if (rankings.status !== "ready") {
    // No progress yet (or an empty total) is indeterminate: omit aria-valuenow, keep max > min.
    const determinate = progress != null && progress.total > 0;
    const pct = determinate ? Math.round((progress.done / progress.total) * 100) : 0;
    body = (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 pt-2">
          <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {determinate ? `Ranking ${progress.done} / ${progress.total}…` : "Ranking…"}
          </p>
          <div
            role="progressbar"
            aria-label="Ranking progress"
            aria-valuemin={0}
            aria-valuemax={determinate ? progress.total : 100}
            aria-valuenow={determinate ? progress.done : undefined}
            className="h-0.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          >
            <div className="h-full bg-emerald-600 transition-[width] duration-150 dark:bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Lv1 uniques · reference horse v2 · {characterCount} characters
          </p>
          <AppButton variant="quiet" onPress={() => setAssumptionsOpen(true)}>Assumptions</AppButton>
        </div>
        {cardModels.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No characters match these filters.</p>
        ) : (
          <ul aria-label="Ranked characters" className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {cardModels.map((model) => (
              <CharacterCard
                key={model.costumeId}
                model={model}
                tier={tier}
                selected={tier !== "phone" && selectedId === model.costumeId}
                onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
                onOpen={openModal}
              />
            ))}
          </ul>
        )}
        {visible < listRows.length ? (
          <div className="flex justify-center pt-1">
            <AppButton variant="secondary" onPress={() => setVisible((v) => v + PAGE)}>Show 20 more</AppButton>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-label="Rankings" className="relative flex flex-col gap-3">
      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{venueCaption}</p>
      <CourseStrip course={course} zones={stripZones} compact={tier === "phone"} numberedSegments={selectedRow != null} />
      <StyleTabs value={styleTab} onChange={onTabChange} sticky={tier !== "desktop"} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <ScoreSwitch value={metric} onChange={onMetricChange} />
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs text-zinc-600 md:min-h-8 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={includeLower}
            onChange={(e) => { setIncludeLower(e.target.checked); setVisible(PAGE); }}
            className="h-4 w-4 accent-emerald-700"
          />
          Include lower aptitude
        </label>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{SCORE_CAPTION}</p>
      {body}
      <LoadingAnimation
        active={rankings.status !== "ready" && rankings.status !== "error"}
        label="Ranking support cards..."
        fallback={
          <ul aria-busy="true" className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {Array.from({ length: 6 }, (_, i) => <CharacterCardSkeleton key={i} />)}
          </ul>
        }
      />

      <SkillEffectDetailsModal
        open={modal.open}
        onClose={closeModal}
        course={course}
        raceParams={activeRaceParameters}
        racerCount={racerCount}
        style={modal.row?.style ?? 1}
        venueLabel={trackName || "this course"}
        focusSkillId={modal.skillId}
        rail={rail}
      />
      <AppDialog
        isOpen={assumptionsOpen}
        onOpenChange={setAssumptionsOpen}
        title="Assumptions"
        size="sm"
        overlayLayer="inspection"
        headerAction={(
          <AppButton variant="quiet" iconOnly aria-label="Close assumptions" onPress={() => setAssumptionsOpen(false)}>
            <XIcon className="h-5 w-5" />
          </AppButton>
        )}
      >
        <div className="flex flex-col gap-3 px-5 py-4">
          <ModelAssumptions profile={profile} racerCount={racerCount} />
        </div>
      </AppDialog>
    </section>
  );
}
