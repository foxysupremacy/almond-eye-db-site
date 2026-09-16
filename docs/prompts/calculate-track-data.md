# Agent Prompt: Calculate & Finalize Track Data for AlmondEyeDB

Copy everything below this line into a fresh agent prompt. This is a self-contained task — no prior context needed.

---

You are working in `/Users/fubuki/Documents/AlmondEyeDB`. Your task: **calculate and finalize all track data** so every course in `data/track_data/tracks.json` is complete, verified, and ready for the visualizer frontend.

## Project Layout

```
scripts/crawl_tracks.py       # Crawl GameTora → raw per-track JSON
scripts/process_tracks.py     # Convert GameTora JSON → tracks.json format
scripts/schema_visualization.sql  # Normalized schema + track_geometry tables
scripts/query_skills_by_chara.sql # Skill discovery query (for reference)
data/racetracks_raw.json      # Raw GameTora dump (105KB, single-line JSON array)
data/track_data/tracks.json   # Processed output: 138 courses, 20 fields each
data/master.sqlite3           # WARNING: currently empty (0 tables) — needs population
docs/spec.md                  # Full spec with formulas, zone calculations, requirements
docs/data.md                  # Data pipeline plan with verification checklist
docs/visualizer.md            # Frontend plan with CourseParamTable reference
docs/references/Uma Musume Race Mechanics.md        # KuromiAK: formulas, constants, frame order
docs/references/Umamusume Reference (5th Anniversary).md  # Spurt timing, inherited scaling, stat caps
docs/references/MASTER_MDB_STRUCTURE.md              # text_data categories, table groups, query patterns
```

## Current Data Status

`tracks.json` has **138 courses** across ~14 tracks. Each track entry has:

| Field | Coverage | Notes |
|-------|----------|-------|
| `course_set_id` | 138/138 ✓ | Unique ID per distance/surface combo |
| `race_track_id` | 138/138 ✓ | Maps to TRACK_NAMES in process_tracks.py |
| `track_name_jp` | 138/138 ✓ | Japanese name (札幌, 東京, etc.) |
| `distance_m` | 138/138 ✓ | Race distance in meters |
| `ground_type` | 138/138 ✓ | "turf" or "dirt" |
| `turn_direction` | 138/138 ✓ | "right", "left", "straight" |
| `distance_type` | 138/138 ✓ | "short", "mile", "middle", "long" |
| `inout` | 138/138 ✓ | Inner/outer course variant |
| `base_time_x` | 138/138 ✓ | distance_m / 1000 |
| `phases` | 138/138 ✓ | 4 phases: early, mid, late, last_spurt |
| `corners` | 138/138 ✓ | Corner positions + lengths |
| `slopes` | 138/138 ✓ | Gradient changes (uphill/downhill) |
| `straights` | 138/138 ✓ | Straight segments |
| `laps` | 138/138 ✓ | Lap boundaries |
| `overlaps` | 73/138 ⚠️ | Where sections overlap |
| `no_mans_land` | 27/138 ⚠️ | Gaps where horses don't exist |
| `terrain_changes` | 10/138 ⚠️ | Turf↔dirt transitions |
| `position_keep_end_m` | 138/138 ✓ | End of position-keep zone |
| `spurt_start` | 138/138 ✓ | Where last spurt begins |
| **`stat_thresholds`** | **86/138 ❌** | **52 tracks missing — CRITICAL** |

## graphify — Your Knowledge Navigator

**Use this FIRST, before reading any file directly.** A pre-built knowledge graph (83 nodes, 84 edges, 15 communities) already indexes every doc, reference, and script in this project. It tells you *where* to look so you don't waste time grepping.

### ⚠️ Environment — conda base REQUIRED

graphify is installed in conda's `base` environment. **Every `graphify` command must be prefixed with:**

```bash
eval "$(conda shell.bash hook)" && conda activate base && graphify ...
```

For readability, the examples below show bare `graphify` commands. **Always wrap them:**

```bash
# What's written below:
graphify query "track geometry" --budget 2000

# What you actually run:
eval "$(conda shell.bash hook)" && conda activate base && graphify query "track geometry" --budget 2000
```

To save typing, set an alias at the start of your session:

```bash
alias gq='eval "$(conda shell.bash hook)" && conda activate base && graphify query'
alias ge='eval "$(conda shell.bash hook)" && conda activate base && graphify explain'
alias gp='eval "$(conda shell.bash hook)" && conda activate base && graphify path'

# Then use:  gq "phase boundaries" --budget 2000
#            ge "Stat System"
#            gp "Track Geometry" "Spurt Carry-over"
```

### Available graphify commands

Run all commands from `/Users/fubuki/Documents/AlmondEyeDB`. The graph lives at `graphify-out/graph.json`.

```bash
# Full-text question — returns matching nodes + edges with source_locations
graphify query "<natural language question>" --budget 2000

# Deep-dive on one node — shows all its connections, community, and source
graphify explain "<node label or ID>"

# Find the shortest path between two concepts — reveals hidden dependencies
graphify path "<concept A>" "<concept B>"
```

### Graph-based navigation pattern (use this for EVERY phase)

1. **Don't know which file has the answer?** → `graphify query "<question>"`
2. **Found a relevant node?** → `graphify explain "<that node>"` to see all connections
3. **Need to trace how two ideas link?** → `graphify path "X" "Y"`
4. **Only THEN** read the specific file at the `source_location` the graph pointed you to.

### The 15 communities (what lives where)

| Community | What's in it | Use when… |
|-----------|-------------|-----------|
| **Track Geometry & Events** | §2 pipeline, CourseParamTable, course events, per-track fields | Checking corner/slope/straight data |
| **Track Crawler Script** | crawl_tracks.py + all its functions | Debugging raw data extraction |
| **Track Processor Script** | process_tracks.py + all its functions | Fixing conversion logic |
| **Race Mechanics Core** | Phase=24 sections, skill duration, frame ordering, activation zones | Understanding phase boundaries |
| **Speed & Spurt Mechanics** | Carry-over math, inherited scaling, speed system, spurt carry-over | Spurt start calculations |
| **Spurt Start & Verification** | is_finalcorner correction, G1 spurt starts, verification checklist | Classifying spurt types |
| **Game Constants & Formulas** | Bashin, lane dimensions, conversion factors, skill types, green skills | Looking up constants |
| **Stat System & Skill Activation** | Stat system, wisdom-based activation, 5th anni stat caps, stamina limit break | Understanding stat thresholds |
| **Skill Discovery Pipeline** | 6-source discovery, skill_data schema, card linkage, text_data | Skill-to-track lookups |
| **Data Sources & Core Spec** | GameTora, master.mdb queries, race tables, finish time, data checklist | Cross-referencing data sources |
| **Condition System & Phase 1** | Condition string parser, SkillTrigger hierarchy, DLL reference, scope | Understanding skill trigger conditions |
| **Backend API Layer** | Worker API, deck endpoint | API design reference |
| **Frontend Layer** | Phase 3 frontend, zero-TL design | Visualizer UI decisions |
| **Zenkai Spurt** | Zenkai spurt (5th Anniversary mechanic) | Zenkai-specific calculations |
| **Wiz Limit Break** | Wiz limit break mechanic | Wiz limit break calculations |

### Example queries for each phase

```
# Phase 1 — Verify data
graphify query "track geometry pipeline verification assertions process_tracks" --budget 2000
graphify explain "Track Geometry Pipeline (§2)"

# Phase 2 — stat_thresholds
graphify query "stat thresholds stat system raw base adjusted final" --budget 2000
graphify path "Stat System (Raw → Base → Adjusted → Final)" "Stat Thresholds"
graphify explain "Stat System (Raw → Base → Adjusted → Final)"

# Phase 3 — master.mdb
graphify query "master mdb race_course_set race_track text_data tables" --budget 2000
graphify explain "Race Tables (race_course_set, race_track, etc.)"

# Phase 4 — Derived fields
graphify query "is_finalcorner correction C4 final straight spurt start classification" --budget 2000
graphify path "Activation Zone Calculation (§4)" "is_finalcorner Zone Correction (CRITICAL)"
graphify explain "Phase = 24 Equal Sections System"
graphify explain "Bashin (Horse Length) — 1 bashin = 2.5m"

# Phase 5 — Verification
graphify query "verification checklist data pipeline validation" --budget 2000
graphify explain "Data Checklist for Visualizer"

# Cross-cutting questions
graphify path "Track Geometry Pipeline (§2)" "Spurt Speed Carry-over Math"
graphify path "Stat System (Raw → Base → Adjusted → Final)" "Zenkai Spurt (全開スパート)"
```

### graphify-first rule

- **BEFORE reading any file**, ask the graph if it already knows the answer
- **BEFORE writing any code**, trace the concept through the graph to find all connected docs
- **When stuck**, `graphify query` with the specific term you're confused about — it'll point you to the exact source file and line
- The graph is not a replacement for reading files — it's a **map** that tells you which file to read and why

---

## What "Calculate & Finalize" Means

### Phase 1 — Verify & Re-crawl if Needed

1. Use `graphify query "track geometry verification assertions process_tracks" --budget 2000` to find the relevant spec sections and assertion logic
2. Read `data/track_data/tracks.json` and `data/racetracks_raw.json`
3. Cross-check all 138 courses against the raw source for data fidelity
4. Verify each course satisfies the assertions in `process_tracks.py` (lines 197-225):
   - All phases sum to track distance
   - All phases are contiguous (no gaps between phase end and next phase start)
   - Nakayama 2400m turf (course_set_id=10606) passes all reference checks
5. If any course fails assertions, re-run `scripts/process_tracks.py` after fixing the raw data

### Phase 2 — Fill Missing `stat_thresholds` (52 tracks)

The stat_thresholds field defines **stat benchmarks** that categorize a character's stats into tiers at each track. These come from the GameTora raw JSON under `course.statThresholds`.

1. Use `graphify explain "Stat System (Raw → Base → Adjusted → Final)"` to understand the stat pipeline
2. Use `graphify path "Stat System (Raw → Base → Adjusted → Final)" "Stat Thresholds"` to trace connections
3. Check `data/racetracks_raw.json` for missing thresholds:

```bash
python3 -c "
import json
with open('data/racetracks_raw.json') as f:
    data = json.load(f)
for group in data:
    for course in group['courses']:
        st = course.get('statThresholds', [])
        if st:
            print(f'course_set_id={course[\"id\"]}: {len(st)} thresholds')
        else:
            print(f'course_set_id={course[\"id\"]}: NO stat_thresholds')
"
```

If the raw JSON has the data but process_tracks.py didn't capture it, fix the script. If the raw JSON is also missing thresholds for those 52 tracks, use graphify to research alternative sources:
- `graphify explain "5th Anniversary Stat Cap Changes (2000→2500)"` — stat cap info
- `graphify explain "Stat System (Raw → Base → Adjusted → Final)"` — stat pipeline from KuromiAK doc
- `graphify query "race_course_set table stat threshold master mdb" --budget 2000` — MDB schema references

### Phase 3 — Populate master.sqlite3

The database is **empty** (0 tables). This blocks skill queries and cross-referencing.

1. Use `graphify explain "Race Tables (race_course_set, race_track, etc.)"` to see all known table schemas
2. Use `graphify query "master mdb text_data category skill_data card_data table structure" --budget 2000` for full context
3. Locate the actual `master.mdb` file (the game's master database). Common locations:
   - DMM version: `%USERPROFILE%/AppData/LocalLow/Cygames/umamusume/master/master.mdb`
   - Check `docs/references/MASTER_MDB_STRUCTURE.md` (the graph will point you to exact sections)
4. If master.mdb is found, open it and verify key tables exist:
   - `text_data` (category 34 = track names, category 145 = skill names)
   - `race_course_set` — course metadata including stat thresholds
   - `race_track` — track definitions
   - `skill_data` — skill definitions with condition strings
   - `card_data`, `available_skill_set` — skill-to-character linkage
5. If master.mdb is NOT available locally, document this as a blocker and note what queries would run against it

### Phase 4 — Compute Derived Fields for Frontend

Use graphify to trace how each field connects before computing:

1. **`is_finalcorner` zone**: 
   - `graphify path "Activation Zone Calculation (§4)" "is_finalcorner Zone Correction (CRITICAL)"` — traces the spec's zone logic
   - For each track, compute the activation zone that spans C4.start through GOAL (not C4.end — spec §4 CRITICAL CORRECTION). See spec.md line 2963.
2. **Spurt start type classification**: 
   - `graphify explain "Spurt Start Classification Table"` — shows all spurt types
   - Apply `classify_spurt_start_type()` logic from spec.md line 1437 to categorize each track's spurt as grandstand-straight, back-stretch, or corner-entry type.
3. **Phase boundaries in meters**: 
   - `graphify explain "Phase = 24 Equal Sections System"` — shows the 24-section model
   - Verify all 4 phases align with KuromiAK's doc (each phase = 6 sections = 1/4 of distance).
4. **Bashin conversion**: 
   - `graphify explain "Bashin (Horse Length) — 1 bashin = 2.5m"` — shows lane dimensions too
   - `graphify explain "Lane Dimensions — 1 course width = 11.25m, 1 horse lane = 0.625m"`
   - 1 bashin = 2.5m, 1 lane = 0.625m (18 lanes per 11.25m course width). Verify these constants are correct for all distance calculations.

### Phase 5 — Verification Checklist

Run through the checklist from `docs/data.md` and spec.md line 3253. Use graphify to understand each item before verifying:

```
[ ] All 138 courses have valid phases (sum to distance, no gaps)
      → graphify query "phase verification contiguous sum distance" --budget 2000
[ ] Nakayama 2400m (10606) passes all reference assertions
      → graphify query "nakayama 2400m reference course_set_id 10606" --budget 2000
[ ] All spurt_start entries are within late or last_spurt phase
      → graphify explain "Spurt Start Classification Table"
[ ] All stat_thresholds filled (currently 52 missing)
      → graphify path "Stat System (Raw → Base → Adjusted → Final)" "Stat Thresholds"
[ ] is_finalcorner zone documented: C4.start → goal (NOT C4.end)
      → graphify explain "is_finalcorner Zone Correction (CRITICAL)"
[ ] Terrain changes verified against raw data (10/138 — is this correct?)
[ ] No man's land entries verified against raw data (27/138 — is this correct?)
[ ] Overlaps verified (73/138 — are the other 65 correct as empty?)
[ ] Track names match text_data category=34 from master.mdb (if available)
      → graphify query "text_data category 34 track names master mdb" --budget 2000
[ ] All course_set_ids are unique
[ ] All distances match known track configurations
      → graphify explain "Track Crawler Script" (shows the TRACKS registry)
```

### Phase 6 — Output

At the end of your run, produce:

1. **Updated `data/track_data/tracks.json`** — all 138 courses with stat_thresholds filled and all verifications passed
2. **`data/track_data/verification_report.txt`** — one-line-per-course status showing what changed and what's confirmed
3. **Summary** in chat: total courses processed, stat_thresholds added, any data issues found, master.mdb status

## Ground Rules

- **graphify FIRST, then read** — query the graph before opening any file you're unsure about
- **Read `docs/spec.md` for zone calculations** — it has the authoritative formulas (use graphify to find the right section)
- **Read `docs/data.md` for the verification checklist** — don't skip steps
- **Use `scripts/process_tracks.py` as reference** — it has assertions that define correctness
- **Don't modify the spec docs** — only fix data and scripts
- **If master.mdb can't be found**, document what we'd query but don't block on it
- **Run process_tracks.py after any raw data changes** to regenerate tracks.json
