"use client";

import type { RefObject } from "react";
import type { SkillDetail } from "../../lib/api";
import type { Course } from "../../lib/skill-engine/types";
import type { SkillZoneResult } from "../../lib/skill-engine/zones";
import type { SkillEvaluationResult, SpecialEffectItem } from "../../lib/evaluator/types";
import type { DeckSkill, ParentDeckSkill } from "../../lib/deck/types";
import { conditionBranches, formatEffect } from "../../lib/skill-engine/describe";
import { ZONE_COLORS } from "../../lib/track-render";
import SkillIcon from "../skill-icon";
import SkillItem from "../skill-item";
import { RarityBadge, splitStylePrefix } from "../shared/skill-badges";
import { ConditionChips } from "../shared/condition-chips";
import { hexToRgba } from "../shared/color-utils";
import {
  HighlightText,
  FormattedEffectBadges,
  CalculationBreakdownPanel,
} from "../highlighted-numbers";
import { AlertTriangleIcon, StarRating } from "../icons";

interface SkillDetailInspectorProps {
  conditionViewerRef?: RefObject<HTMLDivElement | null>;
  skillDetail: SkillDetail | null;
  skillLoading: boolean;
  selectedSkill: DeckSkill | ParentDeckSkill | null;
  selectedSkillId: number | null;
  zones: SkillZoneResult[] | null;
  course: Course | null;
  racerCount: number;
  evaluation: SkillEvaluationResult | null;
  activeSkills: Array<DeckSkill | ParentDeckSkill>;
  isBanned?: boolean;
}

export function SkillDetailInspector({
  conditionViewerRef,
  skillDetail,
  skillLoading,
  selectedSkill,
  selectedSkillId,
  zones,
  course,
  racerCount,
  evaluation,
  activeSkills,
  isBanned = false,
}: SkillDetailInspectorProps) {
  return (
    <div
      ref={conditionViewerRef}
      className="order-1 md:order-2 min-w-0 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm shadow-xs text-left scroll-mt-20 sm:scroll-mt-24 divide-y divide-zinc-200/80 dark:divide-zinc-800 overflow-hidden"
    >
      {skillLoading ? (
        <div className="p-4 sm:p-5 text-zinc-400 dark:text-zinc-500">Loading skill…</div>
      ) : skillDetail ? (
        <>
          {/* Block 1: Skill Info Header */}
          <div className="p-4 sm:p-5">
            <SkillItem
              skill={{
                id: skillDetail.id,
                iconId: skillDetail.iconId,
                nameEn: skillDetail.nameEn,
                nameJp: skillDetail.nameJp,
              }}
              size="lg"
              interactive={false}
              isBanned={isBanned}
              trailing={
                <div className="flex-none flex items-center gap-1.5">
                  {isBanned && (
                    <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs">
                      BANNED
                    </span>
                  )}
                  <RarityBadge rarity={selectedSkill?.rarity ?? skillDetail.rarity} />
                </div>
              }
            />

            {isBanned && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 p-2.5 text-xs text-rose-900 dark:text-rose-200 shadow-2xs">
                <span className="text-base flex-none">🚫</span>
                <div>
                  <p className="font-bold">Banned in Special Rule (No Debuffs)</p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    This debuff skill cannot be used and will not activate during this Champions Meeting.
                  </p>
                </div>
              </div>
            )}
            {(() => {
              const deckSkill = activeSkills.find((x) => x.id === skillDetail.id);
              if (!deckSkill) return null;
              const grants =
                deckSkill.grants && deckSkill.grants.length > 0
                  ? deckSkill.grants
                  : [
                      {
                        cardId: deckSkill.cardId,
                        cardName: deckSkill.cardName,
                        source: deckSkill.source,
                      },
                    ];
              return (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="text-zinc-400 dark:text-zinc-500">From:</span>
                  {grants.map((g, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          g.source === "event"
                            ? "bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300"
                            : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {g.source}
                      </span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {g.cardName}
                      </span>
                      {idx < grants.length - 1 && (
                        <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      )}
                    </span>
                  ))}
                </div>
              );
            })()}
            {(() => {
              const { style, text } = splitStylePrefix(skillDetail.descEn);
              return (
                <div className="mt-2 flex flex-wrap items-start gap-x-2">
                  {style && (
                    <span className="mt-0.5 inline-flex flex-none items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-300">
                      <span
                        className="inline-block h-1.5 w-1.5 flex-none rounded-full bg-zinc-400 dark:bg-zinc-500"
                        aria-hidden
                      />
                      {style}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 leading-6 text-zinc-600 dark:text-zinc-300">
                    {text}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Block 2: Course Activation Windows (Unboxed) */}
          {zones && zones.length > 0 && (
            <div className="p-4 sm:p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2.5">
                Course Activation Windows
              </div>
              <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
                {(skillDetail.conditionGroups ?? []).map((g, gi) => {
                  const z = zones[gi];
                  if (!z || !z.regions.length) return null;
                  const wins = z.regions
                    .map((r) => `${Math.round(r.start)}-${Math.round(r.end)}m`)
                    .join(", ");
                  const branches = conditionBranches(g.condition ?? "", racerCount).branches;
                  const needsBranches = g.precondition
                    ? conditionBranches(g.precondition, racerCount).branches
                    : null;
                  const effectLine = formatEffect(
                    (g.effects as Array<{ type: number; value: number }> | undefined) ?? [],
                    g.base_time,
                    course?.length ?? 0,
                  );
                  return (
                    <div key={gi} className="py-3 first:pt-0 last:pb-0 text-xs">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 flex-none rounded-xs border border-zinc-300 dark:border-zinc-700"
                          style={{
                            background: hexToRgba(ZONE_COLORS[gi % ZONE_COLORS.length], 0.35),
                          }}
                        />
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          Trigger {gi + 1}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                          {z.isRandom ? "Random Zone" : "Deterministic"}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 rounded ml-auto">
                          {wins}
                        </span>
                      </div>

                      <div className="mt-1.5">
                        <ConditionChips
                          branches={branches}
                          needsBranches={needsBranches}
                          tint={hexToRgba(ZONE_COLORS[gi % ZONE_COLORS.length], 0.35)}
                          muted={false}
                        />
                      </div>

                      {/* Highlighted Calculated Effect Badges */}
                      <div className="mt-2">
                        <FormattedEffectBadges
                          effects={(g.effects as Array<{ type: number; value: number }>) ?? []}
                          baseTime={g.base_time}
                          courseLength={course?.length ?? 0}
                        />
                        {!g.effects?.length && effectLine && (
                          <span className="inline-flex flex-wrap items-center gap-1 rounded bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                            {effectLine}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {zones.every((z) => !z.regions.length) && (
                  <p className="py-2 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-1.5">
                    <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>No trigger activates on this course.</span>
                  </p>
                )}
              </div>
              {zones.some((z) => !z.regions.length) && !zones.every((z) => !z.regions.length) && (
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                  (Some triggers do not activate on this course.)
                </p>
              )}
            </div>
          )}

          {/* Block 3: Tactical Verdict & Calculation Breakdown (Unboxed) */}
          {evaluation && (
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Tactical Verdict & Mechanics
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRating stars={evaluation.stars} starClassName="h-3.5 w-3.5" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {evaluation.tier} Tier
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      ({evaluation.score} pts)
                    </span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs border ${evaluation.primaryBadge.badgeClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${evaluation.primaryBadge.dotColor}`} />
                  {evaluation.primaryBadge.label}
                </span>
              </div>

              {/* Summary explanation with highlighted numbers */}
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-200 font-medium">
                <HighlightText text={evaluation.verdictSummary} />
              </p>

              {/* Highlighted Calculation Breakdown Panel & Math Steps */}
              <CalculationBreakdownPanel evaluation={evaluation} />
            </div>
          )}

          {/* Block 4: Special Effects & Track Dynamics (Unboxed) */}
          {evaluation && evaluation.specialEffects.length > 0 && (
            <div className="p-4 sm:p-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-2.5">
                Special Effects & Track Dynamics
              </span>
              <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
                {evaluation.specialEffects.map((eff: SpecialEffectItem) => (
                  <div
                    key={eff.id}
                    className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0 text-xs"
                  >
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider flex-none ${
                        eff.type === "success"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                          : eff.type === "warning"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300"
                          : eff.type === "error"
                          ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                          : "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
                      }`}
                    >
                      {eff.badge}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{eff.title}</span>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                        <HighlightText text={eff.description} />
                      </p>
                    </div>
                    {eff.meters && (
                      <span className="text-[10px] font-mono font-bold flex-none text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        {eff.meters}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Block 5: Parent Mode metadata (Unboxed callout) */}
          {evaluation && evaluation.parentMeta?.isGoldTransformed && (
            <div className="p-4 sm:p-5 text-xs text-amber-900 dark:text-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
              <span className="font-bold">Parent Farming Note:</span> In the Parent Deck, this Gold skill inherits as{" "}
              <span className="font-semibold underline underline-offset-2">
                {evaluation.parentMeta.inheritedWhiteNameEn}
              </span>{" "}
              (Factor Priority: Tier {evaluation.parentMeta.factorTier}).
            </div>
          )}
        </>
      ) : selectedSkillId ? (
        <div className="p-4 sm:p-5 text-zinc-400 dark:text-zinc-500">Could not load that skill.</div>
      ) : (
        <div className="p-4 sm:p-5 text-zinc-400 dark:text-zinc-500">Select a skill from the deck.</div>
      )}
    </div>
  );
}
