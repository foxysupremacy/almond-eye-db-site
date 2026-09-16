# Data Checklist

> Last updated: 2026-06-28
> Track data finalized — 138 courses verified, derived fields computed, master.sqlite3 populated.
> English translations integrated from hachimi-tl-en — 21 tracks, 169 characters, 2,082 skills.
> Character assets collected — 397 full-res stands (140 chars) from official site, 112 skill icons from GameTora CDN.

---

## Data Sources

| Source | What it provides | Status |
|--------|-----------------|--------|
| **master.mdb** (`race_course_set`, `race_track`, text_data) | Track metadata: distance, ground, turn, run-up, lane max, finish times, name_jp | ✅ Populated to `data/master.sqlite3` via MCP uma-master (565 KB, 4 tables, 140 courses) |
| **GameTora** — `racetracks.<hash>.json` | Single JSON file: ALL tracks. Phases, corners, slopes, straights, laps, spurt point, stat thresholds, overlaps, no-mans-land, terrain changes | ✅ Downloaded & processed → `data/track_data/tracks.json` (138 courses) |
| **gameassembly.dll** (IL2CPP dump v2.28.0) | Type definitions confirming all data structures | ✅ Have type defs |
| **Community: Race Mechanics** (KuromiAK) | Formulas: duration/cooldown scaling, activation chance, bashin, lane width, phase=24 sections, frame ordering, course events | ✅ Incorporated into visualizer.md §1g |
| **Community: Skills Guide** (anonymous) | Skill type categorization (7 types), competitive evaluation criteria (5 factors), standard durations, green skill mechanics | ✅ Incorporated into visualizer.md §1g |
| **Community: 5th Anniv. Reference** (shory/Erzzy) | G1 spurt start table, inherited unique scaling (+0.2/40%), green skill values (+40/+60), `is_finalcorner` includes final straight, speed meter formula, aptitude table, 5th anni changes (stat cap 2500, zenkai spurt, stamina compete) | ✅ Incorporated into visualizer.md §1g |
| **hachimi-tl-en** ([UmaTL/hachimi-tl-en](https://github.com/UmaTL/hachimi-tl-en), commit `84e59e3`) | English community translations: track names (cat 456), character names (cat 4/5/6), skill names (cat 47), UI terms (localize_dict) | ✅ Extracted to `data/translations/` (5 JSON files, 2,287 bilingual entries) |
| **umapyoi.net API** (`/api/v1/character/info`) | Character metadata: 170 chars with `game_id` → `name_en_internal` (slug) mapping, names (JP/EN), official page link | ✅ Downloaded → `data/characters_info.json` (141 playable, 29 NPC) |
| **umamusume.jp official site** (Nuxt 3, microCMS CDN) | Full-resolution character stand images (`_01`=制服, `_02`=勝負服, `_04`=衣装). Per-character `_payload.json` provides CDN hashes. | ✅ Downloaded → `assets/chara_stand/` (397 PNGs, 500KB–1.1MB each, 140 chars) |
| **JRA official diagrams** | Ground truth for corner positions, elevation profiles | ⬜ Optional verification source |

---

## Per-Track Data Fields

Each track × distance variant needs these fields. Source: GameTora crawl unless noted otherwise.

### Required for the frontend

| Field | Source | Example (Tokyo 2400m turf) | Status |
|-------|--------|----------------------|--------|
| `course_set_id` | GameTora JSON `courses[].id` | `10606` | ✅ |
| `race_track_id` | GameTora JSON top-level `id` | `10006` (Tokyo) | ✅ |
| `name_jp` | text_data category=34 (verified against MDB; 4 track names were swapped — see note) | `東京` | ✅ Verified against MDB |
| `name_en` | hachimi-tl-en text_data_dict cat 456 + manual for NAR/international tracks | `Tokyo` | ✅ Emitted when `--lang en` |
| `ground_type_jp` | Manual (芝/ダート) | `芝` | ✅ Emitted when `--lang en` |
| `turn_direction_jp` | Manual (右/左/直線) | `左` | ✅ Emitted when `--lang en` |
| `distance_type_jp` | Manual (短距離/マイル/中距離/長距離) | `中距離` | ✅ Emitted when `--lang en` |
| `total_distance_m` | GameTora JSON `courses[].length` | `2400` | ✅ |
| `ground_type` | GameTora JSON `courses[].terrain` (1=turf, 2=dirt) | `turf` | ✅ |
| `turn_direction` | GameTora JSON `courses[].turn` (1=right, 2=left, 4=straight) | `left` | ✅ |
| `inout` | GameTora JSON `courses[].inout` | `1` | ✅ |
| `base_time_x` | COMPUTED: `total_distance_m / 1000` | `2.4` | ✅ |
| `phases` | GameTora JSON `courses[].phases[]` | `[{id:0, start:0, end:400}, ...]` | ✅ |
| `corners` | GameTora JSON `courses[].corners[]` | `[{number:1, start:325, end:575}, ...]` | ✅ |
| `slopes` | GameTora JSON `courses[].slopes[]` (raw÷10000=gradient%) | `[{slope:15000, start:0, end:40}, ...]` | ✅ |
| `straights` | GameTora JSON `courses[].straights[]` | `[{start:0, end:325, frontType:1}, ...]` | ✅ |
| `laps` | GameTora JSON `courses[].laps[]` | `[{lap:1, start:0, end:2088}, ...]` | ✅ |
| `no_mans_land` | GameTora JSON `courses[].noMansLand[]` | `[]` or `[{start, end}]` | ✅ |
| `terrain_changes` | GameTora JSON `courses[].terrainChanges[]` | turf↔dirt transitions | ✅ |
| `position_keep_end_m` | GameTora JSON `courses[].positionKeepEnd` | `1000` | ✅ |
| `spurt_start` | GameTora JSON `courses[].spurtStart` | `{lap:1, location:["corner"], meters:1600}` | ✅ |
| `overlaps` | GameTora JSON `courses[].overlaps[]` | `['03']` — phase 0+3 overlap | ✅ |
| `stat_thresholds` | GameTora JSON `courses[].statThresholds[]` — cross-verified against MDB `race_course_set_status` | `[]` — stat cap IDs | ✅ 86 populated, 52 confirmed empty |
| `stat_thresholds_source` | COMPUTED: `"mdb_verified"` or `"confirmed_empty"` — provenance tag | `"confirmed_empty"` | ✅ Added Phase 2 |
| `lane_width_m` | CONSTANT: 1 course width = 11.25m, 1 horse lane = 11.25/18 ≈ 0.625m | `0.625` | ✅ (from community mechanics doc) |
| `is_finalcorner_zone` | COMPUTED: last C4.start_m → distance_m (GOAL, NOT C4.end — CRITICAL CORRECTION) | `{start_m: 1625, end_m: 2400}` | ✅ Added Phase 4A |
| `spurt_start_type` | COMPUTED: 7-type classification per spec.md §4 | `"just_before_final_corner"` | ✅ Added Phase 4B |
| `spurt_start_corner_progress` | COMPUTED: 0-1 progress within final corner (null if not in corner) | `null` | ✅ Added Phase 4B |
| `spurt_start_distance_from_final_corner_m` | COMPUTED: signed meters from C4.start (negative = before) | `-25` | ✅ Added Phase 4B |
| `path_points` | GENERATED from corners + straights | `[[x,y], ...]` per meter | ⬜ Math TBD |
| `gate_positions` | COMPUTED from run-up + start line | `[{distance, x, y}]` | ⬜ Need run-up from master.mdb |
| `bashin_to_m` | CONSTANT: 1 bashin = 2.5m (community mechanics) | `2.5` | ✅ |
| `base_speed_ms` | COMPUTED: `20.0 - (distance - 2000) / 1000` | `20.0` for 2000m | ✅ |
| `finish_time_bounds` | master.mdb `race_course_set.FinishTimeMin/Max` | display_time = actual × 1.18 | ⬜ Available in MDB, not yet queried |

### Phases (per track)

Phases are defined as 24 equal sections: Early = sections 1-4, Mid = 5-16, Late = 17-20, Last Spurt = 21-24. This means phase boundaries are always at fixed fractions of track distance.

| Phase | Label | Sections | Fraction | Example (2400m) |
|-------|-------|----------|----------|------------------|
| Early (0) | 序盤 | 1–4 | 4/24 = 1/6 | 0–400m |
| Mid (1) | 中盤 | 5–16 | 12/24 = 1/2 | 400–1600m |
| Late (2) | 終盤 | 17–20 | 4/24 = 1/6 | 1600–2000m |
| Last Spurt (3) | 追込 | 21–24 | 4/24 = 1/6 | 2000–2400m |

Confirmed by both community mechanics doc and GameTora data.

### Corners (per track)

| Corner | Example (Tokyo 2400m) | Status |
|--------|----------------------|--------|
| C1 | start_m=325, end_m=575 (250m) | ✅ Crawled |
| C2 | start_m=575, end_m=900 (325m) | ✅ Crawled |
| C3 | start_m=1350, end_m=1625 (275m) | ✅ Crawled |
| C4 | start_m=1625, end_m=1875 (250m) | ✅ Crawled |

### Slopes (per track)

| Slope | Example (Tokyo 2400m) | Status |
|-------|----------------------|--------|
| Slope 1 | start_m=0, end_m=40, uphill, gradient=1.5% | ✅ Crawled |
| Slope 2 | start_m=1125, end_m=1200, uphill, gradient=2.0% | ✅ Crawled |
| Slope 3 | start_m=1250, end_m=1500, downhill, gradient=-1.5% | ✅ Crawled |
| Slope 4 | start_m=1950, end_m=2100, uphill, gradient=1.5% | ✅ Crawled |

### Straights (per track)

| Straight | Example (Tokyo 2400m) | Status |
|----------|----------------------|--------|
| Straight 1 (home stretch back) | start_m=0, end_m=325 | ✅ Crawled |
| Straight 2 (back stretch) | start_m=900, end_m=1350 | ✅ Crawled |
| Straight 3 (home stretch) | start_m=1875, end_m=2400 | ✅ Crawled |

### Extra zones (per track)

| Zone | Example (Tokyo 2400m) | Status |
|------|----------------------|--------|
| Position Keep | start_m=0, end_m=1000 | ✅ Crawled (optional — AI behavior hint, not skill-related) |
| Spurt point | start_m=1600 | ✅ Crawled (marks when spurt AI activates; may differ from phase boundary) |

---

## Computable / Derived Data

| Field | How to compute | Status |
|-------|---------------|--------|
| `base_time_x` | `distance_m / 1000` | ✅ |
| `path_points` | Math: corner arcs (radius from length + turn angle) connected by straight lines, sampled every 1m | ⬜ Need geometry code |
| `gate_positions` | Start line at `-run_up_distance_m` behind distance=0; lane positions spaced by `lane_width_m` | ⬜ Need run-up data first |
| `corner_radius` | From corner length + turn angle: `r = length / angle_rad` | ⬜ Derive from corner data |
| `accumulate_time` → meters | `trigger_value × base_time_x` | ✅ Implemented in condition parser |
| Activation zones | Intersect skill conditions with track geometry (see visualizer.md §1f) | ⬜ Need track data first |

---

## All Tracks to Crawl

Track list from `race_track` table (text_data category=34):

| race_track_id | Name (JP) | Name (EN) | Turf distances | Dirt distances | Crawled? |
|---------------|-----------|-----------|----------------|----------------|----------|
| 10001 | 札幌 | Sapporo | 1500, 1800, 2000, 2600 | 1000, 1700, 2400 | ✅ |
| 10002 | 函館 | Hakodate | 1200, 1800, 2000, 2600 | 1000, 1700, 2400 | ✅ |
| 10003 | 新潟 | Niigata | 1200, 1800, 2000, 2600 | 1000, 1150, 1700, 2400 | ✅ |
| 10004 | 福島 | Fukushima | 1400, 1600, 1800, 2000, 2200, 2400 | 1200, 1800, 2500 | ✅ |
| 10005 | 中山 | Nakayama | 1400, 1600, 1800, 2000, 2400, 2500 | 1300, 1400, 1600, 2100 | ✅ |
| 10006 | 東京 | Tokyo | 1200, 1600, 1800, 2000, 2200, 2500, 3600 | 1200, 1800, 2400, 2500 | ✅ |
| 10007 | 中京 | Chukyo | 1200, 1400, 1600, 2000, 2200 | 1400, 1800, 1900 | ✅ |
| 10008 | 京都 | Kyoto | 1400, 1600, 1800, 2000, 2200, 2400, 3000, 3200 | 1200, 1400, 1800, 1900, 2600 | ✅ |
| 10009 | 阪神 | Hanshin | 1400, 1600, 1800, 2000, 2200, 2400, 2600, 3000, 3200 | 1200, 1400, 1800, 2000, 2600 | ✅ |
| 10010 | 小倉 | Kokura | 1200, 1800, 2000, 2600 | 1000, 1700, 2400 | ✅ |
| 10011 | 大井 | Ooi | — | 1200, 1400, 1600, 1800, 2000, 2600 | ✅ |
| 10012 | 川崎 | Kawasaki | — | 900, 1400, 1500, 1600, 2000, 2100 | ✅ |
| 10013 | 船橋 | Funabashi | — | 1000, 1200, 1500, 1600, 1700, 1800, 2000, 2200, 2400 | ✅ |
| 10014 | 盛岡 | Morioka | — | 1000, 1200, 1400, 1600, 1800, 2000, 2400 | ✅ |

**Total:** ~14 tracks × ~1-6 variants each ≈ **50-60 track pages** to crawl.

---

## GameTora Data — Downloaded & Processed ✅

### Source

```
https://gametora.com/data/umamusume/racetracks.<hash>.json
```

Single JSON file containing ALL tracks. The `<hash>` changes each build — find it by checking the Network tab on any racetrack page for XHR/Fetch requests to `/data/umamusume/racetracks.*.json`. Current hash: `7d2f3355`.

### Structure

```json
[
  {
    "id": "10006",          // race_track_id as string
    "courses": [
      {
        "id": 10606,        // course_set_id
        "distance": 3,      // distance_type enum (1=short 2=mile 3=middle 4=long)
        "length": 2400,     // distance in meters
        "turn": 2,          // 1=right 2=left 4=straight
        "inout": 1,         // inner/outer variant
        "terrain": 1,       // 1=turf 2=dirt
        "laps": [{"lap":1, "start":0, "end":2088}, ...],
        "phases": [{"id":0, "start":0, "end":400}, ...],    // 0=early 1=mid 2=late 3=last_spurt
        "corners": [{"number":1, "start":325, "end":575}, ...],
        "slopes": [{"slope":20000, "start":1125, "end":1200}, ...],  // raw/10000 = gradient%
        "straights": [{"start":0, "end":325, "frontType":1}, ...],   // 1=grandstand 2=opposite
        "noMansLand": [{start, end}, ...],      // gaps where horses don't exist
        "overlaps": ["03"],                     // phase pairs that overlap in multi-lap
        "positionKeepEnd": 1000,                // meters where forced position-hold ends
        "spurtStart": {"lap":1, "location":["corner"], "meters":1600},
        "statThresholds": [],                   // stat cap IDs applied to this track
        "terrainChanges": [{start, terrain}, ...]  // turf↔dirt transition points
      }
    ]
  },
  ...
]
```

### Processed Output

`data/track_data/tracks.json` — 138 courses, ready for Worker API consumption.

| Stat | Count |
|------|-------|
| Total track groups | 17 |
| Total courses | 138 |
| Turf courses | 78 |
| Dirt courses | 60 |
| Unique race_track_ids | 17 (10001-10010, 10101, 10103-10105, 10201-10203) |

### Notes

- **Track name swap discovered & fixed (2026-06-28):** MDB `text_data` category=34 has 10003↔10004 (Fukushima/Niigata) and 10005↔10006 (Tokyo/Nakayama) swapped. Confirmed by course characteristics: 10003 has a straight course (=Niigata), 10005 is right-turning (=Nakayama). Fixed in `process_tracks.py` TRACK_NAMES.
- **10606 is Tokyo 2400m turf** (Japan Derby), NOT Nakayama 2400m. The earlier sample data labeled "Nakayama 2400m" was incorrect — the track name swap caused the confusion. race_track_id=10006=東京, turn=left (Tokyo is left-turning). Verified against MDB and course geometry.
- **Extended tracks (10201-10203)** are newer course variants: 中京(新), 京都(新), 阪神(新) — likely from a scenario update. MDB maps 10201-10203 to international tracks (Longchamp, Santa Anita, Del Mar) but GameTora repurposes them.
- **2 MDB-only courses:** 11201 (Longchamp 1000m straight turf) and 11202 (Longchamp 1400m right turf) exist in MDB but not in GameTora.
- **stat_thresholds fully resolved:** 86 courses populated (verified against MDB `race_course_set_status`), 52 courses confirmed empty (`course_set_status_id=0` in both sources). Values G(1) through C(5) are minimum stat grade thresholds.
- **is_finalcorner_zone computed:** Zone = last C4.start_m → GOAL (NOT C4.end — CRITICAL CORRECTION). Bug found & fixed: initial implementation used first C4 instead of last C4, affecting 22 multi-lap tracks.
- **spurt_start_type classified:** All 138 courses classified into 7 types per spec.md §4.
- **Slope format:** `slope / 10000` = gradient percent. `20000` = 2.0% uphill, `-15000` = 1.5% downhill.
- **Corner `number: -1`** means a pseudo-corner (gentle bend, not a true turn) — seen in Kyoto(新) tracks.
- **`noMansLand`** represents gaps between start and finish line where horses don't exist (gate before start, etc.)
- **2 source anomalies:** Courses 11619 and 11707 (Kawasaki 1600m dirt) have straight S3 data extending beyond `distance_m` in the GameTora source — faithfully reproduced, not processing errors.

---
## Translations — hachimi-tl-en Integration ✅

English community translations extracted from [UmaTL/hachimi-tl-en](https://github.com/UmaTL/hachimi-tl-en) (commit `84e59e3`, 2026-06-24) and cross-referenced with `master.sqlite3` Japanese names.

### Output Files

| File | Source (hachimi) | Source (DB) | Entries | Coverage |
|------|-----------------|-------------|---------|----------|
| `data/translations/track_names.json` | `text_data_dict` cat 456 (EN) | `text_data` cat 34 (JP) | 21 tracks | 100% bilingual |
| `data/translations/character_names.json` | `text_data_dict` cat 6 (EN), cat 4 (card IDs) | `text_data` cat 6 (JP), cat 372 (official EN) | 169 chars, 130 with card IDs | 100% bilingual |
| `data/translations/game_terms.json` | Manual (from `process_tracks.py` constants) | Manual | 15 terms, 5 categories | 100% bilingual |
| `data/translations/skill_names.json` | `text_data_dict` cat 47 (EN) | `text_data` cat 47 (JP) | 2,082 skills | 1,860 bilingual, 222 JP-only |
| `data/translations/README.md` | — | — | Source metadata | Commit hash, coverage stats, update instructions |

### hachimi-tl-en File Inventory

| hachimi File | Size | Key Content |
|-------------|------|-------------|
| `text_data_dict.json` | ~288 categories | **Category 6**: 169 EN character names. **Category 4**: 258 EN card full names. **Category 47**: 1,860 EN skill names. **Category 456**: 17 EN track names (clean, no "RC" suffix). Category 48: skill descriptions. Category 34/31: track codes. |
| `localize_dict.json` | 7,452 entries | UI/game strings organized by screen prefix (Common 251, Character 205, Race 286, SingleMode 781, etc.) |
| `character_system_text_dict.json` | 120 chars | Per-character dialogue lines |
| `hashed_dict.json` | 334 entries | Hash-keyed translation lookup (limited — mostly UI labels) |
| `race_jikkyo_comment_dict.json` | 264 entries | Race commentary lines |
| `race_jikkyo_message_dict.json` | 2,171 entries | Race narration lines |

### Regeneration

```bash
# Pull latest hachimi translations
cd /tmp/hachimi-tl-en && git pull

# Regenerate all mapping files
python3 scripts/rebuild_translations.py

# Or with custom path
python3 scripts/rebuild_translations.py --source ~/path/to/hachimi-tl-en/localized_data

# Verify
python3 -m json.tool data/translations/*.json > /dev/null
```

### Usage in process_tracks.py

```bash
python3 scripts/process_tracks.py              # Japanese only (default, 20 fields per course)
python3 scripts/process_tracks.py --lang en    # Adds track_name_en, ground_type_jp, turn_direction_jp, distance_type_jp
```

### Known Gaps

- **222 skills** have Japanese names (DB cat 47) but no community English translation yet in hachimi cat 47
- **Card names** (cat 4) are extracted but not yet linked to the visualizer output format
- **Game terms** (phases/ground types/directions/distances) are manually mapped — localize_dict.json was checked but does not contain these as discrete key-value pairs
- **character_system_text_dict.json** and **race_jikkyo_* files** are not consumed — those contain per-character dialogue and race narration, not relevant to track/skill visualization

---

## master.mdb Data to Query

```sql
-- All race_course_set rows with track name
SELECT
  rcs.id            AS course_set_id,
  rcs.race_track_id,
  rcs.distance       AS total_distance_m,
  rcs.ground         AS ground_type,     -- 1=turf, 2=dirt
  rcs.turn           AS turn_direction,  -- 1=right, 2=left
  rcs.tight_track    AS is_tight_track,
  rcs.run_up         AS run_up_distance_m,
  rcs.float_lane_max AS float_lane_max,
  rcs.inout          AS inout,           -- inner/outer variant
  tn.text            AS track_name_jp
FROM race_course_set rcs
JOIN text_data tn ON tn.category = 34 AND tn."index" = rcs.race_track_id
ORDER BY rcs.race_track_id, rcs.distance;
```

Status: ✅ Done — populated `data/master.sqlite3` (565 KB, 4 tables) via MCP uma-master. Queryable locally.
  See `scripts/populate_master_from_mcp.py` and `scripts/populate_master_from_mcp.sql`.

---

## Verification Checklist

Once all data is collected, verify:

- [x] Every `race_track_id` (10001-10014) has at least one `course_set_id` crawled
- [x] Phase boundaries sum to track distance (early_end = mid_start, etc.)
- [x] Phase boundaries follow section rule: early = distance/6, mid = distance/2, late = distance/6, last_spurt = distance/6
- [x] Corner labels are sequential (C1 before C2 before C3 before C4)
- [x] No overlapping zones (slope.start_m >= corner.end_m where adjacent)
- [x] All distances are within [0, total_distance_m]
- [ ] `_firstCornerDistance` from DLL matches GameTora C1.start_m for each track (if DLL call available)
- [x] Tokyo 2400m data matches our known-good reference exactly (course_set_id=10606; note: was previously mislabeled as Nakayama)
- [ ] Activation zone calculation for Peerless Heroine on Tokyo 2400m produces correct zones (requires skill import pipeline)
- [x] `base_time_x` calculation is verified: 2400m → 2.4
- [x] `base_speed_ms` formula verified: `20.0 - (distance - 2000) / 1000`
- [ ] Skill duration scaling verified: `base_duration × distance / 1000` (requires skill import)
- [x] Lane width: 1 horse lane = 0.625m, gate spacing verified
- [ ] `order_rate` rounding behavior matches: N% of field size, rounded to nearest integer (requires skill import)
- [ ] Spurt carry-over: speed skills crossing spurt-start boundary get carry-over badge + estimated meter gain (requires skill import)
- [ ] Carry-over meter gain formula verified against reference math (gold speed +3.17m, gold accel +9.16m for 2000m/1000pow) (requires skill import)
- [x] `is_finalcorner==1` activation zones include final straight (C4.start_m .. goal), not just C4 bounds
- [x] Inherited unique scaling applied: strength −0.2, duration × 0.6 (formulas documented)
- [x] G1 spurt start type classified correctly for all tracks (corner/straight/late/very-late)
- [ ] Speed meter gain formula verified: effect × duration × distance/1000 (requires skill import)
- [x] Green skill values: +40 Lv1, +60 Lv2, bypasses stat cap halving (formulas documented)

---

## Mechanics Reference (from Community Doc)

Key constants and formulas from KuromiAK's "Uma Musume Race Mechanics" that affect our data model:

| Constant | Value | Where used |
|----------|-------|------------|
| 1 bashin | 2.5m | `bashin_diff_infront` / `bashin_diff_behind` parsing |
| 1 course width | 11.25m | Lane rendering, gate positions |
| 1 horse lane | 11.25/18 ≈ 0.625m | Gate spacing, near_count lane threshold |
| Frame rate | 0.0666s (15fps) | `accumulatetime` conversion |
| Phase sections | 4+12+4+4 = 24 | Phase boundary verification |
| Skill activate order | Before phase update | Edge case: corner exit + phase change same frame |

| Formula | Where used |
|---------|------------|
| `Duration = BaseDuration × distance / 1000` | Frontend duration bar width |
| `Cooldown = BaseCooldown × distance / 1000` | Skill timing display |
| `ActivationChance = max(100 − 9000/BaseWiz, 20)%` | Tooltip on skill cards |
| `BaseSpeed = 20.0 − (distance − 2000) / 1000` | Track metadata display |
| `DisplayTime = ActualTime × 1.18` | Finish time display |
| `order_rate rounding: round(field_size × rate%)` | Condition parser |
| `Spurt carry-over: distance_saved = speed_bonus / base_accel × top_speed` | Speed skills overlapping spurt start get extra effective duration |
| `Inherited unique: strength −0.2, duration × 0.6` | API must apply when `include_inherited: true` |
| `Green skill: +40 (Lv1), +60 (Lv2), bypasses stat cap halving` | Green skill value display |
| `is_finalcorner==1 INCLUDES the final straight (not just C4!)` | Activation zone = [C4.start_m .. goal], not [C4.start_m .. C4.end_m] |

### G1 Track Spurt Start Types (from 5th Anniversary Reference)

Critical for determining which accel skills work on each track:

| Spurt Start Type | Tracks | Final-corner accels? |
|------------------|--------|---------------------|
| **Final Straight** | Chukyo 1200m, Nakayama 2500m, Kyoto 3000m/3200m, Ooi 1200m | ❌ Need final-straight accels |
| **Very Late Final Corner** | Hanshin 1600m, Tokyo 1600m (turf+dirt) | ❌ Even inherited Taiki fails |
| **Late Final Corner** | Nakayama 1200m, Kyoto 1600m, Tokyo 2000m | ❌ Maruzensky/Dober fail |
| **Corner (not final)** | Nakayama 2000m, Hanshin 2000m, Kyoto 2200m, Hanshin 2200m, Ooi 1800m, Chukyo 1800m dirt, Ooi 2000m | ❌ Too early — final corner is after |
| **Just before Final Corner** | Tokyo 2400m | ✅ Works! |
| **Corner + Downhill** | Kyoto 2000m, Kyoto 2200m | ❌ Same as corner type |
| **Straight** | — | ❌ Need straight-timing accels |

**Overall:** 76.7% corner spurt · 63.3% final corner · 23.3% straight · 13.3% final straight

### 5th Anniversary Stat Changes

| Change | Detail |
|--------|--------|
| Stat cap | 2000 → 2500 (raw). Above 1200 halved: `base = 1200 + (raw − 1200) / 2` |
| Zenkai Spurt | Speed > 2000 + sufficient HP → continuous top-speed gain in last spurt. Accel from Power. |
| Stamina Compete | Stamina > 1200 → bonus target speed in races > 2100m. Scales with distance. |
| Wiz Limit Break | Wiz > 1200 → bonus effectiveness on gold/pink Target Speed + Current Speed skills only |

---

## Skill Type Categorization (from Community Skills Guide)

Skill effect types determine how the frontend displays each skill. Mapped from `float_ability_type` in master.mdb:

| Category | Ability Types | Icon | Visual Style | Competitive Value |
|----------|--------------|------|-------------|-------------------|
| **Speed (Target)** | 1 (Target Speed) | 🏃 | Solid bar | Universal — good in all phases; useless during spurt acceleration |
| **Speed (Current)** | 21, 22 (Current Speed) | 🏃💨 | Solid bar + glow | Rare, always better than Target Speed |
| **Acceleration** | 2 (Accel) | ⚡ | Thick border (2px), emphasized | **Most important** — must hit at spurt start |
| **Recovery** | 3 (HP Recovery) | ❤️ | Dashed bar | Scales with distance; mostly Long only |
| **Lane Change** | 8 (Lane Move Speed) | ↔️ | Dotted bar, subtle | Situational; can be harmful |
| **Vision** | 9 (Vision) | 👁️ | 50% opacity, grayed | Does nothing — FoV already max by default |
| **Green/Passive** | Stat bonuses (tag 601-615) | 🟢 | Badge (always-on) | Always activates (no INT check); Speed green bypasses uncap halving |
| **Debuff** | 10+ (opponent stats) | 🔻 | Red-tinted border | Niche; concentrated on dedicated debuff uma |

> **Note on ability_type values:** The numerical type codes above are *normalized* for the frontend.
> Raw `ability_type_1_1` values in master.mdb differ — e.g., DB uses 27 (not 1) for speed,
> 31 (not 2) for accel, 28 (not 8) for lane change, 8 (not 9) for vision, and 9 for recovery.
> See `data/skill_icon_mapping.json` for the DB-verified mapping and
> `docs/spec.md` § `classif_skill_type()` for the normalization logic.

### Skill Icon ID Convention

Skill icons on the GameTora CDN follow a `TTSSV` (5-digit) naming pattern decoded from `skill_data.icon_id` in master.mdb:

| Segment | Range | Meaning |
|---------|-------|---------|
| **TT** | `10` = Green/Passive, `20` = Active, `30` = Debuff | Top-level skill category |
| **SS** | `01`–`09` | Effect sub-type (01=speed, 02=recovery, 04=accel, 05=lane, 06=concentration, 09=vision) |
| **V** | `1`–`6` | Variant: 1=white (base), 2=gold (upgraded), 3=rainbow (unique), 4=white× (negative), 5=gold× (neg-upgraded), 6=ultimate (evolved) |

**Icon files** are stored at `assets/{icon_id}.png`, sourced from:
```
https://media.gametora.com/umamusume/skills/icon/{icon_id}.png
```

The 17 downloaded base (V=1) icons cover all standard skill sub-types:

| Icon | Category | Sub-type | Example |
|------|----------|----------|---------|
| `10011.png`–`10061.png` | Green/Passive | 01–06 (direction, venue, season, ground, track char, other) | 右回り◎, 東京レース場◎, 春ウマ娘◎ |
| `20011.png` | Speed | 01 | コーナー巧者○ (428 skills) |
| `20021.png` | Recovery | 02 | コーナー回復○ (42 skills) |
| `20041.png` | Acceleration | 04 | コーナー加速○ (67 skills) |
| `20051.png` | Lane Movement | 05 | ポジションセンス (6 skills) |
| `20061.png` | Concentration | 06 | 集中力 — prevents late-start (1 skill) |
| `20091.png` | Vision/FOV | 09 | ホークアイ, 読解力 (4 skills) |
| `30011.png`–`30071.png` | Debuff | 01,02,04,05,07 | ためらい, 駆け引き, けん制, 目くらまし |

**Gold (V=2) and Unique (V=3, V=6) variants** are documented in `data/skill_icon_mapping.json`.
Key highlights:
- `20013` (V=3): ALL 238 character-unique speed skills share this single icon
- `20016` (V=6): 329 evolved character speed ultimates
- `20012` (V=2, gold): 弧線のプロフェッサー, スピードスター (175 skills)
- `20022` (V=2, gold): 円弧のマエストロ, 好転一息 (28 skills)

The **30xxx debuff series mirrors 20xxx** using the same raw ability_types applied negatively:
30011↔20011 (speed↓), 30051↔20021 (restraint), 30021↔20041 (accel↓), 30071↔20091 (blind).

### Standard Skill Durations (base values, before distance scaling)

| Tier | Base Duration | Examples | Visual indicator |
|------|--------------|---------|-----------------|
| Weak | 1.8s | Speed Star (base) | Short bar, light color |
| Standard | 2.4s | Most corner/straight speed skills | Medium bar |
| Premium | 4.0s | Never Give Up, evolved Speed Star | Long bar, saturated color |
| Ultimate | 5.0s | Many character uniques | Longest bar, brightest |
 
**Duration scaling:** `ActualDuration = BaseDuration × CourseDistance / 1000`. A 3.0s base skill on 2400m = `3.0 × 2.4 = 7.2s` of game time. The frontend must apply `track.base_time_x` to all raw duration values.

### Green Skill Mechanics

- **Always activate** — no INT/wisdom check needed. If the condition is met, the skill is ON.
- **Strict track-conditional** — conditions tied to specific track properties (weather, season, ground type, track ID).
- **Speed green bypasses stat uncap halving** — the +40 Speed from a green skill is NOT halved by the stat cap formula (stats >1200 are normally halved). This makes Speed greens ~2× more efficient than they appear.
- Green skills are identified by `skill_tag` 601-615 in master.mdb.

### Character Stand Assets

Full-resolution character stand images ripped from the [official site](https://umamusume.jp/character/) via Nuxt 3 `_payload.json` and microCMS CDN.

**Naming convention:** `{char_id}_{variant}.png` where `char_id` matches `chara_data.id` in master.mdb.

| Variant | Label | Description | Count |
|---------|-------|-------------|-------|
| `01` | 制服 | School uniform (standard) | 138 |
| `02` | 勝負服 | Race wear | 135 |
| `04` | 衣装 | Idol / costume wear | 124 |
| ~~`03`~~ | ~~原案~~ | Concept art — skipped | — |

**Source pipeline:**
1. `umapyoi.net/api/v1/character/info` → `game_id` + `name_en_internal` (slug) mapping (141 playable chars)
2. Per-character: `https://umamusume.jp/character/{slug}/_payload.json` → extract CDN image hashes
3. Download from microCMS CDN:
   ```
   https://images.microcms-assets.io/assets/973fc097984b400db8729642ddff5938/{hash}/{slug}_{variant}.png
   ```

**Storage:** `assets/chara_stand/` — 397 files, 500 KB to 1.1 MB each (full-resolution, uncropped, transparency).

**Coverage:** 140 of 141 playable characters. Special Week (1001) notably lacks race wear (`_02`) — never published on the official site. 1 character failed to resolve on the CDN.

Related assets:
| Directory | Contents | Count |
|-----------|----------|-------|
| `assets/skills/` | Skill type icons (`TTSSV` convention, GameTora CDN) | 112 |
| `assets/chara/` | Character portraits (GameTora CDN, cropped — superseded by `chara_stand/`) | 257 |
| `assets/chara_stand/` | **Full-resolution character stands** (official site microCMS) | **397** |
| `assets/common/` | UI frames, status icons, obtain icons | 14 |
| `data/skill_icon_mapping.json` | Skill icon → type/variant/category mapping | — |
| `data/characters_info.json` | Character metadata from umapyoi API (to-do: save) | — |

## What We DON'T Need

These are intentionally excluded:

| Item | Reason |
|------|--------|
| 3D track mesh / spline data from DLL | We generate path_points mathematically from corners + straights — good enough for a 2D visualization overlay |
| Gate 3D coordinates | Gate positions are a straight line at distance=0 offset by run-up; lanes spaced by 1.2m |
| Position Keep / Spurt Point zones | These are AI behavior hints, not skill activation conditions. Skippable. |
| BGM / Jikkyo / Crowd course params | Cosmetic. `CourseParamType` values 4-10 are irrelevant for skill visualization. |
| Per-scenario phase overrides | Phase boundaries are per-track constants — confirmed by user and DLL structure |
| Ground condition / weather data | These are race-instance variables, not track properties |

---

## Immediate Next Steps

1. ~~**[x] Verify GameTora URL pattern**~~ → Found: single JSON file at `/data/umamusume/racetracks.<hash>.json`
2. ~~**[x] Write crawl script**~~ → `scripts/crawl_tracks.py` (Playwright fallback) + `scripts/process_tracks.py` (JSON processor)
3. ~~**[x] Process Tokyo/Nakayama 2400m**~~ → Verified: Tokyo 10606 matches reference data exactly (was previously mislabeled as Nakayama)
4. ~~**[x] Process all 138 courses**~~ → Done: `data/track_data/tracks.json` (v2.0, 6 new derived fields)
5. ~~**[x] Query master.mdb**~~ → Done: populated `data/master.sqlite3` (565 KB) via MCP uma-master. Track names, run_up, lane max, finish times available.
6. ~~**[x] Fix track names**~~ → 4 track names were swapped (10003↔10004, 10005↔10006). Fixed in `process_tracks.py`.
7. ~~**[x] Compute derived fields**~~ → `is_finalcorner_zone`, `spurt_start_type` (+2 computed fields) added. Bug found & fixed: multi-lap C4 selection.
8. ~~**[x] Resolve stat_thresholds**~~ → 86 populated (MDB-verified), 52 confirmed empty. 0 discrepancies.
9. ~~**[x] Validate**~~ → 27/27 spec coverage items verified. All formulas PASS. Cross-checked by independent agents.
10. ~~**[x] Integrate translations**~~ → hachimi-tl-en extracted to `data/translations/` (21 tracks, 169 chars, 2,082 skills). Bilingual output via `--lang en`. Regeneration via `scripts/rebuild_translations.py`.
11. **[ ] Generate path_points** — math: corner arcs + straights → array of (x,y) per meter
12. **[ ] Skill import pipeline** — import skills from master.mdb, link to track activation zones
13. **[ ] Frontend build** — Cloudflare Pages deployment with deck builder + track overlay
