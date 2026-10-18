"use client";

// The Visualizer tab: pick a venue + course, see the deck's skills as a list,
// and click one to overlay ITS activation zones on the track's ruler band.
// Only the selected skill is computed + drawn.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type SkillDetail } from "@/lib/api";
import { type SkillZoneResult } from "@/lib/skill-engine/zones";
import { useDeck } from "@/features/deck/state";
import { type RarityFilterKey } from "@/lib/skills/rarity";
import { createApplicationRatingSession } from "@/lib/skill-rating/application";
import { skillRatingZones } from "@/app/common/ui/skills/details/skill-rating-presentation";
import { evaluateSkillForTrack } from "@/lib/evaluator";
import { TrackCanvas } from "./components/track-canvas";
import { TrackSkillSidebar } from "./components/track-skill-sidebar";
import { SkillDetailPanel } from "@/app/common/ui/skills/details/skill-detail-panel";
import { isSkillBanned, getPvpRaceParameters } from "@/lib/pvp/events";
import { dynamicConditionKeys } from "@/lib/race-impact";
import { useRaceImpactProfile } from "@/app/common/hooks/use-race-impact-profile";
import { useParentingSetup } from "@/features/parenting/hooks";
import { charactersById, charactersByCharId } from "@/lib/data/registry";
import { resolveTargetCharacter } from "@/lib/parenting/pedigree-resolvers";
import {
  buildVisualizerSkillPools,
  getVisualizerOriginOrder,
  matchesVisualizerFilter,
  type VisualizerSkill,
} from "@/lib/visualizer/skills";
import { RaceImpactProfilePanel } from "./components/race-impact-profile-panel";

// Persisted visualizer prefs (selected skill).
const SAVE_KEY = "visualizer.v1";

export default function TrackView() {
  const {
    course,
    runningStyle,
    racerCount,
    mainSlots,
    parentSlots,
    mainSkills,
    parentSkills,
    activePvpEvent,
    activeRaceParameters,
  } = useDeck();

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
  const { raceImpactProfile, updateRaceImpactProfile } = useRaceImpactProfile();
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
    api
      .skill(selectedSkillId)
      .then((d) => {
        if (!alive) return;
        setSkillDetail(d);
      })
      .catch(() => alive && setSkillDetail(null))
      .finally(() => alive && setSkillLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedSkillId]);

  const ratingSession = useMemo(() => createApplicationRatingSession({ course, style: runningStyle, racerCount, raceParameters: raceParams, profile: raceImpactProfile }), [course, runningStyle, racerCount, raceParams, raceImpactProfile]);

  const evaluation = useMemo(() => {
    if (!skillDetail) return null;
    return evaluateSkillForTrack(
      skillDetail,
      course,
      runningStyle,
      racerCount,
      visualizerDeck === "parent",
      [],
      raceParams,
      { raceImpactProfile, session: ratingSession },
    );
  }, [skillDetail, course, runningStyle, racerCount, visualizerDeck, raceParams, raceImpactProfile, ratingSession]);

  const ratedZones = useMemo(() => evaluation?.canonicalRating ? skillRatingZones(evaluation.canonicalRating) : null, [evaluation]);

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
      const styleSessions = runningStyle ? [ratingSession] : [1, 2, 3, 4, 5].map((style) => createApplicationRatingSession({ course, style, racerCount, raceParameters: raceParams, profile: raceImpactProfile }));
      for (const s of activeSkills) {
        const d = detailCacheRef.current.get(s.id);
        if (!d) continue;
        const variant = visualizerDeck === "parent" && d.rarity === 2 ? "parent-factor" as const
          : visualizerDeck === "parent" && (d.rarity === 3 || d.rarity === 5) ? "inherited-unique" as const : "original" as const;
        // No style selection means potential eligibility in at least one style.
        const analyses = styleSessions.map((session) => session.analyze({ skill: d, variant }));
        const viable = analyses.find((analysis) => analysis.eligibility.state === "eligible");
        if (isSkillBanned(s.id, activePvpEvent)) bySkill.set(s.id, []);
        else if (viable) bySkill.set(s.id, skillRatingZones(viable));
        else if (analyses.every((analysis) => analysis.eligibility.state === "ineligible")) bySkill.set(s.id, []);
        // Unknown parsing/data/context stays pending rather than claiming impossibility.
      }
      setZonesBySkill(bySkill);
    })();
    return () => {
      alive = false;
    };
  }, [course, activeSkills, fetchSkillCached, raceParams, ratingSession, visualizerDeck, runningStyle, racerCount, raceImpactProfile, activePvpEvent]);

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
  const selectedDynamicKeys = useMemo(
    () => Array.from(new Set(
      (skillDetail?.conditionGroups ?? [])
        .flatMap((group) => dynamicConditionKeys(group.condition, group.precondition))
        // A previous-detail marker is a skill-internal chain dependency, not
        // an uncertain race state the user should override.
        .filter((key) => key !== "other_skill"),
    )),
    [skillDetail],
  );

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
            zones={ratedZones}
            selectedSkillId={selectedSkillId?.toString() ?? null}
            evaluation={evaluation}
            skillDetail={skillDetail}
          />

          <RaceImpactProfilePanel
            profile={raceImpactProfile}
            dynamicKeys={selectedDynamicKeys}
            onChange={updateRaceImpactProfile}
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr]">
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
            />
            <SkillDetailPanel
              conditionViewerRef={conditionViewerRef}
              skillDetail={skillDetail}
              skillLoading={skillLoading}
              selectedSkill={selectedSkill}
              selectedSkillId={selectedSkillId}
              zones={ratedZones}
              course={course}
              racerCount={racerCount}
              evaluation={evaluation}
              selectedUma={selectedUma}
              isBanned={isSelectedSkillBanned}
            />
          </div>
        </>
      )}
    </div>
  );
}
