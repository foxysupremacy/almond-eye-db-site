"use client";

// The Visualizer tab: pick a venue + course, see the deck's skills as a list,
// and click one to overlay ITS activation zones on the track's ruler band.
// Only the selected skill is computed + drawn.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, terrainLabel, turnLabel, type SkillDetail } from "@/lib/api";
import type { SkillZoneResult } from "@/lib/skill-engine/zones";
import { computePvpSkillZones } from "@/lib/pvp/skill-zones";
import { useDeckTrack, useDeckSlots } from "@/features/deck/state";
import { type RarityFilterKey } from "@/lib/skills/rarity";
import { evaluateSkillForTrack } from "@/lib/evaluator";
import { TrackCanvas } from "./components/track-canvas";
import { TrackSkillSidebar } from "./components/track-skill-sidebar";
import { SkillDetailPanel } from "@/app/common/ui/skills/details/skill-detail-panel";
import { isSkillBanned } from "@/lib/pvp/events";
import { useRaceImpactProfile } from "@/app/common/hooks/use-race-impact-profile";
import { useParentingSetup } from "@/features/parenting/hooks";
import { charactersById, charactersByCharId } from "@/lib/data/registry";
import { resolveTargetCharacter } from "@/lib/parenting/pedigree-resolvers";
import type { RunningStyle } from "@/lib/deck/types";
import {
  buildVisualizerSkillPools,
  getVisualizerOriginOrder,
  matchesVisualizerFilter,
  type VisualizerSkill,
} from "@/lib/visualizer/skills";
import { SkillEffectDetailsModal } from "@/app/common/ui/skills/effect-details";
import { visualizerRunningStyle, visualizerZoneHorse } from "./visualizer-style";

// Persisted visualizer prefs (selected skill).
const SAVE_KEY = "visualizer.v1";

export default function TrackView() {
  const {
    course,
    trackDetail,
    runningStyle,
    racerCount,
    activePvpEvent,
    activeRaceParameters,
  } = useDeckTrack();
  const {
    mainSkills,
    parentSkills,
  } = useDeckSlots();

  const raceParams = activeRaceParameters;

  const [visualizerDeck, setVisualizerDeck] = useState<"main" | "parent">("main");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");

  const { setup } = useParentingSetup();
  const selectedUma = resolveTargetCharacter(setup, charactersById, charactersByCharId)?.nameEn;
  const pools = useMemo(
    () => buildVisualizerSkillPools({ mainSkills, parentSkills, setup }),
    [mainSkills, parentSkills, setup],
  );
  const activeSkills: VisualizerSkill[] = visualizerDeck === "main" ? pools.main : pools.parent;

  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [zones, setZones] = useState<SkillZoneResult[] | null>(null);
  // The profile is edited inside SkillEffectDetailsModal; the shared hook keeps
  // this view's evaluation in sync and returns a stable object between edits.
  const [raceImpactProfile] = useRaceImpactProfile();
  const conditionViewerRef = useRef<HTMLDivElement>(null);


  // Restore saved selectedSkillId after client hydration
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.skillId === "number") {
          setSelectedSkillId(p.skillId);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Effect-graph modal: stays mounted while a course exists and toggles
  // `open`. The last opened id is kept so the close animation keeps content.
  const [graphSkillId, setGraphSkillId] = useState<number | null>(null);
  const [lastGraphSkillId, setLastGraphSkillId] = useState<number | null>(null);
  const openEffectGraph = useCallback((id: number) => {
    setGraphSkillId(id);
    setLastGraphSkillId(id);
  }, []);
  const closeEffectGraph = useCallback(() => setGraphSkillId(null), []);
  // One style for the inspector's race impact and the effect modal (the modal needs a concrete style).
  const graphStyle: RunningStyle = visualizerRunningStyle(runningStyle);
  const venueLabel = trackDetail?.nameEn || "this course";
  const venueCaption = course
    ? [`${trackDetail?.nameEn ?? ""} ${course.length.toLocaleString("en-US")}m`.trim(), terrainLabel(course.terrain), turnLabel(course.turn), activePvpEvent?.shortName]
      .filter(Boolean).join(" · ")
    : "";

  // Horse used to gate running_style conditions for zones and tints; undefined = default (Nige).
  // Deliberately not graphStyle (R17). Memoized: a fresh object each render would re-fire the zone effects forever.
  const styleHorse = useMemo(() => visualizerZoneHorse(runningStyle), [runningStyle]);

  // Auto-select a deck skill: the saved one when valid, else the first skill.
  // Keeps a valid selection as the deck changes.
  useEffect(() => {
    if (activeSkills.length === 0) {
      setSelectedSkillId(null);
      return;
    }
    setSelectedSkillId((cur) => {
      if (cur != null && activeSkills.some((s) => s.id === cur)) return cur;
      return activeSkills[0].id;
    });
  }, [activeSkills]);

  // Fetch the selected skill detail.
  useEffect(() => {
    if (selectedSkillId == null) return;
    let alive = true;
    setSkillLoading(true);
    setSkillDetail(null);
    setZones(null);
    api
      .skill(selectedSkillId)
      .then((d) => {
        if (!alive) return;
        setSkillDetail(d);
        const groups = (d.conditionGroups ?? []).map((g) => ({
          condition: g.condition ?? "",
          precondition: g.precondition ?? null,
        }));
        if (course) setZones(computePvpSkillZones(course, groups, styleHorse, { ...raceParams, skillId: String(selectedSkillId) }));
        else setZones([]);
      })
      .catch(() => alive && setSkillDetail(null))
      .finally(() => alive && setSkillLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedSkillId, course, styleHorse, raceParams]);

  // Recompute zones when the course changes and we still have a detail loaded.
  useEffect(() => {
    if (!course || !skillDetail) return;
    const groups = (skillDetail.conditionGroups ?? []).map((g) => ({
      condition: g.condition ?? "",
      precondition: g.precondition ?? null,
    }));
    setZones(computePvpSkillZones(course, groups, styleHorse, { ...raceParams, skillId: String(skillDetail.id) }));
  }, [course, skillDetail, styleHorse, raceParams]);

  const evaluation = useMemo(() => {
    if (!skillDetail) return null;
    return evaluateSkillForTrack(
      skillDetail,
      course,
      graphStyle,
      racerCount,
      visualizerDeck === "parent",
      zones ?? [],
      raceParams,
      { raceImpactProfile },
    );
  }, [skillDetail, course, graphStyle, racerCount, visualizerDeck, zones, raceParams, raceImpactProfile]);

  // Cache skill details so triggerability can be computed for every deck skill
  // without re-fetching on each course change.
  const detailCacheRef = useRef<Map<number, SkillDetail>>(new Map());

  const fetchSkillCached = useCallback(async (id: number): Promise<SkillDetail | undefined> => {
    const hit = detailCacheRef.current.get(id);
    if (hit) return hit;
    try {
      const d = await api.skill(id);
      detailCacheRef.current.set(id, d);
      return d;
    } catch {
      return undefined;
    }
  }, []);

  // For each deck skill, compute whether it can activate on the current course.
  const [zonesBySkill, setZonesBySkill] = useState<Map<number, SkillZoneResult[]> | null>(null);

  useEffect(() => {
    if (!course || activeSkills.length === 0) {
      setZonesBySkill(null);
      return;
    }
    let alive = true;
    (async () => {
      await Promise.all(activeSkills.map((s) => fetchSkillCached(s.id)));
      if (!alive) return;
      const bySkill = new Map<number, SkillZoneResult[]>();
      for (const s of activeSkills) {
        const d = detailCacheRef.current.get(s.id);
        if (!d) continue;
        const groups = (d.conditionGroups ?? []).map((g) => ({
          condition: g.condition ?? "",
          precondition: g.precondition ?? null,
        }));
        bySkill.set(s.id, computePvpSkillZones(course, groups, styleHorse, { ...raceParams, skillId: String(s.id) }));
      }
      setZonesBySkill(bySkill);
    })();
    return () => {
      alive = false;
    };
  }, [course, activeSkills, fetchSkillCached, styleHorse, raceParams]);

  const selectedSkill = activeSkills.find((skill) => skill.id === selectedSkillId) ?? null;
  const hasContent = activeSkills.length > 0;

  // Whether a skill fires on the current course (null while zones haven't
  // been computed for it yet).
  const firesOnCourse = useCallback(
    (id: number): boolean | null => {
      const skillZones = zonesBySkill?.get(id);
      if (!skillZones) return null;
      return skillZones.some((z) => z.regions.length > 0);
    },
    [zonesBySkill],
  );

  // Triggerable skills first; stable within each group (existing name order).
  const sortedSkills = useMemo(() => {
    if (!zonesBySkill) return activeSkills;
    return [...activeSkills].sort((a, b) => {
      const fa = firesOnCourse(a.id) ?? false;
      const fb = firesOnCourse(b.id) ?? false;
      return Number(fb) - Number(fa);
    });
  }, [activeSkills, zonesBySkill, firesOnCourse]);

  const displayedSkills = useMemo(() => {
    const filtered = sortedSkills.filter((s) => matchesVisualizerFilter(s, rarityFilter));
    if (rarityFilter !== "unique" && rarityFilter !== "evolved") return filtered;
    return [...filtered].sort((a, b) =>
      getVisualizerOriginOrder(a) - getVisualizerOriginOrder(b)
      || a.nameEn.localeCompare(b.nameEn)
      || a.id - b.id,
    );
  }, [sortedSkills, rarityFilter]);
  const isSelectedSkillBanned = Boolean(selectedSkillId && isSkillBanned(selectedSkillId, activePvpEvent));

  return (
    <div className="flex flex-col gap-3">
      {!hasContent ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
          {visualizerDeck === "main"
            ? "Select an exact trainee costume in Parenting or add Main Deck cards."
            : "Configure parents and grandparents in Parenting or add Parent Deck cards."}
        </div>
      ) : (
        <>
          <TrackCanvas
            course={course}
            zones={zones}
            selectedSkillId={selectedSkillId?.toString() ?? null}
            evaluation={evaluation}
            venueCaption={venueCaption}
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr] pt-2">
            <TrackSkillSidebar
              visualizerDeck={visualizerDeck}
              onVisualizerDeckChange={setVisualizerDeck}
              rarityFilter={rarityFilter}
              onRarityFilterChange={setRarityFilter}
              activeSkills={activeSkills}
              displayedSkills={displayedSkills}
              selectedSkillId={selectedSkillId}
              onSelectSkill={setSelectedSkillId}
              firesOnCourse={firesOnCourse}
              conditionViewerRef={conditionViewerRef}
              isSkillBanned={(id) => isSkillBanned(id, activePvpEvent)}
              onOpenEffectGraph={openEffectGraph}
            />
            <SkillDetailPanel
              conditionViewerRef={conditionViewerRef}
              skillDetail={skillDetail}
              skillLoading={skillLoading}
              selectedSkill={selectedSkill}
              selectedSkillId={selectedSkillId}
              zones={zones}
              course={course}
              racerCount={racerCount}
              evaluation={evaluation}
              raceImpactProfile={raceImpactProfile}
              runningStyle={graphStyle}
              groundCondition={raceParams.groundCondition}
              selectedUma={selectedUma}
              isBanned={isSelectedSkillBanned}
              embedded
            />
          </div>
        </>
      )}
      {/* One instance while a course exists; it fetches nothing while closed.
          Before the first open, focusSkillId is a 0 placeholder that is never shown. */}
      {course && (
        <SkillEffectDetailsModal
          open={graphSkillId != null}
          onClose={closeEffectGraph}
          course={course}
          raceParams={raceParams}
          racerCount={racerCount}
          style={graphStyle}
          venueLabel={venueLabel}
          focusSkillId={lastGraphSkillId ?? 0}
        />
      )}
    </div>
  );
}
