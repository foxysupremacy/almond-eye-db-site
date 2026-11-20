"use client";

import { AppShellHeader } from "@/app/common/ui/controls/app-shell-header";
import { AppMobileNavigation } from "@/app/common/ui/controls/app-mobile-navigation";
import { TabSkeleton } from "@/app/components/tab-skeleton";

type CollectionRoute = "supports" | "characters";

/**
 * Route-level loading state for Supports/Characters (`app/<route>/loading.tsx`).
 * Keeps the same header and mobile nav as `CollectionRouteFrame` — both carry
 * the app-header / app-mobile-nav transition names — so only the content area
 * swaps to the branded loader while the route streams in.
 */
export function CollectionRouteLoading({ activeRoute }: { activeRoute: CollectionRoute }) {
  return (
    <div className="app-shell flex min-h-[100dvh] min-w-0 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AppShellHeader
        activeRoute={activeRoute}
        isControlsCollapsed={false}
        mobileTitle={activeRoute === "supports" ? "Supports" : "Characters"}
        onToggleControls={() => {}}
      />
      <main id="main-content" className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-3 py-5 sm:px-6 sm:py-8">
        <TabSkeleton />
      </main>
      <AppMobileNavigation activeRoute={activeRoute} />
    </div>
  );
}
