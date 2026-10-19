import { DeckIcon, LineageIcon, LibraryIcon, TargetIcon, FlagIcon, TrophyIcon } from "@/app/common/ui/primitives/icons";

export type RootAppRoute = "main" | "parent-deck" | "parenting" | "rankings" | "visualizer" | "veterans";
export type AppShellRoute = RootAppRoute | "supports" | "characters";
export type Tab = RootAppRoute;

export const TABS: { id: AppShellRoute; label: string; badge?: string }[] = [
  { id: "main", label: "Main Deck" },
  { id: "parent-deck", label: "Parent Deck", badge: "Deck & Skills" },
  { id: "parenting", label: "Parenting", badge: "Inheritance" },
  { id: "rankings", label: "Rankings", badge: "By track" },
  { id: "visualizer", label: "Visualizer" },
  { id: "supports", label: "Supports" },
  { id: "characters", label: "Characters" },
  { id: "veterans", label: "Trained Umas", badge: "Beta" },
];

export const MOBILE_TABS = [
  { id: "main", label: "Deck", icon: DeckIcon },
  { id: "parent-deck", label: "Parents", icon: TargetIcon },
  { id: "parenting", label: "Lineage", icon: LineageIcon },
  { id: "rankings", label: "Ranks", icon: TrophyIcon },
  { id: "visualizer", label: "Race", icon: FlagIcon },
  { id: "library", label: "Library", icon: LibraryIcon },
] as const;

export const LIBRARY_ITEMS = TABS.filter(({ id }) => id === "supports" || id === "characters" || id === "veterans");

export function isRootAppRoute(route: string): route is RootAppRoute {
  return route === "main" || route === "parent-deck" || route === "parenting" || route === "rankings" || route === "visualizer" || route === "veterans";
}

export function appRouteHref(route: AppShellRoute): string {
  return isRootAppRoute(route) ? `/#${route}` : `/${route}`;
}
