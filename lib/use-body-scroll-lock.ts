import { useEffect } from "react";

let lockCount = 0;
let originalBodyOverflow = "";
let originalBodyPaddingRight = "";
let originalHtmlOverflow = "";
let originalBodyOverscrollBehavior = "";

/**
 * Incrementally lock body and document scrolling to prevent background scroll.
 * Compares scrollbar width to prevent horizontal layout shift.
 */
export function lockBodyScroll() {
  if (typeof document === "undefined") return;

  if (lockCount === 0) {
    originalBodyOverflow = document.body.style.overflow === "hidden" ? "" : document.body.style.overflow;
    originalBodyPaddingRight = document.body.style.paddingRight;
    originalHtmlOverflow = document.documentElement.style.overflow === "hidden" ? "" : document.documentElement.style.overflow;
    originalBodyOverscrollBehavior = document.body.style.overscrollBehavior === "none" ? "" : document.body.style.overscrollBehavior;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
  }
  lockCount++;
}

/**
 * Decrementally unlock body and document scrolling when popovers/modals close.
 */
export function unlockBodyScroll() {
  if (typeof document === "undefined") return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
    document.body.style.paddingRight = originalBodyPaddingRight;
    document.body.style.overscrollBehavior = originalBodyOverscrollBehavior;
    document.documentElement.style.overflow = originalHtmlOverflow;
  }
}

/**
 * React hook that locks page scrolling while `isLocked` is true,
 * and automatically unlocks when false or on component unmount.
 */
export function useBodyScrollLock(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}
