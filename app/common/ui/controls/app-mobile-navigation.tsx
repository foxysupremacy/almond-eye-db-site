"use client";

import { useState } from "react";
import { Link as AriaLink } from "react-aria-components/Link";
import { appRouteHref, isRootAppRoute, LIBRARY_ITEMS, MOBILE_TABS, type AppShellRoute, type RootAppRoute } from "@/app/tabs";
import { MobileSheet } from "./mobile-sheet";

export function AppMobileNavigation({ activeRoute, onRootRouteChange }: {
  activeRoute: AppShellRoute;
  onRootRouteChange?: (route: RootAppRoute) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  return (
    <>
      <nav aria-label="Mobile navigation" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-zinc-200 bg-white/95 px-1 pt-1 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden">
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
          const active = id === "library" ? LIBRARY_ITEMS.some((item) => item.id === activeRoute) : activeRoute === id;
          const className = `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${active ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`;
          const content = <><span className={`grid h-7 w-9 place-items-center rounded-lg ${active ? "bg-emerald-100 dark:bg-emerald-950" : ""}`}><Icon className="h-4 w-4" /></span>{label}</>;
          return id === "library" ? (
            <button key={id} type="button" aria-haspopup="dialog" aria-expanded={libraryOpen} onClick={() => setLibraryOpen(true)} className={className}>{content}</button>
          ) : (
            <AriaLink key={id} href={appRouteHref(id)} aria-current={active ? "page" : undefined} onClick={(event) => {
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
