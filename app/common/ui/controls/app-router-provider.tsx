"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RouterProvider } from "react-aria-components";
import { createRouteChangeWaiter, navigateWithTransition } from "@/app/common/motion/route-transition";

/**
 * Routes every react-aria `Link` (header, mobile nav, library sheet) through
 * the App Router, so moving between Home and Supports/Characters is a
 * client-side navigation that keeps the loaded game data, wrapped in the same
 * crossfade as tab switches. Without this, those links were full page loads.
 */
export function AppRouterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [waiter] = useState(createRouteChangeWaiter);

  // The new route has committed: let the pending view transition animate.
  useEffect(() => {
    waiter.notify();
  }, [pathname, waiter]);

  const navigate = useCallback(
    (href: string) => navigateWithTransition(href, { push: (target) => router.push(target), waiter }),
    [router, waiter],
  );

  return <RouterProvider navigate={navigate}>{children}</RouterProvider>;
}
