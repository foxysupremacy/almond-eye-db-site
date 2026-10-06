"use client";

import type { ReactNode } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog } from "react-aria-components/Dialog";
import { DialogTrigger, Popover } from "react-aria-components/Popover";

export function ParentingPopover({ label, trigger, className, children }: { label: string; trigger: ReactNode; className?: string; children: ReactNode }) {
  return <DialogTrigger>
    <Button aria-label={label} className={className}>{trigger}</Button>
    <Popover placement="bottom start" offset={4} containerPadding={12} className="z-[410] max-h-[min(80vh,36rem)] w-[min(20rem,calc(100vw-24px))] overflow-auto rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
      <Dialog aria-label={label}>{children}</Dialog>
    </Popover>
  </DialogTrigger>;
}
