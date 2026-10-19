"use client";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Shared pointer/keyboard scrubbing. Pointer-down always scrubs directly (touch taps work);
 * pointer-move scrubs for mouse or while pressed. The first key press lands on `anchorIndex`.
 */
export function useScrub(
  count: number,
  nearestIndex: (clientX: number, rect: DOMRect) => number,
  anchorIndex: number,
) {
  const [index, setIndex] = useState<number | null>(null);
  const pressed = useRef(false);

  const scrub = (e: PointerEvent<SVGRectElement>) =>
    setIndex(nearestIndex(e.clientX, e.currentTarget.getBoundingClientRect()));

  const handlers = {
    onPointerDown: (e: PointerEvent<SVGRectElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pressed.current = true;
      scrub(e);
    },
    onPointerMove: (e: PointerEvent<SVGRectElement>) => {
      if (e.pointerType === "mouse" || pressed.current) scrub(e);
    },
    onPointerUp: () => { pressed.current = false; },
    onPointerCancel: () => { pressed.current = false; },
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setIndex((i) => {
      if (i == null) return anchorIndex;
      return e.key === "ArrowRight" ? Math.min(count - 1, i + 1) : Math.max(0, i - 1);
    });
  };

  return { index, setIndex, handlers, onKeyDown };
}
