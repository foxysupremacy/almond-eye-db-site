"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/** Marks the element the sliding indicator should cover (set it on exactly one element, or none). */
export const INDICATOR_TARGET_ATTR = "data-indicator-active";

export interface IndicatorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Position of `target` inside `container`'s padding box, in the container's
 * scrolled coordinate space — i.e. what an absolutely positioned child needs.
 */
export function computeIndicatorBox(
  container: RectLike,
  target: RectLike,
  scroll: { left: number; top: number },
  border: { left: number; top: number },
): IndicatorBox {
  return {
    x: target.left - container.left - border.left + scroll.left,
    y: target.top - container.top - border.top + scroll.top,
    width: target.width,
    height: target.height,
  };
}

export interface ActiveIndicator<T extends HTMLElement> {
  containerRef: RefObject<T | null>;
  /** Inline style for the absolutely positioned pill. */
  indicatorStyle: CSSProperties;
  /** False before the first measurement and when nothing is active — hide the pill then. */
  visible: boolean;
  /** True once the pill has been placed; enable its transition only then (no slide-in from 0,0). */
  animate: boolean;
}

/**
 * Measures the element matching `targetSelector` (default: marked with
 * `data-indicator-active="true"`) inside the container and returns a style that
 * moves a single pill onto it. Re-measures when `activeKey` changes and when
 * the container resizes.
 */
export function useActiveIndicator<T extends HTMLElement>(
  activeKey: string,
  targetSelector = `[${INDICATOR_TARGET_ATTR}="true"]`,
): ActiveIndicator<T> {
  const containerRef = useRef<T | null>(null);
  const [box, setBox] = useState<IndicatorBox | null>(null);
  const [animate, setAnimate] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const target = container?.querySelector<HTMLElement>(targetSelector);
    if (!container || !target) {
      setBox(null);
      return;
    }
    const targetRect = target.getBoundingClientRect();
    if (targetRect.width === 0) {
      // Hidden layout (e.g. desktop nav under lg:hidden) — the ResizeObserver re-measures on show.
      setBox(null);
      return;
    }
    const next = computeIndicatorBox(
      container.getBoundingClientRect(),
      targetRect,
      { left: container.scrollLeft, top: container.scrollTop },
      { left: container.clientLeft, top: container.clientTop },
    );
    setBox((previous) =>
      previous &&
      previous.x === next.x &&
      previous.y === next.y &&
      previous.width === next.width &&
      previous.height === next.height
        ? previous
        : next,
    );
  }, [targetSelector]);

  useLayoutEffect(() => {
    measure();
  }, [activeKey, measure]);

  // Turn the transition on one frame after the first placement.
  useLayoutEffect(() => {
    if (!box || animate) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [box, animate]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  return {
    containerRef,
    indicatorStyle: box
      ? { width: box.width, height: box.height, transform: `translate(${box.x}px, ${box.y}px)` }
      : { width: 0, height: 0 },
    visible: box !== null,
    animate,
  };
}
