"use client";

import { ComboBox, Input, ListBox, ListBoxItem, Popover, Button } from "react-aria-components/ComboBox";
import { Tag, TagGroup, TagList } from "react-aria-components/TagGroup";
import type { SkillDetail } from "@/lib/api";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import { getSkillRarityStyle } from "@/app/common/ui/skills/skill-rarity";
import { XIcon } from "@/app/common/ui/primitives/icons";

/** Presentation only: the picker owns matching, equivalence and selected-skill state. */
export function CardTargetSkillSearch({ query, results, selected, onQueryChange, onAdd, onRemove }: {
  query: string;
  results: readonly SkillDetail[];
  selected: readonly SkillDetail[];
  onQueryChange: (value: string) => void;
  onAdd: (skill: SkillDetail) => void;
  onRemove: (skillId: number) => void;
}) {
  return <>
    <ComboBox aria-label="Search target skills" items={results} value={null} inputValue={query} allowsCustomValue menuTrigger="input"
      onInputChange={onQueryChange}
      onChange={(id) => {
        const skill = results.find((entry) => entry.id === id);
        if (skill) onAdd(skill);
        onQueryChange("");
      }} className="relative">
      <Input placeholder="Search skill to filter (e.g. Arc Maestro, Tail Flare)…" className="min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 pr-11 text-base text-zinc-900 outline-none placeholder-zinc-400 focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:min-h-8 sm:text-xs" />
      {query && <Button slot={null} onPress={() => onQueryChange("")} aria-label="Clear target skill query" className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded text-zinc-400 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-7 sm:w-7"><XIcon className="h-3.5 w-3.5" /></Button>}
      <Popover className="z-[410] w-[var(--trigger-width)] max-w-[calc(100vw-24px)] rounded-lg border border-zinc-200 bg-white shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-900" offset={4} containerPadding={12}>
        <ListBox items={results} className="max-h-56 overflow-y-auto overscroll-contain divide-y divide-zinc-100 outline-none dark:divide-zinc-800">
          {(skill) => {
            const rarity = getSkillRarityStyle(skill.rarity);
            return <ListBoxItem id={skill.id} textValue={skill.nameEn || skill.nameJp} className="flex min-h-11 cursor-pointer items-center gap-2 px-2.5 py-2 outline-none data-[focused]:bg-emerald-50 dark:data-[focused]:bg-emerald-950/40">
              <SkillIcon iconId={skill.iconId} name={skill.nameEn} size={18} className="h-4 w-4 shrink-0 object-contain" />
              <span className={`shrink-0 rounded px-1 text-[9px] font-bold ${rarity.badgeClass}`}>{rarity.badgeLabel}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{skill.nameEn || skill.nameJp}</p>{skill.nameJp && skill.nameEn && <p className="mt-0.5 truncate text-[10px] text-zinc-400 dark:text-zinc-500">{skill.nameJp}</p>}</div>
              <span className="shrink-0 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">+ Add</span>
            </ListBoxItem>;
          }}
        </ListBox>
      </Popover>
    </ComboBox>
    {selected.length > 0 && <TagGroup aria-label="Selected target skills" onRemove={(keys) => { for (const key of keys) onRemove(Number(key)); }}>
      <TagList items={selected} className="flex flex-wrap items-center gap-1.5 pt-2">
        {(skill) => {
          const rarity = getSkillRarityStyle(skill.rarity);
          return <Tag id={skill.id} textValue={skill.nameEn || skill.nameJp} className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-zinc-800 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 sm:min-h-8">
            <SkillIcon iconId={skill.iconId} name={skill.nameEn} size={16} className="h-4 w-4 shrink-0 object-contain" />
            <span className={`shrink-0 rounded px-1 text-[9px] font-bold ${rarity.badgeClass}`}>{rarity.badgeLabel}</span>
            <span className="min-w-0 max-w-40 sm:max-w-52"><span className="block truncate text-xs font-semibold">{skill.nameEn || skill.nameJp}</span>{skill.nameEn && skill.nameJp && <span className="mt-0.5 block truncate text-[10px] text-zinc-400 dark:text-zinc-500">{skill.nameJp}</span>}</span>
            <Button slot="remove" aria-label="Remove" className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-md text-zinc-400 outline-none hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-7 sm:w-7"><XIcon className="h-3.5 w-3.5" /></Button>
          </Tag>;
        }}
      </TagList>
    </TagGroup>}
  </>;
}
