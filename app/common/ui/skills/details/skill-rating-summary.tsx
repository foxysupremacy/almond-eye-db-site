import type { SkillRating } from "@/lib/skill-rating/types";
import { StarRating } from "@/app/common/ui/primitives/icons";
import { StatusRankIcon } from "@/app/common/ui/primitives/status-icons";

const STYLE_NAMES: Record<number, string> = { 1: "Runner", 2: "Leader", 3: "Betweener", 4: "Chaser", 5: "Great Escape" };
const scoreText = (score: number) => Number.isFinite(score) ? score.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "Unavailable";

/** Show modeled value without turning missing effects into a full skill grade. */
export function SkillRatingSummary({ rating, compact = false }: { rating: SkillRating; compact?: boolean }) {
  const incomplete = rating.status === "partial" || rating.status === "unavailable";
  const unavailable = rating.status === "unavailable" || rating.eligibility.state === "missing-context" || rating.eligibility.state === "unknown";
  return (
    <div className={compact ? "text-[11px]" : "text-xs"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          {rating.status === "partial" ? "Conditional rating · modeled part" : "Conditional skill rating"}
        </span>
        <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
          {unavailable ? "Unavailable" : `${scoreText(rating.score)} pts`}
        </span>
      </div>
      {!incomplete && !unavailable && (rating.stars || rating.tier) && (
        <div className="mt-1 flex items-center gap-2">
          {rating.stars && <StarRating stars={rating.stars} starClassName="h-3.5 w-3.5" />}
          {rating.tier && <StatusRankIcon grade={rating.tier} className="h-6 w-6" />}
          {rating.status === "provisional" && <span className="text-amber-700 dark:text-amber-400">Provisional model</span>}
        </div>
      )}
      <p className="mt-1.5 leading-relaxed text-zinc-500 dark:text-zinc-400">
        Value on the selected course when the highlighted conditions are met. Activation probability is excluded from this rating.
      </p>
      {rating.bestStyle != null && (
        <p className="mt-1.5 font-medium text-zinc-700 dark:text-zinc-200">
          Style unspecified: best case for {STYLE_NAMES[rating.bestStyle] ?? `Style ${rating.bestStyle}`}.
        </p>
      )}
      {rating.styleRatings && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-zinc-500 dark:text-zinc-400">
          {rating.styleRatings.map((entry) => (
            <span key={entry.style}>{STYLE_NAMES[entry.style] ?? `Style ${entry.style}`}: <strong className="font-mono font-medium text-zinc-700 dark:text-zinc-200">
              {entry.status === "unavailable" ? "unavailable" : `${scoreText(entry.score)} pts${entry.status === "partial" ? " (partial)" : ""}`}
            </strong></span>
          ))}
        </div>
      )}
      {!unavailable && <p className="mt-2 font-mono text-zinc-700 dark:text-zinc-200">{rating.timeGainSeconds.toFixed(3)}s conditional time gain</p>}
      {!unavailable && rating.recovery && (
        <div className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
          <p>Simulation points: <strong className="font-mono">{rating.recovery.simulationPoints == null ? "Unavailable" : scoreText(rating.recovery.simulationPoints)}</strong>
            {" · "}Recovery reserve points: <strong className="font-mono">{rating.recovery.policyPoints == null ? "Unavailable" : scoreText(rating.recovery.policyPoints)}</strong></p>
          <p>Nominal HP: {scoreText(rating.recovery.nominalHP)} · Received: {scoreText(rating.recovery.receivedHP)} · Wasted: {scoreText(rating.recovery.wastedHP)}</p>
          {rating.recovery.distanceGate === 0 && <p>Self-heal contributes 0 points on courses of 2000m or shorter under the Recovery rating policy. HP recovery still applies in the simulation.</p>}
          {rating.recovery.simulationWeight < 1 && <p>Early-race healing keeps 50% of its rating value; actual HP recovery is unchanged.</p>}
          <p>Reserve points credit nominal healing, including HP above the cap. This product policy does not add simulated time or distance gain.</p>
        </div>
      )}
      {!unavailable && rating.eligibility.state === "eligible" && rating.activationOutcome === "not-activated" && (
        <p className="mt-1.5 text-zinc-500 dark:text-zinc-400">No activation in the modeled timeline for this profile.</p>
      )}
      {!unavailable && rating.activationOutcome === "activated" && Math.abs(rating.simulatedBenefit) < 1e-9 && (rating.recovery?.policyPoints ?? 0) <= 0 && (
        <p className="mt-1.5 text-zinc-500 dark:text-zinc-400">Activated in the model; no net benefit for this profile.</p>
      )}
      {!unavailable && rating.activationOutcome === "activated" && Math.abs(rating.simulatedBenefit) < 1e-9 && (rating.recovery?.policyPoints ?? 0) > 0 && (
        <p className="mt-1.5 text-zinc-500 dark:text-zinc-400">Activated with no net simulated time benefit; this rating includes Recovery reserve value under the product policy.</p>
      )}
      {rating.partialReasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-amber-800 dark:text-amber-300" aria-label="Model limitations">
          {rating.partialReasons.map((reason, index) => <li key={index}>{reason}</li>)}
        </ul>
      )}
      {rating.eligibility.reasons.length > 0 && <p className="mt-2 text-zinc-600 dark:text-zinc-300">{rating.eligibility.reasons.join(". ")}</p>}
      {!compact && rating.assumptions.length > 0 && (
        <details className="mt-3 border-t border-zinc-200/80 pt-2 dark:border-zinc-700/80">
          <summary className="cursor-pointer font-medium text-amber-800 dark:text-amber-300">Assumed conditions ({rating.assumptions.length})</summary>
          <ul className="mt-2 space-y-2 text-zinc-600 dark:text-zinc-300">
            {rating.assumptions.map((entry, index) => <li key={index}>
              <span className="text-zinc-400">Trigger {entry.triggerIndex + 1} · {entry.source}: </span><code className="break-all font-mono text-amber-800 dark:text-amber-300">{entry.clause}</code>
              <p className="mt-0.5">{entry.description}</p>
            </li>)}
          </ul>
        </details>
      )}
      {!compact && <details className="mt-3 border-t border-zinc-200/80 pt-2 dark:border-zinc-700/80">
        <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-200">Rating calculation</summary>
        <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">{rating.breakdown.map((line, index) => <li key={index}>{line}</li>)}</ul>
        {rating.hp && <div className="mt-2 border-t border-zinc-200/80 pt-2 text-zinc-600 dark:border-zinc-700/80 dark:text-zinc-300">
          <p>Competition environment: {rating.hp.competition === "conditional" ? "one nearby same-style opponent assumed" : "none"}.</p>
          {(["baseline", "skill"] as const).map(key => <p key={key}>
            {key === "baseline" ? "Baseline" : "With skill"}: spurt starts {rating.hp![key].startMeter == null ? "unavailable" : `${scoreText(rating.hp![key].startMeter!)}m`}
            {", "}{scoreText(rating.hp![key].distance)}m of spurt; {scoreText(rating.hp![key].remainingHP)} HP at finish.
          </p>)}
          <p>HP/spurt planning and inferred competition mechanics are provisional. Downhill mode, Rushed, Dueling and full positioning are not modeled.</p>
        </div>}
        {rating.recovery && <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300" aria-label="Recovery activations">
          {rating.recovery.activations.map((entry,index) => <li key={index}>Trigger {entry.triggerIndex+1} · {scoreText(entry.meter)}m · Phase {entry.phase} · Rating weight {entry.weight*100}% · Nominal {scoreText(entry.nominalHP)} HP</li>)}
        </ul>}
        {rating.hpEvents && <details className="mt-2 border-t border-zinc-200/80 pt-2 dark:border-zinc-700/80">
          <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-200">HP timeline events</summary>
          {(["baseline", "skill"] as const).map(key => <div key={key} className="mt-2">
            <p className="font-medium text-zinc-700 dark:text-zinc-200">{key === "baseline" ? "Baseline" : "With skill"}</p>
            <ul className="mt-1 space-y-1 text-zinc-600 dark:text-zinc-300">
              {rating.hpEvents![key].map((entry,index) => <li key={index}>
                {scoreText(entry.meter)}m · {scoreText(entry.time)}s · {scoreText(entry.hp)} HP · {entry.kind}: {entry.detail}
              </li>)}
            </ul>
          </div>)}
        </details>}
        <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">Model: {rating.modelVersion} · Benchmark: {rating.benchmarkVersion}{rating.policyVersion ? ` · Policy: ${rating.policyVersion}` : ""}</p>
      </details>}
    </div>
  );
}
