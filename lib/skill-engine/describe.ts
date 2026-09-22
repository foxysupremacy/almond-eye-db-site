// Human-readable condition-string renderer. Inverse of the condition parser
// (parser.ts): given a raw condition string like "phase==1&is_overtake==1",
// emit a compact English phrase via a keyword dictionary.
//
// The dictionary covers every keyword that appears in the live skills.json
// dataset (135 distinct keywords, counted via scan). Unknown keywords fall
// back to the raw "keyword op value" text; the function never throws.

// ---------------------------------------------------------------------------
// Registration helpers
// ---------------------------------------------------------------------------

type DictEntry = (op: string, value: number) => string | undefined;

/** Accumulate multiple (op,value)→phrase handlers per keyword (first wins). */
const DICT: Record<string, DictEntry[]> = {};

function push(kw: string, entry: DictEntry): void {
  (DICT[kw] ??= []).push(entry);
}

/** Static phrase for exactly one (op, value), e.g. corner!=0 → "on a corner". */
function phrase(kw: string, op: string, value: number, text: string): void {
  push(kw, (o, v) => (o === op && v === value ? text : undefined));
}

/** Phrase that depends only on the value, for a specific op. */
function phraseByOp(kw: string, op: string, fn: (value: number) => string): void {
  push(kw, (o, v) => (o === op ? fn(v) : undefined));
}

/** phraseByOp whose fn may decline (return undefined → fall through). */
function phraseByOpOpt(kw: string, op: string, fn: (value: number) => string | undefined): void {
  push(kw, (o, v) => (o === op ? fn(v) : undefined));
}

/** Phrase for == op that looks up the value in a name table. */
function lookup(kw: string, table: Record<number, string>): void {
  push(kw, (o, v) => (o === "==" ? table[v] : undefined));
}

/** Bare "value + suffix" phrase for any op. */
function units(kw: string, suffix: string): void {
  push(kw, (_o, v) => `${v}${suffix}`);
}

// ---------------------------------------------------------------------------
// Value-name tables
// ---------------------------------------------------------------------------

const DISTANCE_TYPES: Record<number, string> = {
  1: "a sprint",
  2: "a mile",
  3: "a medium-distance race",
  4: "a long-distance race",
};

function gradeName(v: number): string {
  const t: Record<number, string> = {
    100: "G1",
    200: "G2",
    300: "G3",
    400: "open",
    500: "one-win",
    600: "two-win",
    700: "three-win",
    800: "pre-OP",
    900: "maiden",
    999: "daily",
  };
  return t[v] ?? `grade ${v}`;
}

function seasonName(v: number): string {
  const t: Record<number, string> = { 1: "spring", 2: "summer", 3: "autumn", 4: "winter", 5: "cherry blossom" };
  return t[v] ?? `season ${v}`;
}

function weatherName(v: number): string {
  const t: Record<number, string> = { 1: "sunny", 2: "cloudy", 3: "rainy", 4: "snowy" };
  return t[v] ?? `weather ${v}`;
}

function timeName(v: number): string {
  const t: Record<number, string> = { 0: "any time of day", 1: "morning", 2: "daytime", 3: "evening", 4: "night" };
  return t[v] ?? `time ${v}`;
}

function ordinal(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return `${n}`;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function motivationName(v: number): string {
  const t: Record<number, string> = { 1: "Awful", 2: "Bad", 3: "Normal", 4: "Good", 5: "Great" };
  return t[v] ?? `motivation ${v}`;
}

const TRACK_NAMES: Record<number, string> = {
  10001: "Sapporo",
  10002: "Hakodate",
  10003: "Niigata",
  10004: "Fukushima",
  10005: "Nakayama",
  10006: "Tokyo",
  10007: "Chukyo",
  10008: "Kyoto",
  10009: "Hanshin",
  10010: "Kokura",
  10101: "Ooi",
  10103: "Kawasaki",
  10104: "Funabashi",
  10105: "Morioka",
  10201: "Longchamp",
  10202: "Sha Tin",
  10203: "Santa Anita",
};

function trackName(v: number): string {
  return TRACK_NAMES[v] ? `${TRACK_NAMES[v]} racecourse` : `track #${v}`;
}

// ---------------------------------------------------------------------------
// Dictionary
// ---------------------------------------------------------------------------

// --- spatial / phase -------------------------------------------------------
lookup("phase", { 0: "early race", 1: "mid-race", 2: "late race", 3: "last spurt" });
phraseByOp("phase", ">=", (v) => (v === 1 ? "mid-race or later" : v === 2 ? "late race or later" : v === 3 ? "last spurt" : `phase ≥ ${v}`));
phraseByOp("phase", ">", (v) => (v === 0 ? "mid-race or later" : v === 1 ? "late race or later" : v === 2 ? "last spurt" : `phase > ${v}`));
phraseByOp("phase", "<=", (v) => (v === 1 ? "early or mid-race" : v === 2 ? "before last spurt" : v === 0 ? "early race" : `phase ≤ ${v}`));
phraseByOp("phase", "<", (v) => (v === 2 ? "early or mid-race" : v === 3 ? "before last spurt" : v === 1 ? "early race" : `phase < ${v}`));
phrase("phase_random", "==", 0, "random point in early race");
phrase("phase_random", "==", 1, "random point in mid-race");
phrase("phase_random", "==", 2, "random point in late race");
phrase("phase_random", "==", 3, "random point in last spurt");
phrase("phase_firsthalf", "==", 0, "first half of early race");
phrase("phase_firsthalf", "==", 1, "first half of mid-race");
phrase("phase_firsthalf", "==", 2, "first half of late race");
phrase("phase_firsthalf", "==", 3, "first half of last spurt");
phrase("phase_laterhalf", "==", 0, "later half of early race");
phrase("phase_laterhalf", "==", 1, "later half of mid-race");
phrase("phase_laterhalf", "==", 2, "later half of late race");
phrase("phase_laterhalf", "==", 3, "later half of last spurt");
phrase("phase_firstquarter", "==", 0, "first quarter of early race");
phrase("phase_firstquarter", "==", 1, "first quarter of mid-race");
phrase("phase_firstquarter", "==", 2, "first quarter of late race");
phrase("phase_firstquarter", "==", 3, "first quarter of last spurt");
phrase("phase_firsthalf_random", "==", 0, "random point in first half of early race");
phrase("phase_firsthalf_random", "==", 1, "random point in first half of mid-race");
phrase("phase_firsthalf_random", "==", 2, "random point in first half of late race");
phrase("phase_firsthalf_random", "==", 3, "random point in first half of last spurt");
phrase("phase_laterhalf_random", "==", 0, "random point in later half of early race");
phrase("phase_laterhalf_random", "==", 1, "random point in later half of mid-race");
phrase("phase_laterhalf_random", "==", 2, "random point in later half of late race");
phrase("phase_laterhalf_random", "==", 3, "random point in later half of last spurt");
phrase("phase_firstquarter_random", "==", 0, "random point in first quarter of early race");
phrase("phase_firstquarter_random", "==", 1, "random point in first quarter of mid-race");
phrase("phase_firstquarter_random", "==", 2, "random point in first quarter of late race");
phrase("phase_firstquarter_random", "==", 3, "random point in first quarter of last spurt");
phrase("phase_corner_random", "==", 0, "random corner in early race");
phrase("phase_corner_random", "==", 1, "random corner in mid-race");
phrase("phase_corner_random", "==", 2, "random corner in late race");
phrase("phase_corner_random", "==", 3, "random corner in last spurt");
phrase("phase_straight_random", "==", 0, "random straight in early race");
phrase("phase_straight_random", "==", 1, "random straight in mid-race");
phrase("phase_straight_random", "==", 2, "random straight in late race");
phrase("phase_straight_random", "==", 3, "random straight in last spurt");
phrase("phase_first_half_straight_random", "==", 0, "random straight in first half of early race");
phrase("phase_first_half_straight_random", "==", 1, "random straight in first half of mid-race");
phrase("phase_first_half_straight_random", "==", 2, "random straight in first half of late race");
phrase("phase_first_half_straight_random", "==", 3, "random straight in first half of last spurt");
phrase("phase_latter_half_straight_random", "==", 0, "random straight in later half of early race");
phrase("phase_latter_half_straight_random", "==", 1, "random straight in later half of mid-race");
phrase("phase_latter_half_straight_random", "==", 2, "random straight in later half of late race");
phrase("phase_latter_half_straight_random", "==", 3, "random straight in later half of last spurt");

phrase("corner", "!=", 0, "on a corner");
phraseByOp("corner", "!=", (v) => (v === 0 ? "on a corner" : `on a corner other than corner ${v}`));
phraseByOp("corner", "==", (v) => (v === 0 ? "not on a corner" : `corner ${v}`));
phraseByOp("corner_random", "==", (v) => `a random point on corner ${v}`);
phrase("all_corner_random", "==", 1, "any corner");
phraseByOp("corner_count", "==", (v) => (v === 0 ? "a course with no corners" : `${v} corners on the course`));

phrase("is_finalcorner", "==", 1, "at or after the final corner");
phrase("is_finalcorner", "==", 0, "before the final corner");
phrase("is_finalcorner_laterhalf", "==", 1, "in the later half of the final corner");
phrase("is_finalcorner_random", "==", 1, "a random point at the final corner");
phrase("is_last_straight", "==", 1, "on the final straight");
phrase("is_last_straight_onetime", "==", 1, "at the start of the final straight");
phrase("last_straight_random", "==", 1, "a random point on the final straight");
phrase("straight_random", "==", 1, "a random straight");
phrase("straight_front_type", "==", 1, "the grandstand straight");
phrase("straight_front_type", "==", 2, "the opposite straight");

// --- slope -----------------------------------------------------------------
lookup("slope", { 0: "on flat ground", 1: "on an uphill", 2: "on a downhill" });
phrase("up_slope_random", "==", 1, "a random uphill");
phrase("down_slope_random", "==", 1, "a random downhill");
phrase("up_slope_random_later_half", "==", 1, "a random uphill in the later half of the race");

// --- distance / track -------------------------------------------------------
lookup("distance_type", DISTANCE_TYPES);
phraseByOp("distance_type", "!=", (v) => `not ${DISTANCE_TYPES[v] ?? `distance type ${v}`}`);
lookup("ground_type", { 1: "turf", 2: "dirt" });
lookup("ground_condition", { 1: "good ground", 2: "slightly heavy ground", 3: "heavy ground", 4: "bad ground" });
phrase("ground_condition", "!=", 1, "not good ground");
phrase("ground_condition", "<=", 2, "good or slightly heavy ground");
phrase("ground_condition", ">=", 3, "heavy or bad ground");
phraseByOp("course_distance", "==", (v) => `a ${v}m course`);
phraseByOp("course_distance", "!=", (v) => `not a ${v}m course`);
phraseByOp("course_distance", ">=", (v) => `a ${v}m or longer course`);
phraseByOp("course_distance", "<=", (v) => `a ${v}m or shorter course`);
phraseByOp("course_distance", "<", (v) => `a course shorter than ${v}m`);
phraseByOp("course_distance", ">", (v) => `a course longer than ${v}m`);
phraseByOp("remain_distance", ">=", (v) => `${v}m or more remaining`);
phraseByOp("remain_distance", "<=", (v) => `${v}m or less remaining`);
phraseByOp("remain_distance", "==", (v) => `${v}m remaining`);
phraseByOp("distance_rate", ">=", (v) => `race is past ${v}%`);
phraseByOp("distance_rate", "<=", (v) => `race is within the first ${v}%`);
phraseByOp("distance_rate_after_random", "==", (v) => `a random point after ${v}% of the race`);
lookup("rotation", { 1: "a right-hand course", 2: "a left-hand course", 4: "a straight course" });
phrase("is_abroad", "==", 1, "an overseas course");
phrase("is_abroad", "==", 0, "a domestic course");
phrase("is_tight_track", "==", 1, "a tight track");
phrase("is_basis_distance", "==", 1, "a core distance (÷400)");
phrase("is_basis_distance", "!=", 1, "a non-core distance");
phraseByOp("is_basis_distance", "==", (v) => (v === 0 ? "a non-core distance" : `a core distance (÷400) value ${v}`));
phrase("is_dirtgrade", "==", 1, "a dirt-grade race");
phrase("is_dirtgrade", "!=", 1, "not a dirt-grade race");
phraseByOp("track_id", "==", (v) => trackName(v));
phraseByOp("track_id", "!=", (v) => (TRACK_NAMES[v] ? `not ${TRACK_NAMES[v]} racecourse` : `not track #${v}`));
phraseByOp("track_id", ">=", (v) => (TRACK_NAMES[v] ? `${TRACK_NAMES[v]} racecourse or higher` : `track #${v} or higher`));
phraseByOp("track_id", "<=", (v) => (TRACK_NAMES[v] ? `${TRACK_NAMES[v]} racecourse or lower` : `track #${v} or lower`));
phraseByOp("grade", "==", (v) => `a ${gradeName(v)} race`);
phraseByOp("season", "==", (v) => `${seasonName(v)} season`);
phraseByOp("weather", "==", (v) => `${weatherName(v)} weather`);
phraseByOp("time", "==", (v) => timeName(v));

// --- position / order ------------------------------------------------------
phraseByOp("order", "<=", (v) => (v <= 1 ? "position 1" : `position 1–${v}`));
phraseByOp("order", "<", (v) => (v <= 2 ? "position 1" : `position 1–${v - 1}`));
phraseByOp("order", ">", (v) => (v + 1 >= currentRacerCount ? `position ${currentRacerCount}` : `position ${v + 1}–${currentRacerCount}`));
phraseByOp("order", ">=", (v) => (v >= currentRacerCount ? `position ${currentRacerCount}` : `position ${v}–${currentRacerCount}`));
phraseByOp("order", "==", (v) => `position ${v}`);
// order_rate conditions express a fractional position (rate% of the field),
// so their phrase depends on the number of racers in the race. `currentRacerCount`
// is set by renderCondition's racerCount argument (module-level so DictEntry's
// fixed `(op, value)` signature is preserved); rate ≤ 0 is absent from live data,
// so those fall through to the raw-text fallback.
let currentRacerCount = 12;

phraseByOpOpt("order_rate", "<=", (v) => {
  if (v <= 0) return undefined;
  const t = Math.round((currentRacerCount * v) / 100);
  return t <= 1 ? "position 1" : `position 1–${t}`;
});
phraseByOpOpt("order_rate", "<", (v) => {
  if (v <= 0) return undefined;
  const t = Math.round((currentRacerCount * v) / 100);
  return t <= 2 ? "position 1" : `position 1–${t - 1}`;
});
phraseByOpOpt("order_rate", ">=", (v) => {
  if (v <= 0) return undefined;
  const t = Math.round((currentRacerCount * v) / 100);
  return t >= currentRacerCount ? `position ${currentRacerCount}` : `position ${t}–${currentRacerCount}`;
});
phraseByOpOpt("order_rate", ">", (v) => {
  if (v <= 0) return undefined;
  const t = Math.round((currentRacerCount * v) / 100);
  return t + 1 >= currentRacerCount ? `position ${currentRacerCount}` : `position ${t + 1}–${currentRacerCount}`;
});
phrase("order_rate_in20_continue", "==", 1, "position inside the top 20% continuously");
phrase("order_rate_in40_continue", "==", 1, "position inside the top 40% continuously");
phrase("order_rate_in50_continue", "==", 1, "position inside the top 50% continuously");
phrase("order_rate_in80_continue", "==", 1, "position inside the top 80% continuously");
phrase("order_rate_out20_continue", "==", 1, "position outside the top 20% continuously");
phrase("order_rate_out40_continue", "==", 1, "position outside the top 40% continuously");
phrase("order_rate_out50_continue", "==", 1, "position outside the top 50% continuously");
phrase("order_rate_out70_continue", "==", 1, "position outside the top 70% continuously");
phraseByOp("near_count", ">=", (v) => `${v} other ${v === 1 ? "girl" : "girls"} within ~3m`);
phraseByOp("near_count", "==", (v) => `exactly ${v} other ${v === 1 ? "girl" : "girls"} within ~3m`);
phraseByOp("near_infront_count", ">=", (v) => `${v} ${v === 1 ? "girl" : "girls"} within ~2.5m ahead`);
phraseByOp("near_infront_count", "==", (v) => `exactly ${v} ${v === 1 ? "girl" : "girls"} within ~2.5m ahead`);
phraseByOp("distance_diff_top", "<=", (v) => `within ${v}m of the leader`);
phraseByOp("distance_diff_top", ">=", (v) => `${v}m or more behind the leader`);
phraseByOp("distance_diff_top", ">", (v) => `more than ${v}m behind the leader`);
phraseByOp("distance_diff_top_float", "<=", (v) => `within ${v / 10}m of the leader`);
phraseByOp("distance_diff_rate", "<=", (v) => `within the top ${v}% of the pack`);
phraseByOp("distance_diff_rate", ">=", (v) => `in the bottom ${100 - v}% of the pack`);
phraseByOp("bashin_diff_infront", "<=", (v) => `≤ ${v} ${v === 1 ? "length" : "lengths"} to the horse ahead`);
phraseByOp("bashin_diff_infront", ">=", (v) => `≥ ${v} ${v === 1 ? "length" : "lengths"} to the horse ahead`);
phraseByOp("bashin_diff_behind", "<=", (v) => `≤ ${v} ${v === 1 ? "length" : "lengths"} to the horse behind`);
phraseByOp("bashin_diff_behind", ">=", (v) => `≥ ${v} ${v === 1 ? "length" : "lengths"} to the horse behind`);
phraseByOp("lane_type", "==", (v) => (v === 0 ? "the inner lane" : v === 1 ? "the middle lane" : v === 2 ? "the outer lane" : "outside the pack"));
phrase("is_move_lane", "==", 1, "moving closer to the fence");
phrase("is_move_lane", "==", 2, "moving away from the fence");
phrase("is_behind_in", "==", 1, "the horse behind is closer to the fence");
phrase("is_surrounded", "==", 1, "boxed in (front, back, and outside)");
phrase("blocked_front", "==", 1, "blocked in front");
phraseByOp("blocked_front_continuetime", ">=", (v) => `blocked in front for ${v}s`);
phraseByOp("blocked_side_continuetime", ">=", (v) => `blocked to the side for ${v}s`);
phraseByOp("blocked_all_continuetime", ">=", (v) => `blocked on all sides for ${v}s`);
phrase("is_overtake", "==", 1, "has an overtake target");
phraseByOp("overtake_target_time", ">=", (v) => `being an overtake target for ${v}s`);
phraseByOp("overtake_target_no_order_up_time", ">=", (v) => `passing without gaining a place for ${v}s`);
phrase("change_order_onetime", "<", 0, "overtaking");
phrase("change_order_onetime", ">", 0, "just got passed");
phraseByOp("change_order_up_end_after", ">=", (v) => `passed ${v} ${v === 1 ? "girl" : "girls"} in the late race`);
phraseByOp("change_order_up_middle", ">=", (v) => `passed ${v} ${v === 1 ? "girl" : "girls"} in mid-race`);
phraseByOp("change_order_up_finalcorner_after", ">=", (v) => `passed ${v} ${v === 1 ? "girl" : "girls"} at or after the final corner`);
phraseByOp("post_number", "<=", (v) => (v <= 1 ? "gate 1" : `gate 1–${v}`));
phraseByOp("post_number", "<", (v) => (v <= 2 ? "gate 1" : `gate 1–${v - 1}`));
phraseByOp("post_number", ">=", (v) => (v >= currentRacerCount ? `gate ${currentRacerCount}` : `gate ${v}–${currentRacerCount}`));
phraseByOp("post_number", ">", (v) => (v + 1 >= currentRacerCount ? `gate ${currentRacerCount}` : `gate ${v + 1}–${currentRacerCount}`));
phraseByOp("post_number", "==", (v) => `gate ${v}`);
phraseByOp("popularity", "<=", (v) => (v <= 1 ? "1st favorite" : `1st–${ordinal(v)} favorite`));
phraseByOp("popularity", "<", (v) => (v <= 2 ? "1st favorite" : `1st–${ordinal(v - 1)} favorite`));
phraseByOp("popularity", ">=", (v) => (v >= currentRacerCount ? `${ordinal(currentRacerCount)} favorite` : `${ordinal(v)}–${ordinal(currentRacerCount)} favorite`));
phraseByOp("popularity", ">", (v) => (v + 1 >= currentRacerCount ? `${ordinal(currentRacerCount)} favorite` : `${ordinal(v + 1)}–${ordinal(currentRacerCount)} favorite`));
phraseByOp("popularity", "==", (v) => `${ordinal(v)} favorite`);
lookup("running_style", { 1: "running as a Runner", 2: "running as a Leader", 3: "running as a Betweener", 4: "running as a Chaser" });
phraseByOp("visiblehorse", ">=", (v) => `${v} or more girls in view`);

// --- stats / HP ------------------------------------------------------------
phraseByOp("base_speed", ">=", (v) => `base speed ≥ ${v}`);
phraseByOp("base_speed", "<", (v) => `base speed < ${v}`);
phraseByOp("base_stamina", ">=", (v) => `base stamina ≥ ${v}`);
phraseByOp("base_stamina", "<", (v) => `base stamina < ${v}`);
phraseByOp("base_power", ">=", (v) => `base power ≥ ${v}`);
phraseByOp("base_power", "<", (v) => `base power < ${v}`);
phraseByOp("base_guts", ">=", (v) => `base guts ≥ ${v}`);
phraseByOp("base_guts", "<", (v) => `base guts < ${v}`);
phraseByOp("base_wiz", ">=", (v) => `base wisdom ≥ ${v}`);
phraseByOp("base_wiz", "<", (v) => `base wisdom < ${v}`);
phraseByOp("hp_per", "<=", (v) => `HP ≤ ${v}%`);
phraseByOp("hp_per", ">=", (v) => `HP ≥ ${v}%`);
phraseByOp("hp_per", ">", (v) => `HP > ${v}%`);
phraseByOp("hp_per", "<", (v) => `HP < ${v}%`);
phrase("is_hp_empty_onetime", "==", 1, "HP was depleted");
phraseByOp("motivation", ">=", (v) => (v >= 5 ? "Great motivation" : `at least ${motivationName(v)} motivation`));
phraseByOp("motivation", "==", (v) => `${motivationName(v)} motivation`);
phraseByOp("motivation", "<=", (v) => (v <= 1 ? "Terrible motivation" : `at most ${motivationName(v)} motivation`));
phraseByOp("fan_count", ">=", (v) => `${v} or more fans`);

// --- timing / skill activation ---------------------------------------------
phraseByOp("accumulatetime", ">=", (v) => `after ${v}s`);
phraseByOp("accumulatetime", "<", (v) => `within the first ${v}s`);
phraseByOp("activate_count_all", ">=", (v) => `${v} skills activated`);
phraseByOp("activate_count_all", "<=", (v) => `at most ${v} skills activated`);
phraseByOp("activate_count_start", ">=", (v) => `${v} skills activated in the early race`);
phraseByOp("activate_count_middle", ">=", (v) => `${v} skills activated in mid-race`);
phraseByOp("activate_count_middle", "<=", (v) => `at most ${v} skills activated in mid-race`);
phraseByOp("activate_count_middle", "==", (v) => `exactly ${v} skills activated in mid-race`);
phraseByOp("activate_count_end_after", ">=", (v) => `${v} skills activated in the late race`);
phraseByOp("activate_count_later_half", ">=", (v) => `${v} skills activated in the later half`);
phraseByOp("activate_count_heal", ">=", (v) => `${v} recovery skills activated`);
phraseByOp("activate_count_all_team", ">=", (v) => `${v} team skills activated`);
phraseByOp("infront_near_lane_time", ">=", (v) => `near a horse ahead for ${v}s`);
phraseByOp("behind_near_lane_time", ">=", (v) => `near a horse behind for ${v}s`);
phraseByOp("behind_near_lane_time_set1", ">=", (v) => `near a horse behind (wide) for ${v}s`);
phrase("compete_fight_count", ">", 0, "in a showdown");
phraseByOp("compete_fight_count", ">=", (v) => (v === 1 ? "in a showdown" : `in at least ${v} showdowns`));
phraseByOp("compete_fight_count", ">", (v) => (v === 0 ? "in a showdown" : `in more than ${v} showdowns`));
phrase("temptation_count", "==", 0, "never rushed");
phraseByOp("temptation_count", "==", (v) => (v === 0 ? "never rushed" : `rushed exactly ${v} time${v === 1 ? "" : "s"}`));
phraseByOp("temptation_count", ">=", (v) => `rushed ${v} time${v === 1 ? "" : "s"}`);
phrase("is_temptation", "==", 1, "currently rushing");
phrase("is_temptation", "==", 0, "not currently rushing");
phrase("is_badstart", "==", 1, "a late start");
phrase("is_badstart", "!=", 1, "not a late start");
phrase("is_badstart", "==", 0, "not a late start");
phrase("is_goodstart", "==", 1, "a good start");
phrase("is_lastspurt", "==", 1, "during the last spurt");
lookup("lastspurt", { 0: "can't finish", 1: "above base stamina", 2: "full last spurt" });
phrase("run_at_full_speed_random", "==", 1, "a random point at Zenkai Spurt");

// --- skill interaction -----------------------------------------------------
phrase("is_activate_any_skill", "==", 1, "any skill activated");
phrase("is_activate_other_skill_detail", "==", 1, "this skill already activated once");
phrase("is_activate_heal_skill", "==", 1, "just recovered stamina");
phraseByOp("is_other_character_activate_advantage_skill", "==", (v) => `another character activated an advantage skill (type ${v})`);
phraseByOp("is_popularity_top_character_activate_advantage_skill", "==", (v) => `the top-popularity character activated an advantage skill (type ${v})`);
phraseByOp("is_used_skill_id", "==", (v) => `skill #${v} was used`);
phraseByOp("is_used_skill_id_with_detail_one", "==", (v) => `skill #${v} was used (with detail)`);
phraseByOp("is_exist_skill_id", "==", (v) => `someone in the race has skill #${v}`);
phraseByOp("is_exist_chara_id", "==", (v) => `character #${v} is in the race`);
phraseByOp("same_skill_horse_count", ">=", (v) => `${v} other ${v === 1 ? "girl has" : "girls have"} this skill`);
phraseByOp("same_skill_horse_count", "==", (v) => `exactly ${v} other ${v === 1 ? "girl has" : "girls have"} this skill`);
phrase("succession_skill_count", "==", 1, "a succession skill was inherited");
phraseByOp("succession_skill_count", ">=", (v) => `${v} succession skills inherited`);

// --- running style / temptation counts -------------------------------------
phraseByOp("running_style_count_nige_otherself", ">=", (v) => `${v} other Runners`);
phraseByOp("running_style_count_senko_otherself", ">=", (v) => `${v} other Leaders`);
phraseByOp("running_style_count_sashi_otherself", ">=", (v) => `${v} other Betweeners`);
phraseByOp("running_style_count_oikomi_otherself", ">=", (v) => `${v} other Chasers`);
phraseByOp("running_style_count_same", ">=", (v) => `${v} other girls running the same style`);
phraseByOp("running_style_count_same", "<=", (v) => `at most ${v} other girls running the same style`);
phraseByOp("running_style_count_same", "==", (v) => `exactly ${v} other girls running the same style`);
phraseByOp("running_style_count_same_rate", ">=", (v) => `≥${v}% of the field running the same style`);
phrase("running_style_equal_popularity_one", "==", 1, "a same-style rival with equal popularity");
phraseByOp("running_style_temptation_count_nige", ">=", (v) => `${v} Runners rushing`);
phraseByOp("running_style_temptation_count_senko", ">=", (v) => `${v} Leaders rushing`);
phraseByOp("running_style_temptation_count_sashi", ">=", (v) => `${v} Betweeners rushing`);
phraseByOp("running_style_temptation_count_oikomi", ">=", (v) => `${v} Chasers rushing`);
phraseByOp("running_style_temptation_opponent_count_nige", ">=", (v) => `${v} opponent Runners rushing`);
phraseByOp("running_style_temptation_opponent_count_senko", ">=", (v) => `${v} opponent Leaders rushing`);
phraseByOp("running_style_temptation_opponent_count_sashi", ">=", (v) => `${v} opponent Betweeners rushing`);
phraseByOp("running_style_temptation_opponent_count_oikomi", ">=", (v) => `${v} opponent Chasers rushing`);
phraseByOp("temptation_count_behind", ">=", (v) => `${v} ${v === 1 ? "girl" : "girls"} behind rushing`);
phraseByOp("temptation_count_infront", ">=", (v) => `${v} ${v === 1 ? "girl" : "girls"} in front rushing`);
phraseByOp("temptation_opponent_count_behind", ">=", (v) => `${v} ${v === 1 ? "opponent" : "opponents"} behind rushing`);
phraseByOp("temptation_opponent_count_infront", ">=", (v) => `${v} ${v === 1 ? "opponent" : "opponents"} in front rushing`);

// --- misc ------------------------------------------------------------------
phrase("always", "==", 1, "always");
phraseByOp("random_lot", "==", (v) => `${v}% chance`);
phraseByOp("remain_distance_viewer_id", ">=", (v) => `within ${v} of the remaining-distance viewer`);
phraseByOp("remain_distance_viewer_id", "<=", (v) => `within ${v} of the remaining-distance viewer`);
phraseByOp("furlong", "==", (v) => `${v} furlong(s)`);

// ---------------------------------------------------------------------------
// Tokenizer + renderer
// ---------------------------------------------------------------------------

const TOKEN = /([a-z0-9_]+)\s*(==|!=|<=|>=|<|>)\s*(-?\d+)/g;

/** Render a single fragment (no `&`/`@` separators) to English. */
function renderFragment(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return "";
  TOKEN.lastIndex = 0;
  const m = TOKEN.exec(cleaned);
  if (!m || m[0].trim() !== cleaned) {
    // Malformed or has surrounding text we can't attribute — keep it verbatim.
    return cleaned;
  }
  const kw = m[1];
  const op = m[2];
  const value = Number(m[3]);
  const entries = DICT[kw];
  let phraseText: string | undefined;
  if (entries) {
    for (const entry of entries) {
      phraseText = entry(op, value);
      if (phraseText !== undefined) break;
    }
  }
  return phraseText ?? `${kw} ${op} ${value}`;
}

/** Clamp racerCount to [9, 18]; non-finite → 12. */
function normalizeRacerCount(racerCount: number | undefined): number {
  if (racerCount === undefined) return 12;
  if (!Number.isFinite(racerCount)) return 12;
  return Math.min(18, Math.max(9, Math.round(racerCount)));
}

interface ParsedFrag {
  raw: string;
  kw?: string;
  op?: string;
  value?: number;
}

function parseFragment(raw: string): ParsedFrag {
  const cleaned = raw.trim();
  if (!cleaned) return { raw: cleaned };
  TOKEN.lastIndex = 0;
  const m = TOKEN.exec(cleaned);
  if (!m || m[0].trim() !== cleaned) {
    return { raw: cleaned };
  }
  return {
    raw: cleaned,
    kw: m[1],
    op: m[2],
    value: Number(m[3]),
  };
}

/**
 * Render a single AND-separated group of conditions (e.g. "order>=2&order<=5"),
 * consolidating multiple position, gate, or popularity constraints into single ranges.
 */
function renderAndGroup(andClause: string, racerCount: number): string[] {
  const rawFrags = andClause
    .split("&")
    .map((f) => f.trim())
    .filter(Boolean);
  if (rawFrags.length === 0) return [];

  const parsed = rawFrags.map(parseFragment);

  // Identify constraint groups to consolidate
  const posIndices: number[] = [];
  const gateIndices: number[] = [];
  const popIndices: number[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    if (p.kw === "order" || (p.kw === "order_rate" && p.value !== undefined && p.value > 0)) {
      posIndices.push(i);
    } else if (p.kw === "post_number" && p.value !== undefined) {
      gateIndices.push(i);
    } else if (p.kw === "popularity" && p.value !== undefined) {
      popIndices.push(i);
    }
  }

  const replacements: Record<number, string> = {};
  const skipIndices = new Set<number>();

  // Consolidate positions (when >= 2 conditions)
  if (posIndices.length > 1) {
    let minPos = 1;
    let maxPos = racerCount;
    let exactPos: number | null = null;

    for (const idx of posIndices) {
      const p = parsed[idx];
      if (p.kw === "order") {
        if (p.op === "==") exactPos = p.value!;
        else if (p.op === "<=") maxPos = Math.min(maxPos, p.value!);
        else if (p.op === "<") maxPos = Math.min(maxPos, p.value! - 1);
        else if (p.op === ">=") minPos = Math.max(minPos, p.value!);
        else if (p.op === ">") minPos = Math.max(minPos, p.value! + 1);
      } else if (p.kw === "order_rate") {
        const t = Math.round((racerCount * p.value!) / 100);
        if (p.op === "<=") maxPos = Math.min(maxPos, t);
        else if (p.op === "<") maxPos = Math.min(maxPos, t - 1);
        else if (p.op === ">=") minPos = Math.max(minPos, t);
        else if (p.op === ">") minPos = Math.max(minPos, t + 1);
      }
    }

    if (exactPos !== null) {
      minPos = exactPos;
      maxPos = exactPos;
    }
    minPos = Math.max(1, Math.min(racerCount, minPos));
    maxPos = Math.max(1, Math.min(racerCount, maxPos));
    if (minPos > maxPos) maxPos = minPos;

    replacements[posIndices[0]] = minPos === maxPos ? `position ${minPos}` : `position ${minPos}–${maxPos}`;
    for (let k = 1; k < posIndices.length; k++) {
      skipIndices.add(posIndices[k]);
    }
  }

  // Consolidate gates
  if (gateIndices.length > 1) {
    let minGate = 1;
    let maxGate = racerCount;
    let exactGate: number | null = null;

    for (const idx of gateIndices) {
      const p = parsed[idx];
      if (p.op === "==") exactGate = p.value!;
      else if (p.op === "<=") maxGate = Math.min(maxGate, p.value!);
      else if (p.op === "<") maxGate = Math.min(maxGate, p.value! - 1);
      else if (p.op === ">=") minGate = Math.max(minGate, p.value!);
      else if (p.op === ">") minGate = Math.max(minGate, p.value! + 1);
    }

    if (exactGate !== null) {
      minGate = exactGate;
      maxGate = exactGate;
    }
    if (minGate > maxGate) maxGate = minGate;

    replacements[gateIndices[0]] = minGate === maxGate ? `gate ${minGate}` : `gate ${minGate}–${maxGate}`;
    for (let k = 1; k < gateIndices.length; k++) {
      skipIndices.add(gateIndices[k]);
    }
  }

  // Consolidate popularity
  if (popIndices.length > 1) {
    let minPop = 1;
    let maxPop = racerCount;
    let exactPop: number | null = null;

    for (const idx of popIndices) {
      const p = parsed[idx];
      if (p.op === "==") exactPop = p.value!;
      else if (p.op === "<=") maxPop = Math.min(maxPop, p.value!);
      else if (p.op === "<") maxPop = Math.min(maxPop, p.value! - 1);
      else if (p.op === ">=") minPop = Math.max(minPop, p.value!);
      else if (p.op === ">") minPop = Math.max(minPop, p.value! + 1);
    }

    if (exactPop !== null) {
      minPop = exactPop;
      maxPop = exactPop;
    }
    if (minPop > maxPop) maxPop = minPop;

    replacements[popIndices[0]] =
      minPop === maxPop ? `${ordinal(minPop)} favorite` : `${ordinal(minPop)}–${ordinal(maxPop)} favorite`;
    for (let k = 1; k < popIndices.length; k++) {
      skipIndices.add(popIndices[k]);
    }
  }

  const out: string[] = [];
  for (let i = 0; i < parsed.length; i++) {
    if (skipIndices.has(i)) continue;
    if (replacements[i] !== undefined) {
      out.push(replacements[i]);
    } else {
      out.push(renderFragment(parsed[i].raw));
    }
  }
  return out;
}

/**
 * Join fragments with the actual separator words seen in the raw string
 * (`&`→"and", `@`→"or"), lowercasing every phrase after the first so the
 * result reads as one sentence.
 */
function renderCondition(str: string, racerCount?: number): string {
  currentRacerCount = normalizeRacerCount(racerCount);
  const raw = (str ?? "").trim();
  if (!raw) return "";

  const orGroups = raw.split("@");
  const renderedBranches: string[] = [];

  for (const orGroup of orGroups) {
    const frags = renderAndGroup(orGroup, currentRacerCount).filter(Boolean);
    if (frags.length === 0) continue;
    let branchText = "";
    for (let i = 0; i < frags.length; i++) {
      const rendered = frags[i];
      if (i === 0) {
        branchText = rendered;
      } else {
        branchText += " and " + rendered.charAt(0).toLowerCase() + rendered.slice(1);
      }
    }
    renderedBranches.push(branchText);
  }

  if (renderedBranches.length === 0) return "";

  let out = "";
  for (let i = 0; i < renderedBranches.length; i++) {
    const b = renderedBranches[i];
    if (i === 0) {
      out = b.charAt(0).toUpperCase() + b.slice(1);
    } else {
      out += " or " + b.charAt(0).toLowerCase() + b.slice(1);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Effect formatting
// ---------------------------------------------------------------------------

// Effect type display (from uma-tools SkillType enum, RaceSolver.ts)
export const EFFECT_LABELS: Record<number, { label: string; unit: string; scale: number }> = {
  27: { label: "Target Speed", unit: "m/s", scale: 10000 },
  31: { label: "Acceleration", unit: "m/s²", scale: 10000 },
  48: { label: "Zenkai Spurt Acceleration", unit: "m/s²", scale: 10000 },
  22: { label: "Current Speed", unit: "m/s", scale: 10000 },
  21: { label: "Current Speed", unit: "m/s", scale: 10000 },
  9:  { label: "HP", unit: "%", scale: 100 },
  1:  { label: "Speed", unit: "", scale: 10000 },       // stat-up (+40, +60)
  2:  { label: "Stamina", unit: "", scale: 10000 },
  3:  { label: "Power", unit: "", scale: 10000 }, 
  4:  { label: "Guts", unit: "", scale: 10000 },
  5:  { label: "Wisdom", unit: "", scale: 10000 },
  8:  { label: "Clairvoyance", unit: "", scale: 1 },
  10: { label: "Start delay", unit: "×", scale: 1 }, // multiplier
  14: { label: "Start delay", unit: "×", scale: 1 },
  28: { label: "Lane", unit: "", scale: 1 },
  37: { label: "Internal", unit: "", scale: 1 },     // hide
  42: { label: "Internal", unit: "", scale: 1 },     // hide
};

/**
 * Format a skill's effects into a human-readable line.
 * @param effects - Array of {type, value} from the API.
 * @param baseTime - base_time from the API (centiseconds, ÷10000→s; null/ -1→no duration).
 * @param courseLength - selected course length in meters.
 * @returns e.g. "+0.35 m/s for 2.4 s" or "+60 Guts" (passive, no duration).
 * Never throws: unknown types fall back to "type:{type} value:{value}".
 */
function formatTarget(target?: number, targetDetails?: number): string {
  if (target === 10) return "(opponents behind)";
  if (target === 9) return "(opponents ahead)";
  if (target === 11) return "(teammates)";
  if (target === 18) {
    const styleMap: Record<number, string> = {
      1: "Runners",
      2: "Leaders",
      3: "Betweeners",
      4: "Chasers",
    };
    const style = targetDetails ? styleMap[targetDetails] : "";
    return style ? `(opponent ${style})` : "(opponents)";
  }
  return "";
}

export function formatEffect(
  effects: Array<{ type: number; value: number; target?: number; target_details?: number }>,
  baseTime: number | null | undefined,
  courseLength: number,
): string {
  // Duration: baseTime × courseLength / 10_000_000 → seconds
  const hasDuration = baseTime != null && baseTime > 0 && Number.isFinite(baseTime);
  let durationS = 0;
  if (hasDuration) {
    durationS = (baseTime! * courseLength) / 10_000_000;
  }

  // Filter out hidden types (37, 42)
  const visible = effects.filter((e) => {
    const meta = EFFECT_LABELS[e.type];
    return !meta || meta.label !== "Internal";
  });
  if (visible.length === 0) return "";

  const hasTargetDifferences = visible.some((x) => x.target && x.target !== 1);

  const parts = visible.map((e) => {
    const meta = EFFECT_LABELS[e.type];
    if (!meta) return `type:${e.type} value:${e.value}`; // fallback

    const scaled = e.value / meta.scale;
    const sign = scaled >= 0 ? "+" : "−";
    const abs = Math.abs(scaled);
    let num: string;
    let unit: string;
    if (meta.unit === "%") {
      num = Number(abs.toFixed(2)).toString();
      unit = "%";
    } else if (meta.unit) {
      num = abs.toFixed(2);
      unit = ` ${meta.unit}`;
    } else {
      num = Math.round(abs).toString();
      unit = "";
    }

    let targetSuffix = "";
    if (hasTargetDifferences) {
      targetSuffix = e.target && e.target !== 1 ? ` ${formatTarget(e.target, e.target_details)}` : " (self)";
    } else if (e.target && e.target !== 1) {
      targetSuffix = ` ${formatTarget(e.target, e.target_details)}`;
    }

    // Label always shown so the reader knows what kind of effect it is
    // (e.g. "+0.35 m/s target speed", not just "+0.35 m/s").
    return `${sign}${num}${unit} ${meta.label}${targetSuffix}`;
  });

  let line = parts.join(", ");
  if (durationS > 0) {
    line += ` for ${durationS.toFixed(1)} s`;
  }
  return line;
}

/**
 * Render a condition string into branches: one per `@` (OR), each a list of
 * rendered leaf phrases formed by `&` (AND) joins. The flat `.when` string is
 * also returned for backward compatibility.
 */
export function conditionBranches(str: string, racerCount?: number): {
  branches: string[][];
  when: string;
} {
  const when = renderCondition(str, racerCount);
  const raw = (str ?? "").trim();
  if (!raw) return { branches: [], when };
  const count = normalizeRacerCount(racerCount);
  // Split on `@` first (OR branches → lines), then consolidate and render & (AND → chips).
  const branches = raw
    .split("@")
    .map((orGroup) => renderAndGroup(orGroup, count).filter(Boolean))
    .filter((b) => b.length > 0);
  return { branches, when };
}

/**
 * Human-readable description of a condition string (and optional precondition).
 * Returns `{ when }`, plus `{ needs }` when a precondition is present.
 * Never throws: unknown/malformed input falls back to the raw string.
 */
export function describeCondition(
  cond: string,
  precond?: string | null,
  racerCount?: number,
): { when: string; needs?: string } {
  try {
    const when = renderCondition(cond ?? "", racerCount);
    const needs = precond ? renderCondition(precond, racerCount) : undefined;
    return needs ? { when, needs } : { when };
  } catch {
    return { when: cond ?? "" };
  }
}
