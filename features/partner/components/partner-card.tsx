"use client";

import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import { CheckIcon, StarIcon } from "@/app/common/ui/primitives/icons";
import { getSkillRarityStyle, RARITY_META } from "@/app/common/ui/skills/skill-rarity";
import type { DecodedFactor } from "@/lib/lineage/factor-decoder";
import type { AffinityCalculationResult } from "@/lib/lineage/affinity-engine";
import type { PartnerSection } from "@/lib/veterans/share/partner-codec";
import type { CharacterIndexEntry } from "@/lib/api";
import type { PartnerAptitude, PartnerCardModel, PartnerSparkGroup } from "../model/partner-card-model";

export const PARTNER_SECTION_LABELS: Record<PartnerSection, string> = {
  "support-cards": "Support Cards",
  skills: "Skills",
  sparks: "Sparks",
  affinity: "Affinity",
  wins: "G1 Wins",
};

const GRADE_TONE: Record<string, string> = {
  S: "text-amber-600 dark:text-amber-400",
  A: "text-orange-600 dark:text-orange-400",
  B: "text-rose-600 dark:text-rose-400",
  C: "text-emerald-600 dark:text-emerald-400",
};

const SPARK_TONE: Record<"blue" | "pink" | "green" | "white", string> = {
  blue: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700/70 dark:bg-sky-950/60 dark:text-sky-100",
  pink: "border-pink-300 bg-pink-50 text-pink-900 dark:border-pink-700/70 dark:bg-pink-950/60 dark:text-pink-100",
  green: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/70 dark:bg-emerald-950/60 dark:text-emerald-100",
  white: "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
};

const SPARK_OWNER_LABEL: Record<PartnerSparkGroup["owner"], string> = {
  self: "Own sparks",
  parent1: "Parent 1",
  parent2: "Parent 2",
};

/** Flat segmented group (DESIGN.md §3); selected segments read as "on" with an emerald tint and a check. */
export const SEGMENT_GROUP_CLASS = "inline-flex flex-wrap items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/80";
export const SEGMENT_CLASS =
  "inline-flex min-h-11 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-zinc-500 outline-none transition-colors duration-150 ease-out-quart hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-500/70 md:min-h-8 dark:text-zinc-400 dark:hover:text-zinc-200 data-[selected]:bg-white data-[selected]:font-semibold data-[selected]:text-emerald-800 data-[selected]:shadow-2xs dark:data-[selected]:bg-emerald-950/70 dark:data-[selected]:text-emerald-200";

export function PartnerSectionToggles({
  shared,
  visible,
  onToggle,
}: {
  shared: readonly PartnerSection[];
  visible: readonly PartnerSection[];
  onToggle: (section: PartnerSection) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Sections to show"
      selectionMode="multiple"
      selectedKeys={new Set(visible)}
      onSelectionChange={(next) => {
        for (const section of shared) if (visible.includes(section) !== next.has(section)) onToggle(section);
      }}
      className={SEGMENT_GROUP_CLASS}
    >
      {shared.map((section) => (
        <ToggleButton key={section} id={section} className={SEGMENT_CLASS}>
          {({ isSelected }) => (
            <>
              {isSelected && <CheckIcon className="h-3 w-3 flex-none" aria-hidden="true" />}
              {PARTNER_SECTION_LABELS[section]}
            </>
          )}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function SectionHeading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">{children}</h2>
      {aside}
    </div>
  );
}

function AptitudeRow({ title, items }: { title: string; items: PartnerAptitude[] }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 flex-none text-[11px] text-zinc-400 dark:text-zinc-500">{title}</span>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((a) => (
          <span key={a.label} className="inline-flex items-center gap-1">
            <span className="text-zinc-500 dark:text-zinc-400">{a.label}</span>
            <span className={`w-3 font-black ${GRADE_TONE[a.grade] ?? "text-zinc-500 dark:text-zinc-400"}`}>{a.grade}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SparkChip({ factor }: { factor: DecodedFactor }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${SPARK_TONE[factor.type as keyof typeof SPARK_TONE] ?? SPARK_TONE.white}`}>
      <span className="truncate">{factor.nameEn || factor.name}</span>
      <span className="inline-flex flex-none items-center gap-0.5 font-bold tabular-nums" aria-label={`${factor.stars} stars`}>
        {factor.stars}
        <StarIcon className="h-2.5 w-2.5" aria-hidden="true" />
      </span>
    </span>
  );
}

function SparkGroup({ group }: { group: PartnerSparkGroup }) {
  const all = [...group.blue, ...group.pink, ...group.green, ...group.white];
  return (
    <div className="py-2.5">
      <p className="mb-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        {SPARK_OWNER_LABEL[group.owner]}
        {group.owner !== "self" && <span className="ml-1 font-semibold text-zinc-600 dark:text-zinc-300">{group.ownerName}</span>}
      </p>
      {all.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">No sparks</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {all.map((factor, i) => (
            <SparkChip key={`${factor.factorId}-${i}`} factor={factor} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PartnerCard({
  model,
  sections,
  affinity,
  trainee,
  onPickTrainee,
}: {
  model: PartnerCardModel;
  sections: readonly PartnerSection[];
  affinity: AffinityCalculationResult | null;
  trainee: CharacterIndexEntry | null;
  onPickTrainee: () => void;
}) {
  const show = (section: PartnerSection) => sections.includes(section);

  return (
    <article className="divide-y divide-zinc-100 dark:divide-zinc-800/80" aria-label={`${model.nameEn} partner card`}>
      {/* Header */}
      <header className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {model.portraitUrl && (
            <img src={model.portraitUrl} alt="" width={72} height={72} className="h-[72px] w-[72px] flex-none rounded-full bg-zinc-100 object-cover object-top dark:bg-zinc-800" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{model.titleEn}</p>
            <h1 className="truncate text-xl font-bold leading-snug text-zinc-900 dark:text-zinc-100">{model.nameEn}</h1>
            {model.nameJp && <p className="mt-0.5 truncate text-xs leading-tight text-zinc-400 dark:text-zinc-500">{model.nameJp}</p>}
          </div>
          <img src={model.rankIconSrc} alt={`Rank ${model.rank}`} width={44} height={44} className="h-11 w-11 flex-none object-contain" />
        </div>
        <div className="grid flex-1 grid-cols-5 gap-1 text-center sm:ml-auto sm:max-w-xs">
          {model.stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{stat.label}</p>
              <p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{stat.value}</p>
            </div>
          ))}
        </div>
      </header>

      <section className="space-y-1.5 py-4" aria-label="Aptitudes">
        <AptitudeRow title="Surface" items={model.aptitudes.surface} />
        <AptitudeRow title="Distance" items={model.aptitudes.distance} />
        <AptitudeRow title="Style" items={model.aptitudes.style} />
      </section>

      {show("support-cards") && (
        <section className="py-4">
          <SectionHeading>Support Cards</SectionHeading>
          {model.supportCards.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">No support cards recorded.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {model.supportCards.map((card) => (
                <div key={card.id} className="min-w-0">
                  <div className="relative">
                    <img src={card.imageUrl} alt="" loading="lazy" className="aspect-square w-full rounded-md bg-zinc-100 object-cover dark:bg-zinc-800" />
                    <span className={`absolute left-1 top-1 rounded px-1 text-[9px] ${RARITY_META[card.rarity]?.chip ?? RARITY_META[3].chip}`}>{RARITY_META[card.rarity]?.label ?? "SSR"}</span>
                    <span className="absolute bottom-1 right-1 inline-flex w-11 items-center justify-center rounded bg-zinc-900/80 px-1 text-[10px] font-semibold text-white">{card.lbLabel}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{card.nameEn}</p>
                  {card.nameJp && <p className="mt-0.5 truncate text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">{card.nameJp}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {show("skills") && (
        <section className="py-4">
          <SectionHeading aside={<span className="text-[11px] text-zinc-400">{model.skills.length}</span>}>Skills</SectionHeading>
          {model.skills.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">No skills recorded.</p>
          ) : (
            <ul className="grid gap-x-4 sm:grid-cols-2">
              {model.skills.map((skill) => {
                const rarity = getSkillRarityStyle(skill.rarity);
                return (
                  <li key={skill.id} className={`flex min-w-0 items-center gap-2.5 border-b border-l-4 border-b-zinc-100 px-2 py-1.5 dark:border-b-zinc-800/80 ${rarity.borderClass} ${rarity.bgClass ?? ""}`}>
                    <SkillIcon iconId={skill.iconId} name={skill.nameEn} className="h-7 w-7 flex-none object-contain drop-shadow-2xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{skill.nameEn}</p>
                      {skill.nameJp && <p className="mt-0.5 truncate text-xs leading-tight text-zinc-400 dark:text-zinc-500">{skill.nameJp}</p>}
                    </div>
                    {skill.level > 1 && <span className="flex-none text-[11px] font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">Lv{skill.level}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {show("sparks") && (
        <section className="py-4">
          <SectionHeading>Sparks</SectionHeading>
          {model.sparks.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">No sparks recorded.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {model.sparks.map((group) => (
                <SparkGroup key={group.owner} group={group} />
              ))}
            </div>
          )}
        </section>
      )}

      {show("affinity") && (
        <section className="py-4">
          <SectionHeading
            aside={
              <button type="button" onClick={onPickTrainee} className="min-h-11 text-xs font-semibold text-emerald-700 hover:underline md:min-h-0 dark:text-emerald-400">
                {trainee ? "Change trainee" : "Pick trainee"}
              </button>
            }
          >
            Affinity
          </SectionHeading>
          {trainee && affinity ? (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{trainee.nameEn}</p>
                {trainee.nameJp && <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-500">{trainee.nameJp}</p>}
              </div>
              <p className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-100">
                {affinity.total}
                <span className="ml-1 text-xs font-medium text-zinc-400">pts</span>
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Relations {affinity.base} · Shared G1 wins +{affinity.raceBonus}
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Pick a trainee to see this partner's affinity with it.</p>
          )}
        </section>
      )}

      {show("wins") && (
        <section className="py-4">
          <SectionHeading aside={<span className="text-[11px] text-zinc-400">{model.wins.length}</span>}>G1 Wins</SectionHeading>
          {model.wins.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">No G1 wins recorded.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
              {model.wins.map((win) => (
                <li key={win.id} className="min-w-0 border-b border-zinc-100 py-1.5 dark:border-zinc-800/80">
                  <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{win.name}</p>
                  {win.nameJp && <p className="mt-0.5 truncate text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">{win.nameJp}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
