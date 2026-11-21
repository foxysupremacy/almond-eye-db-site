// A trained uma's overall rank → its badge image.
//
// `rank` is the game's single_mode_rank.id, which starts at 1 (G, 0-299 pts).
// The extracted icon files are numbered from 00 (G), so the file number is rank - 1.

export type RankIconVariant = "badge" | "text";

export function veteranRankIconSrc(rank: number | null | undefined, variant: RankIconVariant = "badge"): string {
  const index = String(Math.max(0, Math.trunc(Number(rank) || 0) - 1)).padStart(2, "0");
  return variant === "text"
    ? `/assets/rank/utx_txt_rank_${index}.png`
    : `/assets/statusrank/utx_ico_statusrank_${index}.png`;
}
