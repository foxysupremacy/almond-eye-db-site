import { DeckIcon, LineageIcon, LibraryIcon, TargetIcon, FlagIcon, TrophyIcon } from "@/app/common/ui/primitives/icons";

export type RootAppRoute = "main" | "parent-deck" | "parenting" | "rankings" | "visualizer" | "stamina" | "veterans";
export type AppShellRoute = RootAppRoute | "supports" | "characters";
export type Tab = RootAppRoute;

// Visible navigation only; the veterans route remains valid for direct hash URLs.
export const TABS: { id: AppShellRoute; label: string; badge?: string }[] = [
  { id: "main", label: "Main Deck" },
  { id: "parent-deck", label: "Parent Deck", badge: "Deck & Skills" },
  { id: "parenting", label: "Parenting", badge: "Inheritance" },
  { id: "rankings", label: "Rankings" },
  { id: "visualizer", label: "Visualizer" },
  { id: "stamina", label: "Stamina" },
  { id: "supports", label: "Supports" },
  { id: "characters", label: "Characters" },
];

export const MOBILE_TABS = [
  { id: "main", label: "Deck", icon: DeckIcon },
  { id: "parent-deck", label: "Parents", icon: TargetIcon },
  { id: "parenting", label: "Lineage", icon: LineageIcon },
  { id: "rankings", label: "Ranks", icon: TrophyIcon },
  { id: "visualizer", label: "Race", icon: FlagIcon },
  { id: "library", label: "Library", icon: LibraryIcon },
] as const;

// Stamina has no bottom-bar slot; phones reach it from the Library sheet.
export const LIBRARY_ITEMS = (["supports", "characters", "stamina"] as const).map((id) => TABS.find((tab) => tab.id === id)!);

export function isRootAppRoute(route: string): route is RootAppRoute {
  return route === "main" || route === "parent-deck" || route === "parenting" || route === "rankings" || route === "visualizer" || route === "stamina" || route === "veterans";
}

export function appRouteHref(route: AppShellRoute): string {
  return isRootAppRoute(route) ? `/#${route}` : `/${route}`;
}
