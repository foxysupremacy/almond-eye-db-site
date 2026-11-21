import { describe, expect, test } from "bun:test";
import { veteranRankIconSrc } from "./rank-icon";

// Game ranks (single_mode_rank.id) start at 1 = G; the icon files start at 00 = G.
describe("veteranRankIconSrc", () => {
  test("rank 71 (49,000-49,799 pts) is UB2, icon file 70", () => {
    expect(veteranRankIconSrc(71)).toBe("/assets/statusrank/utx_ico_statusrank_70.png");
    expect(veteranRankIconSrc(71, "text")).toBe("/assets/rank/utx_txt_rank_70.png");
  });

  test("rank 1 (G) is icon file 00", () => {
    expect(veteranRankIconSrc(1)).toBe("/assets/statusrank/utx_ico_statusrank_00.png");
  });

  test("missing or invalid ranks fall back to G", () => {
    expect(veteranRankIconSrc(0)).toBe("/assets/statusrank/utx_ico_statusrank_00.png");
    expect(veteranRankIconSrc(undefined)).toBe("/assets/statusrank/utx_ico_statusrank_00.png");
  });
});
