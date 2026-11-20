"use client";

import { useState } from "react";
import { Link as AriaLink } from "react-aria-components/Link";
import { appRouteHref, isRootAppRoute, LIBRARY_ITEMS, MOBILE_TABS, type AppShellRoute, type RootAppRoute } from "@/app/tabs";
import { MobileSheet } from "./mobile-sheet";
import { useActiveIndicator } from "@/app/common/hooks/use-active-indicator";

export function AppMobileNavigation({ activeRoute, onRootRouteChange, onRoutePreload }: {
  activeRoute: AppShellRoute;
  onRootRouteChange?: (route: RootAppRoute) => void;
  /** Called on press start / focus of a nav item so the app can prefetch that tab. */
  onRoutePreload?: (route: AppShellRoute) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  // One pill slides between the icon badges (the nav is fixed, so it is the positioning box).
  const indicator = useActiveIndicator<HTMLElement>(activeRoute);
  return (
    <>
      <nav ref={indicator.containerRef} aria-label="Mobile navigation" className="mobile-bottom-nav [view-transition-name:app-mobile-nav] fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-zinc-200 bg-white/95 px-1 pt-1 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden">
        <span
          aria-hidden="true"
          style={indicator.indicatorStyle}
          className={`pointer-events-none absolute left-0 top-0 rounded-lg bg-emerald-100 dark:bg-emerald-950 ${indicator.visible ? "opacity-100" : "opacity-0"} ${indicator.animate ? "transition-[transform,width,height,opacity] duration-[250ms] ease-out-expo" : ""}`}
        />
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
          const active = id === "library" ? LIBRARY_ITEMS.some((item) => item.id === activeRoute) : activeRoute === id;
          const className = `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${active ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`;
          const content = <><span data-indicator-active={active ? "true" : undefined} className="relative grid h-7 w-9 place-items-center rounded-lg"><Icon className="h-4 w-4" /></span>{label}</>;
          return id === "library" ? (
            <button key={id} type="button" aria-haspopup="dialog" aria-expanded={libraryOpen} onClick={() => {
              setLibraryOpen(true);
              // Opening the sheet is intent to go there: warm Supports/Characters/Stamina.
              for (const item of LIBRARY_ITEMS) onRoutePreload?.(item.id);
            }} className={className}>{content}</button>
          ) : (
            <AriaLink key={id} href={appRouteHref(id)} aria-current={active ? "page" : undefined} onPressStart={() => onRoutePreload?.(id)} onFocus={() => onRoutePreload?.(id)} onClick={(event) => {
              if (!onRootRouteChange) return;
              event.preventDefault();
              onRootRouteChange(id);
            }} className={className}>{content}</AriaLink>
          );
        })}
      </nav>
      <MobileSheet open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Library" description="Browse your support cards and characters, or check stamina.">
        <nav aria-label="Library navigation" className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {LIBRARY_ITEMS.map(({ id, label }) => (
            <AriaLink key={id} href={appRouteHref(id)} aria-current={activeRoute === id ? "page" : undefined} onClick={(event) => {
              setLibraryOpen(false);
              if (!onRootRouteChange || !isRootAppRoute(id)) return;
              event.preventDefault();
              onRootRouteChange(id);
            }} className="flex min-h-12 items-center py-3 text-sm font-semibold text-zinc-900 outline-offset-2 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400">{label}</AriaLink>
          ))}
        </nav>
      </MobileSheet>
    </>
  );
}
