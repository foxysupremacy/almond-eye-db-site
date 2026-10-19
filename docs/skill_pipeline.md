# Active skill evaluation after the race-rankings merge

The application follows `feat/race-rankings`. There are two distinct outputs:

- `lib/evaluator/evaluator.ts` produces tactical categories, scores, tiers, stars,
  timing explanations and trap badges. Parenting and card recommendations consume
  this contract. They retain feature style/rank filters and inherited-unique rules.
- `lib/race-impact/score.ts` (`scoreSkill`) estimates baseline-versus-skill Bashin
  and time gains. Rankings and the effect-details modal use this physical scorer;
  the evaluator attaches its result through `evaluateTriggerRaceImpact` when needed.

A tactical score is not a Bashin value. Changing stats in the shared profile changes
physical estimates, not the tactical formulas used to order parent/card candidates.
The profile hook returns `[profile, setProfile]`. Profile version 2 defaults Wisdom
to 1200 and migrates the old default of 1800; other valid saved values are retained.

Tactical-only callers pass `skipRaceImpact: true` to avoid independent physical
simulations. Per-trigger tactical evaluations still run, including chained scoring.
Inspectors and Visualizer retain physical details by default. Dynamic race conditions
are assumed satisfied unless an existing saved override says otherwise; the shared
profile panel exposes stats, with no probability controls. Simulation mechanics are
model estimates, not validation against real races.

Zones come from the feature PvP zone wrapper. Visualizer uses Runner (1) as its
unset-style zone fallback and Leader (2) for physical impact. This preserves the
feature defaults. Runtime datasets are loaded only through `lib/data/registry.ts`.
Each dataset has one committed JSON: new main records/translations are combined with
feature activation/trigger fields. `cd` and `time_scale` remain nullable.

`lib/skill-rating/` and `skillRatingBenchmarks` remain for offline research/regressions.
They are not the active application scorer. The old race-impact priors dataset and
its generator are removed; the feature does not consume them.

CLI gates: `bunx tsc --noEmit`, `bun test`, `bun run test:ui`, `bun run build`.
DOM tests run locally without opening a browser. Browser acceptance remains user-owned.

## Special effect values

`lib/race-impact/scaling-details.ts` adapts the physical engine's `scaledEffectValue`
and `additionalActivationFactor` into effect values and presentation metadata. The
Visualizer, shared inspector and effect modal use this adapter, including the same
profile, ground condition and unique-level order as the physical engine. Source
skill records are never mutated; inherited variants use their own metadata.

Course and stat facts resolve directly. Situational maxima show explicit assumptions
and concrete thresholds, including Fan Love 3,000,000+, four Final Leg corner
overtakes, and the 20 m behind-first bonus. Mile bonuses are resolved from the
course; Arima's fan threshold is assumed only on the matching course. Reference
skill/green counts and expected random outcomes follow the engine rather than the
older resolver's maximum defaults. Unmodeled codes remain labeled unsupported.

`SpecialValueDetails` is shared presentation for these explanations. The older
`lib/skill-scaling/` numeric resolver remains part of the historical rating engine;
active application UI does not call it. Tactical category scores remain separate
from physical estimates.
