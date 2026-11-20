"use client";

import { useEffect, type ReactNode } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { LIST_MOTION_OPTIONS, shouldAnimateList } from "@/app/common/motion/list-motion";

interface AnimatedListProps {
  /** Number of rendered rows; motion turns off above the row cap. */
  readonly rowCount: number;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * A `<ul>` whose rows animate as they are added, removed, or reordered
 * (DESIGN.md §13.8). Do not place it inside an element that carries a
 * `view-transition-name`; the two systems would animate the same rows twice.
 */
export function AnimatedList({ rowCount, className, children }: AnimatedListProps) {
  const [parentRef, setEnabled] = useAutoAnimate<HTMLUListElement>(LIST_MOTION_OPTIONS);
  const enabled = shouldAnimateList(rowCount);

  useEffect(() => {
    setEnabled(enabled);
  }, [enabled, setEnabled]);

  return (
    <ul ref={parentRef} className={className}>
      {children}
    </ul>
  );
}
