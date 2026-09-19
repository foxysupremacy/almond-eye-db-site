"use client";

import React, { useMemo } from "react";
import type { KyumaruVeteranItem } from "../lib/kyumaru-types";
import { getCharacterImageUrl, type CharacterIndexEntry } from "../lib/api";
import { extractSlotPrimaryFactors } from "../lib/factor-decoder";
import type { VeteranTargetFactorMatch } from "../lib/parent-factor-matcher";

interface TrainedUmaCardProps {
  veteran: KyumaruVeteranItem;
  character?: CharacterIndexEntry | null;
  onClick: () => void;
  isParent?: boolean;
  onToggleParent?: (e: React.MouseEvent) => void;
  targetFactorMatch?: VeteranTargetFactorMatch;
  hasTargetSkills?: boolean;
}

function renderStarPill(count: number) {
  return (
    <div className="flex items-center justify-center gap-0.5 text-[8px] leading-none mt-0.5">
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          className={
            s <= count
              ? "text-amber-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] font-black"
              : "text-white/30 font-normal"
          }
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function TrainedUmaCard({
  veteran,
  character,
  onClick,
  isParent = false,
  onToggleParent,
  targetFactorMatch,
  hasTargetSkills = false,
}: TrainedUmaCardProps) {
  const cardId = veteran.card_id;
  const charId = character?.charId || 0;
  const avatarUrl = charId && cardId ? getCharacterImageUrl(charId, cardId) : "";
  const nameEn = character?.nameEn || veteran.name || `Chara ${cardId}`;
  const titleEn = character?.titleEn || character?.titleJp || "";

  // Rank icon asset path from public/assets/rank/utx_txt_rank_XX.png
  const rankPadded = String(veteran.rank || 0).padStart(2, "0");
  const rankIconSrc = `/assets/rank/utx_txt_rank_${rankPadded}.png`;

  // Primary 3 factors: Blue, Pink, Green
  const primaryFactors = useMemo(() => {
    return extractSlotPrimaryFactors(veteran.factor_info_array);
  }, [veteran.factor_info_array]);

  const blue = primaryFactors.blue;
  const pink = primaryFactors.pink;
  const green = primaryFactors.green;

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col items-center pt-6 pb-2.5 px-2.5 rounded-2xl border shadow-2xs hover:shadow-md transition-all cursor-pointer group ${
        isParent
          ? "border-emerald-500/50 bg-emerald-50/[0.04] dark:bg-emerald-950/[0.08]"
          : "border-zinc-200/90 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 hover:border-emerald-500/50 hover:bg-emerald-50/10 dark:hover:bg-emerald-950/10"
      }`}
      title={`Inspect ${nameEn} (${veteran.rank_score?.toLocaleString()} pts)`}
    >
      {/* Top-Left: Parent Controls & Target Factor Indicator */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
        {onToggleParent && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleParent(e);
            }}
            className={`flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-lg text-xs transition-all cursor-pointer ${
              isParent
                ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-500 ring-1 ring-emerald-400/60"
                : "bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 opacity-60 group-hover:opacity-100 hover:scale-105"
            }`}
            title={isParent ? "Parent candidate (Click to unmark)" : "Click to mark as Parent candidate"}
            aria-label={isParent ? "Unmark as Parent" : "Mark as Parent"}
          >
            <span>🧬</span>
          </button>
        )}

        {isParent && hasTargetSkills && (
          <div className="relative group/factor">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] sm:text-[9.5px] font-bold tracking-tight shadow-2xs border ${
                (targetFactorMatch?.count || 0) > 0
                  ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-700/80"
                  : "bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              +{(targetFactorMatch?.count || 0)} target factor{(targetFactorMatch?.count || 0) === 1 ? "" : "s"}
            </span>

            {/* Hover Tooltip listing matched target factors */}
            {(targetFactorMatch?.count || 0) > 0 && (
              <div
                className="hidden group-hover/factor:block absolute left-0 top-full mt-1.5 w-60 sm:w-64 max-w-[85vw] p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl backdrop-blur-md z-50 pointer-events-none text-left animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Target Factors ({targetFactorMatch?.count})</span>
                  <span className="text-zinc-400 font-normal">3-gen Lineage</span>
                </div>
                <div className="flex flex-col gap-2 mt-2 max-h-44 overflow-y-auto pr-0.5">
                  {targetFactorMatch?.matchedSkills.map((m) => (
                    <div key={m.skillId} className="flex flex-col gap-0.5 text-[10px]">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{m.skillNameEn}</span>
                        <span className="text-amber-500 dark:text-amber-400 font-bold shrink-0">{"★".repeat(m.maxStars)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[9px] text-zinc-500 dark:text-zinc-400">
                        <span className="truncate">{m.skillNameJa}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {m.occurrences.map((occ, idx) => (
                            <span
                              key={idx}
                              className={`px-1 py-0.2 rounded text-[8px] font-semibold ${
                                occ.origin === "self"
                                  ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                  : occ.origin === "parent1"
                                  ? "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                                  : "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800"
                              }`}
                            >
                              {occ.originLabel} ({occ.stars}★)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Circular Avatar Container with Pop-out 3D Layering */}
      <div className="relative w-20 h-20 sm:w-[88px] sm:h-[88px] flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform duration-150 ease-out-quart">
        {/* Layer 1: Golden Circular Frame with Lower Body Clipped Inside */}
        <div className="absolute inset-0 rounded-full ring-[2.5px] ring-amber-400/95 dark:ring-amber-400/80 shadow-sm bg-gradient-to-b from-amber-50 via-amber-100/60 to-amber-200/50 dark:from-zinc-800 dark:to-zinc-900 overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={nameEn}
              className="h-full w-full object-contain filter drop-shadow-xs scale-[1.65] origin-top -translate-y-[17%]"
              loading="lazy"
            />
          ) : (
            <span className="text-2xl">🐎</span>
          )}
        </div>

        {/* Layer 2: Pop-Out Top Half (Ears, hat, hair unclipped & layered over golden border) */}
        {avatarUrl && (
          <div
            className="absolute inset-0 z-1 pointer-events-none"
            style={{ clipPath: "inset(-65px -20px 35% -20px)" }}
          >
            <img
              src={avatarUrl}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain filter drop-shadow-xs scale-[1.65] origin-top -translate-y-[17%]"
              loading="lazy"
            />
          </div>
        )}

        {/* Layer 3: Top-Right Rank Badge from /assets/rank */}
        <div className="absolute -top-2 -right-2.5 z-10 pointer-events-none">
          <img
            src={rankIconSrc}
            alt={`Rank ${veteran.rank}`}
            className="h-7 sm:h-8 w-auto object-contain filter drop-shadow-md"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        {/* Layer 4: Bottom 3 Spark/Factor Pills (Blue, Pink, Green) */}
        <div className="absolute -bottom-5.5 inset-x-[-8px] z-10 flex items-center justify-center gap-0.5 pointer-events-none">
          {/* Blue Stat Factor */}
          <div className="flex-1 max-w-[34px] px-0.5 py-0.5 rounded bg-blue-600 dark:bg-blue-600 text-white shadow-xs border border-blue-400/40 flex flex-col items-center">
            <span className="text-[8.5px] font-bold tracking-tighter leading-tight truncate w-full text-center">
              {blue?.nameEn || "--"}
            </span>
            {renderStarPill(blue?.stars || 0)}
          </div>

          {/* Pink Aptitude Factor */}
          <div className="flex-1 max-w-[34px] px-0.5 py-0.5 rounded bg-pink-600 dark:bg-pink-600 text-white shadow-xs border border-pink-400/40 flex flex-col items-center">
            <span className="text-[8.5px] font-bold tracking-tighter leading-tight truncate w-full text-center">
              {pink?.nameEn || "--"}
            </span>
            {renderStarPill(pink?.stars || 0)}
          </div>

          {/* Green Unique Factor */}
          <div className="flex-1 max-w-[34px] px-0.5 py-0.5 rounded bg-emerald-600 dark:bg-emerald-600 text-white shadow-xs border border-emerald-400/40 flex flex-col items-center">
            <span className="text-[8.5px] font-bold tracking-tighter leading-tight truncate w-full text-center">
              {green ? "Unique" : "--"}
            </span>
            {renderStarPill(green?.stars || 0)}
          </div>
        </div>
      </div>

      {/* Uma Meta: Name, Score, and Title */}
      <div className="w-full text-center mt-7">
        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug">
          {nameEn}
        </h4>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {veteran.rank_score?.toLocaleString()} pts
          </span>
        </div>
        {titleEn && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
            {titleEn}
          </p>
        )}
      </div>
    </div>
  );
}
