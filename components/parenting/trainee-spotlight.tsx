import React from "react";
import { type CharacterIndexEntry, getCharacterImageUrl } from "../../lib/api";
import type { LineageStatBonuses } from "../../lib/factor-decoder";
import { getStatRankBadge, getAptitudeStyle } from "../../lib/parenting/constants";

export interface TraineeSpotlightProps {
  targetChara: CharacterIndexEntry | null;
  statBonuses: LineageStatBonuses;
  onSelectTrainee: () => void;
  className?: string;
}

export function TraineeSpotlight({
  targetChara,
  statBonuses,
  onSelectTrainee,
  className = "",
}: TraineeSpotlightProps) {
  return (
    <div className={className}>
      {/* Target Trainee Spotlight Stage */}
      <div className="relative w-full h-[250px] sm:h-[290px] flex items-end justify-center my-2 select-none">
        {/* Center Stage Pedestal Spotlight */}
        <div className="absolute bottom-2 w-52 sm:w-68 h-10 bg-radial from-emerald-500/25 via-emerald-500/10 to-transparent rounded-full blur-md pointer-events-none" />

        <div
          onClick={onSelectTrainee}
          className="relative z-20 w-48 sm:w-64 h-full flex flex-col items-center justify-end cursor-pointer group"
          title="Click to select or change Target Trainee"
        >
          {targetChara ? (
            <div className="relative w-full h-full flex items-end justify-center">
              <img
                src={getCharacterImageUrl(targetChara.charId, targetChara.id, "01")}
                alt={targetChara.nameEn}
                className="h-full w-full object-contain filter drop-shadow-[0_12px_22px_rgba(0,0,0,0.35)] group-hover:scale-105 transition-transform duration-200 ease-out-quart"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = "0.8";
                }}
              />
              <div className="absolute bottom-0 px-3 py-0.5 rounded-full bg-emerald-600/90 text-white text-[11px] font-bold shadow-md backdrop-blur-xs flex items-center gap-1.5">
                <span>{targetChara.nameEn}</span>
                <span className="text-[10px] text-emerald-100 font-normal">Target Trainee</span>
              </div>
            </div>
          ) : (
            <div className="w-32 h-44 sm:w-40 sm:h-52 rounded-2xl border-2 border-dashed border-emerald-500/70 bg-emerald-500/10 hover:bg-emerald-500/20 flex flex-col items-center justify-center text-center p-3 transition-all active:scale-[0.98]">
              <span className="text-3xl mb-1.5">⭐</span>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                + Select Trainee
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Pick target character
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Blue Stat Bonus Pills (Directly above the 5 stat columns) */}
      <div className="grid grid-cols-5 gap-1 sm:gap-2 max-w-xl mx-auto mb-1 px-1 text-center">
        {/* Speed Bonus Pill */}
        <div>
          <span
            className={`inline-block font-black text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full shadow-md border-2 border-white dark:border-zinc-900 ${
              statBonuses.speed > 0
                ? "bg-[#00c0f0] text-white"
                : "bg-zinc-400/30 text-zinc-400 text-[10px]"
            }`}
          >
            +{statBonuses.speed}
          </span>
        </div>

        {/* Stamina Bonus Pill */}
        <div>
          <span
            className={`inline-block font-black text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full shadow-md border-2 border-white dark:border-zinc-900 ${
              statBonuses.stamina > 0
                ? "bg-[#ff3b80] text-white"
                : "bg-zinc-400/30 text-zinc-400 text-[10px]"
            }`}
          >
            +{statBonuses.stamina}
          </span>
        </div>

        {/* Power Bonus Pill */}
        <div>
          <span
            className={`inline-block font-black text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full shadow-md border-2 border-white dark:border-zinc-900 ${
              statBonuses.power > 0
                ? "bg-[#00c0f0] text-white"
                : "bg-zinc-400/30 text-zinc-400 text-[10px]"
            }`}
          >
            +{statBonuses.power}
          </span>
        </div>

        {/* Guts Bonus Pill */}
        <div>
          <span
            className={`inline-block font-black text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full shadow-md border-2 border-white dark:border-zinc-900 ${
              statBonuses.guts > 0
                ? "bg-[#00c0f0] text-white"
                : "bg-zinc-400/30 text-zinc-400 text-[10px]"
            }`}
          >
            +{statBonuses.guts}
          </span>
        </div>

        {/* Wit Bonus Pill */}
        <div>
          <span
            className={`inline-block font-black text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full shadow-md border-2 border-white dark:border-zinc-900 ${
              statBonuses.wiz > 0
                ? "bg-[#ff3b80] text-white"
                : "bg-zinc-400/30 text-zinc-400 text-[10px]"
            }`}
          >
            +{statBonuses.wiz}
          </span>
        </div>
      </div>

      {/* Trainee 5-Stat Bar */}
      <div className="max-w-xl mx-auto rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 shadow-2xs mb-2.5">
        {/* 5-Column Header */}
        <div className="grid grid-cols-5 text-center divide-x divide-zinc-200/80 dark:divide-zinc-800 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 py-1.5 text-[10px] sm:text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
          <div>👟 Speed</div>
          <div>❤️ Stamina</div>
          <div>💪 Power</div>
          <div>🔥 Guts</div>
          <div>🎓 Wit</div>
        </div>

        {/* 5-Column Stat Values + Rank Box */}
        <div className="grid grid-cols-5 text-center divide-x divide-zinc-100 dark:divide-zinc-800/50 py-2 px-0.5 text-xs bg-white dark:bg-zinc-900">
          {[
            { name: "Speed", val: targetChara?.baseStats?.[0] ?? 100 },
            { name: "Stamina", val: targetChara?.baseStats?.[1] ?? 100 },
            { name: "Power", val: targetChara?.baseStats?.[2] ?? 100 },
            { name: "Guts", val: targetChara?.baseStats?.[3] ?? 100 },
            { name: "Wit", val: targetChara?.baseStats?.[4] ?? 100 },
          ].map((stat, i) => {
            const badge = getStatRankBadge(stat.val);
            return (
              <div key={i} className="flex items-center justify-center gap-1">
                <span
                  className={`px-1.5 py-0.2 rounded font-black text-[10px] shadow-2xs ${badge.bgClass}`}
                >
                  {badge.rank}
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[11px] sm:text-xs">
                  {stat.val}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trainee Aptitude Grid (Turf/Dirt, Sprint/Mile/Med/Long, Runner/Leader/Betweener/Chaser) */}
      <div className="max-w-xl mx-auto rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 p-2.5 text-xs space-y-2 shadow-2xs">
        {/* Row 1: Surface */}
        <div className="flex items-center gap-2">
          <span className="w-16 sm:w-20 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            Surface
          </span>
          <div className="flex-1 grid grid-cols-2 gap-1 sm:gap-2">
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
              <span className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">Turf</span>
              <span
                className={`w-5 h-5 flex items-center justify-center rounded-md text-xs font-black ${getAptitudeStyle(
                  targetChara?.aptitude?.[0],
                )}`}
              >
                {targetChara?.aptitude?.[0] || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
              <span className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">Dirt</span>
              <span
                className={`w-5 h-5 flex items-center justify-center rounded-md text-xs font-black ${getAptitudeStyle(
                  targetChara?.aptitude?.[1],
                )}`}
              >
                {targetChara?.aptitude?.[1] || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Distance */}
        <div className="flex items-center gap-2">
          <span className="w-16 sm:w-20 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            Distance
          </span>
          <div className="flex-1 grid grid-cols-4 gap-1 sm:gap-1.5">
            {[
              { label: "Short", grade: targetChara?.aptitude?.[2] },
              { label: "Mile", grade: targetChara?.aptitude?.[3] },
              { label: "Medium", grade: targetChara?.aptitude?.[4] },
              { label: "Long", grade: targetChara?.aptitude?.[5] },
            ].map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-1.5 py-1 rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs"
              >
                <span className="text-[10px] sm:text-[11px] text-zinc-700 dark:text-zinc-300 font-medium truncate">
                  {d.label}
                </span>
                <span
                  className={`w-5 h-5 flex items-center justify-center rounded-md text-xs font-black ${getAptitudeStyle(
                    d.grade,
                  )}`}
                >
                  {d.grade || "-"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Strategy */}
        <div className="flex items-center gap-2">
          <span className="w-16 sm:w-20 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            Strategy
          </span>
          <div className="flex-1 grid grid-cols-4 gap-1 sm:gap-1.5">
            {[
              { label: "Runner", grade: targetChara?.aptitude?.[6] },
              { label: "Leader", grade: targetChara?.aptitude?.[7] },
              { label: "Between", grade: targetChara?.aptitude?.[8] },
              { label: "Chaser", grade: targetChara?.aptitude?.[9] },
            ].map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-1.5 py-1 rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs"
              >
                <span className="text-[10px] sm:text-[11px] text-zinc-700 dark:text-zinc-300 font-medium truncate">
                  {s.label}
                </span>
                <span
                  className={`w-5 h-5 flex items-center justify-center rounded-md text-xs font-black ${getAptitudeStyle(
                    s.grade,
                  )}`}
                >
                  {s.grade || "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
