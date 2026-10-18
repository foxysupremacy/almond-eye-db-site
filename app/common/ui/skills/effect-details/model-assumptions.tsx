"use client";

import { BASHIN_METERS, USEFUL_THRESHOLD_BASHIN, type RaceImpactProfile } from "@/lib/race-impact";

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

/** The model assumptions shared by the skill effect modal and the rankings screen. */
export function ModelAssumptions({ profile, racerCount }: { profile: RaceImpactProfile; racerCount: number }) {
  return (
    <>
      <dl className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        <SummaryRow
          label="Reference stats"
          value={`${profile.stats.speed} / ${profile.stats.stamina} / ${profile.stats.power} / ${profile.stats.guts} / ${profile.stats.wisdom}`}
        />
        <SummaryRow label="Mood / strategy aptitude" value="Normal / A" />
        <SummaryRow label="Racers" value={String(racerCount)} />
        <SummaryRow label="Bashin reference speed" value={profile.bashinReferenceSpeed != null ? `${profile.bashinReferenceSpeed} m/s` : "course base speed"} />
        <SummaryRow label="Bashin length" value={`${BASHIN_METERS} m per Bashin`} />
        <SummaryRow label="Useful threshold" value={`${USEFUL_THRESHOLD_BASHIN} Bashin`} />
      </dl>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Scores assume the skill activates: situational conditions (position, overtakes, counts, prerequisite skills, popularity) are treated as met.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        No wisdom or lottery roll.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Course geometry, distance, surface and running style still decide where and whether a skill can fire.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Stats are adjusted as in-game: above 1200 counts half, course stat bonus, ground and mood modifiers.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Slopes: uphill lowers target speed (slope x 200 / Power) and acceleration; downhill accel mode is counted at its expected bonus.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Section randomness: counted at its mean (wisdom-based), outside the last spurt.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        HP: assumed sufficient to finish at full spurt speed.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Situational scaling uses its strongest version: most passes, longest blocked time, far from the lead, maximum lead, team and career bonuses. HP-based durations use the HP left at activation. Green-skill scaling assumes 6 green skills (typical after scrims).
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Corner lane loss: counted on a modelled expected lane (mechanics doc lane rules, fitted to umasim results), with minimum speed after the start dash and the start run-up.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Additional activation: counted from activation at its maximum, 3 passes or 3 other skills (2 for the up-to-twice type).
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Cooldown: each skill fires at most once per race.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Race-state skills (overtaking, blocked, Umas nearby) fire where a race-state timing model, fitted to umasim results, first allows; other situational skills are sampled across their zone.
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Passive stat skills re-run the race with the stat added to the final stat (not halved past 1200).
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Not modeled: blocking, position keeping, skill interactions
      </p>
    </>
  );
}
