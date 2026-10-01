"use client";

import { Popover, type PopoverProps } from "react-aria-components/Popover";
import type { ReactNode, RefObject } from "react";

export interface AppPopoverProps extends Omit<PopoverProps, "children" | "triggerRef"> {
  triggerRef: RefObject<Element | null>;
  children: ReactNode;
  layer?: "select" | "picker" | "inspection" | "inspector" | "duplicate" | "duplicate-inspection" | "duplicate-inspector";
}

const layers = { select: "z-[410]", picker: "z-[300]", inspection: "z-[350]", inspector: "z-[400]", duplicate: "z-[250]", "duplicate-inspection": "z-[360]", "duplicate-inspector": "z-[405]" } as const;

/** Anchored React Aria overlay with the application's shared viewport spacing. */
export function AppPopover({ triggerRef, children, layer = "inspector", placement = "right", offset = 8, containerPadding = 16, className = "", ...props }: AppPopoverProps) {
  return (
    <Popover
      {...props}
      triggerRef={triggerRef}
      placement={placement}
      offset={offset}
      containerPadding={containerPadding}
      className={`outline-none ${layers[layer]} ${typeof className === "string" ? className : ""}`}
    >
      {children}
    </Popover>
  );
}
