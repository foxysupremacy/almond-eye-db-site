"use client";

import { Link as AriaLink } from "react-aria-components/Link";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { BrandMark } from "@/app/common/ui/primitives/brand-mark";
import { ChevronDownIcon, FilterIcon, MenuIcon } from "@/app/common/ui/primitives/icons";
import { appRouteHref, isRootAppRoute, TABS, type AppShellRoute, type RootAppRoute } from "@/app/tabs";

export type { AppShellRoute, RootAppRoute } from "@/app/tabs";

interface AppShellHeaderProps {
  activeRoute: AppShellRoute;
  isControlsCollapsed: boolean;
  mobileTitle: string;
  onToggleControls: () => void;
  onRootRouteChange?: (route: RootAppRoute) => void;
  onOpenBuildTools?: () => void;
}

/** The single responsive application header shared by root and collection routes. */
export function AppShellHeader({
  activeRoute,
  isControlsCollapsed,
  mobileTitle,
  onToggleControls,
  onRootRouteChange,
  onOpenBuildTools,
}: AppShellHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md transition-colors duration-200 dark:border-zinc-800/80 dark:bg-zinc-900/85">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">AlmondEye DB</p>
            <h1 className="truncate text-base font-semibold">{mobileTitle}</h1>
          </div>
        </div>
        {onOpenBuildTools ? <AppButton type="button" variant="quiet" size="md" aria-label="Build settings" aria-haspopup="dialog" onPress={onOpenBuildTools}><FilterIcon className="h-5 w-5" />Build</AppButton> : null}
      </div>

      <div className="mx-auto hidden h-14 max-w-5xl items-center gap-3 px-3 sm:px-6 lg:flex">
        <BrandMark />
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Primary navigation">
          {TABS.map((item) => {
            const href = appRouteHref(item.id);
            const active = activeRoute === item.id;
            return (
              <AriaLink
                key={item.id}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  if (!isRootAppRoute(item.id) || !onRootRouteChange) return;
                  event.preventDefault();
                  onRootRouteChange(item.id);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${active
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"}`}
              >
                {item.label}
                {item.id === "rankings" && <span className="text-[9px] uppercase tracking-wider opacity-70">{item.badge}</span>}
              </AriaLink>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <AppButton type="button" onPress={onToggleControls} variant="quiet" className="flex items-center gap-1.5 px-2.5 text-xs font-semibold" aria-expanded={!isControlsCollapsed} aria-controls="global-controls" title={isControlsCollapsed ? "Expand controls" : "Collapse controls"}>
            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ease-in-out-cubic ${isControlsCollapsed ? "" : "rotate-180"}`} />
            <span className="hidden xl:inline">Controls</span>
          </AppButton>
          <AppButton type="button" variant="quiet" size="sm" iconOnly aria-label="Menu" title="Menu"><MenuIcon /></AppButton>
        </div>
      </div>
    </header>
  );
}
