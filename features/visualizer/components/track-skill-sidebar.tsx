"use client";

import type { RefObject } from "react";
import { Button } from "react-aria-components/Button";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import SkillItem from "@/app/common/ui/skills/skill-item";
import { SkillIndicator } from "@/app/common/ui/skills/skill-badges";
import { type RarityFilterKey } from "@/lib/skills/rarity";
import { AppButton } from "@/app/common/ui/controls/app-button";
import type { VisualizerSkill } from "@/lib/visualizer/skills";
import { SkillSourceBadges } from "@/app/common/ui/skills/provenance/skill-source-badges";
import { ChartIcon } from "@/app/common/ui/primitives/icons";

interface TrackSkillSidebarProps {
  visualizerDeck: "main" | "parent";
  onVisualizerDeckChange: (deck: "main" | "parent") => void;
  rarityFilter: RarityFilterKey;
  onRarityFilterChange: (filter: RarityFilterKey) => void;
  activeSkills: VisualizerSkill[];
  displayedSkills: VisualizerSkill[];
  selectedSkillId: number | null;
  onSelectSkill: (id: number) => void;
  firesOnCourse: (id: number) => boolean | null;
  conditionViewerRef?: RefObject<HTMLDivElement | null>;
  isSkillBanned?: (id: number) => boolean;
  onOpenEffectGraph?: (id: number) => void;
}

export function TrackSkillSidebar({
  visualizerDeck,
  onVisualizerDeckChange,
  rarityFilter,
  onRarityFilterChange,
  activeSkills,
  displayedSkills,
  selectedSkillId,
  onSelectSkill,
  firesOnCourse,
  conditionViewerRef,
  isSkillBanned,
  onOpenEffectGraph,
}: TrackSkillSidebarProps) {
  return (
    <div className="order-2 flex max-h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 md:order-1 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:self-start">
      <div className="flex flex-col gap-2 border-b border-zinc-100 dark:border-zinc-800 p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {visualizerDeck === "main" ? "Main Deck Skills" : "Parent Deck Skills"}
            </h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {displayedSkills.length} of {activeSkills.length} skills ·{" "}
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                green = triggers
              </span>
            </p>
          </div>
          <ToggleButtonGroup
            aria-label="Skill deck"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[visualizerDeck]}
            onSelectionChange={(keys) => { const key = [...keys][0]; if (key === "main" || key === "parent") onVisualizerDeckChange(key); }}
            className="flex items-center gap-1 text-xs font-medium"
          >
            <ToggleButton id="main"
              className={`min-h-11 md:min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                visualizerDeck === "main"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Main
            </ToggleButton>
            <ToggleButton id="parent"
              className={`min-h-11 md:min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                visualizerDeck === "parent"
                  ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-2xs font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Parent
            </ToggleButton>
          </ToggleButtonGroup>
        </div>

        <ToggleButtonGroup
          aria-label="Skill rarity"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[rarityFilter]}
          onSelectionChange={(keys) => { const key = [...keys][0]; if (key && key !== rarityFilter) onRarityFilterChange(key as RarityFilterKey); }}
          className="flex flex-wrap items-center gap-1 text-[11px] font-medium"
        >
          <ToggleButton id="all"
            className={`min-h-11 md:min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "all"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800"
            }`}
          >
            All
          </ToggleButton>
          <ToggleButton id="white"
            className={`min-h-11 md:min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "white"
                ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            White
          </ToggleButton>
          <ToggleButton id="gold"
            className={`min-h-11 md:min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "gold"
                ? "bg-amber-500 text-amber-950 font-bold shadow-2xs"
                : "text-amber-950 dark:text-amber-100 hover:bg-amber-100/60 dark:hover:bg-amber-950/60 font-medium"
            }`}
          >
            Gold
          </ToggleButton>
          <ToggleButton id="unique"
            className={`min-h-11 md:min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "unique"
                ? "bg-pink-500 text-white font-bold shadow-2xs"
                : "text-pink-700 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40"
            }`}
          >
            Unique
          </ToggleButton>
          <ToggleButton id="evolved"
            className={`min-h-11 md:min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "evolved"
                ? "bg-purple-600 text-white font-bold shadow-2xs"
                : "text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
            }`}
          >
            Evo
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      <div className="flex flex-1 flex-col divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800/80">
        {displayedSkills.length === 0 ? (
          rarityFilter === "unique" || rarityFilter === "evolved" ? (
            <div className="p-4 text-center">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                No {rarityFilter === "unique" ? "Unique" : "Evolved"} Skills
              </p>
              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                {visualizerDeck === "parent"
                  ? "Unique skills can be inherited directly from Parent characters."
                  : "Unique and Evolved skills come from Trainee/Parent characters."}
              </p>
            </div>
          ) : (
            <p className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
              No skills match.
            </p>
          )
        ) : (
          displayedSkills.map((s) => {
            const active = s.id === selectedSkillId;
            const isBanned = isSkillBanned ? isSkillBanned(s.id) : false;
            const fires = !isBanned && firesOnCourse(s.id);
            const graphName = s.nameEn || s.nameJp;
            // Selection and graph actions stay siblings within a flat list row.
            return (
              <div
                key={s.id}
                className={`flex w-full min-w-0 items-center transition-colors duration-150 ${
                  isBanned
                    ? "bg-rose-50/40 opacity-60 dark:bg-rose-950/20"
                    : active
                    ? "bg-emerald-50 dark:bg-emerald-950/40"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
              <Button
                aria-pressed={active}
                onPress={() => {
                  onSelectSkill(s.id);
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    conditionViewerRef?.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
                  }
                }}
                className="min-h-11 min-w-0 flex-1 cursor-pointer px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/70"
              >
                <SkillItem
                  skill={{
                    id: s.id,
                    iconId: s.iconId,
                    nameEn: s.nameEn,
                    nameJp: s.nameJp,
                  }}
                  size="sm"
                  interactive={false}
                  isBanned={isBanned}
                  leading={
                    <span
                      className={`inline-block h-2 w-2 flex-none rounded-full mr-0.5 ${
                        isBanned
                          ? "bg-rose-500"
                          : fires
                          ? "bg-emerald-500 shadow-2xs"
                          : "bg-zinc-300 dark:bg-zinc-700"
                      }`}
                      title={
                        isBanned
                          ? "Banned in Special Rule (No Debuffs)"
                          : fires
                          ? "Triggers on this course"
                          : "No trigger on this course"
                      }
                    />
                  }
                  trailing={
                    <div className="flex-none flex items-center gap-1">
                      {isBanned && <SkillIndicator kind="banned" density="compact" title="Banned in Special Rule (No Debuffs)" />}
                    </div>
                  }
                >
                  {s.origins && s.origins.length > 0 && (
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                      <span className="font-bold uppercase tracking-wider">Source</span>
                      <SkillSourceBadges origins={s.origins} compact />
                    </div>
                  )}
                </SkillItem>
              </Button>
              {onOpenEffectGraph && (
              <AppButton
                type="button"
                variant="quiet"
                iconOnly
                aria-label={`Open effect graph for ${graphName}`}
                title="Open effect graph"
                className="mr-1.5 cursor-pointer"
                onPress={() => onOpenEffectGraph(s.id)}
              >
                <ChartIcon className="h-4 w-4 flex-none" />
              </AppButton>
              )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
