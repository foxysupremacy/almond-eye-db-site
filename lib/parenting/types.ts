import type { KyumaruVeteranItem } from "../kyumaru-types";
import type { GrandparentSlot } from "../parenting-state";
import type { CharacterIndexEntry } from "../api";

/** One pedigree slot shown in the inherited-skills modal (parent/grandparent line). */
export interface ParticipantSlot {
  slotLabel: string;
  subLabel: string;
  vet: KyumaruVeteranItem | GrandparentSlot | null;
  chara: CharacterIndexEntry | null;
}

export interface AptitudePatchInfo {
  requiresPatch: boolean;
  canPatch: boolean;
  targetCategory: string;
  currentRank: string;
  missingRanks: number;
  requiredPinkStars: number;
  warningMessage?: string;
}

export interface DeckAnalysis {
  equippedDeckCharNames: Set<string>;
  equippedDeckCharIds: Set<number>;
  equippedDeckSkillIds: Set<number>;
}

export interface LegacyUniqueEval {
  skillName?: string;
  category: string;
  tier: "S+" | "S" | "A" | "B" | "C" | "D" | "F";
  badge: string;
  badgeClass: string;
  explanation: string;
}

export interface LegacyCandidate {
  charId: number;
  cardId: number;
  nameEn: string;
  nameJp: string;
  titleEn?: string;
  avatarUrl: string;

  /** True when backed by an imported Hall of Fame veteran (real factors / G1 wins). */
  isVeteran: boolean;
  /**
   * True for untrained roster picks surfaced under "Your Umas" — owned but not
   * yet trained; scored as a potential veteran via their career G1 schedule.
   */
  isUntrained?: boolean;
  /** G1s the character can win in a career run (must-win for friend borrows). */
  careerG1Count?: number;
  veteran?: KyumaruVeteranItem;
  allRuns?: KyumaruVeteranItem[];
  runCount?: number;
  blueStarsTotal?: number;
  selfBlueFactor?: { name: string; stars: number };
  selfPinkFactor?: { name: string; stars: number };

  /** Affinity points with the target trainee (GameTora-style plain number). */
  affinityScore: number;
  /** Affinity points with the fixed parent (sub-legacy lists only). */
  pairScore?: number;
  /** Sort key: affinityScore + (pairScore ?? 0). */
  totalScore: number;

  /** Track/style suitability of the inheritable unique (absent when no course selected). */
  uniqueEval?: LegacyUniqueEval;

  reasons: string[];
}
