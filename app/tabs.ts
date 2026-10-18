import { DeckIcon, LineageIcon, LibraryIcon, TargetIcon, FlagIcon, TrophyIcon } from "@/app/common/ui/primitives/icons";

export type Tab = "main" | "parent-deck" | "parenting" | "rankings" | "visualizer" | "collection" | "veterans";

export const TABS: { id: Tab; label: string; badge?: string }[] = [
  { id: "main", label: "Main Deck" },
  { id: "parent-deck", label: "Parent Deck", badge: "Deck & Skills" },
  { id: "parenting", label: "Parenting", badge: "Inheritance" },
  { id: "rankings", label: "Rankings", badge: "By track" },
  { id: "visualizer", label: "Visualizer" },
  { id: "collection", label: "Collection" },
  { id: "veterans", label: "Trained Umas", badge: "Beta" },
];

export const MOBILE_TABS = [
  { id: "main", label: "Deck", icon: DeckIcon },
  { id: "parent-deck", label: "Parents", icon: TargetIcon },
  { id: "parenting", label: "Lineage", icon: LineageIcon },
  { id: "rankings", label: "Ranks", icon: TrophyIcon },
  { id: "visualizer", label: "Race", icon: FlagIcon },
  { id: "collection", label: "Collection", icon: LibraryIcon },
] as const;
