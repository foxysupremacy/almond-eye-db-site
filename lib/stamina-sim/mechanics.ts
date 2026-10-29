import { baseStats } from "../race-impact/adjusted-stats";
import { hpConsumptionPerSecond } from "../race-impact/trace";
import type { RunningStyle } from "../deck/types";
import { GENERIC_FIELD, type GenericField } from "./field";
import { baseTargetSpeed, lastSpurtSpeedMax, spurtHpNeed, type SpurtPlan } from "./spurt";
import { clampRaw, type RaceContext } from "./stats";
import { GREEN_BUCKETS, type Rng, type StaminaInput } from "./types";

/** What the frame stepper shows the mechanics each frame (speed is the speed entering the frame). */
export interface FrameView { t: number; meter: number; hp: number; speed: number; section: number; phase: number; spurtPlan: SpurtPlan | null }
/** Per-frame modifiers: target = base x mul + add; acceleration + accelAdd; HP burn x hpMul; hpLoss HP deducted once on this frame. */
export interface MechanicsMods { targetSpeedMul: number; targetSpeedAdd: number; accelAdd: number; hpMul: number; hpLoss: number }

/** Position-keep modes (doc §Position Keeping). */
const Pk = { Normal: 0, SpeedUp: 1, Overtake: 2, PaceUp: 3, PaceDown: 4 } as const;
type Pk = (typeof Pk)[keyof typeof Pk];

export interface MechanicsState {
  ctx: RaceContext;
  field: GenericField;
  style: RunningStyle;
  /** Kakari toggle: the single gate for the rushed roll. */
  kakariEnabled: boolean;
  /** Section (2..9) the uma becomes rushed in; 0 = not rushed this run. */
  rushSection: number;
  rushed: boolean;
  rushDone: boolean;
  rushStart: number;
  rushNextSnap: number;
  /** Mode forced while rushed (doc §Rushed: AI strategy change, wit rolls auto-pass). */
  rushMode: Pk;
  pkMode: Pk;
  pkStartMeter: number;
  /** Metres the field still has to close before the mode's exit condition holds (Infinity while rushed). */
  pkGap: number;
  pkNextCheck: number;
  pkWitChance: number;
  /** Compete before spurt: active until, cooldown until, next check, and the active effect. */
  compUntil: number;
  compCoolUntil: number;
  compNextCheck: number;
  compAdd: number;
  compHp: number;
  secUntil: number;
  secCoolUntil: number;
  secNextCheck: number;
  secAdd: number;
  secHp: number;
  keepRatio: number;
  keepChance: number;
  keepNextCheck: number;
  staminaKeep: boolean;
  enteredStaminaKeep: boolean;
  /** Stamina Limit Break target-speed buff (0 = none) and whether it is on. */
  slbBuff: number;
  slbActive: boolean;
  zenkaiEnabled: boolean;
  zenkaiAccel: number;
  zenkaiActive: boolean;
  zenkaiSpent: boolean;
  zenkaiBonus: number;
  /** Spot struggle (toggle + front runner / oonige): partner rolled once per run, once per race, ends at section 9. */
  ssEnabled: boolean;
  ssPartner: boolean;
  ssActive: boolean;
  ssDone: boolean;
  ssUntil: number;
  /** Dueling (toggle): partner rolled once per run; the 2 s proximity clock starts on entering the final straight. */
  dueEnabled: boolean;
  duePartner: boolean;
  dueActive: boolean;
  dueEntryT: number;
  lastT: number;
  /** Precomputed per run so a check allocates nothing. */
  pre: {
    compAdd: number; compAddSolo: number; compHpFar: number; compHpNear: number;
    secAdd: number; secAddSolo: number; secHp: number;
    keepMidPerMeter: number; keepSpurtNeed: number;
    ssAdd: number; ssDuration: number; dueAdd: number; dueAccel: number;
  };
  out: MechanicsMods;
}

const EPS = 1e-9;
const isFront = (style: RunningStyle) => style === 1 || style === 5;

/** Doc §Rushed: (6.5 / log10(0.1 x Wiz + 1))^2 %, rounded up to a whole % (integer RNG). */
export function rushedChance(wiz: number): number {
  const pct = (6.5 / Math.log10(0.1 * wiz + 1)) ** 2;
  return Math.min(1, Math.ceil(pct - 1e-9) / 100);
}

/** Doc §Speed up / Overtake mode: 20 x log10(Wiz x 0.1) %; §Pace up mode: 15 x log10(Wiz x 0.1) %. */
export function positionKeepWitChance(style: RunningStyle, wiz: number): number {
  const pct = (isFront(style) ? 20 : 15) * Math.log10(wiz * 0.1);
  return Math.min(1, Math.max(0, pct / 100));
}

/**
 * Doc §Stamina Keep: 30% x (Wisdom / 1000 + Wisdom^0.03). Speculative (the doc says so; a 1000-wit capture saw 93/100,
 * above this formula). Capped at 100%.
 */
export function staminaKeepChance(wiz: number): number {
  return Math.min(1, 0.3 * (wiz / 1000 + wiz ** 0.03));
}

/** Doc §Compete Before Spurt / §Secure Lead: stamina consumption course distance coefficient. */
function competitionDistanceCoef(L: number): number {
  return L < 1401 ? 0.3 : L < 1801 ? 0.3 : L < 2101 ? 0.5 : L < 2201 ? 0.8 : L < 2401 ? 1.0 : L < 2601 ? 1.1 : 1.2;
}

/** Doc §Compete Before Spurt, by style (1 Nige, 2 Senkou, 3 Sashi, 4 Oikomi, 5 Oonige). */
const COMPETE_SPEED_COEF: Record<RunningStyle, number> = { 1: 0.8, 2: 1, 3: 1, 4: 1, 5: 0.2 };
const COMPETE_STAMINA_COEF: Record<RunningStyle, number> = { 1: 1.2, 2: 1, 3: 1, 4: 1, 5: 1.5 };
/** Doc §Compete Before Spurt: front runner with no same-strategy uma within 10 m (the doc's 20% threshold is unexplained, ignored). */
const COMPETE_SOLO_BONUS: Record<RunningStyle, number> = { 1: 1.1, 2: 1, 3: 1, 4: 1, 5: 2 };
/** Doc §Compete Before Spurt: near factor when not far from first place. */
const COMPETE_NEAR_FACTOR = 0.5;

/**
 * Doc §Compete Before Spurt: TargetSpeedIncrease = ((Power/1500)^0.5 x 2 + (Guts/3000)^0.2) x 0.1 x StrategyCoef;
 * StaminaConsumption = 20 x (StaminaStrategyCoef x DistanceCoef + NearFactor), deducted once per activation (ruling R8,
 * replacing R4's HP per second; fitted to 60 saved Kyoto 2200 races in Task 7).
 */
export function competeBeforeSpurtEffect(ctx: RaceContext, far: boolean, solo: boolean): { targetSpeedAdd: number; hpPerActivation: number } {
  const s = ctx.style;
  const add = (Math.sqrt(ctx.stats.power / 1500) * 2 + (ctx.stats.guts / 3000) ** 0.2) * 0.1 * COMPETE_SPEED_COEF[s] * (solo ? COMPETE_SOLO_BONUS[s] : 1);
  const hp = 20 * (COMPETE_STAMINA_COEF[s] * competitionDistanceCoef(ctx.courseLength) + (far ? 0 : COMPETE_NEAR_FACTOR));
  return { targetSpeedAdd: add, hpPerActivation: hp };
}

/** Doc §Secure Lead: strategies with someone who should be behind (Oikomi has none). */
const SECURE_SPEED_COEF: Record<RunningStyle, number> = { 1: 1, 2: 1, 3: 0.8, 4: 0, 5: 0.2 };
const SECURE_STAMINA_COEF: Record<RunningStyle, number> = { 1: 1, 2: 0.8, 3: 0.8, 4: 0, 5: 1.2 };
/** Doc §Secure Lead: nige with no same-strategy uma within 10 m; Nige 4.0 (after the 5th anniversary, as Zenkai). */
const SECURE_SOLO_BONUS: Record<RunningStyle, number> = { 1: 4, 2: 1, 3: 1, 4: 1, 5: 7 };
/** Doc §Secure Lead: 20% chance per check when the lead is short. */
const SECURE_CHANCE = 0.2;

/**
 * Doc §Secure Lead: TargetSpeedIncrease = (Guts/2000)^0.5 x 0.3 x StrategyCoef; StaminaConsumption = 20 x Coef x
 * DistanceCoef, deducted once per activation (ruling R8).
 */
export function secureLeadEffect(ctx: RaceContext, solo: boolean): { targetSpeedAdd: number; hpPerActivation: number } {
  const s = ctx.style;
  const add = Math.sqrt(ctx.stats.guts / 2000) * 0.3 * SECURE_SPEED_COEF[s] * (solo ? SECURE_SOLO_BONUS[s] : 1);
  return { targetSpeedAdd: add, hpPerActivation: 20 * SECURE_STAMINA_COEF[s] * competitionDistanceCoef(ctx.courseLength) };
}

/** Doc §Stamina Limit Break: sqrt(Stamina - 1200) x 0.0085 x DistanceFactor (before the random factor); 0 at <= 1200. */
export function staminaLimitBreakBase(stamina: number, L: number): number {
  if (stamina <= 1200) return 0;
  const factor = L < 2101 ? 0 : L < 2201 ? 0.5 : L < 2401 ? 1 : L < 2601 ? 1.5 : 1.8;
  return Math.sqrt(stamina - 1200) * 0.0085 * factor;
}

/**
 * Doc §Stamina Limit Break random factor: table 0 (50%) 0.98-1.00, 1 (30%) 0.95-0.98, 2 (20%) 1.00-1.02, uniform in
 * range. The doc's "TargetSpeedRandomTableChangeProbabilityByPower: 500" is unexplained and not modelled.
 */
function slbRandomFactor(rng: Rng): number {
  const table = rng.next();
  const u = rng.next();
  return table < 0.5 ? 0.98 + 0.02 * u : table < 0.8 ? 0.95 + 0.03 * u : 1 + 0.02 * u;
}

/** Doc §Zenkai Spurt with the spec §5 assumption AccelFromPower = 0.0006 x sqrt(500 x Power): 0.068 x that / (L/1000)^1.5. */
export function zenkaiAccel(power: number, L: number): number {
  return (0.068 * 0.0006 * Math.sqrt(500 * power)) / (L / 1000) ** 1.5;
}

/** Doc §Zenkai Spurt: "more than 2000 Speed stat", read as the raw on-screen speed (the owner's framing). */
const ZENKAI_MIN_SPEED = 2000;
/** Doc §Stamina Keep: target 1.035-1.04x the HP needed to finish. */
const KEEP_RATIO_MIN = 1.035;
const KEEP_RATIO_MAX = 1.04;
/** Doc §Position Keeping, §Compete Before Spurt, §Secure Lead, §Stamina Keep: checks every 2 s; position keep 1 s cooldown. */
const CHECK_INTERVAL = 2;
const PK_COOLDOWN = 1;
/** Doc §Compete Before Spurt / §Secure Lead: 2 s active, then a 1 s cooldown. */
const COMPETE_DURATION = 2;
const COMPETE_COOLDOWN = 1;
/** Doc §Rushed: snap-out roll every 3 s at 55%, at most 12 s; HP x1.6. */
const RUSH_SNAP_INTERVAL = 3;
const RUSH_SNAP_CHANCE = 0.55;
const RUSH_MAX = 12;
const RUSH_HP = 1.6;
/**
 * Doc §Spot Struggle: TargetSpeed += (500 x Guts)^0.6 x 0.0001; Duration = (700 x Guts)^0.5 x 0.012 x
 * StrategyProficiencyModifier s.
 */
export function spotStruggleEffect(guts: number, styleProf: number): { targetSpeedAdd: number; duration: number } {
  return { targetSpeedAdd: (500 * guts) ** 0.6 * 0.0001, duration: (700 * guts) ** 0.5 * 0.012 * styleProf };
}

/** Doc §Dueling: TargetSpeed += (200 x Guts)^0.708 x 0.0001; Accel += (160 x Guts)^0.59 x 0.0001. */
export function duelingEffect(guts: number): { targetSpeedAdd: number; accelAdd: number } {
  return { targetSpeedAdd: (200 * guts) ** 0.708 * 0.0001, accelAdd: (160 * guts) ** 0.59 * 0.0001 };
}

/** Doc §Spot Struggle: triggers after 150 m, while a struggler has not reached section 6, and always ends at section 9. */
const SS_MIN_METER = 150;
const SS_LAST_TRIGGER_SECTION = 5;
const SS_END_SECTION = 9;
/** Doc §Spot Struggle HP multiplier: [normal, rushed] for front runner / oonige. */
const SS_HP_FRONT = [1.4, 3.6] as const;
const SS_HP_OONIGE = [3.5, 7.7] as const;
/** Doc §Dueling: needs HP >= 15% of max to trigger, ends below 5%; the target must stay a target for 2 s. */
const DUEL_MIN_HP = 0.15;
const DUEL_END_HP = 0.05;
const DUEL_PROXIMITY_SECONDS = 2;
/** Doc §HP Consumption: pace-down status modifier. */
const PACE_DOWN_HP = 0.6;

export function initMechanics(input: StaminaInput, ctx: RaceContext, rng: Rng, field: GenericField = GENERIC_FIELD): MechanicsState {
  const style = ctx.style;
  const kakariEnabled = input.toggles.kakari;
  let rushSection = 0;
  // Doc §Rushed: rolled before the race; a rushed uma enters it in a random section 2..9.
  if (kakariEnabled && rng.next() < rushedChance(ctx.stats.wisdom)) rushSection = 2 + Math.floor(rng.next() * 8);
  const keepRatio = KEEP_RATIO_MIN + (KEEP_RATIO_MAX - KEEP_RATIO_MIN) * rng.next();

  const raw = clampRaw(input.stats);
  // Doc §Stamina Limit Break: base stamina (compressed over 1200, mood) + green skill bonus.
  let stamina = baseStats(raw, input.motivation).stamina;
  for (const [key, [stat, bonus]] of Object.entries(GREEN_BUCKETS)) {
    if (stat === "stamina") stamina += bonus * Math.max(0, input.greens[key as keyof typeof GREEN_BUCKETS] ?? 0);
  }
  const slbBase = staminaLimitBreakBase(stamina, ctx.courseLength);
  const slbBuff = slbBase > 0 ? slbBase * slbRandomFactor(rng) : 0;

  // Field rolls (once per run, always drawn; note the Kakari roll above depends on its toggle, so toggles can shift the stream, but the same input + seed still reproduces): is there a same-style front runner / a duel partner.
  const ssPartner = rng.next() < field.pSameStyleFrontRunner;
  const duePartner = rng.next() < field.pDuelPartner;
  const ss = spotStruggleEffect(ctx.stats.guts, ctx.styleProf);
  const due = duelingEffect(ctx.stats.guts);

  const near = competeBeforeSpurtEffect(ctx, false, false);
  const farFx = competeBeforeSpurtEffect(ctx, true, false);
  const sec = secureLeadEffect(ctx, false);
  // Stamina Keep "needed HP" (spec reading): mid-race cruise to the late-race start, then a max last spurt from there.
  const midSpeed = baseTargetSpeed(ctx, 1);
  const keepMidPerMeter = hpConsumptionPerSecond(midSpeed, ctx.baseSpeed, ctx.hpGroundCoef, false, ctx.stats.guts) / midSpeed;

  return {
    ctx, field, style, kakariEnabled, rushSection,
    rushed: false, rushDone: false, rushStart: 0, rushNextSnap: 0, rushMode: Pk.Normal,
    pkMode: Pk.Normal, pkStartMeter: 0, pkGap: 0, pkNextCheck: 0, pkWitChance: positionKeepWitChance(style, ctx.stats.wisdom),
    compUntil: 0, compCoolUntil: 0, compNextCheck: 0, compAdd: 0, compHp: 0,
    secUntil: 0, secCoolUntil: 0, secNextCheck: 0, secAdd: 0, secHp: 0,
    keepRatio, keepChance: staminaKeepChance(ctx.stats.wisdom), keepNextCheck: 0, staminaKeep: false, enteredStaminaKeep: false,
    slbBuff, slbActive: false,
    zenkaiEnabled: raw.speed > ZENKAI_MIN_SPEED, zenkaiAccel: zenkaiAccel(ctx.stats.power, ctx.courseLength),
    zenkaiActive: false, zenkaiSpent: false, zenkaiBonus: 0,
    ssEnabled: input.toggles.spotStruggle && isFront(style), ssPartner, ssActive: false, ssDone: false, ssUntil: 0,
    dueEnabled: input.toggles.dueling, duePartner, dueActive: false, dueEntryT: -1,
    lastT: 0,
    pre: {
      compAdd: near.targetSpeedAdd, compAddSolo: competeBeforeSpurtEffect(ctx, false, true).targetSpeedAdd,
      compHpFar: farFx.hpPerActivation, compHpNear: near.hpPerActivation,
      secAdd: sec.targetSpeedAdd, secAddSolo: secureLeadEffect(ctx, true).targetSpeedAdd, secHp: sec.hpPerActivation,
      keepMidPerMeter, keepSpurtNeed: spurtHpNeed(ctx, ctx.phases[1], lastSpurtSpeedMax(ctx)),
      ssAdd: ss.targetSpeedAdd, ssDuration: ss.duration, dueAdd: due.targetSpeedAdd, dueAccel: due.accelAdd,
    },
    out: { targetSpeedMul: 1, targetSpeedAdd: 0, accelAdd: 0, hpMul: 1, hpLoss: 0 },
  };
}

/** Doc §Pace up / Pace down: CourseFactor-scaled distance band to the pacemaker, [min, max] metres. */
function paceBand(style: RunningStyle, L: number): [number, number] {
  const cf = 0.0008 * (L - 1000) + 1;
  return style === 2 ? [3, 5 * cf] : style === 3 ? [6.5 * cf, 7 * cf] : [7.5 * cf, 8 * cf];
}

function pkMultiplier(mode: Pk, phase: number): number {
  // Doc §Speed up 1.04, §Overtake 1.05, §Pace up 1.04, §Pace down 0.945 mid-race / 0.915 otherwise.
  return mode === Pk.SpeedUp ? 1.04 : mode === Pk.Overtake ? 1.05 : mode === Pk.PaceUp ? 1.04 : mode === Pk.PaceDown ? (phase === 1 ? 0.945 : 0.915) : 1;
}

/**
 * Metres to close before the doc's exit condition holds, with the entry assumed right at the entry threshold
 * (checks run every 2 s). Speed up: lead U(0, 4.5 | 17.5 oonige); overtake: 10 | 27.5 m lead + U(0, leadDeficitMax)
 * deficit; pace up: down to U(min, max); pace down: up to U(min, max'), max' = lerp(min, max, 0.5) in mid-race.
 */
function pkGapFor(s: MechanicsState, mode: Pk, r: number, phase: number): number {
  const oonige = s.style === 5;
  if (mode === Pk.SpeedUp) return (oonige ? 17.5 : 4.5) * r;
  if (mode === Pk.Overtake) return (oonige ? 27.5 : 10) + s.field.leadDeficitMax * r;
  const [min, max] = paceBand(s.style, s.ctx.courseLength);
  if (mode === Pk.PaceUp) return (max - min) * r;
  return ((phase === 1 ? (min + max) / 2 : max) - min) * r;
}

/** Doc §Rushed: the forced position-keep mode from the AI strategy change. */
function rushModeFor(style: RunningStyle, r: number): Pk {
  if (isFront(style)) return Pk.SpeedUp; // front runners enter speed up mode
  // Pace Chasers -> runners; Late Surgers 75% runner / 25% leader; End Closers 70% runner / 20% leader / 10% betweener.
  const asRunner = style === 2 || (style === 3 ? r < 0.75 : r < 0.7);
  // As a runner she trails the real runners (overtake); as a leader/betweener she is past her band's max (pace up).
  return asRunner ? Pk.Overtake : Pk.PaceUp;
}

function exitPk(s: MechanicsState, t: number, cooldown: boolean) {
  s.pkMode = Pk.Normal;
  if (cooldown) s.pkNextCheck = t + PK_COOLDOWN + CHECK_INTERVAL;
}

/** One frame of mechanics; returns the state's reused modifier object. */
export function stepMechanics(s: MechanicsState, frame: FrameView, rng: Rng): MechanicsMods {
  const { t, section, phase } = frame;
  const dt = Math.max(0, t - s.lastT);
  s.lastT = t;
  const field = s.field;
  // Ruling R8: competition stamina consumption lands once, on the frame the competition activates.
  let hpLoss = 0;

  // Doc §Rushed: starts on entering the rolled section, snap-out roll every 3 s, ends after 12 s.
  if (s.rushed) {
    if (t >= s.rushNextSnap - EPS) {
      s.rushNextSnap += RUSH_SNAP_INTERVAL;
      if (t - s.rushStart >= RUSH_MAX - EPS || rng.next() < RUSH_SNAP_CHANCE) {
        s.rushed = false;
        s.rushDone = true;
        if (s.pkMode !== Pk.Normal && s.pkGap === Infinity) exitPk(s, t, true);
      }
    }
  } else if (!s.rushDone && s.rushSection > 0 && section >= s.rushSection) {
    s.rushed = true;
    s.rushStart = t;
    s.rushNextSnap = t + RUSH_SNAP_INTERVAL;
    s.rushMode = rushModeFor(s.style, rng.next());
    s.pkMode = Pk.Normal;
    s.pkNextCheck = t;
  }

  // Doc §Position Keeping: sections 1-10 only. Pace Up Ex needs a behind-strategy uma ahead, which this generic
  // field never produces, so it is not modelled.
  if (section > 10) {
    if (s.pkMode !== Pk.Normal) exitPk(s, t, false);
  } else if (s.pkMode !== Pk.Normal) {
    const limit = Math.floor(s.ctx.courseLength / 24) * (s.style === 5 ? 3 : 1);
    s.pkGap -= Math.abs(pkMultiplier(s.pkMode, phase) - 1) * frame.speed * dt;
    if (frame.meter - s.pkStartMeter >= limit || s.pkGap <= 0) exitPk(s, t, true);
  } else if (t >= s.pkNextCheck - EPS) {
    s.pkNextCheck = t + CHECK_INTERVAL;
    let mode: Pk = Pk.Normal;
    if (s.rushed) mode = s.rushMode; // wit rolls auto-pass while rushed
    else {
      const u = rng.next();
      const chase = field.pChaseNeeded[s.style];
      if (u < chase) mode = isFront(s.style) ? Pk.Overtake : Pk.PaceUp;
      else if (u < chase + field.pTooClose[s.style]) mode = isFront(s.style) ? Pk.SpeedUp : Pk.PaceDown;
      // Pace down has no wit check; the others pass the wit check.
      if (mode !== Pk.Normal && mode !== Pk.PaceDown && rng.next() >= s.pkWitChance) mode = Pk.Normal;
    }
    if (mode !== Pk.Normal) {
      s.pkMode = mode;
      s.pkStartMeter = frame.meter;
      s.pkGap = s.rushed ? Infinity : pkGapFor(s, mode, rng.next(), phase);
    }
  }

  if (section >= 11 && section <= 15) {
    // Doc §Stamina Keep: every 2 s, HP below ratio x needed -> chance to enter keep mode.
    if (t >= s.keepNextCheck - EPS) {
      s.keepNextCheck = t + CHECK_INTERVAL;
      if (!s.staminaKeep) {
        const plan = frame.spurtPlan;
        const needed = plan
          ? spurtHpNeed(s.ctx, frame.meter, plan.speed)
          : Math.max(0, s.ctx.phases[1] - frame.meter) * s.pre.keepMidPerMeter + s.pre.keepSpurtNeed;
        if (frame.hp < s.keepRatio * needed && rng.next() < s.keepChance) {
          s.staminaKeep = true;
          s.enteredStaminaKeep = true;
        }
      }
    }
    // Doc §Compete Before Spurt: every 2 s; far from first (pChaseNeeded) or an uma nearby (pNearbyRival).
    if (t >= s.compNextCheck - EPS) {
      s.compNextCheck = t + CHECK_INTERVAL;
      if (!s.staminaKeep && t >= s.compCoolUntil - EPS) {
        const far = rng.next() < field.pChaseNeeded[s.style];
        const near = rng.next() < field.pNearbyRival;
        if (far || near) {
          const solo = isFront(s.style) && rng.next() >= field.pSameStyleFrontRunner;
          s.compAdd = solo ? s.pre.compAddSolo : s.pre.compAdd;
          s.compHp = far ? s.pre.compHpFar : s.pre.compHpNear;
          hpLoss += s.compHp;
          s.compUntil = t + COMPETE_DURATION;
          s.compCoolUntil = t + COMPETE_DURATION + COMPETE_COOLDOWN;
        }
      }
    }
    // Doc §Secure Lead: every 2 s; lead short (pNearbyRival) then a 20% chance.
    if (s.pre.secHp > 0 && t >= s.secNextCheck - EPS) {
      s.secNextCheck = t + CHECK_INTERVAL;
      if (!s.staminaKeep && t >= s.secCoolUntil - EPS && rng.next() < field.pNearbyRival && rng.next() < SECURE_CHANCE) {
        const solo = isFront(s.style) && rng.next() >= field.pSameStyleFrontRunner;
        s.secAdd = solo ? s.pre.secAddSolo : s.pre.secAdd;
        s.secHp = s.pre.secHp;
        hpLoss += s.secHp;
        s.secUntil = t + COMPETE_DURATION;
        s.secCoolUntil = t + COMPETE_DURATION + COMPETE_COOLDOWN;
      }
    }
  }

  // Doc §Spot Struggle: once per race, front runner / oonige with a same-style partner, 150 m to section 5, ends at section 9.
  if (s.ssActive) {
    if (section >= SS_END_SECTION || t >= s.ssUntil - EPS) { s.ssActive = false; s.ssDone = true; }
  } else if (s.ssEnabled && s.ssPartner && !s.ssDone && !s.staminaKeep && frame.meter >= SS_MIN_METER && section <= SS_LAST_TRIGGER_SECTION) {
    s.ssActive = true;
    s.ssUntil = t + s.pre.ssDuration;
  }

  // Doc §Dueling: final straight only; 2 s after entering it with a partner alongside, HP >= 15% to start, ends below 5%.
  if (s.dueEnabled && s.duePartner) {
    if (s.dueActive) {
      if (frame.hp < DUEL_END_HP * s.ctx.maxHp) s.dueActive = false;
    } else if (frame.meter >= s.ctx.finalStraightStart) {
      if (s.dueEntryT < 0) s.dueEntryT = t;
      if (t - s.dueEntryT >= DUEL_PROXIMITY_SECONDS - EPS && !s.staminaKeep && frame.hp >= DUEL_MIN_HP * s.ctx.maxHp) s.dueActive = true;
    }
  }

  // Doc §Stamina Limit Break / §Zenkai Spurt: on a full max spurt, once max spurt speed is reached.
  const plan = frame.spurtPlan;
  let zenkaiStarted = false;
  if (plan && plan.isMax && frame.hp > 0 && frame.meter >= plan.startMeter && frame.speed >= plan.speed - 1e-6) {
    if (s.slbBuff > 0) s.slbActive = true;
    if (s.zenkaiEnabled && !s.zenkaiActive && !s.zenkaiSpent) { s.zenkaiActive = true; zenkaiStarted = true; }
  }
  if (s.zenkaiActive) {
    if (frame.hp <= 0) { s.zenkaiActive = false; s.zenkaiSpent = true; s.zenkaiBonus = 0; }
    else if (!zenkaiStarted) s.zenkaiBonus += s.zenkaiAccel * dt; // no cap (spec §5)
  }

  const out = s.out;
  const pk = section <= 10 ? s.pkMode : Pk.Normal;
  out.targetSpeedMul = pkMultiplier(pk, phase);
  const comp = t < s.compUntil - EPS;
  const sec = t < s.secUntil - EPS;
  out.targetSpeedAdd = (comp ? s.compAdd : 0) + (sec ? s.secAdd : 0) + (s.slbActive ? s.slbBuff : 0) + s.zenkaiBonus
    + (s.ssActive ? s.pre.ssAdd : 0) + (s.dueActive ? s.pre.dueAdd : 0);
  out.accelAdd = s.dueActive ? s.pre.dueAccel : 0;
  // Spot struggle's multipliers are totals (they already include the rushed state), not stacked on x1.6.
  const ssHp = s.ssActive ? (s.style === 5 ? SS_HP_OONIGE : SS_HP_FRONT)[s.rushed ? 1 : 0] : 0;
  out.hpMul = (ssHp > 0 ? ssHp : s.rushed ? RUSH_HP : 1) * (pk === Pk.PaceDown ? PACE_DOWN_HP : 1);
  out.hpLoss = hpLoss;
  return out;
}

/** Doc §Stamina Keep: an HP recovery skill resets keep mode. */
export function onHeal(s: MechanicsState): void {
  s.staminaKeep = false;
}

/** Doc §Zenkai Spurt: out of HP during Zenkai drops speed to minimum at once (a confirmed bug). True = drop now. */
export function onOutOfHp(s: MechanicsState): boolean {
  if (!s.zenkaiActive) return false;
  s.zenkaiActive = false;
  s.zenkaiSpent = true;
  s.zenkaiBonus = 0;
  return true;
}
