"use client";

import type { ReactNode } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components/Tabs";

export type PedigreeBranch = "p1" | "p2";

export function PedigreeBranchTabs({ value, onChange, children, trailing }: {
  value: PedigreeBranch;
  onChange: (branch: PedigreeBranch) => void;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return <Tabs selectedKey={value} onSelectionChange={(key) => onChange(String(key) as PedigreeBranch)}>
    <div className="mb-2 flex items-center justify-between gap-2">
      <TabList aria-label="Choose lineage branch" className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        <Tab id="p1" className="inline-flex min-h-9 min-w-14 cursor-pointer items-center justify-center rounded-md px-3 text-center text-xs font-bold text-zinc-600 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 data-[selected]:bg-emerald-600 data-[selected]:text-white data-[selected]:shadow-sm dark:text-zinc-300">P1</Tab>
        <Tab id="p2" className="inline-flex min-h-9 min-w-14 cursor-pointer items-center justify-center rounded-md px-3 text-center text-xs font-bold text-zinc-600 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 data-[selected]:bg-emerald-600 data-[selected]:text-white data-[selected]:shadow-sm dark:text-zinc-300">P2</Tab>
      </TabList>
      {trailing}
    </div>
    <TabPanel id={value}>{children}</TabPanel>
  </Tabs>;
}
