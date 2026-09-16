# Visualizer — Master Plan

> Last updated: 2026-06-22
> Based on reverse-engineering of master.mdb + gameassembly.dll (v2.28.0 IL2CPP dump)

---

## Context

Uma Musume skill data is publicly available (gamewith, kamigame, gametora) but presented as raw text. No existing tool answers: *"For this track, with this exact training deck, where does each skill fire — and what does the elevation look like at that point?"*

This tool overlays activation zones onto the actual track shape, using raw numerical data. No translations needed — numbers, icons, and geometry are universal. The core use case is training deck planning: pick 7 cards, see what happens on the track.

---

## Goals

1. **Zero translation dependency.** Effect values, duration bars, phase bands, corner positions, elevation profiles — all visual, no JP→EN text needed.
2. **Full deck visualization.** 1 character card + 6 support cards = ~25-35 skills mapped onto the track.
3. **Accurate course shape.** Track geometry extracted from `gameassembly.dll` as spline data, not hand-traced SVGs. Phase boundaries, corners, slopes, and gate positions are exact.
4. **Update-friendly.** master.mdb replaced on each content drop; import pipeline handles the rest. Track data is static (same across 4+ years of content).

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Your Cloudflare Zone                                │
│                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │  Static Frontend      │  │  Existing Worker      │ │
│  │  (Pages / R2)         │──│  + API endpoints      │ │
│  │                       │  │  + import pipeline    │ │
│  │  - HTML + vanilla JS  │  │  + DB (SQLite / D1)   │ │
│  │  - separate repo      │  │  - internal-only      │ │
│  └──────────────────────┘  └──────────────────────┘ │
│       public CDN              internal (same domain)  │
└─────────────────────────────────────────────────────┘

          ▲
          │ extraction (one-time per track)
          │
┌─────────┴──────────────────────────────────────────────────┐
│  gameassembly.dll (Unity IL2CPP, v2.28.0 mobile)            │
│                                                             │
│  Track geometry:     CourseParamTable (MonoBehaviour)       │
│                      ├─ CourseParam[] courseParams          │
│                      │  ├─ _paramType: Corner|Straight|     │
│                      │  │   Slope|GroundChange|LaneMaxChange│
│                      │  ├─ _distance: float (m from start)  │
│                      │  └─ _values: int[] (type-specific)   │
│                                                             │
│  Phase calculator:   RacePhaseCalculator                    │
│                      ├─ PhaseStartStartDistance (Early)     │
│                      ├─ PhaseMiddleStartDistance (Mid)      │
│                      ├─ PhaseEndStartDistance (Late)        │
│                      ├─ PhaseLastStartDistance (Last Spurt) │
│                      └─ GetPhaseByDistance(float) → HorsePhase│
│                                                             │
│  Master metadata:    RaceCourseSet (mirrors master.mdb)     │
│                      CourseEventManager (filters params)    │
│                                                             │
│  Race simulation:    HorseRaceInfo, CompeteBeforeSpurtParam │
│                      40+ SkillTrigger* evaluator classes    │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Where | Role |
|-------|-------|------|
| Data extraction | gameassembly.dll | Pull track geometry once per track (~11 tracks) |
| Data import | Worker (cron/manual trigger) | master.mdb → normalized schema |
| API | Worker (service bindings) | 3-4 read-only endpoints, internal only |
| Frontend | Pages (static) | One page: deck picker + track overlay |
| Caching | Worker KV or `fetch` cache | Per-track × per-character, stale-while-revalidate |

---

## Phase 1 — Data Pipeline

### 1a. Track Geometry Extraction (gameassembly.dll)

**Source:** `CourseParamTable` (MonoBehaviour on course prefabs) — NOT in master.mdb.
The track geometry data lives in Unity's serialized assets, loaded at runtime as a `CourseParam[]` array.

#### CourseParamType enum (what each array element describes)

| Value | Enum | What it describes | `_values` encoding |
|-------|------|-------------------|--------------------|
| 0 | `Corner` | Turn location + length | `[CORNER_NO, CORNER_DISTANCE]` |
| 1 | `GroundChange` | Turf↔dirt transition | usage TBD |
| 2 | `Straight` | Straight section | `[START_END_FLAG, TYPE, IS_LAST]` |
| 3 | `LaneMaxChange` | Where max lane count changes | `[LANE_MAX]` |
| 4 | `FirstBgmLandscape` | BGM trigger (cosmetic) | — |
| 5 | `SecondBgmLandscape` | BGM trigger (cosmetic) | — |
| 6 | `JikkyoTrigger` | Commentary trigger (cosmetic) | — |
| 7 | `MoveLanePoint` | Position shift trigger | `[IN_OR_OUT]` |
| 10 | `CrowdMode` | Crowd animation (cosmetic) | — |
| 11 | `Slope` | Elevation gradient | `[SLOPE_PER (gradient%), SLOPE_LENGTH]` |

#### CourseParam (per-element data structure)

```csharp
[Serializable]
public class CourseParam {
    public CourseParamType _paramType;      // which type this element is
    public float          _distance;        // meters from start gate
    public float          _distanceOffsetPerLane;  // per-lane distance adjustment
    public int[]          _values;          // type-specific payload (see above)

    // Static helper for slope extraction:
    // GetSlopeValue(values, out float slopePer, out SlopeType slopeType, out float slopeLength)
    //   slopePer:    gradient in % (e.g., 2.0 = 2% grade)
    //   slopeType:   Up=1, Down=2
    //   slopeLength: length in meters
}
```

#### CourseEventManager (wrapper that filters + caches the array)

```csharp
public class CourseEventManager {
    private CourseEventParam _eventParam;
    private float _firstCornerDistance;

    void Init(CourseParamTable courseParamTable);

    // Filtered accessors — each returns only the matching param type:
    CourseParam[] GetCourseEventCorner();        // _paramType == Corner
    CourseParam[] GetCourseEventStraight();     // _paramType == Straight
    CourseParam[] GetCourseEventSlope();        // _paramType == Slope

    // Additional accessors:
    float GetFirstCornerDistance();
    bool IsExistLastStraightEvent { get; }
    float FirstBgmStopDistance { get; }
    float SecondBgmPlayDistance { get; }
}
```

#### RacePhaseCalculator (phase boundaries)

```csharp
public class RacePhaseCalculator {
    // Hardcoded section counts (in DLL data section, extractable):
    public const int PHASE_START_SECTION;   // # of sections in Early phase
    public const int PHASE_MIDDLE_SECTION;  // # of sections in Mid phase
    public const int PHASE_END_SECTION;     // # of sections in Late phase
    public const int PHASE_LAST_SECTION;    // # of sections in Last Spurt

    private float _courseOnlyDistance;  // track distance excluding run-up
    private float _runUpDistance;       // gate-to-start distance

    // Computed phase boundaries (meters from actual start):
    public float PhaseStartStartDistance   { get; private set; }  // Early start
    public float PhaseMiddleStartDistance  { get; private set; }  // Mid start
    public float PhaseEndStartDistance     { get; private set; }  // Late start
    public float PhaseLastStartDistance    { get; private set; }  // Last Spurt start

    void Init(float courseDistance, float runUpDistance, float sectionDistance);
    HorsePhase GetPhaseByDistance(float distance);
    void GetPhaseDistance(HorsePhase phase, out float startDis, out float endDis);
}
```

#### HorsePhase enum

| Value | Enum | Our label | Maps to phase ID |
|-------|------|-----------|-------------------|
| -1 (0xFFFFFFFF) | `RunUp` | Before gate | — |
| 0 | `Start` | Early (序盤) | 0 |
| 1 | `MiddleRun` | Mid (中盤) | 1 |
| 2 | `End` | Late (終盤) | 2 |
| 3 | `Last` | Last Spurt (追込) | 3 |
| 4 | `Finished` | Post-race | — |

#### Extraction Method

Two approaches to get actual track values:

**Approach A — Unity asset extraction (preferred, one-time):**
1. Use AssetStudio / AssetRipper to open the course prefab bundles
2. Deserialize `CourseParamTable` components for each `course_set_id`
3. Parse `CourseParam[]` → extract corners, straights, slopes by `_paramType`
4. Run `RacePhaseCalculator.Init()` with known `courseDistance` and `runUpDistance` from `RaceCourseSet` master data → get all phase boundaries
5. Output per-course JSON

**Approach B — Manual curation (fallback):**
- Hard-code the ~14 JRA tracks from known real-world layouts
- Phase boundaries computed via `RacePhaseCalculator` constants extracted from DLL data section
- Corners/slopes positioned from track maps, verified against `_firstCornerDistance` and other DLL constants

**Track data is extracted once and never re-extracted** unless a new track is added (~1-2 per year). Phase boundaries are per-track constants — same across all scenarios and 4+ years of content.

**Update (2026-06-22):** Track geometry data discovered at `https://gametora.com/data/umamusume/racetracks.<hash>.json` — a single JSON file containing all 138 courses across 17 track groups. Processed by `scripts/process_tracks.py` → `data/track_data/tracks.json`. No asset extraction needed. See `data.md` for details.

### 1b. Supporting Enums & Types (DLL Reference)

Documented from the v2.28.0 IL2CPP dump. These types appear across the race simulation and master data layers.

#### Core Enums

```csharp
// Maps to our phase IDs 0-3
enum HorsePhase { RunUp = -1, Start = 0, MiddleRun = 1, End = 2, Last = 3, Finished = 4 }

// Ground / surface
enum GroundType      { Undefined = 0, Turf = 1, Dirt = 2 }
enum GroundCondition { Good = 1, SlightlyHeavy = 2, Heavy = 3, Bad = 4 }

// Distance categories
enum CourseDistanceType { Undefined = 0, Short = 1, Mile = 2, Middle = 3, Long = 4 }

// Turn direction
enum Rotation { Undefined = 0, Right = 1, Left = 2, StraightRight = 3, StraightLeft = 4 }

// Running styles
enum RunningStyle   { None = 0, Nige = 1, Senko = 2, Sashi = 3, Oikomi = 4 }
enum RunningStyleEx { None = 0, Oonige = 1 }  // "Big Runner" — even more extreme front-running

// Slope
enum SlopeType { Null = 0, Up = 1, Down = 2 }

// Lane position (for near_count / lane_type condition tokens)
enum LaneType { Uti = 0, Naka = 1, Soto = 2, Oosoto = 3 }

// Course variant (inner/outer)
enum CourseAround { Undefined = 0, None = 1, Inner = 2, Outer = 3, OuterToInner = 4 }

// Horse stats proper grade
enum ProperGrade { Null = 0, G = 1, F = 2, E = 3, D = 4, C = 5, B = 6, A = 7, S = 8 }

// Proper stat category
enum ProperExpCategory { None = 0, Ground = 1, RunningStyle = 2, Distance = 3 }
```

#### RaceCourseSet (master.mdb table, confirmed in DLL)

```csharp
public sealed class RaceCourseSet : IRaceCourseInfo {
    int  Id;                          // course_set_id (PK)
    int  RaceTrackId;                 // 10001=Sapporo ... 10105=Morioka
    int  Distance;                    // meters (e.g., 2400)
    int  Ground;                      // 1=turf, 2=dirt
    int  Inout;                       // inner/outer variant
    int  Turn;                        // 1=right, 2=left
    bool TightTrack;                  // is_tight_track flag
    bool RunOutside;                  // run_outside flag
    int  ExCamera;                    // extra camera index
    int  RunUp;                       // run-up distance in meters
    int  FenceSet;                    // fence set ID
    int  FloatLaneMax;                // max lane count
    int  CourseSetStatusId;           // FK → RaceCourseSetStatus
    int  FinishTimeMin;               // finish time window (ms)
    int  FinishTimeMinRandomRange;
    int  FinishTimeMax;
    int  FinishTimeMaxRandomRange;

    int  GetCourseDistanceWithRunUp();        // Distance + RunUp
    CourseDistanceType GetDistanceType();     // Short/Mile/Middle/Long from Distance
}
```

#### RaceHorseData (network/PvP data structure — MessagePack serializable)

```csharp
public class RaceHorseData {
    long viewer_id;
    int  chara_id, card_id, rarity, talent_level;
    int  frame_order;                         // gate position
    SkillData[] skill_array;                  // equipped skills
    int  stamina, speed, pow, guts, wiz;      // stats
    int  running_style;                       // Nige/Senko/Sashi/Oikomi
    int  proper_distance_short, proper_distance_mile, proper_distance_middle, proper_distance_long;
    int  proper_running_style_nige, proper_running_style_senko, proper_running_style_sashi, proper_running_style_oikomi;
    int  proper_ground_turf, proper_ground_dirt;
    int  motivation;                          // 1-5
    int  fan_count;
    RaceHorseDataRaceResult[] race_result_array;
    ScenarioData[] scenario_data_array;
    // ... additional fields
}
```

#### SkillTrigger Hierarchy (complete — 158 classes from v2.28.0)

All in `StandaloneSimulator` namespace. 6 abstract bases, 2 interfaces/infrastructure, 150+ concrete evaluators. Each condition token maps to a concrete class.

**Abstract Base Classes**

```
ISkillTrigger (interface)
└── SkillTriggerBase                           ← root evaluator base
    ├── SkillTriggerParamBase                  ← single int param: keyword op valueRh
    ├── SkillTriggerParamBaseFloat             ← single float param
    │   └── SkillTriggerParamBaseInputFloat    ← input-typed float param
    ├── SkillTriggerDistanceBase               ← random activation within distance range
    ├── SkillTriggerDistanceSetBase            ← fixed distance set (multiple zones)
    ├── SkillTriggerSlopeRandom                ← slope random base
    │   └── SkillTriggerSlopeRandomLaterHalf   ← slope random later-half base
    ├── SkillTriggerPhaseFinalCornerRandom     ← final corner random in phase base
    └── SkillTriggerCharacterActivateAdvantageSkillBase  ← "other chara skill" base
```

**Concrete Trigger Classes — organized by functional group**

Each group matches a section in the condition string parser (Section 1e).

*Group 1 — Spatial / Phase (30 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerCorner` | ParamBase | `corner!=0`, `corner==N` |
| `SkillTriggerCornerRandom` | DistanceBase | `corner_random==N` |
| `SkillTriggerPhaseCornerRandom` | DistanceBase | `phase_corner_random==N` |
| `SkillTriggerPhaseLatterHalfCornerRandom` | PhaseCornerRandom | `phase_laterhalf_corner_random==N` |
| `SkillTriggerAllCornerRandom` | DistanceSetBase | `all_corner_random==1` (4 rolls) |
| `SkillTriggerFinalCorner` | ParamBase | `is_finalcorner==1` |
| `SkillTriggerFinalCornerRandom` | DistanceBase | `is_finalcorner_random==1` |
| `SkillTriggerFinalCornerLaterHalf` | ParamBase | `is_finalcorner_laterhalf==1` |
| `SkillTriggerFinalCornerRandomPhaseMiddle` | PhaseFinalCornerRandom | final corner random in mid |
| `SkillTriggerFinalCornerRandomPhaseEnd` | PhaseFinalCornerRandom | final corner random in end |
| `SkillTriggerCourseCornerCount` | ParamBase | `corner_count==N` |
| `SkillTriggerCourseRotation` | ParamBase | `rotation==N` |
| `SkillTriggerStraightRandom` | DistanceBase | `straight_random==1` |
| `SkillTriggerWhileInStraightRandom` | DistanceBase | straight position random while in |
| `SkillTriggerPhaseStraightRandom` | DistanceBase | `phase_straight_random==N` |
| `SkillTriggerPhaseLatterHalfStraightRandom` | PhaseStraightRandom | `phase_later_half_straight_random==N` |
| `SkillTriggerPhaseFirstHalfStraightRandom` | PhaseStraightRandom | `phase_first_half_straight_random==N` |
| `SkillTriggerLastStraightRandom` | DistanceBase | `last_straight_random==1` |
| `SkillTriggerLastStraightOneTime` | Base | `is_last_straight_onetime==1` |
| `SkillTriggerLastStraight` | Base | `is_last_straight==1` |
| `SkillTriggerStraightFrontType` | ParamBase | `straight_front_type==N` |
| `SkillTriggerSlope` | ParamBase | `slope==N` |
| `SkillTriggerUpSlopeRandom` | SlopeRandom | `up_slope_random==1` |
| `SkillTriggerDownSlopeRandom` | SlopeRandom | `down_slope_random==1` |
| `SkillTriggerUpSlopeRandomLaterHalf` | SlopeRandomLaterHalf | `up_slope_random_later_half==1` |
| `SkillTriggerDownSlopeRandomLaterHalf` | SlopeRandomLaterHalf | `down_slope_random_later_half==1` |
| `SkillTriggerPhase` | ParamBase | `phase==N` |
| `SkillTriggerPhaseFirstHalf` | DistanceBase | `phase_firsthalf==N` |
| `SkillTriggerPhaseFirstQuarter` | DistanceBase | `phase_firstquarter==N` |
| `SkillTriggerPhaseLaterHalf` | DistanceBase | `phase_laterhalf==N` |

*Group 2 — Phase (continued) / Random Timing (11 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerPhaseLaterQuarter` | DistanceBase | `phase_laterquarter==N` |
| `SkillTriggerPhaseRandom` | DistanceBase | `phase_random==N` |
| `SkillTriggerPhaseLaterHalfRandom` | DistanceBase | `phase_laterhalf_random==N` |
| `SkillTriggerPhaseFirstHalfRandom` | DistanceBase | `phase_firsthalf_random==N` |
| `SkillTriggerPhaseFirstQuarterRandom` | DistanceBase | `phase_firstquarter_random==N` |
| `SkillTriggerAllPhaseRandom` | PhaseRandom | all-phase random (RANDOM_PHASES array) |
| `SkillTriggerDistanceRateAfterRandom` | DistanceBase | `distance_rate_after_random==N` |
| `SkillTriggerFurlong` | ParamBase | furlong position |
| `SkillTriggerFurlongRandom` | DistanceBase | `furlong_random==N` |
| `SkillTriggerIsLastSpurt` | ParamBase | `is_lastspurt==1` |
| `SkillTriggerLastSpurt` | ParamBase | `lastspurt==N` (0/1/2 stamina check) |

*Group 3 — Distance / Track (14 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerCourseDistanceType` | ParamBase | `distance_type==N` |
| `SkillTriggerCourseDistance` | ParamBase | `course_distance==N` |
| `SkillTriggerCourseBasisDistance` | ParamBase | `is_basis_distance==N` |
| `SkillTriggerRaceTrackId` | ParamBase | `track_id==N` |
| `SkillTriggerRaceTightTrack` | ParamBase | `is_tight_track==1` |
| `SkillTriggerGroundType` | ParamBase | `ground_type==N` |
| `SkillTriggerGroundCondition` | ParamBase | `ground_condition==N` |
| `SkillTriggerWeather` | ParamBase | `weather==N` |
| `SkillTriggerSeason` | ParamBase | `season==N` |
| `SkillTriggerTime` | ParamBase | `time==N` |
| `SkillTriggerGrade` | ParamBase | `grade==N` |
| `SkillTriggerIsDirtGrade` | ParamBase | `is_dirtgrade==1` |
| `SkillTriggerAbroad` | ParamBase | `is_abroad==1` |
| `SkillTriggerMonth` | ParamBase | month (season variant) |

*Group 4 — Horse Progress / Distance Tracking (8 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerHorseDistanceRate` | ParamBase | `distance_rate>=N` |
| `SkillTriggerHorseRemainDistance` | ParamBase | `remain_distance>=N` |
| `SkillTriggerHorseDistance` | ParamBase | total distance traveled |
| `SkillTriggerHorseViewerIdRemainDistance` | ParamBase | remain distance for viewer |
| `SkillTriggerHorseDistanceDiffRate` | ParamBase | `distance_diff_rate<=N` |
| `SkillTriggerRaceAccumulateTime` | ParamBase | `accumulatetime>=N` |
| `SkillTriggerRaceAccumulateTimeRandom` | ParamBase | accumulate time random |
| `SkillTriggerRaceId` | ParamBase | specific race ID |

*Group 5 — Position / Order (20 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerOrder` | ParamBase | `order<=N` |
| `SkillTriggerOrderRate` | ParamBase | `order_rate<=N` |
| `SkillTriggerOrderRateLastSpurt` | ParamBase | order rate in last spurt |
| `SkillTriggerOrderLastSpurt` | ParamBase | order in last spurt |
| `SkillTriggerOrderRateFinalCornerEnd` | ParamBase | `order_rate_finalcorner_end<=N` |
| `SkillTriggerOrderFinalCornerEnd` | ParamBase | `order_finalcorner_end<=N` |
| `SkillTriggerOrderRateInContinue` | ParamBase | `order_rate_inXX_continue==1` |
| `SkillTriggerOrderRateOutContinue` | ParamBase | `order_rate_outXX_continue==1` |
| `SkillTriggerChangeOrderOneTime` | ParamBase | `change_order_onetime<0` |
| `SkillTriggerChangeOrder` | ParamBase | generic order change |
| `SkillTriggerChangeOrderUpPhaseMiddle` | ParamBase | `change_order_up_middle>=N` |
| `SkillTriggerChangeOrderUpPhaseEndAfter` | ParamBase | `change_order_up_end_after>=N` |
| `SkillTriggerChangeOrderUpCorner` | ParamBase | order up in corner |
| `SkillTriggerChangeOrderUpLastSpurt` | ParamBase | order up in last spurt |
| `SkillTriggerChangeOrderUpFinalCornerAfter` | ParamBase | `change_order_up_finalcorner_after>=N` |
| `SkillTriggerChangeOrderUpLaterHalf` | ParamBase | order up in later half |
| `SkillTriggerChangeOrderDownPhaseMiddle` | ParamBase | order down in mid |
| `SkillTriggerChangeOrderDownPhaseEndAfter` | ParamBase | order down in end |
| `SkillTriggerChangeOrderDownCorner` | ParamBase | order down in corner |
| `SkillTriggerChangeOrderDownLastSpurt` | ParamBase | order down in last spurt |

*Group 6 — Position / Order (continued) (9 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerChangeOrderDownFinalCornerAfter` | ParamBase | order down after final corner |
| `SkillTriggerChangeOrderDownLaterHalf` | ParamBase | order down in later half |
| `SkillTriggerPopularity` | ParamBase | `popularity==N` |
| `SkillTriggerPopularityRate` | ParamBase | popularity rate |
| `SkillTriggerGateNumber` | ParamBase | gate number |
| `SkillTriggerGateNumberRate` | ParamBase | gate number rate |
| `SkillTriggerPostNumber` | ParamBase | `post_number<=N` |
| `SkillTriggerPostNumberRate` | ParamBase | post number rate |
| `SkillTriggerOvertake` | ParamBase | `is_overtake==1` |

*Group 7 — Opponent Distance (12 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerDistanceDiffTop` | ParamBase | `distance_diff_top>=N` (meters) |
| `SkillTriggerDistanceDiffTopFloat` | ParamBaseInputFloat | `distance_diff_top_float<=N` (decimeters) |
| `SkillTriggerDistanceDiffInfront` | ParamBase | distance to closest ahead |
| `SkillTriggerDistanceDiffBehind` | ParamBase | distance to closest behind |
| `SkillTriggerBashinDiffInfront` | ParamBaseFloat | `bashin_diff_infront<=N` (horse lengths) |
| `SkillTriggerBashinDiffBehind` | ParamBaseFloat | `bashin_diff_behind<=N` (horse lengths) |
| `SkillTriggerOvertakeTargetContinueTime` | ParamBase | `overtake_target_time>=N` |
| `SkillTriggerOvertakeTargetHaveNoOrderUpContinueTime` | ParamBase | `overtake_target_no_order_up_time>=N` |
| `SkillTriggerOvertakeTargetHaveNoOrderDownContinueTime` | ParamBase | overtake target no order down |
| `SkillTriggerHorseInfrontNearTime` | ParamBase | `infront_near_lane_time>=N` |
| `SkillTriggerHorseBehindNearTime` | ParamBase | `behind_near_lane_time>=N` |
| `SkillTriggerHorseBehindNearLaneTime` | ParamBase | `behind_near_lane_time_set1>=N` |

*Group 8 — Lane / Surroundings (13 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerLaneType` | ParamBase | `lane_type==N` |
| `SkillTriggerLanePer` | ParamBase | lane percentage |
| `SkillTriggerMoveLane` | ParamBase | `is_move_lane==N` |
| `SkillTriggerHorseInfrontNearLaneTime` | ParamBase | infront + near lane time |
| `SkillTriggerHorseBehindNearLaneTimeParamSet` | ParamBase | behind + near lane time param set |
| `SkillTriggerHorseBehindIn` | ParamBase | `is_behind_in==1` |
| `SkillTriggerHorseBehindOut` | ParamBase | behind out |
| `SkillTriggerOtherHorseBehind` | ParamBase | other horse behind |
| `SkillTriggerNearHorseCount` | ParamBase | `near_count>=N` |
| `SkillTriggerNearAroundAccumulateTime` | ParamBase | near around accumulate time |
| `SkillTriggerNearFrontHorseCount` | ParamBase | `near_infront_count==N` |
| `SkillTriggerNearBehindHorseCount` | ParamBase | near behind count |
| `SkillTriggerVisibleHorse` | ParamBase | `visiblehorse>=N` |

*Group 9 — Blocking / Surrounded (8 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerBeBlocked` | ParamBase | general block check |
| `SkillTriggerBeBlockedFront` | ParamBase | `blocked_front==1` |
| `SkillTriggerBeBlockedSide` | ParamBase | `blocked_side==1` |
| `SkillTriggerBeBlockedAllContinueTime` | ParamBase | `blocked_all_continuetime>=N` |
| `SkillTriggerBeBlockedFrontContinueTime` | ParamBase | `blocked_front_continuetime>=N` |
| `SkillTriggerBeBlockedSideContinueTime` | ParamBase | `blocked_side_continuetime>=N` |
| `SkillTriggerBeBlockedFrontHpEmpty` | ParamBase | blocked front + HP empty |
| `SkillTriggerBeBlockedFrontHpEmptyContinueTime` | ParamBase | blocked front + HP empty time |
| `SkillTriggerSurrounded` | ParamBase | `is_surrounded==1` |

*Group 10 — Running Style (9 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerRunningStyle` | ParamBase | `running_style==N` |
| `SkillTriggerIsRunningStyleCountMax` | ParamBase | running style count is max |
| `SkillTriggerRunningStyleCount` | ParamBase | count of this running style |
| `SkillTriggerRunningStyleCountOtherSelf` | ParamBase | count of OTHER running styles |
| `SkillTriggerRunningStyleCountSame` | ParamBase | same running style count |
| `SkillTriggerRunningStyleCountSameRate` | ParamBase | same running style count rate |
| `SkillTriggerRunningStyleEqualPopularityOne` | ParamBase | running style == most popular |
| `SkillTriggerPopularityTopIconNum` | ParamBase | popularity top icon count |
| `SkillTriggerPopularityIconNum` | ParamBase | popularity icon count |

*Group 11 — Stat / HP (11 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerBaseSpeed` | ParamBase | `base_speed>=N` |
| `SkillTriggerBaseStamina` | ParamBase | `base_stamina>=N` |
| `SkillTriggerBasePower` | ParamBase | `base_power>=N` |
| `SkillTriggerBaseGuts` | ParamBase | `base_guts>=N` |
| `SkillTriggerBaseWiz` | ParamBase | `base_wiz>=N` |
| `SkillTriggerHp` | ParamBaseFloat | HP value |
| `SkillTriggerHpPer` | ParamBase | `hp_per<=N` |
| `SkillTriggerHpEmpty` | ParamBase | HP empty check |
| `SkillTriggerHpEmptyOneTime` | Base | `is_hp_empty_onetime==1` |
| `SkillTriggerCurrentSpeed` | ParamBase | current speed |
| `SkillTriggerSpeedOrder` | ParamBase | speed order ranking |

*Group 12 — Skill Activation / Interaction (13 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerActivateCountPhase` | ParamBase | `activate_count_X>=N` (per phase) |
| `SkillTriggerActivateCountLaterHalf` | ParamBase | `activate_count_later_half>=N` |
| `SkillTriggerActivateCount` | ParamBase | `activate_count_all>=N` |
| `SkillTriggerActivateCountAllTeam` | ParamBase | `activate_count_all_team>=N` |
| `SkillTriggerActivateSpeedSkillCount` | ParamBase | speed skill activate count |
| `SkillTriggerActivateHealSkillCount` | ParamBase | `activate_count_heal>=N` |
| `SkillTriggerIsActivateAnySkill` | ParamBase | `is_activate_any_skill==1` |
| `SkillTriggerIsActivateHealSkill` | ParamBase | `is_activate_heal_skill==1` |
| `SkillTriggerActivateSkillTagGroup` | ParamBase | activate skill by tag group |
| `SkillTriggerActivateOtherSkillDetail` | ParamBase | `is_activate_other_skill_detail==1` |
| `SkillTriggerOtherCharacterActivateAdvantageSkill` | CharActivateAdvantageSkillBase | `is_other_character_activate_advantage_skill==N` |
| `SkillTriggerPopularityTopCharacterActivateAdvantageSkill` | CharActivateAdvantageSkillBase | popularity top chara advantage skill |
| `SkillTriggerSameSkillHorseCount` | ParamBase | `same_skill_horse_count==N` |

*Group 13 — Temptation / Start / Misc (10 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerTemptationCount` | ParamBase | `temptation_count==N` |
| `SkillTriggerTemptationBehind` | ParamBase | temptation behind |
| `SkillTriggerTemptationInfront` | ParamBase | temptation infront |
| `SkillTriggerTemptation` | ParamBase | `is_temptation==N` |
| `SkillTriggerRunningStyleTemptationCount` | ParamBase | running style temptation count |
| `SkillTriggerCompeteFightCount` | ParamBase | `compete_fight_count>0` |
| `SkillTriggerGoodStart` | ParamBase | good start check |
| `SkillTriggerBadStart` | ParamBase | `is_badstart==N` |
| `SkillTriggerFinalGradeHigherCount` | ParamBase | final grade higher count |
| `SkillTriggerFinalGradeLowerCount` | ParamBase | final grade lower count |

*Group 14 — Special / Fixed (7 classes)*

| Class | Base | Condition token(s) |
|-------|------|--------------------|
| `SkillTriggerAlways` | ParamBase | `always==1` |
| `SkillTriggerRandomLot` | ParamBase | `random_lot==N` |
| `SkillTriggerRandomLotOtherActivate` | Base | random lot after other activate |
| `SkillTriggerExistCharaId` | ParamBase | `is_exist_chara_id==N` |
| `SkillTriggerRunAtFullSpeedRandom` | DistanceBase | `run_at_full_speed_random==1` |
| `SkillTriggerUsedParticularSkillId` | Base | `is_used_skill_id==N` |
| `SkillTriggerUsedParticularSkillIdWithDetailIndex` | Base | used skill ID with detail index |
| `SkillTriggerMotivation` | ParamBase | `motivation>=N` |

**Condition Parser Infrastructure**

| Type | Kind | Role |
|------|------|------|
| `ISkillTrigger` | interface | `{ bool IsActivated { get; }; void Update(float dt); }` |
| `SkillTriggerNull` | class : ISkillTrigger | No-op trigger (singleton instance) |
| `SkillTriggerBuildInfo` | class | Parsed condition: `{ SkillTriggerOperator op; int valueRh; }` |
| `SkillTriggerCreatorSimulate` | class | **The condition string parser.** `Parse2Context(string text, out TriggerContext)` → parses `keyword==value` tokens. `CreateTriggerTagList(int skillId)` → returns `List<ISkillTrigger>` for a skill. Uses `&`=AND (`SEPARATOR_AND`), `@`=OR (`SEPARATOR_OR`). |
| `SkillTriggerOperator` | enum | `Equal=0, NotEqual=1, Greater=2, GreaterEqual=3, Lesser=4, LesserEqual=5` |
| `TriggerContext` | struct | `{ string Keyword; SkillTriggerOperator Op; int ValueRh; }` — maps to our `condition_1`/`condition_2` parsing |
| `TriggerTextIndex` | enum | `ValueLh=0, Operator=1, ValueRh=2` — position in tokenized condition string |
| `SkillTriggerType` | static class | `USE_SKILL_DETAIL_COOLDOWN_TIME_TRIGGER_LIST`, `ONLY_SHOW_SKILL_PLATE_AND_EFFECT_SKILL_TRIGGER_TYPE_LIST` |
| `SkillTriggerBase` | static class | `TriggerTagCreateFunc` dictionary — maps keyword→trigger factory |
| `SkillTriggerPhase` | static class | `PHASE_2_TAG_DIC` — phase ID→tag mapping |
| `SkillTriggerAllPhaseRandom` | static class | `RANDOM_PHASES` — `HorsePhase[]` used by all-phase random |
| `SkillDefineStatic` | static class | `NORMAL_AND_RARE_SKILL_RARITY_ARRAY`, `RARE_SKILL_RARITY_ARRAY`, `ORDER_IN_PER`, `ORDER_OUT_PER` |
| `SkillDefine` | static class | Constants: `SKILL_TRIGGER_KEYWORD_ALWAYS` and other trigger keyword strings |

**Key insight:** `SkillTriggerCreatorSimulate.Parse2Context()` is the game's actual condition string parser. It tokenizes on `@` (SEPARATOR_OR) and `&` (SEPARATOR_AND), then `Str2Operator()` maps `==`/`>=`/`<=`/`!=`/`>`/`<` to `SkillTriggerOperator` enum values. Each `TriggerContext` (keyword + op + valueRh) is used by `SkillTriggerBase.TriggerTagCreateFunc` to instantiate the correct `SkillTrigger*` class. Our condition parser (Section 1e) should mirror this logic exactly.

### 1c. Skill Data Import (master.mdb)

Normalized schema:

| Table | Row count (est.) | Source |
|-------|------------------|--------|
| `characters` | ~100 | `chara_data` |
| `cards` | ~400 | `card_data` |
| `skills` | ~5000 | `skill_data` |
| `skill_triggers` | ~8000 | Parse `condition_1`, `condition_2` |
| `skill_effects` | ~12000 | Parse `ability_type_X_Y`, `float_ability_value_X_Y` |
| `card_skills` | ~8000 | `available_skill_set` + `skill_upgrade_description` |
| `support_cards` | ~500 | `support_card_data` |
| `support_card_effects` | ~30000 | `support_card_effect_table` + `support_card_unique_effect` |
| `support_card_skills` | ~3000 | `support_card_data → skill_set` (unpivot 20 columns) |

### 1d. Skill Discovery (6 Sources)

| Source | Path | Reliability |
|--------|------|-------------|
| Card regular skills | `card_data → available_skill_set` | ✅ FK join |
| Evolved uniques | `card_data → skill_upgrade_description` | ✅ FK join |
| Base uniques | ID pattern: `skill_id / 10 = 10000 + (chara_id % 1000)`, rarity≥5 | ⚠️ Pattern match |
| Inherited versions | `base_skill_id + 800000` from all sources | ⚠️ Convention |
| Back-references | `unique_skill_id_1` from inherited → original | ⚠️ Indirect |
| Support card skills | `support_card_data → skill_set` (unpivot) | ✅ FK join |

**Rule:** FK joins first. Pattern match as fallback. Log warnings for pattern-only finds.

### 1e. Condition String Parser

Full reference from GameTora skill condition documentation. Every token in `precondition_1`, `condition_1`, `condition_2` is covered.

**Spatial / Phase Tokens**

| Raw token | Column | Values |
|-----------|--------|--------|
| `phase==N` | `phase` | 0=Early 1=Mid 2=Late 3=Last Spurt |
| `phase_random==N` | `phase_position` | `'phase_random:N'` |
| `phase_firsthalf==N` | `phase_position` | `'firsthalf:N'` |
| `phase_laterhalf==N` | `phase_position` | `'laterhalf:N'` |
| `phase_firstquarter==N` | `phase_position` | `'firstquarter:N'` |
| `phase_firsthalf_random==N` | `phase_position` | `'firsthalf_random:N'` |
| `phase_laterhalf_random==N` | `phase_position` | `'laterhalf_random:N'` |
| `phase_firstquarter_random==N` | `phase_position` | `'firstquarter_random:N'` |
| `phase_corner_random==N` | `phase_position` | `'corner_random:N'` |
| `phase_straight_random==N` | `phase_position` | `'straight_random:N'` |
| `phase_first_half_straight_random==N` | `phase_position` | `'first_half_straight_random:N'` |
| `phase_latter_half_straight_random==N` | `phase_position` | `'latter_half_straight_random:N'` |
| `corner!=0` | `corner_condition` | TRUE |
| `corner==N` | `corner` | 1-4 |
| `corner_random==N` | `corner_position` | `'corner_random:N'` |
| `corner_count==N` | (meta) | Track has N corners |
| `all_corner_random==1` | `corner_position` | `'all_corner_random'` (4 rolls) |
| `is_finalcorner==1` | `is_final_corner` | TRUE | **⚠️ Includes the final straight, not just the corner!** |
| `is_finalcorner_laterhalf==1` | `is_final_corner_laterhalf` | TRUE |
| `is_finalcorner_random==1` | `corner_position` | `'finalcorner_random'` |
| `is_last_straight==1` | `is_last_straight` | TRUE |
| `is_last_straight_onetime==1` | `is_last_straight_onetime` | TRUE |
| `last_straight_random==1` | `straight_position` | `'last_straight_random'` |
| `straight_random==1` | `straight_position` | `'any_straight_random'` |
| `straight_front_type==N` | `straight_front_type` | 1=grandstand 2=opposite |
| `is_lastspurt==1` | `is_last_spurt` | TRUE |
| `lastspurt==N` | `lastspurt` | 0=can't finish 1=above base 2=full |
| `run_at_full_speed_random==1` | `run_at_full_speed_random` | TRUE |

**Distance / Track Tokens**

| Raw token | Column | Values |
|-----------|--------|--------|
| `distance_type==N` | `distance_type` | 1=sprint 2=mile 3=medium 4=long |
| `course_distance==N` | `course_distance` | Exact meters |
| `remain_distance==M` | `remain_distance` | Meters remaining |
| `distance_rate>=N` | `distance_rate` | Race progress % |
| `distance_rate_after_random==N` | `distance_rate_after_random` | Random after N% |
| `ground_type==N` | `ground_type` | 1=turf 2=dirt |
| `ground_condition==N` | `ground_condition` | 1=good 2=slightly heavy 3=heavy 4=bad |
| `track_id==N` | `track_id` | 10001=Sapporo ... 10105=Morioka |
| `is_tight_track==1` | `is_tight_track` | TRUE |
| `is_basis_distance==N` | `is_basis_distance` | 0=non-core 1=core (÷400) |
| `is_abroad==1` | `is_abroad` | TRUE |
| `rotation==N` | `rotation` | 1=right 2=left |
| `grade==N` | `grade` | 100=G1 ... 999=daily |
| `is_dirtgrade==1` | `is_dirtgrade` | TRUE |
| `season==N` | `season` | 1=spring 2=summer 3=fall 4=winter 5=cherry blossom |
| `weather==N` | `weather` | 1=sunny 2=cloudy 3=rainy 4=snowy |
| `time==N` | `time` | 0=any 1=morning 2=daytime 3=evening 4=night |

**Position / Opponent Tokens**

| Raw token | Column | Values |
|-----------|--------|--------|
| `order<=N` | `order_max` | Exact position |
| `order_rate<=N` | `order_rate_max` | % of field (rounded to int first!) |
| `order_rate_in20_continue==1` | `order_rate_continue` | `'in20'` |
| `order_rate_in40_continue==1` | `order_rate_continue` | `'in40'` |
| `order_rate_in50_continue==1` | `order_rate_continue` | `'in50'` |
| `order_rate_in80_continue==1` | `order_rate_continue` | `'in80'` |
| `order_rate_out20_continue==1` | `order_rate_continue` | `'out20'` |
| `order_rate_out40_continue==1` | `order_rate_continue` | `'out40'` |
| `order_rate_out50_continue==1` | `order_rate_continue` | `'out50'` |
| `order_rate_out70_continue==1` | `order_rate_continue` | `'out70'` |
| `near_count>=N` | `near_count_min` | ≤3m ahead/behind + ≤3 lanes |
| `near_infront_count==N` | `near_infront_count` | ≤2.5m ahead |
| `distance_diff_top>=M` | `distance_diff_top` | Meters behind 1st |
| `distance_diff_top_float<=M` | `distance_diff_top_dm` | Decimeters behind 1st (÷10=m) |
| `distance_diff_rate<=N` | `distance_diff_rate` | Position % between 1st and last |
| `bashin_diff_infront<=N` | `bashin_diff_infront` | Horse lengths to closest ahead |
| `bashin_diff_behind<=N` | `bashin_diff_behind` | Horse lengths to closest behind |
| `lane_type==N` | `lane_type` | inner≤0.2<middle≤0.4<outer≤0.6<outside |
| `is_move_lane==N` | `is_move_lane` | 1=closer to fence 2=further |
| `is_behind_in==1` | `is_behind_in` | Uma behind is closer to fence |
| `is_surrounded==1` | `is_surrounded` | Blocked front/back/side |
| `blocked_front==1` | `blocked_front` | TRUE |
| `blocked_front_continuetime>=N` | `blocked_front_time` | Seconds |
| `blocked_side_continuetime>=N` | `blocked_side_time` | Seconds |
| `blocked_all_continuetime>=N` | `blocked_all_time` | Seconds |
| `is_overtake==1` | `is_overtake` | Has overtake target |
| `overtake_target_time>=N` | `overtake_target_time` | Seconds being target |
| `overtake_target_no_order_up_time>=N` | `overtake_target_no_up_time` | Seconds having targets |
| `change_order_onetime<0` | `change_order_onetime` | Neg=overtook Pos=overtaken |
| `change_order_up_end_after>=N` | `change_order_up_end_after` | Overtakes Late-Race+ |
| `change_order_up_middle>=N` | `change_order_up_middle` | Overtakes Mid-Race |
| `change_order_up_finalcorner_after>=N` | `change_order_up_finalcorner_after` | Overtakes after Final Corner |
| `post_number<=N` | `post_number` | Gate block |
| `popularity==N` | `popularity` | Popularity rank |
| `running_style==N` | `running_style` | 1=Front Runner 2=Pace Chaser 3=Late Surger 4=End Closer |
| `visiblehorse>=N` | `visiblehorse` | Girls in field of vision |

**Stat / HP Tokens**

| Raw token | Column | Values |
|-----------|--------|--------|
| `base_speed>=N` | `min_speed` | |
| `base_stamina>=N` | `min_stamina` | |
| `base_power>=N` | `min_power` | |
| `base_guts>=N` | `min_guts` | |
| `base_wiz>=N` | `min_wisdom` | |
| `hp_per<=N` | `hp_per_max` | Remaining HP % |
| `is_hp_empty_onetime==1` | `is_hp_empty` | HP was depleted |
| `motivation>=N` | `motivation` | 1=Terrible 2=Bad 3=Normal 4=Good 5=Perfect |
| `fan_count>=N` | `fan_count` | |

**Timing / Activation Tokens**

| Raw token | Column | Values |
|-----------|--------|--------|
| `accumulatetime>=N` | `accumulate_time_raw` | Seconds (track-scaled) |
| `activate_count_all>=N` | `activate_count_all` | Total skills fired |
| `activate_count_start>=N` | `activate_count_start` | Skills in Early |
| `activate_count_middle>=N` | `activate_count_middle` | Skills in Mid |
| `activate_count_end_after>=N` | `activate_count_end_after` | Skills Late+ |
| `activate_count_later_half>=N` | `activate_count_later_half` | Skills in 2nd half |
| `activate_count_heal>=N` | `activate_count_heal` | Recovery skills |
| `activate_count_all_team>=N` | `activate_count_all_team` | Team cumulative |
| `infront_near_lane_time>=N` | `infront_near_lane_time` | Seconds uma ≤2.5m ahead + 1 lane |
| `behind_near_lane_time>=N` | `behind_near_lane_time` | Seconds uma ≤2.5m behind + 1 lane |
| `behind_near_lane_time_set1>=N` | `behind_near_lane_time_set1` | Seconds uma ≤5m behind + 2.7 lanes |
| `compete_fight_count>0` | `compete_fight_count` | Showdown (追い比べ) count |
| `temptation_count==N` | `temptation_count` | Times rushed (kakari) |
| `is_temptation==N` | `is_temptation` | Currently rushing? |
| `is_badstart==N` | `is_badstart` | Late start? |

**Skill Interaction Tokens**

| Raw token | Column | Values |
|-----------|--------|--------|
| `is_activate_any_skill==1` | `is_activate_any_skill` | Any skill just fired |
| `is_activate_other_skill_detail==1` | `is_activate_other_skill_detail` | Another trigger of THIS skill fired earlier |
| `is_activate_heal_skill==1` | `is_activate_heal_skill` | Just recovered stamina |
| `is_other_character_activate_advantage_skill==N` | `other_skill_type` | Someone else's skill type N |
| `is_used_skill_id==N` | `is_used_skill_id` | Specific skill used |
| `is_exist_skill_id==N` | `is_exist_skill_id` | Someone has skill N |
| `same_skill_horse_count==N` | `same_skill_count` | Girls with this skill |

**Other Tokens**

| Raw token | Column | Values |
|-----------|--------|--------|
| `always==1` | `always_active` | TRUE |
| `random_lot==N` | `random_lot` | N% chance |
| `is_exist_chara_id==N` | `is_exist_chara_id` | Character N in race |
| `slope==N` | `slope` | 0=flat 1=uphill 2=downhill |
| `up_slope_random==1` | `slope_position` | `'uphill_random'` |
| `down_slope_random==1` | `slope_position` | `'downhill_random'` |
| `up_slope_random_later_half==1` | `slope_position` | `'uphill_random_later_half'` |

**`@` vs `&` parsing:**
- `&` = AND → all must be true simultaneously
- `@` = OR → each branch becomes its own `skill_triggers` row
- `precondition` AND `condition` are combined per trigger

**Values:** raw ÷ 10000 = display. `float_ability_value = 3500` → `+0.35`.

**Position display note:** `order_rate` is rounded to the nearest integer first. In a 9-horse race, `order_rate<=50` means 50% of 9 = 4.5, rounded = 5 → positions 1-5 qualify, not 1-4. (From community mechanics doc: `order_rate>50` in 9-horse → `9*50%=4.55` rounded → `order>5` = 6th or below.)

**Exact condition thresholds** (from community reverse-engineering, for accurate semantic display):
- `near_count`: `abs(distance_gap) < 3m` AND `abs(lane_gap) < 3 horse_lanes` (was 1.5/1.5 pre-1st-anniversary)
- `near_infront_count`: `abs(distance_gap) < 2.5m` AND same-lane-ish
- `infront_near_lane_time` / `behind_near_lane_time`: `abs(distance_gap) < 2.5m` AND `abs(lane_gap) < 1 horse_lane`, timer resets on placement change
- `is_surrounded`: ahead `0–3m ∧ <1.5 lanes` + behind `-3–0m ∧ <1.5 lanes` + outside `±1.5m ∧ 0–3 lanes`
- `blocked_front`: `0 < distance_gap < 2m` AND lane_gap within `(1.0 − 0.6 × gap/2m) × 0.75 horse_lanes`
- `bashin_diff_infront` / `bashin_diff_behind`: 1 bashin = 2.5m
- `visiblehorse`: within 20m base distance + vision cone

**Skill activation chance** (checked pre-race, wisdom-based): `max(100 − 9000/BaseWiz, 20)%`. Uses base wisdom (motivation-adjusted, before strategy proficiency). The frontend can show this as a tooltip on skills with probability-based activation.

**Duration/cooldown scaling:** Both scale by `CourseDistance / 1000`. A skill with base duration 3.0s on a 2400m track lasts `3.0 × 2.4 = 7.2s` of game time. The frontend duration bar width must account for this.

### 1f. Activation Zone Calculation

```
1. Phase window: track.phases WHERE phase = trigger.phase
2. Intersect with spatial condition:
   - corner!=0        → intersect with corners
   - is_lastspurt==1  → intersect with last spurt phase
   - no spatial       → full phase window
3. Intersect with surface/distance filter
4. Result: [{start_m, end_m, zone_label, gradient}]
5. Random-phase → shaded band, not fixed line
6. Multiply durations by track.base_time_x for game-tick accuracy
```

### 1g. Race Mechanics Reference

Key formulas and constants from community reverse-engineering (KuromiAK's "Uma Musume Race Mechanics"). These affect how we **display** skill data — not how we extract it.

#### Skill Duration & Cooldown Scaling

Both scale linearly with course distance:

```
Duration  = BaseDuration  × CourseDistance / 1000
Cooldown  = BaseCooldown  × CourseDistance / 1000
```

A 3.0s base-duration skill on a 2400m track lasts 7.2s of game time. **The frontend must apply this scaling when rendering duration bars** — the raw `float_ability_value` from master.mdb is the base value only.

#### Skill Activation Chance

Checked **before** the race (wisdom check):

```
ActivationChance = max(100 - 9000 / BaseWiz, 20) %
```

| Base Wiz | Chance |
|----------|--------|
| 300 | 70.0% |
| 600 | 85.0% |
| 900 | 90.0% |
| 1200 | 92.5% |

Uses **base** wisdom (motivation-adjusted, before strategy proficiency). This could be shown as a tooltip on skill cards in the frontend.

#### Phase = 24 Equal Sections

Phases are defined by section boundaries, not arbitrary distances:

| Phase | Sections | Fraction | 2400m example |
|-------|----------|----------|---------------|
| Early (序盤) | 1–4 | 4/24 = 1/6 | 0–400m |
| Mid (中盤) | 5–16 | 12/24 = 1/2 | 400–1600m |
| Late (終盤) | 17–20 | 4/24 = 1/6 | 1600–2000m |
| Last Spurt (追込) | 21–24 | 4/24 = 1/6 | 2000–2400m |

This confirms GameTora's phase data is correct — it's a simple mathematical split of the track distance.

#### Skill Activation Order (Frame Timing)

Each frame (0.0666s, ~15fps), the game processes:

1. Check end of corner
2. **Activate skills** ← skills fire here
3. Recover HP by skills
4. Update last spurt state
5. Update target speed
6. Calculate acceleration
7. **Update phase** ← phase changes here
8. Calculate distance/position
9. Check start of corner

**Key edge case:** A skill with `phase==1&corner==0` can activate when the horse exits a corner into the late-race on the same frame. Skill activation (step 2) happens after corner-end check (step 1) but before phase update (step 7). Our activation zone calculation should account for this: a mid-race corner skill's final activation window includes the instant the corner ends, even if that instant coincides with the phase boundary.

#### Bashin (Horse Length)

```
1 bashin = 2.5 meters
```

Used by `bashin_diff_infront` and `bashin_diff_behind` conditions. When displaying these conditions in the frontend, we can convert to meters for clarity.

#### order_rate Rounding

`order_rate` is **rounded to the nearest integer** before comparison:

```
order_rate > 50 in a 9-horse race:
  9 × 50% = 4.5  →  rounded to 5  →  order > 5 (6th place or worse)
```

This means `order_rate<=50` in a 9-horse race = top 5 positions (1st–5th), not top 4.

#### Lane Dimensions

```
1 course width  = 11.25 m
1 horse lane    = 1/18 course width ≈ 0.625 m
```

| Track | Max course width | Max horse lanes |
|-------|-----------------|-----------------|
| Tokyo turf | 1.5 | 27 |
| Most JRA turf | 1.2–1.4 | 22–25 |
| Sapporo/Hakodate/Niigata dirt | 1.1 | 20 |

Gate positions are spaced by 1 horse lane. The initial lane = `gate_number × horse_lane + adjustor` where the adjustor is 0.6 horse lanes for gates ≥10 on JRA courses (0 for Ooi, 1.86 for Longchamp gates ≥14).

#### Precise Condition Definitions

These exact thresholds matter for the condition parser's semantic display:

| Condition | Definition |
|-----------|------------|
| `near_count` | `abs(distance_gap) < 3m` AND `abs(lane_gap) < 3 horse_lanes` |
| `is_surrounded` | Horse ahead `0–3m ∧ <1.5 lanes` + behind `-3–0m ∧ <1.5 lanes` + outside `±1.5m ∧ 0–3 lanes` |
| `infront_near_lane_time` | `abs(distance_gap) < 2.5m` AND `abs(lane_gap) < 1 horse_lane` with horse 1 place ahead |
| `behind_near_lane_time` | Same thresholds, horse 1 place behind |
| `blocked_front` | `0 < distance_gap < 2m` AND lane_gap within `(1.0 - 0.6 × gap/2m) × 0.75 horse_lanes` |
| `visiblehorse` | `distance_gap ≤ visible_distance` (base 20m) AND within vision cone |

#### Base Speed Formula

```
BaseSpeed = 20.0 - (CourseDistance - 2000) / 1000  [m/s]
```

| Distance | Base Speed |
|----------|-----------|
| 1200m | 20.8 m/s |
| 2000m | 20.0 m/s |
| 2500m | 19.5 m/s |
| 3600m | 18.4 m/s |

This is the baseline from which target speed is derived per phase × strategy. Useful as track metadata — could be displayed on the track info panel.

#### Spurt Speed Carry-over

A critical mechanic that makes speed skills active near spurt start **more valuable than their face value suggests**.

**How it works:** When the last spurt begins, the horse accelerates from its current speed to its top speed. If a Target Speed skill is active at that moment, the horse accelerates from `BaseSpeed + SkillBonus` instead of just `BaseSpeed` — a headstart. Even if the speed skill expires 0.1s later, the speed gained from the headstart is **not lost** (Target Speed skills only raise the ceiling, they don't set the floor).

**The effect is equivalent to extending the speed skill's duration** by the amount of time saved during acceleration.

**Worked example** (2000m track, 1000 Power, BaseSpeed=20m/s, TopSpeed=24m/s, BaseAccel=0.424m/s²):

| Skill type | Effect | Accel time | Meters gained | vs Base |
|------------|--------|-----------|---------------|---------|
| Base (no skill) | — | 9.43s | 207.46m | — |
| White Speed | +0.15 speed | 9.08s | 208.84m | **+1.38m** |
| Gold Speed | +0.35 speed | 8.60s | 210.63m | **+3.17m** |
| White Accel | +0.20 accel | 6.41s | 213.50m | **+6.04m** |
| Gold Accel | +0.40 accel | 4.85s | 216.62m | **+9.16m** |
| Dual Unique | +0.25 speed +0.30 accel | 5.18s | 216.61m | **+9.15m** |
| Inherited Dual | +0.05 speed +0.10 accel | 7.54s | 211.43m | **+3.97m** |

**Key insights from the math:**

1. **Gold accel (+9.16m) ≈ Dual unique speed+accel (+9.15m).** The speed component of a dual unique contributes almost nothing beyond what the accel already provides — the carry-over effect is small compared to raw acceleration.

2. **Gold speed carry-over (+3.17m) is worth ~1/3 of a gold accel.** Not dominant, but meaningful — and the speed skill also provided value during its active phase before the spurt.

3. **The carry-over is proportional to the speed bonus.** A +0.35 speed skill saves `0.35 / 0.424 = 0.83s` of acceleration time. That's the "extra duration" the skill effectively gets.

4. **Speed skills that are still active as spurt starts get this bonus for free.** A mid-race speed skill that happens to overlap the spurt boundary is more valuable than one that expires 50m before it.

**What this means for our visualizer:**

| Visualizer feature | Implementation |
|--------------------|----------------|
| **Spurt-start marker** | A vertical dashed line on the track at the late→last_spurt phase boundary |
| **Carry-over indicator** | Speed skills whose duration bar crosses the spurt-start line get a 🔥 "carry-over" badge |
| **Carry-over value** | Show estimated meter gain from carry-over: `speed_bonus / base_accel × top_speed` |
| **Carry-over zone** | Highlight the acceleration phase of last spurt (first ~6-9s after spurt start depending on stats) as the "carry-over window" |
| **Skill comparison** | When comparing two decks, show which one has more skills overlapping spurt start |

**The `accumulatetime` condition** (used by some speed skills) directly leverages this: skills conditioned on `accumulatetime>=5` fire exactly 5 seconds into the race, which on many tracks aligns with a strategic position. Skills with conditions that naturally place their expiration near spurt start are implicitly better — our visualizer makes this explicit.

#### Course Events Table (confirms CourseParamType)

From the mechanics doc, the runtime course event IDs match our `CourseParamType` enum exactly:

| Event ID | Name | Additional Data | Notes |
|----------|------|----------------|-------|
| 0 | Corner | Corner Number, Distance | |
| 1 | Ground Change | — | Turf↔dirt transition |
| 2 | Straight | Start/End flag, FrontType (1=Front/Grandstand, 2=Across/Opposite, 3=False Straight) | Each straight = 2 events (start + end) |
| 3 | Lane Max Change | New max lanes | Only Nakayama 2000m + some Hanshin |
| 7 | Move Lane Point | In/Out | Only Niigata 1000m |
| 11 | Slope | SlopePer (gradient%), Length | |

#### Finish Time Display

```
DisplayTime = ActualTime × 1.18
```

Each track has a lower/upper bound on display time (stored in `race_course_set.FinishTimeMin`/`Max`). If a horse breaks the lower bound, the displayed time is the bound ± up to 1 second.

#### What We DON'T Need from the Mechanics Doc

These are simulation internals — interesting but not relevant to a skill activation zone visualizer:

| Topic | Why excluded |
|-------|-------------|
| Full stat calculation pipeline (raw→base→adjusted) | Stats are inputs, not outputs of our tool |
| Target speed / acceleration formulas | We show WHERE skills fire, not how fast horses run |
| HP consumption / stamina formulas | Only relevant as trigger conditions (already handled) |
| Position keeping AI modes | AI behavior, not skill conditions |
| Spot struggle / dueling / compete mechanics | AI mechanics, not skill conditions |
| Charge up / conserve power / release | AI mechanics |
| Zenkai spurt / Wiz limit break buff | Post-5th-anniversary mechanics, complex, still under investigation |
| Start delay mechanics | Only affects first 0.1s |
| Overtake / lane change logic | AI pathfinding |

**Boundary:** The mechanics doc tells us how the simulation works. We only need the parts that affect (a) when/where skills activate, (b) how skill values are scaled for display, and (c) track geometry verification.

#### 5th Anniversary Changes (from 5th Anniversary Reference)

The 5th anniversary (early 2026) introduced significant mechanics changes:

| Change | Detail | Impact on visualizer |
|--------|--------|---------------------|
| **Stat cap raised** | 2000 → 2500 (raw). Above 1200 still halved: `base = 1200 + (raw − 1200) / 2` | Stat slider range: 800–2500 |
| **Zenkai Spurt (全開スパート)** | Speed > 2000 + sufficient HP → continuous top-speed gain in last spurt. Accel scaled by Power + specific skills (ID=48) | Meta context only — not a skill condition |
| **Stamina Compete (スタミナ勝負)** | Stamina > 1200 → bonus target speed in races > 2100m, scaled by distance | Meta context — explains why stamina matters above 1200 |
| **Wiz Limit Break** | Wiz > 1200 → bonus effectiveness on Target Speed + Current Speed gold/pink skills (not white/inherited) | Skill value display could show the Wiz bonus if Wiz stat is known |

#### `is_finalcorner==1` INCLUDES the Final Straight

**Critical finding from the 5th Anniversary Reference (§Skills → Activating Conditions):**

> "is_finalcorner — As you may be able to guess, this checks if it's the final corner. **Includes the final straight.**"

This means skills with `is_finalcorner==1` can activate on BOTH the final corner (C4) AND the entire final straight (home stretch). The activation zone is significantly larger than just the corner:

```
Without this correction:  activation_zone = C4 area only (e.g., 1625–1875m on Nakayama 2400m)
With this correction:     activation_zone = C4 + final straight (e.g., 1625–2400m on Nakayama 2400m)
```

Our activation zone calculator must intersect `is_finalcorner==1` with `[C4.start_m .. goal]`, not just `[C4.start_m .. C4.end_m]`.

#### G1 Track Spurt Start Reference

Where the last spurt begins determines which accel skills work on each track. From the 5th Anniversary Reference:

| Spurt starts on... | Tracks | Accel skills that work |
|--------------------|--------|----------------------|
| **Final Straight** | Chukyo 1200m, Nakayama 2500m, Kyoto 3000m/3200m, Ooi 1200m | Final-straight accels (El Condor Pasa, etc.) |
| **Very Late Final Corner** | Hanshin 1600m, Tokyo 1600m, Ooi 1800m, Tokyo 1600m dirt | Final-corner accels DON'T work (too late even for inherited Taiki) |
| **Late Final Corner** | Nakayama 1200m, Kyoto 1600m, Tokyo 2000m | Final-corner accels DON'T work (Maruzensky/Dober fail) |
| **Corner** (not final) | Nakayama 2000m, Hanshin 2000m, Kyoto 2200m, Hanshin 2200m, Ooi 1800m, Chukyo 1800m dirt, Ooi 2000m | Final-corner accels FAIL — corner too early, Final Corner shortly after |
| **Just before Final Corner** | Tokyo 2400m | Final-corner accels WORK (spurt starts moments before C4) |
| **Corner + Downhill** | Kyoto 2000m, Kyoto 2200m | Same as corner — downhill adds speed variance |

**Statistics:** 76.7% of G1 tracks start spurt on a corner; 63.3% on the final corner (30% early, 10% late, 23.3% very late); 23.3% on a straight; 13.3% on the final straight.

Our visualizer can pre-compute the spurt-start location type for each track and flag which accel skill categories are compatible.

#### Inherited Unique Skill Scaling

When a unique skill is passed down via inheritance, its values are significantly reduced (5th Anniversary Reference §Unique Skills):

| Stat | Original → Inherited | Formula |
|------|---------------------|---------|
| **Strength** | 0.35 → 0.15, 0.45 → 0.25 | `value − 0.2` |
| **Duration** | 5.0s → 3.0s | `duration × 0.6` (−40%) |
| **Dual (speed+accel)** | 0.25spd+0.30acc → 0.05+0.10 | Both reduced by 0.2 |
| **Recovery** | 5.5% → 1.5%, 7.5% → 3.5% | Similar scaling |

Inherited uniques become "essentially white skills with weird conditions and longer durations." Our visualizer marks inherited skills with a dashed border; the API should apply the inheritance formula when `include_inherited: true` is set.

#### Green Skill Exact Values

| Level | Stat bonus | Notes |
|-------|-----------|-------|
| Level 1 | +40 | Full value, NOT halved by stat cap |
| Level 2 | +60 | Full value, NOT halved by stat cap |
| Purple (debuff) | −40 | Self-debuff |

Speed green is the only type worth the SP cost in competitive PvP. Stamina green occasionally useful in Long races for the Stamina Compete mechanic (>2100m only).

#### Speed Skill Meter Gain Formula

Simple calculation for comparing skill value (5th Anniversary Ref §Calculating Effectiveness):

```
Meters gained = effect_value × duration × (track_distance / 1000)
```

| Skill | Effect | Duration | 2400m gain |
|-------|--------|----------|------------|
| Speed Star (base) | 0.35 | 1.8s | 1.51m |
| Heart and Soul | 0.35 | 2.4s | 2.02m |
| Medium Distance Corner ◎ | 0.25 | 3.0s | 1.80m |

Note the counterintuitive result: the 0.25/3s skill (1.80m) beats the 0.35/1.8s skill (1.51m) on total meter gain, despite lower face value — duration matters more than value for speed skills.

#### Skill Type Categorization (from Community Skills Guide)

Competitive players evaluate skills across 7 distinct types, each with different evaluation criteria. Our visualizer should make these distinctions visually obvious.

| Skill Type | Effect Mechanic | Competitive Value | Visualizer Display |
|------------|----------------|-------------------|-------------------|
| **Speed (Target)** | Increases target speed | Universal — good in all phases. Useless during acceleration phase of spurt start. | 🏃 icon, solid bar |
| **Speed (Current)** | Boosts actual speed immediately | Rarer, always better than Target Speed. Not affected by acceleration dead zone. | 🏃💨 icon, solid bar |
| **Acceleration** | Increases acceleration rate | **Most important type.** Lives/dies by activation timing — MUST hit at spurt start. "Reliable" >> "random". | ⚡ icon, emphasized zone |
| **Recovery** | Restores HP/Stamina | Scales with distance. Only needed for Long (~150-200 Stamina for gold). Some ults require a heal to activate first. | ❤️ icon, dashed bar |
| **Lane Change** | Modifies lane move speed | Situational. Can be harmful (moving out slows you). Mostly Runner-only combinations. | ↔️ icon, subtle bar |
| **Vision** | Extends field of view | **Does nothing.** Default FoV is already maximum. Only useful for Stadium point padding. | 👁️ icon, grayed out |
| **Green (Passive)** | Stat bonuses, always activates (no INT check) | Speed green bypasses stat uncap halving (+40 Speed = full value). Strict track-specific conditions. | 🟢 icon, stat badge |
| **Debuff** | Reduces opponents' stats | Niche — concentrated on one "debuff" uma. Speed debuff is most relevant. Controversial in competitive. | 🔻 icon, red-tinted |

**The 5 factors that determine skill quality** (from the competitive community):

| Factor | What it means | How our visualizer shows it |
|--------|---------------|---------------------------|
| **Activation timing** | When during the race the skill fires | The entire point of our tool — activation zones on the track map |
| **Effect value** | How big the numeric boost is | `+0.45` display value (raw ÷ 10000) |
| **Duration** | How long the effect lasts | Bar width on the track, scaled by `distance/1000` |
| **Reliability** | Fixed vs random activation | Solid border = fixed timing, dashed = random (shaded band) |
| **SP cost** | Skill point cost to equip | Shown on skill card; efficiency = value ÷ cost |

**Key competitive insights our visualizer surfaces:**

1. **Accel timing is everything.** The most important question in competitive deck-building is "does this accel skill hit at spurt start?" Our track overlay makes this immediately visible — accel zones that overlap the spurt start point are highlighted.

2. **First-quarter accels are premium.** `phase_firstquarter_random==2` skills have a narrow activation window even on long tracks. Our visualizer shows the first-quarter zone as a distinct track marker so users can verify coverage.

3. **Duration is visually comparable.** Standard = 2.4s, premium = 4s, weak = 1.8s. Because our duration bars are scaled to track distance, these differences are immediately apparent — a 4s skill bar is more than twice as long as a 1.8s one.

4. **Phase coverage gaps.** Competitive builds need speed skills in all phases. Our `coverage_summary` (count + effect density per phase) directly identifies dead zones.

5. **Green skills are track-locked.** Unlike other skills, greens have strict track-specific conditions (weather, season, ground). The visualizer can flag greens whose conditions don't match the selected track.

6. **Recovery scales with distance.** A gold recovery worth ~150-200 Stamina on Long might only be worth ~75-100 on Mile. The visualizer can show the distance-scaled recovery amount.

**Standard skill durations** (for visual comparison):

| Category | Duration | Examples |
|----------|----------|---------|
| Weak | 1.8s | Speed Star (base) |
| Standard | 2.4s | Most corner/straight speed skills |
| Premium | 4.0s | Never Give Up, evolved Speed Star |
| Ultimate | 5.0s | Many character uniques |

These are **base** durations — actual game time is `base × distance / 1000`.

### 1h. What We DON'T Need (Scope Boundaries)

These are intentionally excluded from the visualizer:

| Topic | Reason |
|-------|--------|
| 3D track mesh / spline data from DLL | We generate path_points mathematically from corners + straights — good enough for a 2D visualization overlay |
| Gate 3D coordinates | Gate positions are a straight line at distance=0 offset by run-up; lanes spaced by 1 horse lane (0.625m) |
| Position Keep / Spurt Point zones | These are AI behavior hints, not skill activation conditions |
| BGM / Jikkyo / Crowd course params | `CourseParamType` values 4-10 are cosmetic only |
| Per-scenario phase overrides | Phase boundaries are per-track constants — confirmed by community and DLL structure |
| Ground condition / weather data | These are race-instance variables, not track properties |
| Full stat calculation pipeline | Stats are user inputs, not outputs of our tool |
| HP consumption / stamina formulas | Only relevant as trigger conditions (already handled in parser) |
| AI behavior (position keeping, overtake, lane change logic) | Not skill conditions |
| Spot struggle / dueling / compete / charge mechanics | AI mechanics, not skill triggers |
| Zenkai spurt / Wiz limit break buff | Post-5th-anniversary, still under investigation by community |

---

## Phase 2 — Worker API

Integrated into existing Cloudflare Worker. Internal only (service bindings or CORS whitelist to frontend domain).

### Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/tracks` | List of available tracks with metadata |
| `GET /api/tracks/:course_set_id/geometry` | Track path points, corners, phases, slopes |
| `POST /api/tracks/:course_set_id/deck` | Full activation map for a 7-card deck |
| `GET /api/search/skills?effect=accel&distance=middle&min_val=0.3` | Compact filtered list |

### Core endpoint: `POST /api/tracks/:course_set_id/deck`

```json
// Request
{
  "chara_id": 1129,
  "card_id": 112901,
  "support_card_ids": [30123, 30045, 30067, 30089, 30101, 30112],
  "include_whites": true,
  "include_inherited": false
}

// Response
{
  "track": {
    "name_jp": "東京 2400m", "distance": 2400, "ground": "turf",
    "path_points": [[x,y], ...],
    "corners": [{"label":"C1","start_m":325,"end_m":575}, ...],
    "phases": [{"phase":0,"label":"序盤","start_m":0,"end_m":400}, ...],
    "slopes": [{"start_m":1125,"end_m":1200,"gradient":2.0}, ...]
  },
  "deck": {
    "character": {"name_jp":"アーモンドアイ","name_en":"Almond Eye"},
    "card": {"name_jp":"[花宿しのクチュール]...","rarity":3},
    "support_cards": [{"name_jp":"...","rarity":3}, ...]
  },
  "skills": [
    {
      "id": 101291, "name_jp": "Peerless Heroine",
      "rarity": 5, "source": "character", "color": "#FF6B6B",
      "skill_type": "accel", "skill_type_icon": "⚡",
      "sp_cost": 120,
      "activation_chance_pct": 85.0,
      "triggers": [
        {
          "index": 1,
          "timing": "fixed",
          "conditions_summary": "mid-race · corner · turf · front 50%",
          "activation_zones": [
            {"zone":"C1","start_m":400,"end_m":575},
            {"zone":"C2","start_m":575,"end_m":900},
            {"zone":"C3","start_m":1350,"end_m":1600}
          ],
          "effects": [
            {"type":"accel","icon":"⚡","value":0.45,"duration_s":3.0,"target":"self"}
          ]
        }
      ]
    }
  ],
  "coverage_summary": {
    "early":     {"skill_count": 0, "effect_density": 0},
    "mid":       {"skill_count": 12, "effect_density": 2.3},
    "late":      {"skill_count": 5, "effect_density": 1.1},
    "last_spurt":{"skill_count": 8, "effect_density": 2.8},
    "gaps": [
      {"phase":"last_spurt","start_m":2100,"end_m":2250,"label":"dead zone: no skills"}
    ]
  }
}
```

---

## Phase 3 — Frontend

Single page. Hosted on Cloudflare Pages. Separate repo from the worker.

### User Flow

```
┌──────────────────────────────────────────────────────────┐
│  Deck Builder                          Track: [東京 2400m ▼] │
│                                                          │
│  Character:  [アーモンドアイ ▼]   Card: [花宿し ▼]       │
│                                                          │
│  Supports:                                               │
│  [SSR キタサン ▼] [SSR ドゥラ ▼] [SR ネイチャ ▼]       │
│  [SSR オルフェ ▼] [R バクシン ▼] [SSR マックイーン ▼]   │
│                                                          │
│  [x] Show white skills    [ ] Show inherited             │
│  [x] Show all types       [ ] Accel only  [ ] Speed only │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              ╭──────────────────────╮                   │
│             ╱    C3 (downhill -1.5%) ╲                  │
│            │     ████████████         │                  │
│            │     ⚡ Peerless T1        │                  │
│            │     +0.45 accel · 7.2s    │                  │
│            │     📍front 50% · fixed   │                  │
│            │       · C4 ·              │                  │
│        C4  │     Grandstand          │  C1              │
│            │     ▌▌▌▌▌▌▌▌▌▌          │                  │
│            │     🏃 Support skills     │                  │
│            │     ▌▌▌▌▌▌▌▌▌▌          │                  │
│  ◄ spurt  │                          │                  │
│   start   │     Home Stretch          │                  │
│            ╲    ░░░░░░░░░░           ╱                  │
│             ╲   ░░ T2 random ░░     ╱                  │
│              ╰──────────────────────╯                   │
│              ▲     Goal               ▲                 │
│              │                         │                 │
│         1600m (spurt)              2400m                 │
│                                                          │
│  [Elevation] ▔▔▔╲╲╲╲╲╲╱╱╱╱╱╱▔▔▔▔▔                     │
│  ▔ = uphill +2.0%   ╲ = downhill -1.5%                  │
├──────────────────────────────────────────────────────────┤
│  Skill list (grouped by type, color-coded by source)      │
│  ⚡ Accel  ██ Unique  ██ Gold  ░░ White                   │
│  🏃 Speed  ██ Unique  ██ Gold  ░░ White                   │
│  ❤️ Heal   ██ Gold    ░░ White    ☐ toggle on/off        │
│  🟢 Green  ██ Gold    ░░ White    (always active)         │
│  👁️ Vision ░░ — grayed at 50% opacity                    │
│                                                          │
│  Hover a skill → activation zone pulses on track          │
│  Click a zone  → popup: all skills active at that meter  │
│  ▌ = solid: fixed timing    ░░ = hatched: random timing  │
└──────────────────────────────────────────────────────────┘
```

### Interactions

| Action | Result |
|--------|--------|
| Change character/card/support | Track overlay re-renders with new skill set |
| Filter by type (accel/speed/heal/green) | Only skills of selected types shown on track |
| Hover skill bar | Activation zone pulses on track; tooltip shows full conditions + activation chance % |
| Click track zone | Popup: all skills active at that meter, sorted by type |
| Click spurt-start marker | Highlight all accel skills — which ones hit spurt start? |
| Toggle white skills | Normal-rarity skills fade in/out |
| Toggle inherited | Show/hide inherited unique versions |
| Toggle individual skill | Remove it from the track map (for "what if I drop this skill?") |
| Stat slider (speed 800→2500) | Skills with unmet stat thresholds gray out; Wiz slider updates activation chance % |
| Hover green skill badge | Show which track conditions it requires (season/weather/ground) |

### Color Coding

| Source | Color |
|--------|-------|
| Character unique (rarity 5-6) | Red |
| Character card gold (rarity 2) | Orange |
| Support card gold | Blue |
| Support card white (rarity 1) | Light gray |
| Inherited | Dashed border |

**Skill type overlays** (icon + border style, applied on top of source color):

| Skill Type | Icon | Border | Rationale |
|------------|------|--------|-----------|
| Acceleration | ⚡ | **Thick solid** border (2px) | Most important — must stand out |
| Speed (Target) | 🏃 | Solid border (1px) | Core skill type |
| Speed (Current) | 🏃💨 | Solid border (1px) + glow | Rare, always better than Target |
| Recovery | ❤️ | Dashed border | Situational (mostly Long only) |
| Lane Change | ↔️ | Dotted border | Niche, can be harmful |
| Vision | 👁️ | None, 50% opacity | Does nothing — visually de-emphasized |
| Green/Passive | 🟢 | Stat badge (not a zone bar) | Always active, track-conditional |
| Debuff | 🔻 | Red-tinted border | Affects opponents, not self |

**Reliability indicator** (zone fill style):

| Timing | Fill | Meaning |
|--------|------|---------|
| Fixed | ████ Solid fill | Activates at a specific point every time |
| Random | ░░░░ Hatched/dashed | Randomly picks a 10m segment within the zone |
| Position-based | ▓▓▓▓ Gradient | Activates when condition met (e.g., order<=3) — probability varies |

### Track Rendering

Path points from API → SVG `<path>` with lane width. Activation zones drawn as thickened colored strokes at the correct arc segment via `getPointAtLength()`.

Distance-to-SVG mapping:
```js
function distanceToPoint(meter, track) {
  const idx = Math.round(meter); // path_points indexed per meter
  return track.path_points[idx]; // [x, y]
}
```

No calibration needed — the DLL data gives us the path indexed by meter.

### Visual Language (Zero TL)

| Data | Display |
|------|---------|
| Effect type | Icon: ⚡ accel, 🏃 speed, 🏃💨 current speed, ❤️ recovery, ↔️ lane, 👁️ vision, 🟢 green, 🔻 debuff |
| Value | Number: `+0.45` |
| Duration | Bar width + label: `3.0s` (base) / `7.2s` (scaled). Standard=2.4s, premium=4.0s, weak=1.8s — indicated by bar color intensity |
| Phase | Kanji badge: `序` early, `中` mid, `終` late, `追` spurt |
| Distance | Kanji badge: `短` short, `マ` mile, `中` middle, `長` long |
| Surface | `🌱` turf / `🟫` dirt |
| Position | `📍front50%` / `🥉top3` |
| Stat threshold | `≥1200` + stat icon |
| Random timing | Dotted zone border + hatched fill |
| Fixed timing | Solid zone border + solid fill |
| Corner | Track label `C1`/`C2` |
| First-quarter spurt | Special marker at 0–25% of last spurt (premium accel window) |
| Green skill active | Green dot on track info bar (always-on, no INT check needed) |
| SP cost | Small tag: `⭐ 120sp` on skill card |

Token legend as a small dismissible panel — users learn the 6 kanji and 8 icons in ~30 seconds.

---

## Phase 4 — Content Update Workflow

```
1. New master.mdb drops
2. Convert .mdb → .sqlite3
3. Run import pipeline (Worker cron or manual trigger):
   a. Upsert: characters, cards, skills (match on id)
   b. Rebuild: card_skills, skill_triggers, skill_effects (parse conditions fresh)
   c. Validate: spot-check known skill IDs, row count sanity
4. Invalidate cache
5. Frontend unchanged (no rebuild needed)
6. Track data unchanged (only updated when new tracks release)
```

---

## Files

| File | Purpose |
|------|---------|
| `docs/references/MASTER_MDB_STRUCTURE.md` | Reference: text_data categories, table groups, query patterns |
| `scripts/query_skills_by_chara.sql` | Reference: skill discovery query (6-source UNION) |
| `scripts/schema_visualization.sql` | Reference: normalized schema + track_geometry tables |
| `data/dumps/dump_2_28_0.cs` | IL2CPP dump from v2.28.0 (mobile) — track geometry + enums + skill triggers |
| `data/dumps/dump_2_27_5.cs` | IL2CPP dump from v2.27.5 (Steam PC) — comparison baseline |
| `data/dumps/dump_diff_report.txt` | Semantic diff between the two dumps |
| `docs/references/Uma Musume Race Mechanics.md` | Community doc (KuromiAK) — formulas, constants, frame ordering |
| `Uma Skills.md` | Community doc (anonymous) — skill types, competitive evaluation, duration tiers |
| `import_pipeline/` (new) | master.mdb → normalized DB |
| `worker-api/` (new) | Cloudflare Worker API (3-4 endpoints) |
| `frontend/` (new) | Static page: deck picker + track overlay (vanilla JS) |

---

## Verification

1. **Import**: Almond Eye (1129) → 12 skills. Curren Bouquetd'or (1134) → 11 skills. Trigger/effect rows match manual queries.
2. **Activation zones**: Peerless Heroine T1 on Tokyo 2400m → C1 (400-575m) + C2 (575-900m) + C3 (1350-1600m). T2 → Last Spurt (2000-2400m).
3. **Deck endpoint**: POST with 7 cards → response contains ~25-35 skills, each with activation zones. Coverage summary correctly identifies gaps.
4. **Track mapping**: DLL-extracted path + known control points (C1 start=325m, goal=2400m) → gate offset aligns within 1m error.
5. **Content update**: Run import against older master.mdb snapshot → no skill regression.
6. **Frontend**: Tokyo 2400m + Almond Eye + 6 popular supports → all skills render, zones overlay correctly, hover/click/toggle work.
