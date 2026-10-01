"use client";

import { useLayoutEffect, useState } from "react";

export interface InspectorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface InspectorViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SkillInspectorPosition {
  x: number;
  y: number;
  side: "left" | "right";
}

const VIEWPORT_PADDING = 16;
const TRIGGER_GAP = 8;

/** Pure placement calculation so viewport edge cases can be tested without layout. */
export function calculateSkillInspectorPosition(
  anchor: InspectorRect,
  panel: Pick<InspectorRect, "width" | "height">,
  viewport: InspectorViewport,
  padding = VIEWPORT_PADDING,
  gap = TRIGGER_GAP,
): SkillInspectorPosition {
  const viewportRight = viewport.left + viewport.width;
  const viewportBottom = viewport.top + viewport.height;
  const rightSpace = viewportRight - padding - anchor.right - gap;
  const leftSpace = anchor.left - gap - (viewport.left + padding);

  let side: SkillInspectorPosition["side"];
  if (panel.width <= rightSpace) side = "right";
  else if (panel.width <= leftSpace) side = "left";
  else side = rightSpace >= leftSpace ? "right" : "left";

  const rawX = side === "right" ? anchor.right + gap : anchor.left - gap - panel.width;
  const maxX = Math.max(viewport.left + padding, viewportRight - padding - panel.width);
  const x = Math.min(Math.max(rawX, viewport.left + padding), maxX);
  const centeredY = anchor.top + anchor.height / 2 - panel.height / 2;
  const maxY = Math.max(viewport.top + padding, viewportBottom - padding - panel.height);
  const y = Math.min(Math.max(centeredY, viewport.top + padding), maxY);

  return { x, y, side };
}

function getViewport(): InspectorViewport {
  const visualViewport = window.visualViewport;
  return {
    left: visualViewport?.offsetLeft ?? 0,
    top: visualViewport?.offsetTop ?? 0,
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
  };
}

/**
 * Positions a React Aria popover without writing layout from inside a
 * ResizeObserver callback. All measurement updates are coalesced into a frame
 * and only the composited transform is written back to the element.
 */
export function useSkillInspectorPosition(
  anchor: HTMLElement,
  popover: HTMLElement | null,
) {
  const [positioned, setPositioned] = useState(false);
  const [side, setSide] = useState<SkillInspectorPosition["side"]>("right");

  useLayoutEffect(() => {
    if (!popover || !anchor.isConnected) return;
    setPositioned(false);

    let frame = 0;
    let previousX = Number.NaN;
    let previousY = Number.NaN;
    let previousSide: SkillInspectorPosition["side"] | null = null;

    const schedulePosition = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!anchor.isConnected || !popover.isConnected) return;

        const anchorRect = anchor.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const next = calculateSkillInspectorPosition(anchorRect, popoverRect, getViewport());

        if (next.x !== previousX || next.y !== previousY) {
          popover.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
          previousX = next.x;
          previousY = next.y;
        }
        if (next.side !== previousSide) {
          previousSide = next.side;
          setSide(next.side);
          popover.dataset.inspectorPlacement = next.side;
        }
        setPositioned(true);
      });
    };

    const resizeObserver = typeof window.ResizeObserver === "undefined"
      ? null
      : new window.ResizeObserver(schedulePosition);
    resizeObserver?.observe(anchor);
    resizeObserver?.observe(popover);
    window.addEventListener("resize", schedulePosition);
    window.addEventListener("scroll", schedulePosition, true);
    window.visualViewport?.addEventListener("resize", schedulePosition);
    window.visualViewport?.addEventListener("scroll", schedulePosition);
    schedulePosition();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition, true);
      window.visualViewport?.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("scroll", schedulePosition);
    };
  }, [anchor, popover]);

  return { positioned, side };
}
