"use client";

import { Button } from "react-aria-components/Button";
import { Disclosure, DisclosurePanel, Heading } from "react-aria-components/Disclosure";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "../primitives/icons";

export function AppDisclosure({ title, children, defaultExpanded = false, className = "" }: {
  title: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}) {
  return (
    <Disclosure defaultExpanded={defaultExpanded} className={className}>
      <Heading className="m-0">
        <Button slot="trigger" className="group flex min-h-11 w-full items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70">
          {title}
          <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform group-data-[expanded]:rotate-180" />
        </Button>
      </Heading>
      <DisclosurePanel>{children}</DisclosurePanel>
    </Disclosure>
  );
}
