import React from "react";

export type StatName = "Speed" | "Stamina" | "Power" | "Guts" | "Wit";

const STAT_ICON_FILES: Record<StatName, string> = {
  Speed: "utx_ico_obtain_00.png",
  Stamina: "utx_ico_obtain_01.png",
  Power: "utx_ico_obtain_02.png",
  Guts: "utx_ico_obtain_03.png",
  Wit: "utx_ico_obtain_04.png",
};

/** Game-provided stat icon, replacing emoji-only labels in compact stat shelves. */
export function StatIcon({ stat, className = "h-4 w-4" }: { stat: StatName; className?: string }) {
  return (
    <img
      src={`/assets/icons/${STAT_ICON_FILES[stat]}`}
      alt=""
      aria-hidden="true"
      title={stat}
      className={`object-contain ${className}`}
    />
  );
}

const RANK_ICON_CODES: Record<string, number> = {
  G: 0,
  "G+": 1,
  F: 2,
  "F+": 3,
  E: 4,
  "E+": 5,
  D: 6,
  "D+": 7,
  C: 8,
  "C+": 9,
  B: 10,
  "B+": 11,
  A: 12,
  "A+": 13,
  S: 14,
  "S+": 15,
};

/** Game-provided rank icon for aptitude/evaluation grades. */
export function StatusRankIcon({
  grade,
  className = "h-5 w-5",
}: {
  grade?: string | null;
  className?: string;
}) {
  const normalized = grade?.trim().toUpperCase() || "-";
  if (normalized === "-") {
    return (
      <span
        aria-label="Not rated"
        title="Not rated"
        className={`inline-flex items-center justify-center font-bold text-zinc-400 dark:text-zinc-500 ${className}`}
      >
        —
      </span>
    );
  }
  const code = RANK_ICON_CODES[normalized] ?? RANK_ICON_CODES.G;
  return (
    <img
      src={`/assets/statusrank/utx_ico_statusrank_${String(code).padStart(2, "0")}.png`}
      alt={normalized}
      title={normalized}
      className={`object-contain ${className}`}
    />
  );
}
