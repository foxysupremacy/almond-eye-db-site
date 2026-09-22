"use client";

import type { RefObject } from "react";
import SkillIcon from "../skill-icon";
import SkillItem from "../skill-item";
import { RarityBadge } from "../shared/skill-badges";
import { getSkillRarityStyle, type RarityFilterKey } from "../../lib/skill-rarity";
import type { VisualizerSkill } from "../../lib/visualizer-skills";
import { SkillSourceBadges } from "./skill-source-badges";

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
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => onVisualizerDeckChange("main")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                visualizerDeck === "main"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Main
            </button>
            <button
              type="button"
              onClick={() => onVisualizerDeckChange("parent")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                visualizerDeck === "parent"
                  ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-2xs font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Parent
            </button>
          </div>
        </div>

        {/* Rarity Tabs */}
        <div className="flex flex-wrap rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-[11px] font-medium shadow-2xs">
          <button
            type="button"
            onClick={() => onRarityFilterChange("all")}
            className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "all"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onRarityFilterChange("white")}
            className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "white"
                ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            White
          </button>
          <button
            type="button"
            onClick={() => onRarityFilterChange("gold")}
            className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "gold"
                ? "bg-amber-500 text-amber-950 font-bold shadow-2xs"
                : "text-amber-950 dark:text-amber-100 hover:bg-amber-100/60 dark:hover:bg-amber-950/60 font-medium"
            }`}
          >
            Gold
          </button>
          <button
            type="button"
            onClick={() => onRarityFilterChange("unique")}
            className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "unique"
                ? "bg-pink-500 text-white font-bold shadow-2xs"
                : "text-pink-700 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40"
            }`}
          >
            Unique
          </button>
          <button
            type="button"
            onClick={() => onRarityFilterChange("evolved")}
            className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
              rarityFilter === "evolved"
                ? "bg-purple-600 text-white font-bold shadow-2xs"
                : "text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
            }`}
          >
            Evo
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
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
            const rStyle = getSkillRarityStyle(s.rarity);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelectSkill(s.id);
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    conditionViewerRef?.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }
                }}
                className={`w-full min-w-0 rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                  active
                    ? "ring-2 ring-emerald-600 dark:ring-emerald-400 shadow-xs"
                    : rStyle.borderClass
                } ${isBanned ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40" : fires ? "border-emerald-500/80 dark:border-emerald-600/80" : ""} ${
                  rStyle.bgClass ?? "bg-white dark:bg-zinc-900"
                }`}
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
                      {isBanned && (
                        <span className="rounded bg-rose-600 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                          BANNED
                        </span>
                      )}
                      <RarityBadge rarity={s.rarity} />
                    </div>
                  }
                >
                  {s.descEn && (
                    <p className="line-clamp-2 text-[11px] leading-4 text-zinc-700 dark:text-zinc-300">
                      {s.descEn}
                    </p>
                  )}
                  {s.origins && s.origins.length > 0 && (
                    <div className="mt-0.5">
                      <SkillSourceBadges origins={s.origins} compact />
                    </div>
                  )}
                </SkillItem>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
