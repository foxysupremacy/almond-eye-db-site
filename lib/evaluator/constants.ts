/**
 * Expected typical rank intervals for 9-uma CM room.
 * Runner: 1st - 2nd
 * Leader: 2nd - 5th
 * Betweener: 4th - 7th
 * Chaser: 4th - 9th (current game version)
 */
export const STYLE_EXPECTED_RANKS: Record<number, [number, number]> = {
  1: [1, 2], // Runner
  2: [2, 5], // Leader
  3: [4, 7], // Betweener
  4: [4, 9], // Chaser (updated for the current game version — End Closers now sit 4th–9th)
  5: [1, 1], // Great Escape
};

export const STYLE_NAMES: Record<number, string> = {
  1: "Runner",
  2: "Leader",
  3: "Betweener",
  4: "Chaser",
  5: "Great Escape",
};
