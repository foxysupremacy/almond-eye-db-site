# AlmondEyeDB — Implementation Specification

> Spec version: 1.0
> Last updated: 2026-06-28
> Rule: ALL logic is expressed in pseudo code. No executable language syntax.

---

## §1 System Overview

### Architecture

```
┌────────────────────────────┐
│  Track Geometry Data        │  Static. One-time crawl from GameTora CDN.
│  (corners, slopes, phases,  │  Keyed on course_set_id.
│   straights, path_points)   │  ~138 courses. Updated ~1-2/year.
└──────────┬─────────────────┘
           │
┌──────────┴─────────────────┐
│  master.mdb (raw)           │  Replaced each game content update.
│  ~430 tables                │  Converted from Access → SQLite.
└──────────┬─────────────────┘
           │ import pipeline
┌──────────┴─────────────────┐
│  Normalized Schema          │  skill_triggers, skill_effects,
│  (web-serving SQLite DB)    │  card_skills, characters, cards.
└──────────┬─────────────────┘
           │
┌──────────┴─────────────────┐
│  Backend API                │  Cloudflare Worker.
│  (REST, internal-only)      │  Serves JSON: skills + activation zones +
└──────────┬─────────────────┘  track overlays + comparisons.
           │
┌──────────┴─────────────────┐
│  Frontend                   │  Cloudflare Pages. Static HTML + vanilla JS.
│  (single-page app)          │  Track SVG, skill bars, filters, compare mode.
└────────────────────────────┘
```

### Deployment Model

| Layer | Where | Role |
|-------|-------|------|
| Track data extraction | One-time script | Pull track geometry from GameTora CDN JSON |
| Skill data import | Worker (cron/manual trigger) | master.mdb → normalized SQLite schema |
| API | Worker (service bindings) | 4-5 read-only endpoints, internal only |
| Frontend | Pages (static) | One page: deck picker + track overlay |
| Caching | Worker fetch cache | Per-track × per-character, stale-while-revalidate |

### Data Flow

```
User selects: Track [Tokyo 2400m ▼] + Character [Almond Eye ▼] + 6 support cards
  │
  ▼
Frontend calls: POST /api/tracks/:course_set_id/deck
  │
  ▼
Worker loads track geometry from SQLite (phases, corners, slopes, path_points)
Worker loads all skills for character + all support cards (6-source discovery)
  │
  ▼
For each skill trigger:
  └─ Calculate activation zones (intersect trigger conditions with track geometry)
  └─ Scale duration by track distance
  └─ Compute spurt carry-over if applicable
  └─ Apply inherited scaling if needed
  │
  ▼
Return merged JSON: track + deck + skills + activation zones + coverage_summary
  │
  ▼
Frontend renders:
  └─ Track SVG from path_points
  └─ Phase bands as colored background
  └─ Corner arcs + slope arrows
  └─ Skill bars positioned at activation zones along the track
  └─ Spurt-start marker (vertical dashed line)
  └─ Icons + badges (no text translation needed)
```

---

## §2 Track Geometry Pipeline

### Source

GameTora CDN serves a single JSON file at:
```
https://gametora.com/data/umamusume/racetracks.<hash>.json
```

The `<hash>` changes each build. Discover by checking network requests on any GameTora racetrack page. Current known hash: `7d2f3355`.

### Input Format

The JSON is an array of track groups. Each group has a race_track_id and an array of courses. Each course has phases, corners, slopes, straights, laps, spurt_start, overlaps, no_mans_land, terrain_changes, position_keep_end, and stat_thresholds.

### Pseudo Code

---

**FUNCTION** `DOWNLOAD_RACETRACKS_JSON()`

PURPOSE: Fetch the latest track geometry data from GameTora CDN.

```
FUNCTION download_racetracks_json(hash):
    fetch JSON from "https://gametora.com/data/umamusume/racetracks.{hash}.json"
    if fetch fails:
        report error and exit
    parse response body as JSON
    validate the top-level is an array with at least 10 track groups
    save raw JSON to local file "racetracks_raw.json"
    return the parsed data
```

---

**FUNCTION** `PROCESS_ALL_COURSES(raw_data, track_names_map)`

PURPOSE: Convert raw GameTora JSON into the visualization format for all courses.

```
FUNCTION process_all_courses(raw_data, track_names_map):
    result = empty list

    for each track_group in raw_data:
        race_track_id = convert track_group.id from string to integer
        track_name_jp = lookup track_names_map[race_track_id]
                        or fallback to "Track_{race_track_id}"

        for each course in track_group.courses:
            processed = process_course(course, race_track_id, track_name_jp)
            append processed to result

    sort result by (race_track_id, distance_m, ground_type)
    return result
```

---

**FUNCTION** `PROCESS_COURSE(course, race_track_id, track_name_jp)`

PURPOSE: Convert one course entry to visualization format.

```
FUNCTION process_course(course, race_track_id, track_name_jp):
    distance_m = course.length
    base_time_x = distance_m / 1000.0

    -- Phase conversion
    phases = empty list
    for each phase in course.phases:
        append to phases:
            phase_id    = phase.id           -- 0=early, 1=mid, 2=late, 3=last_spurt
            label_jp    = PHASE_LABEL_MAP[phase.id]   -- 序盤, 中盤, 終盤, 追込
            name_en     = PHASE_NAME_MAP[phase.id]    -- early, mid, late, last_spurt
            start_m     = phase.start
            end_m       = phase.end

    -- Corner conversion
    corners = empty list
    for each corner in course.corners:
        if corner.number > 0:
            label = "C{corner.number}"
        else:
            label = "pseudo_{abs(corner.number)}"
        append to corners:
            label       = label
            corner_no   = corner.number
            start_m     = corner.start
            end_m       = corner.end
            length_m    = corner.end - corner.start

    -- Slope conversion (raw value / 10000 = gradient percent)
    slopes = empty list
    for each slope in course.slopes:
        gradient_pct = slope.slope / 10000.0
        if gradient_pct > 0:
            direction = "uphill"
        else if gradient_pct < 0:
            direction = "downhill"
        else:
            direction = "flat"
        append to slopes:
            start_m     = slope.start
            end_m       = slope.end
            gradient_pct = gradient_pct
            direction   = direction
            length_m    = slope.end - slope.start

    -- Straight conversion
    straights = empty list
    for each straight with index i in course.straights:
        front_type = FRONT_TYPE_MAP[straight.frontType]
                     -- 1="grandstand", 2="opposite"
        append to straights:
            label       = "S{i+1}"
            start_m     = straight.start
            end_m       = straight.end
            length_m    = straight.end - straight.start
            front_type  = front_type

    -- Lap conversion
    laps = empty list
    for each lap in course.laps:
        append to laps:
            lap_no  = lap.lap
            start_m = lap.start
            end_m   = lap.end

    -- Spurt start conversion
    spurt_start = nothing
    if course has field "spurtStart":
        spurt_start = {
            lap:      course.spurtStart.lap
            meters:   course.spurtStart.meters
            location: course.spurtStart.location   -- e.g., ["corner"]
        }

    -- No-mans-land (gaps where horses don't exist)
    no_mans_land = empty list
    for each nml in course.noMansLand:
        append {start_m: nml.start, end_m: nml.end}

    -- Terrain changes (turf ↔ dirt transitions)
    terrain_changes = empty list
    for each tc in course.terrainChanges:
        append {
            start_m: tc.start
            terrain: GROUND_NAME_MAP[tc.terrain]  -- "turf" or "dirt"
        }

    -- Build result
    return {
        course_set_id:       course.id
        race_track_id:       race_track_id
        track_name_jp:       track_name_jp
        distance_m:          distance_m
        ground_type:         GROUND_NAME_MAP[course.terrain]
        turn_direction:      TURN_NAME_MAP[course.turn]
        distance_type:       DISTANCE_TYPE_MAP[course.distance]
        inout:               course.inout
        base_time_x:         base_time_x
        phases:              phases
        corners:             corners
        slopes:              slopes
        straights:           straights
        laps:                laps
        overlaps:            course.overlaps
        no_mans_land:        no_mans_land
        terrain_changes:     terrain_changes
        position_keep_end_m: course.positionKeepEnd
        spurt_start:         spurt_start
        stat_thresholds:     course.statThresholds
    }
```

---

**FUNCTION** `GENERATE_PATH_POINTS(track)`

PURPOSE: Construct an array of (x,y) coordinates, one per meter, that describes the track's 2D shape. Built from corner arcs connected by straight line segments.

```
FUNCTION generate_path_points(track):
    -- Determine turn direction
    turn_is_right = (track.turn_direction == "right")

    -- Build ordered sequence of segments interleaving corners and straights
    -- Sort all zones (corners + straights) by start_m
    segments = merge_and_sort(track.corners, track.straights, key=start_m)

    -- Choose a starting position for the first point (arbitrary origin)
    current_x = 0
    current_y = 0
    current_heading = 0   -- radians, 0 = pointing right (+x direction)

    path_points = empty list
    append {distance_m: 0, x: current_x, y: current_y}

    for distance_m from 1 to track.distance_m:
        -- Find which segment contains this distance
        segment = find segment where segment.start_m <= distance_m < segment.end_m

        if segment is a straight:
            -- Move 1 meter along current heading
            current_x = current_x + cos(current_heading) * 1.0
            current_y = current_y + sin(current_heading) * 1.0

        else if segment is a corner:
            -- Derive corner geometry
            corner_length = segment.end_m - segment.start_m
            -- Estimate turn angle: assume each corner turns ~90° (± depending on track)
            -- For known JRA tracks, corners are approximately quarter-circles
            turn_angle = PI / 2   -- 90 degrees, adjust per track if known
            corner_radius = corner_length / turn_angle

            -- Distance into this corner
            dist_into_corner = distance_m - segment.start_m
            angle_into_corner = dist_into_corner / corner_radius

            if turn_is_right:
                new_heading = current_heading - angle_into_corner
            else:
                new_heading = current_heading + angle_into_corner

            -- Compute position on the arc
            -- The center of the corner circle is offset perpendicular to entry heading
            if turn_is_right:
                center_x = current_x + corner_radius * cos(current_heading - PI/2)
                center_y = current_y + corner_radius * sin(current_heading - PI/2)
                -- Point on arc
                current_x = center_x + corner_radius * cos(new_heading + PI/2)
                current_y = center_y + corner_radius * sin(new_heading + PI/2)
            else:
                center_x = current_x + corner_radius * cos(current_heading + PI/2)
                center_y = current_y + corner_radius * sin(current_heading + PI/2)
                current_x = center_x + corner_radius * cos(new_heading - PI/2)
                current_y = center_y + corner_radius * sin(new_heading - PI/2)

            current_heading = new_heading

        append {distance_m: distance_m, x: current_x, y: current_y} to path_points

    return path_points
```

---

**FUNCTION** `COMPUTE_GATE_POSITIONS(track, run_up_distance_m, float_lane_max)`

PURPOSE: Compute the starting gate positions: a row of gates at the start line, spaced by horse lane width.

CONSTANTS:
    HORSE_LANE_WIDTH = 0.625   -- meters (11.25m course width / 18 lanes)

```
FUNCTION compute_gate_positions(track, run_up_distance_m, float_lane_max):
    -- Start line is behind the distance=0 point by the run-up distance
    -- The gates form a straight line perpendicular to the track direction
    start_line_distance = -run_up_distance_m

    -- Gate 1 is at distance 0 (closest to the inside rail)
    -- Gates are numbered outward from the inside
    gates = empty list
    for gate_number from 1 to max(18, float_lane_max):
        -- Position: each gate is one horse-lane away from the next
        lateral_offset = (gate_number - 1) * HORSE_LANE_WIDTH

        -- Gate positions are arranged along a line perpendicular to the track
        -- at the start line distance
        -- (x,y) coordinates derived from path_points at distance=0
        start_point = path_points[0]   -- (x,y) at distance 0
        heading_at_start = compute_heading(path_points, at_meter=0)

        -- Perpendicular direction (pointing outward from rail)
        perp_x = cos(heading_at_start + PI/2)
        perp_y = sin(heading_at_start + PI/2)

        gate = {
            gate_id:      gate_number
            distance_m:   start_line_distance
            x:            start_point.x + perp_x * lateral_offset
            y:            start_point.y + perp_y * lateral_offset
        }
        append gate to gates

    return gates
```

---

**FUNCTION** `VALIDATE_TRACK(track)`

PURPOSE: Run all verification assertions against a processed track.

```
FUNCTION validate_track(track):
    errors = empty list

    -- 1. Phase boundaries sum to track distance
    last_phase = track.phases[last index]
    if last_phase.end_m != track.distance_m:
        append "Phase end {last_phase.end_m} != distance {track.distance_m}" to errors

    -- 2. Phases are contiguous (no gaps)
    for i from 0 to length(track.phases) - 2:
        if track.phases[i].end_m != track.phases[i+1].start_m:
            append "Gap between phase {i} and {i+1}" to errors

    -- 3. Phase fractions match section rule
    expected_early = track.distance_m / 6
    expected_mid   = track.distance_m / 2
    expected_late  = track.distance_m / 6
    expected_spurt = track.distance_m / 6
    if abs(track.phases[0].end_m - track.phases[0].start_m - expected_early) > 1.0:
        append "Early phase length deviates from distance/6" to errors
    if abs(track.phases[1].end_m - track.phases[1].start_m - expected_mid) > 1.0:
        append "Mid phase length deviates from distance/2" to errors

    -- 4. Corner labels are sequential
    for i from 0 to length(track.corners) - 2:
        if track.corners[i].corner_no > 0 and track.corners[i+1].corner_no > 0:
            if track.corners[i].corner_no + 1 != track.corners[i+1].corner_no:
                append "Non-sequential corners: C{i} then C{i+1}" to errors

    -- 5. All distances within [0, total_distance_m]
    all_zones = merge track.corners + track.slopes + track.straights
    for each zone in all_zones:
        if zone.start_m < 0 or zone.end_m > track.distance_m:
            append "Zone {zone.label} out of bounds" to errors
        if zone.start_m >= zone.end_m:
            append "Zone {zone.label} has non-positive length" to errors

    -- 6. No zero-length slope segments (gradient can be negative for downhill, that's correct)
    for each slope in track.slopes:
        -- gradient_pct can be negative (downhill), that's fine
        if slope.length_m <= 0:
            append "Slope at {slope.start_m} has zero or negative length" to errors

    -- 7. No overlapping zones within same category
    -- Check that adjacent zones of the same type don't overlap
    for each zone_category in [corners, slopes, straights]:
        for i from 0 to length(zone_category) − 2:
            if zone_category[i].end_m > zone_category[i+1].start_m:
                append "Overlap: {zone_category[i].label} ends at {zone_category[i].end_m} but next starts at {zone_category[i+1].start_m}" to errors

    -- 8. base_time_x computed correctly
    expected_base_time_x = track.distance_m / 1000.0
    if abs(track.base_time_x - expected_base_time_x) > 0.001:
        append "base_time_x mismatch" to errors

    -- 9. spurt_start within late or last_spurt phase
    if track has spurt_start:
        late_phase = track.phases[2]   -- phase_id=2 is Late
        spurt_phase = track.phases[3]  -- phase_id=3 is Last Spurt
        ss_m = track.spurt_start.meters
        if ss_m < late_phase.start_m or ss_m > spurt_phase.end_m:
            append "Spurt start {ss_m}m outside late+last_spurt range" to errors

    return errors
```

---

**FUNCTION** `VALIDATE_ALL_TRACKS(tracks)`

PURPOSE: Batch validation with cross-track checks.

```
FUNCTION validate_all_tracks(tracks):
    all_errors = empty map

    for each track in tracks:
        errors = validate_track(track)
        if errors is not empty:
            all_errors[track.course_set_id] = errors

    -- Cross-track: every race_track_id should have at least one course
    track_ids_seen = set of all track.race_track_id
    for id in range 10001 to 10014:
        if id not in track_ids_seen:
            warning "race_track_id {id} has no courses"

    -- Cross-track: verify Nakayama 2400m turf (course_set_id=10606) as known reference
    ref = find track where course_set_id == 10606
    if ref exists:
        verify ref.track_name_jp == "中山"
        verify ref.distance_m == 2400
        verify ref.ground_type == "turf"
        verify length(ref.phases) == 4
        verify ref.phases[0] == {phase_id:0, start_m:0, end_m:400}
        verify ref.phases[3] == {phase_id:3, start_m:2000, end_m:2400}
        verify ref.corners[0].start_m == 325

    return all_errors
```

---

### Phase Constants

```
PHASE_LABEL_MAP = {
    0: "序盤"     -- Early
    1: "中盤"     -- Mid
    2: "終盤"     -- Late
    3: "追込"     -- Last Spurt
}

PHASE_NAME_MAP = {
    0: "early"
    1: "mid"
    2: "late"
    3: "last_spurt"
}

PHASE_SECTIONS = {
    0: "1-4"      -- Early: 4 sections (1/6 of track)
    1: "5-16"     -- Mid:   12 sections (1/2 of track)
    2: "17-20"    -- Late:  4 sections (1/6 of track)
    3: "21-24"    -- Last Spurt: 4 sections (1/6 of track)
}

PHASE_FRACTIONS = {
    0: 1/6        -- Early
    1: 1/2        -- Mid
    2: 1/6        -- Late
    3: 1/6        -- Last Spurt
}

GROUND_NAME_MAP = {
    1: "turf"
    2: "dirt"
}

TURN_NAME_MAP = {
    1: "right"
    2: "left"
    4: "straight"
}

DISTANCE_TYPE_MAP = {
    1: "short"    -- <=1400m
    2: "mile"     -- 1401-1800m
    3: "middle"   -- 1801-2400m
    4: "long"     -- >2400m
}

FRONT_TYPE_MAP = {
    1: "grandstand"   -- home straight
    2: "opposite"     -- back stretch
}
```

---

## §3 Skill Data Pipeline

### Source

master.mdb — an Access database shipped with the game client. Contains ~430 tables. Must be converted to SQLite before import.

### Pseudo Code

---

**FUNCTION** `CONVERT_MASTER_MDB(mdb_path)`

PURPOSE: Convert Microsoft Access .mdb file to SQLite database.

```
FUNCTION convert_master_mdb(mdb_path):
    output_path = mdb_path with extension replaced by ".sqlite3"

    invoke external tool (mdbtools or similar) to:
        enumerate all tables in mdb_path
        for each table:
            export as CSV
            import CSV into SQLite at output_path

    verify output_path exists and has >400 tables
    return output_path
```

---

**FUNCTION** `IMPORT_CHARACTERS(sqlite_db)`

PURPOSE: Extract character data from the chara_data table into normalized characters table.

```
FUNCTION import_characters(sqlite_db):
    query:
        select all rows from chara_data
        where chara_id is not null

    for each row:
        character = {
            id:             row.chara_id
            name_jp:        resolve text from text_data where category=6 and index=row.chara_id
            name_en:        romanized name (manually curated or from alternate source)
            race_running_type: row.race_running_type   -- 1=Nige 2=Senko 3=Sashi 4=Oikomi
            sex:            row.sex
            birth_year:     row.birth_year
            birth_month:    row.birth_month
            birth_day:      row.birth_day
        }
        upsert into characters table on id

    log: "Imported {count} characters"
```

---

**FUNCTION** `IMPORT_CARDS(sqlite_db)`

PURPOSE: Extract card data into normalized cards table.

```
FUNCTION import_cards(sqlite_db):
    query:
        select all rows from card_data
        where chara_id is not null

    for each row:
        card = {
            id:             row.card_id
            chara_id:       row.chara_id
            name_jp:        resolve text from text_data where category=4 and index=row.card_id
            rarity:         row.rarity    -- 1=white 2=gold 3=pink(base) 4=pink(evolved) 5=unique
            talent_level:   row.talent_level or derived  -- may come from card_talent_level_upgrade_item, not card_data directly
            available_skill_set_id: row.available_skill_set_id   -- FK to available_skill_set table
            -- note: skill_upgrade_description is a separate table, joined via skill_upgrade_description.card_id = card_data.id
        }
        upsert into cards table on id

    log: "Imported {count} cards"
```

---

**FUNCTION** `DISCOVER_SKILLS_FOR_CHARACTER(sqlite_db, chara_id)`

PURPOSE: Find ALL skills available to a character across 6 linkage paths. Returns a list of skill IDs with source annotations.

```
FUNCTION discover_skills_for_character(sqlite_db, chara_id):
    discovered = empty map   -- keyed by skill_id, value = {skill_id, source, source_detail}

    -- Source 1: Card regular skills (FK join, most reliable)
    query:
        find all card_data rows for this chara_id
        join card_data.available_skill_set_id → available_skill_set table
        collect skill_id from each available_skill_set row (one skill per row)
    for each skill_id found:
        add to discovered with source="card_regular"

    -- Source 2: Evolved unique skills (FK join via separate table)
    query:
        find all card_data rows for this chara_id
        join skill_upgrade_description ON skill_upgrade_description.card_id = card_data.id
        join skill_data ON skill_data.id = skill_upgrade_description.skill_id
        collect skill_id
    for each skill_id found:
        add to discovered with source="evolved_unique"

    -- Source 3: Base unique skills (ID pattern match)
    -- Pattern: skill_id / 10 == 10000 + (chara_id % 1000)
    -- Only skills with rarity >= 5
    expected_prefix = 10000 + (chara_id % 1000)
    query:
        select from skill_data
        where skill_id / 10 == expected_prefix
        and rarity >= 5
    for each skill_id found:
        add to discovered with source="base_unique_pattern"

    -- Source 4: Inherited versions (pattern: base_skill_id + 800000)
    for each skill_id already in discovered:
        inherited_id = skill_id + 800000
        query: check if inherited_id exists in skill_data
        if exists:
            add to discovered with source="inherited", parent=skill_id

    -- Source 5: Back-references from inherited skills
    -- Inherited skills point back to their originals via unique_skill_id_1 and unique_skill_id_2.
    -- Search only against inherited version IDs (base + 800000) for both columns.
    inherited_ids = all skill_ids in discovered where source is "inherited"
    query:
        select unique_skill_id_1, unique_skill_id_2 from skill_data
        where id in inherited_ids
          and (unique_skill_id_1 > 0 or unique_skill_id_2 > 0)
    for each unique_skill_id_1 and unique_skill_id_2 found:
        if not already in discovered:
            add to discovered with source="back_reference"

    -- Source 6: Support card skills
    query:
        find all support_card_data rows
        unpivot skill_set columns (skill_id_1 through skill_id_20)
        join via support_card_data.chara_id or general availability
    for each skill_id found:
        add to discovered with source="support_card"

    -- Log warnings for any skills found only via pattern matching
    for each skill_id in discovered:
        if skill_id.source is "base_unique_pattern" or "inherited":
            log warning: "Skill {skill_id} found only via pattern match — verify manually"

    return list of all values in discovered
```

---

**FUNCTION** `PARSE_CONDITION_STRING(condition_text)`

PURPOSE: Parse a skill's condition string (precondition_1, condition_1, condition_2) into structured trigger data.

The condition string uses the format:
    `keyword==value` or `keyword>=value` or `keyword<=value`
    `&` means AND (all conditions must be true)
    `@` means OR (creates separate trigger branch)

```
FUNCTION parse_condition_string(condition_text):
    if condition_text is empty or null:
        return empty list

    triggers = empty list

    -- Split on OR separator "@" to get branches
    branches = split condition_text by "@"

    for branch_index from 0 to length(branches) - 1:
        branch = trim(branches[branch_index])
        tokens = split branch by "&"

        trigger = initialize empty trigger record

        for each token in tokens:
            token = trim(token)

            -- Parse operator and values
            -- Format: "keyword{op}{value}"
            parsed = parse_single_condition(token)
            if parsed is null:
                log warning: "Unknown condition token: {token}"
                continue

            -- Map to trigger column based on keyword
            apply parsed to trigger using CONDITION_TOKEN_MAP

        append trigger to triggers

    return triggers
```

**FUNCTION** `parse_single_condition(token)`

```
FUNCTION parse_single_condition(token):
    -- Extract operator
    if token contains "==":
        op = EQUAL
        parts = split by "=="
    else if token contains ">=":
        op = GREATER_EQUAL
        parts = split by ">="
    else if token contains "<=":
        op = LESSER_EQUAL
        parts = split by "<="
    else if token contains "!=":
        op = NOT_EQUAL
        parts = split by "!="
    else if token contains ">":
        op = GREATER
        parts = split by ">"
    else if token contains "<":
        op = LESSER
        parts = split by "<"
    else:
        return null   -- unrecognized format

    keyword = trim(parts[0])
    value_raw = trim(parts[1])
    value = convert value_raw to integer

    return {keyword: keyword, operator: op, value: value}
```

---

**CONDITION_TOKEN_MAP** — mapping from raw condition tokens to trigger fields:

```
CONDITION_TOKEN_MAP = {
    -- Spatial / Phase
    "phase":                          {field: "phase", type: "int"}
    "phase_random":                   {field: "phase_position", type: "string", format: "phase_random:{value}"}
    "phase_firsthalf":                {field: "phase_position", type: "string", format: "firsthalf:{value}"}
    "phase_laterhalf":                {field: "phase_position", type: "string", format: "laterhalf:{value}"}
    "phase_firstquarter":             {field: "phase_position", type: "string", format: "firstquarter:{value}"}
    "phase_laterquarter":             {field: "phase_position", type: "string", format: "laterquarter:{value}"}
    "phase_firsthalf_random":         {field: "phase_position", type: "string", format: "firsthalf_random:{value}"}
    "phase_laterhalf_random":         {field: "phase_position", type: "string", format: "laterhalf_random:{value}"}
    "phase_firstquarter_random":      {field: "phase_position", type: "string", format: "firstquarter_random:{value}"}
    "phase_corner_random":            {field: "phase_position", type: "string", format: "corner_random:{value}"}
    "phase_straight_random":          {field: "phase_position", type: "string", format: "straight_random:{value}"}
    "phase_latter_half_straight_random": {field: "phase_position", type: "string", format: "latter_half_straight_random:{value}"}
    "phase_first_half_straight_random": {field: "phase_position", type: "string", format: "first_half_straight_random:{value}"}
    "corner":                         {field: "corner", type: "int"}
    "corner_random":                  {field: "corner_position", type: "string", format: "corner_random:{value}"}
    "all_corner_random":              {field: "corner_position", type: "string", format: "all_corner_random"}
    "is_finalcorner":                 {field: "is_final_corner", type: "bool"}
    "is_finalcorner_laterhalf":       {field: "is_final_corner_laterhalf", type: "bool"}
    "is_finalcorner_random":          {field: "corner_position", type: "string", format: "finalcorner_random"}
    "is_last_straight":               {field: "is_last_straight", type: "bool"}
    "is_last_straight_onetime":       {field: "is_last_straight_onetime", type: "bool"}
    "last_straight_random":           {field: "straight_position", type: "string", format: "last_straight_random"}
    "straight_random":                {field: "straight_position", type: "string", format: "any_straight_random"}
    "straight_front_type":            {field: "straight_front_type", type: "int"}
    "is_lastspurt":                   {field: "is_last_spurt", type: "bool"}
    "lastspurt":                      {field: "lastspurt", type: "int"}
    "run_at_full_speed_random":       {field: "run_at_full_speed_random", type: "bool"}

    -- Distance / Track
    "distance_type":                  {field: "distance_type", type: "int"}
    "course_distance":                {field: "course_distance", type: "int"}
    "remain_distance":                {field: "remain_distance", type: "int"}
    "distance_rate":                  {field: "distance_rate", type: "int"}
    "distance_rate_after_random":     {field: "distance_rate_after_random", type: "int"}
    "distance_diff_rate":             {field: "distance_diff_rate", type: "int"}
    "furlong":                        {field: "furlong", type: "int"}
    "furlong_random":                 {field: "furlong_random", type: "int"}
    "ground_type":                    {field: "ground_type", type: "int"}
    "ground_condition":               {field: "ground_condition", type: "int"}
    "track_id":                       {field: "track_id", type: "int"}
    "is_tight_track":                 {field: "is_tight_track", type: "bool"}
    "is_basis_distance":              {field: "is_basis_distance", type: "int"}
    "is_abroad":                      {field: "is_abroad", type: "bool"}
    "rotation":                       {field: "rotation", type: "int"}
    "grade":                          {field: "grade", type: "int"}
    "is_dirtgrade":                   {field: "is_dirtgrade", type: "bool"}
    "season":                         {field: "season", type: "int"}
    "weather":                        {field: "weather", type: "int"}
    "time":                           {field: "time", type: "int"}

    -- Position / Order
    "order":                          {field: "order_max", type: "int"}
    "order_rate":                     {field: "order_rate_max", type: "int"}
    "near_count":                     {field: "near_count_min", type: "int"}
    "near_infront_count":             {field: "near_infront_count", type: "int"}
    "distance_diff_top":              {field: "distance_diff_top", type: "int"}
    "distance_diff_top_float":        {field: "distance_diff_top_dm", type: "int", note: "divide by 10 for meters"}
    "bashin_diff_infront":            {field: "bashin_diff_infront", type: "int", note: "multiply by 2.5 for meters"}
    "bashin_diff_behind":             {field: "bashin_diff_behind", type: "int", note: "multiply by 2.5 for meters"}
    "lane_type":                      {field: "lane_type", type: "int"}
    "is_move_lane":                   {field: "is_move_lane", type: "int"}
    "is_behind_in":                   {field: "is_behind_in", type: "bool"}
    "is_surrounded":                  {field: "is_surrounded", type: "bool"}
    "blocked_front":                  {field: "blocked_front", type: "bool"}
    "blocked_front_continuetime":     {field: "blocked_front_time", type: "int"}
    "blocked_side_continuetime":      {field: "blocked_side_time", type: "int"}
    "blocked_all_continuetime":       {field: "blocked_all_time", type: "int"}
    "is_overtake":                    {field: "is_overtake", type: "bool"}
    "overtake_target_time":           {field: "overtake_target_time", type: "int"}
    "change_order_onetime":           {field: "change_order_onetime", type: "int"}
    "change_order_up_end_after":      {field: "change_order_up_end_after", type: "int"}
    "change_order_up_middle":         {field: "change_order_up_middle", type: "int"}
    "change_order_up_finalcorner_after": {field: "change_order_up_finalcorner_after", type: "int"}
    "post_number":                    {field: "post_number", type: "int"}
    "popularity":                     {field: "popularity", type: "int"}
    "running_style":                  {field: "running_style", type: "int"}
    "visiblehorse":                   {field: "visiblehorse", type: "int"}
    "order_rate_in20_continue":       {field: "order_rate_continue", type: "string", format: "in20"}
    "order_rate_in40_continue":       {field: "order_rate_continue", type: "string", format: "in40"}
    "order_rate_in50_continue":       {field: "order_rate_continue", type: "string", format: "in50"}
    "order_rate_in80_continue":       {field: "order_rate_continue", type: "string", format: "in80"}
    "order_rate_out20_continue":      {field: "order_rate_continue", type: "string", format: "out20"}
    "order_rate_out40_continue":      {field: "order_rate_continue", type: "string", format: "out40"}
    "order_rate_out50_continue":      {field: "order_rate_continue", type: "string", format: "out50"}
    "order_rate_out70_continue":      {field: "order_rate_continue", type: "string", format: "out70"}
    "overtake_target_no_order_up_time": {field: "overtake_target_no_up_time", type: "int"}
    "fan_count":                      {field: "fan_count", type: "int"}
    "behind_near_lane_time_set1":     {field: "behind_near_lane_time_set1", type: "int"}

    -- Stat / HP
    "base_speed":                     {field: "min_speed", type: "int"}
    "base_stamina":                   {field: "min_stamina", type: "int"}
    "base_power":                     {field: "min_power", type: "int"}
    "base_guts":                      {field: "min_guts", type: "int"}
    "base_wiz":                       {field: "min_wisdom", type: "int"}
    "hp_per":                         {field: "hp_per_max", type: "int"}
    "is_hp_empty_onetime":            {field: "is_hp_empty", type: "bool"}
    "motivation":                     {field: "motivation", type: "int"}

    -- Timing / Activation
    "accumulatetime":                 {field: "accumulate_time_raw", type: "float"}
    "activate_count_all":             {field: "activate_count_all", type: "int"}
    "activate_count_start":           {field: "activate_count_start", type: "int"}
    "activate_count_middle":          {field: "activate_count_middle", type: "int"}
    "activate_count_end_after":       {field: "activate_count_end_after", type: "int"}
    "activate_count_later_half":      {field: "activate_count_later_half", type: "int"}
    "activate_count_heal":            {field: "activate_count_heal", type: "int"}
    "activate_count_all_team":        {field: "activate_count_all_team", type: "int"}

    -- Skill Interaction
    "is_activate_any_skill":          {field: "is_activate_any_skill", type: "bool"}
    "is_activate_other_skill_detail": {field: "is_activate_other_skill_detail", type: "bool"}
    "is_activate_heal_skill":         {field: "is_activate_heal_skill", type: "bool"}
    "same_skill_horse_count":         {field: "same_skill_count", type: "int"}
    "is_other_character_activate_advantage_skill": {field: "other_skill_type", type: "int"}
    "is_used_skill_id":               {field: "is_used_skill_id", type: "int"}
    "is_exist_skill_id":              {field: "is_exist_skill_id", type: "int"}

    -- Misc
    "always":                         {field: "always_active", type: "bool"}
    "random_lot":                     {field: "random_lot", type: "int"}
    "slope":                          {field: "slope", type: "int"}
    "up_slope_random":                {field: "slope_position", type: "string", format: "uphill_random"}
    "down_slope_random":              {field: "slope_position", type: "string", format: "downhill_random"}
    "infront_near_lane_time":         {field: "infront_near_lane_time", type: "int"}
    "behind_near_lane_time":          {field: "behind_near_lane_time", type: "int"}
    "compete_fight_count":            {field: "compete_fight_count", type: "int"}
    "temptation_count":               {field: "temptation_count", type: "int"}
    "is_temptation":                  {field: "is_temptation", type: "bool"}
    "is_badstart":                    {field: "is_badstart", type: "bool"}
    "is_exist_chara_id":              {field: "is_exist_chara_id", type: "int"}
    "up_slope_random_later_half":     {field: "slope_position", type: "string", format: "uphill_random_later_half"}
    "down_slope_random_later_half":   {field: "slope_position", type: "string", format: "downhill_random_later_half"}
}
```

---

**FUNCTION** `NORMALIZE_SKILL(raw_skill_row)`

PURPOSE: Convert a raw skill_data row into normalized skills, skill_triggers, and skill_effects records.

```
FUNCTION normalize_skill(raw_skill_row):
    -- Convert raw integer values to display values (divide by 10000)
    -- These conversion factors are consistent across the entire game

    -- Build skill record
    skill = {
        id:             raw_skill_row.skill_id
        name_jp:        resolve text from text_data category=47
        rarity:         raw_skill_row.rarity
        tag_id:         raw_skill_row.tag_id            -- 601-615 = green skills
        sp_cost:        raw_skill_row.skill_point or derived (see single_mode_skill_need_point)
        description_jp: resolve text from text_data
        icon_id:        raw_skill_row.icon_id
    }

    -- Build trigger records from conditions
    triggers = empty list
    trigger_index = 1

    for each condition_pair in [
        {pre: raw_skill_row.precondition_1,  cond: raw_skill_row.condition_1},
        {pre: raw_skill_row.precondition_2,  cond: raw_skill_row.condition_2},
    ]:
        if condition_pair.cond is null or empty:
            continue

        -- Combine precondition with condition (AND relationship)
        if condition_pair.pre is not null and not empty:
            full_condition = condition_pair.pre + "&" + condition_pair.cond
        else:
            full_condition = condition_pair.cond

        -- Parse into trigger branches
        branches = parse_condition_string(full_condition)

        -- Duration and cooldown are PER-TRIGGER (stored at trigger level in MDB, shared by all effects)
        trigger_duration_raw = raw_skill_row["float_ability_time_{trigger_index}"] / 10000.0
        trigger_cooldown_raw = raw_skill_row["float_cooldown_time_{trigger_index}"] / 10000.0

        for each branch in branches:
            trigger = branch
            trigger.trigger_index = trigger_index
            trigger.skill_id = raw_skill_row.skill_id
            trigger.duration_raw = trigger_duration_raw
            trigger.cooldown_raw = trigger_cooldown_raw
            append trigger to triggers

        trigger_index = trigger_index + 1

    -- Build effect records
    effects = empty list

    -- Each trigger typically has 1-3 effects
    -- Effect data is stored in columns: ability_type_X_Y, float_ability_value_X_Y
    -- NOTE: duration and cooldown are stored per-trigger (float_ability_time_X, float_cooldown_time_X),
    -- NOT per-effect. All effects within a trigger share the same duration/cooldown.
    for trigger_idx from 1 to trigger_index:
        for effect_idx from 1 to 3:
            ability_type = raw_skill_row["ability_type_{trigger_idx}_{effect_idx}"]
            if ability_type is 0 or null:
                continue

            effect = {
                skill_id:       raw_skill_row.skill_id
                trigger_index:  trigger_idx
                effect_index:   effect_idx
                ability_type:   ability_type
                ability_value:  raw_skill_row["float_ability_value_{trigger_idx}_{effect_idx}"] / 10000.0
                target_type:    raw_skill_row["target_type_{trigger_idx}_{effect_idx}"]
                -- duration/cooldown inherited from parent trigger (see above)
            }
            append effect to effects

    return {skill: skill, triggers: triggers, effects: effects}
```

---

**FUNCTION** `IMPORT_SUPPORT_CARDS(sqlite_db)`

PURPOSE: Extract support card data and their effects.

```
FUNCTION import_support_cards(sqlite_db):
    query:
        select all rows from support_card_data

    for each row:
        support_card = {
            id:             row.support_card_id
            chara_id:       row.chara_id
            name_jp:        resolve text from text_data category=90
            rarity:         row.rarity   -- R, SR, SSR
            support_card_type: row.support_card_type     -- speed, stamina, power, guts, wisdom, friend, etc.
        }
        upsert into support_cards table on id

        -- Import effects at each limit break level
        -- limit_break 0-4 maps to MDB's 11-tier breakpoint columns:
        --   0 = init, 1 = lv5-15, 2 = lv20-30, 3 = lv35-45, 4 = lv50
        -- MDB columns: init, limit_lv5, limit_lv10, ..., limit_lv50
        for limit_break from 0 to 4:
            effects = parse support_card_effect_table for this card at this limit_break
            for each effect:
                upsert into support_card_effects

        -- Import skills from skill_set (20-slot unpivot)
        for slot from 1 to 20:
            skill_id = row["skill_set.skill_id_{slot}"]
            if skill_id is not null and skill_id != 0:
                upsert into support_card_skills
                    {support_card_id, skill_id, slot}

    log: "Imported {count} support cards"
```

---

**FUNCTION** `BUILD_CARD_SKILLS(sqlite_db)`

PURPOSE: Build the junction table linking cards to skills from all discovery sources.

```
FUNCTION build_card_skills(sqlite_db):
    clear card_skills table

    for each card in cards table:
        chara_id = card.chara_id
        skills = discover_skills_for_character(sqlite_db, chara_id)

        for each skill_info in skills:
            insert into card_skills:
                card_id:        card.id
                skill_id:       skill_info.skill_id
                source:         skill_info.source
                source_detail:  skill_info.source_detail

    log: "Built {count} card-skill links"
```

---

**FUNCTION** `VALIDATE_IMPORT(sqlite_db)`

PURPOSE: Verify import integrity with known reference data.

```
FUNCTION validate_import(sqlite_db):
    errors = empty list

    -- Verify Almond Eye (chara_id=1129) skill count
    almond_skills = discover_skills_for_character(sqlite_db, 1129)
    if length(almond_skills) < 12:
        append "Almond Eye has fewer than 12 skills — expected 12+ (check import)" to errors

    -- Verify Curren Bouquetd'or (chara_id=1134) skill count
    curren_skills = discover_skills_for_character(sqlite_db, 1134)
    if length(curren_skills) < 11:
        append "Curren has fewer than 11 skills — expected 11+ (check import)" to errors

    -- Verify row counts are in expected ranges
    verify count(characters) >= 80
    verify count(cards) >= 300
    verify count(skills) >= 4000
    verify count(skill_triggers) >= 6000
    verify count(skill_effects) >= 10000
    verify count(card_skills) >= 6000

    -- Verify Peerless Heroine (skill_id=101291) exists and has 2 triggers
    verify exists skill where id=101291
    verify count triggers where skill_id=101291 == 2

    -- Verify all trigger/effect rows reference valid skill_ids
    verify no orphan triggers (skill_id not in skills)
    verify no orphan effects (skill_id not in skills)

    -- Verify all card_skills reference valid card_ids and skill_ids
    verify no orphan card_skill links

    return errors
```

---

## §4 Activation Zone Calculation (Core Algorithm)

This is the heart of the system. Given a skill trigger and a track, compute the exact meter ranges where the skill can activate.

### Pseudo Code

---

**FUNCTION** `CALCULATE_ACTIVATION_ZONES(skill_trigger, track_geometry)`

PURPOSE: Compute the list of meter ranges where a skill can fire on a given track.

```
FUNCTION calculate_activation_zones(skill_trigger, track_geometry):
    zones = empty list

    -- Step 1: Determine the phase window
    if skill_trigger.phase is not null:
        phase_window = track_geometry.phases[skill_trigger.phase]
        phase_start = phase_window.start_m
        phase_end   = phase_window.end_m
    else if skill_trigger.is_last_spurt is true:
        phase_window = track_geometry.phases[3]   -- last_spurt
        phase_start = phase_window.start_m
        phase_end   = phase_window.end_m
    else:
        -- Skill can fire anywhere on track
        phase_start = 0
        phase_end   = track_geometry.distance_m

    -- Step 2: Intersect with spatial conditions
    spatial_zones = empty list

    if skill_trigger.is_final_corner is true:
        -- CRITICAL: is_finalcorner==1 INCLUDES the final straight!
        -- Activation zone = [C4.start_m .. goal], NOT [C4.start_m .. C4.end_m]
        c4 = find last positive-numbered corner in track_geometry.corners
        if c4 exists:
            append {start: c4.start_m, end: track_geometry.distance_m, label: "c4_final_straight"} to spatial_zones
        else:
            -- Fallback: use last quarter of track
            append {start: track_geometry.distance_m * 3/4, end: track_geometry.distance_m, label: "final_section"} to spatial_zones

    else if skill_trigger.corner_condition is true or skill_trigger.corner is not null:
        -- Intersect with all corner zones
        for each corner in track_geometry.corners:
            if skill_trigger.corner is not null:
                if corner.corner_no != skill_trigger.corner:
                    skip this corner
            -- Only include real corners (positive number), skip pseudo-corners
            if corner.corner_no > 0:
                append {start: corner.start_m, end: corner.end_m, label: corner.label} to spatial_zones

    else if skill_trigger.is_last_straight is true:
        -- The final straight (home stretch)
        last_straight = last element in track_geometry.straights
        append {start: last_straight.start_m, end: last_straight.end_m, label: last_straight.label} to spatial_zones

    else if skill_trigger.straight_position is not null:
        -- All straights or specific straight
        for each straight in track_geometry.straights:
            append {start: straight.start_m, end: straight.end_m, label: straight.label} to spatial_zones

    else if skill_trigger.slope_position is not null:
        -- Intersect with slope zones
        for each slope in track_geometry.slopes:
            matches = false
            if skill_trigger.slope_position contains "uphill" and slope.direction == "uphill":
                matches = true
            else if skill_trigger.slope_position contains "downhill" and slope.direction == "downhill":
                matches = true
            if matches:
                append {start: slope.start_m, end: slope.end_m, label: "slope_{slope.gradient_pct}%"} to spatial_zones

    else:
        -- No spatial condition — use full phase window
        append {start: phase_start, end: phase_end, label: "full_phase"} to spatial_zones

    -- Step 3: Intersect spatial zones with phase window
    for each spatial_zone in spatial_zones:
        -- Compute overlap between spatial zone and phase window
        overlap_start = max(spatial_zone.start, phase_start)
        overlap_end   = min(spatial_zone.end, phase_end)

        if overlap_start < overlap_end:
            -- Valid intersection found
            zone = {
                start_m:    overlap_start
                end_m:      overlap_end
                zone_label: spatial_zone.label
                gradient:   find gradient at midpoint (overlap_start + overlap_end) / 2
                            from track_geometry.slopes
                direction:  "flat" or derived from slope gradient
                timing:     determine_timing(skill_trigger)
            }
            append zone to zones

    -- Step 4: Intersect with distance_type filter
    -- If skill requires a specific distance category, skip non-matching tracks
    if skill_trigger.distance_type is not null:
        if skill_trigger.distance_type != track_geometry.distance_type:
            return empty list   -- This skill cannot activate on this track's distance category

    -- Step 5: Intersect with ground_type filter
    -- If skill requires a specific surface, skip non-matching tracks
    if skill_trigger.ground_type is not null:
        if skill_trigger.ground_type != track_geometry.ground_type:
            return empty list   -- This skill cannot activate on this track's surface

    -- Step 6: Handle sub-phase positioning (firsthalf, laterhalf, firstquarter, laterquarter)
    if skill_trigger.phase_position is not null:
        zones = apply_sub_phase_filter(zones, skill_trigger, track_geometry)

    -- Step 7: Apply random timing adjustment
    if skill_trigger has random timing:
        for each zone in zones:
            zone.timing = "random"
            -- Random skills pick a position within the zone
            -- Display as a shaded band, not a fixed line

    -- Step 6: Apply corner_position random logic
    if skill_trigger.corner_position is not null:
        if skill_trigger.corner_position == "all_corner_random":
            -- Skill makes 4 random rolls, one per corner
            -- Only fires on the corner where the roll succeeds
            zone.timing = "multi_random"
            zone.note = "4 independent rolls"

    return zones
```

---

**FUNCTION** `determine_timing(skill_trigger)`

PURPOSE: Classify the skill's activation timing as fixed or random.

```
FUNCTION determine_timing(skill_trigger):
    if skill_trigger.always_active is true:
        return "always"    -- Green skills, always on

    -- Check for any random-condition keyword
    random_keywords = [
        "phase_random", "phase_laterhalf_random", "phase_firsthalf_random",
        "phase_firstquarter_random", "phase_corner_random", "phase_straight_random",
        "phase_first_half_straight_random", "phase_latter_half_straight_random",
        "corner_random", "all_corner_random", "is_finalcorner_random",
        "straight_random", "last_straight_random", "run_at_full_speed_random",
        "random_lot", "distance_rate_after_random", "up_slope_random",
        "down_slope_random", "up_slope_random_later_half", "down_slope_random_later_half",
        "furlong_random"
    ]

    for each field in skill_trigger:
        for each keyword in random_keywords:
            if field matches keyword:
                return "random"

    return "fixed"
```

---

**FUNCTION** `apply_sub_phase_filter(zones, skill_trigger, track_geometry)`

PURPOSE: Narrow activation zones when the skill targets a sub-division of the phase (first half, later half, first quarter, etc.).

```
FUNCTION apply_sub_phase_filter(zones, skill_trigger, track_geometry):
    phase_id = skill_trigger.phase
    if phase_id is null:
        -- Determine from spatial context or default to full track
        return zones

    phase = track_geometry.phases[phase_id]
    phase_length = phase.end_m - phase.start_m

    if skill_trigger.phase_position contains "firsthalf":
        -- First half of the phase
        sub_start = phase.start_m
        sub_end   = phase.start_m + phase_length / 2
    else if skill_trigger.phase_position contains "laterhalf":
        -- Second half of the phase
        sub_start = phase.start_m + phase_length / 2
        sub_end   = phase.end_m
    else if skill_trigger.phase_position contains "firstquarter":
        -- First quarter of the phase
        sub_start = phase.start_m
        sub_end   = phase.start_m + phase_length / 4
    else if skill_trigger.phase_position contains "laterquarter":
        -- Last quarter of the phase
        sub_start = phase.start_m + phase_length * 3/4
        sub_end   = phase.end_m
    else:
        -- No sub-phase filter
        return zones

    -- Intersect zones with the sub-phase window
    filtered = empty list
    for each zone in zones:
        overlap_start = max(zone.start_m, sub_start)
        overlap_end   = min(zone.end_m, sub_end)
        if overlap_start < overlap_end:
            zone.start_m = overlap_start
            zone.end_m   = overlap_end
            append zone to filtered

    return filtered
```

---

**FUNCTION** `CALCULATE_DURATION_DISPLAY(base_duration_s, track_base_time_x)`

PURPOSE: Scale a skill's base duration to actual game time for the given track distance.

FORMULA: `ActualDuration = BaseDuration × track_distance_m / 1000`
         Which equals: `BaseDuration × base_time_x`

```
FUNCTION calculate_duration_display(base_duration_s, base_time_x):
    actual_duration = base_duration_s * base_time_x
    return actual_duration   -- in seconds of game time
```

---

**FUNCTION** `CALCULATE_ACTIVATION_CHANCE(base_wisdom)`

PURPOSE: Compute the pre-race probability that a skill will activate, based on the horse's wisdom stat.

FORMULA: `max(100 − 9000 / base_wisdom, 20)%`

```
FUNCTION calculate_activation_chance(base_wisdom):
    if base_wisdom <= 0:
        return 0

    raw_chance = 100.0 - (9000.0 / base_wisdom)
    chance = max(raw_chance, 20.0)
    return chance   -- percentage, e.g., 85.0 means 85%
```

---

**FUNCTION** `CALCULATE_SPURT_CARRY_OVER(skill_effect, trigger_zones, track, horse_stats)`

PURPOSE: Determine if a speed/accel skill overlaps the spurt start point, and if so, compute the carry-over benefit using full acceleration profile comparison.

The carry-over effect occurs because speed skills active during the spurt acceleration give the horse a higher starting speed, which is retained even after the skill expires. The correct methodology compares two acceleration profiles: baseline (no skill) vs adjusted (with skill bonus).

FORMULA: Compare acceleration distance profiles — baseline vs skill-assisted.
  meters_saved = (adjusted_distance − baseline_distance) + (time_saved × top_speed)
  Where time_saved = baseline_accel_time − adjusted_accel_time
  Reference values for 2000m/1000pow: gold accel +9.16m, gold speed +3.17m, dual unique +9.15m

```
FUNCTION calculate_spurt_carry_over(skill_effect, trigger_zones, track, horse_stats):
    if track has no spurt_start:
        return {has_carry_over: false}

    if skill_effect.ability_type is not "speed_target" and not "accel":
        return {has_carry_over: false}

    spurt_m = track.spurt_start.meters

    -- Check if any activation zone overlaps the spurt start point
    overlaps_spurt = false
    for each zone in trigger_zones:
        if zone.start_m <= spurt_m and zone.end_m >= spurt_m:
            overlaps_spurt = true
            break

    if not overlaps_spurt:
        return {has_carry_over: false}

    -- Step 1: Compute baseline acceleration profile (no skill)
    base_speed = 20.0 − (track.distance_m − 2000) / 1000    -- m/s
    top_speed = compute_top_speed(track, horse_stats)         -- from base target speed formulas
    base_accel = 0.0006 × sqrt(500 × horse_stats.power) × strategy_accel_coef

    baseline_time = (top_speed − base_speed) / base_accel    -- seconds to reach top speed
    baseline_dist = base_speed × baseline_time + 0.5 × base_accel × baseline_time²

    -- Step 2: Recompute with skill bonus
    if skill_effect.ability_type == "speed_target":
        -- Speed skill gives a headstart: start accelerating from base_speed + bonus
        boosted_start = base_speed + skill_effect.ability_value
        boosted_accel = base_accel
    else if skill_effect.ability_type == "accel":
        -- Accel skill improves acceleration rate
        boosted_start = base_speed
        boosted_accel = base_accel + skill_effect.ability_value

    adjusted_time = (top_speed − boosted_start) / boosted_accel
    adjusted_dist = boosted_start × adjusted_time + 0.5 × boosted_accel × adjusted_time²

    -- Step 3: Compare full distance profiles over the entire acceleration phase
    meters_saved_absolute = adjusted_dist − baseline_dist
    time_saved = baseline_time − adjusted_time
    meters_saved = meters_saved_absolute + time_saved × top_speed

    return {
        has_carry_over:  true
        meters_saved:    meters_saved
        time_saved_s:    time_saved
        display_text:    "🔥 +{meters_saved rounded to 2 decimal}m carry-over"
    }

-- Reference worked examples (2000m track, 1000 Power, base_speed=20, top_speed=24, base_accel=0.424):
--   Gold Accel +0.40: baseline_accel=0.424 → boosted_accel=0.824
--     baseline: 9.43s / 207.46m → adjusted: 4.85s / 216.62m → +9.16m
--   Gold Speed +0.35: baseline_start=20.0 → boosted_start=20.35
--     baseline: 9.43s / 207.46m → adjusted: 8.60s / 210.63m → +3.17m
--   Dual Unique +0.25spd +0.30acc: boosted_start=20.25, boosted_accel=0.724
--     baseline: 9.43s / 207.46m → adjusted: 5.18s / 216.61m → +9.15m
--   Inherited Dual +0.05spd +0.10acc: boosted_start=20.05, boosted_accel=0.524
--     baseline: 9.43s / 207.46m → adjusted: 7.54s / 211.43m → +3.97m
```

---

**FUNCTION** `CLASSIFY_SPURT_START_TYPE(track)`

PURPOSE: Classify where on the track the last spurt begins, to determine which accel skill categories work.

```
FUNCTION classify_spurt_start_type(track):
    if track has no spurt_start:
        return "unknown"

    ss = track.spurt_start
    ss_m = ss.meters

    -- Find which corner (if any) contains the spurt start
    final_corner = last positive-numbered corner in track.corners

    -- Determine which straight is the final straight
    final_straight = last element in track.straights

    -- Check location tags from GameTora data
    location_tags = ss.location   -- e.g., ["corner"] or ["straight"]

    if "corner" is in location_tags:
        if final_corner exists:
            -- Is spurt start within or very near final corner?
            if ss_m >= final_corner.start_m and ss_m <= final_corner.end_m:
                -- Spurt starts ON the final corner
                -- Check position within corner to determine early/late/very-late
                corner_progress = (ss_m - final_corner.start_m) / (final_corner.end_m - final_corner.start_m)
                if corner_progress < 0.3:
                    return "final_corner_early"    -- accels work
                else if corner_progress < 0.6:
                    return "final_corner_late"     -- Maruzensky/Dober fail
                else:
                    return "final_corner_very_late" -- even inherited Taiki fails
            else if ss_m < final_corner.start_m and (final_corner.start_m - ss_m) < 100:
                -- Spurt starts just before final corner (e.g., Tokyo 2400m)
                return "just_before_final_corner"  -- accels work!
            else:
                return "corner_not_final"          -- too early, not near final

    if "straight" is in location_tags:
        if final_straight exists and ss_m >= final_straight.start_m:
            return "final_straight"               -- need final-straight accels
        else:
            return "straight"                     -- need straight-timing accels

    -- Fallback: classify by distance from final corner
    if final_corner exists:
        if ss_m >= final_corner.start_m and ss_m <= final_corner.end_m:
            return "final_corner"
        else if ss_m > final_corner.end_m:
            return "final_straight"

    return "unknown"
```

---

**FUNCTION** `APPLY_INHERITED_SCALING(effect, is_inherited)`

PURPOSE: Reduce a skill's effect values when it is an inherited version.

```
FUNCTION apply_inherited_scaling(effect, is_inherited):
    if not is_inherited:
        return effect   -- no change

    scaled = copy of effect

    -- Strength reduction: −0.2 from the effect value
    scaled.ability_value = max(0, effect.ability_value - 0.20)

    -- Duration reduction: × 0.6 (−40%)
    scaled.duration_raw = effect.duration_raw * 0.6

    -- For recovery-type skills, values are also heavily reduced
    if effect.ability_type == "recovery":
        -- Recovery percentage drops significantly (e.g., 5.5% → 1.5%)
        scaled.ability_value = effect.ability_value * 0.27   -- approximate scaling

    return scaled
```

---

**FUNCTION** `CALCULATE_SPEED_METER_GAIN(effect_value, duration_s, base_time_x)`

PURPOSE: Compute total meters gained from a speed skill. Useful for comparing skill value.

FORMULA: `Meters = effect_value × duration_s × base_time_x`

```
FUNCTION calculate_speed_meter_gain(effect_value, duration_s, base_time_x):
    if effect_value <= 0 or duration_s <= 0:
        return 0

    meters_gained = effect_value * duration_s * base_time_x
    return meters_gained
```

---

**FUNCTION** `CALCULATE_COVERAGE_SUMMARY(skills_with_zones, track)`

PURPOSE: Analyze which phases have skill coverage and identify dead zones.

```
FUNCTION calculate_coverage_summary(skills_with_zones, track):
    summary = {
        early:      {skill_count: 0, effect_density: 0}
        mid:        {skill_count: 0, effect_density: 0}
        late:       {skill_count: 0, effect_density: 0}
        last_spurt: {skill_count: 0, effect_density: 0}
        gaps:       empty list
    }

    for each phase in track.phases:
        phase_meters = phase.end_m - phase.start_m
        active_meters = empty set

        for each skill in skills_with_zones:
            for each zone in skill.activation_zones:
                -- Intersect zone with this phase
                overlap_start = max(zone.start_m, phase.start_m)
                overlap_end   = min(zone.end_m, phase.end_m)
                if overlap_start < overlap_end:
                    summary[phase.name_en].skill_count += 1
                    mark range [overlap_start, overlap_end] as covered in active_meters

        -- Calculate effect density: fraction of phase covered by any skill
        covered_distance = sum of lengths of covered ranges in active_meters
        summary[phase.name_en].effect_density = covered_distance / phase_meters

        -- Find gaps (uncovered regions within this phase)
        find gaps in active_meters where no skill covers
        for each gap:
            append {phase: phase.name_en, start_m: gap.start, end_m: gap.end, label: "dead zone"} to summary.gaps

    return summary
```

---

## §5 Backend API

### Stack

Cloudflare Worker. SQLite database accessed via D1 bindings or service bindings. All endpoints return JSON. Internal-only (CORS restricted to frontend domain).

### Pseudo Code

---

**ENDPOINT** `GET /api/tracks`

PURPOSE: List all available tracks with metadata.

```
FUNCTION handle_get_tracks(request):
    query database:
        select course_set_id, track_name_jp, distance_m, ground_type, turn_direction, distance_type
        from track_meta
        order by race_track_id, distance_m, ground_type

    tracks = empty list
    for each row:
        append {
            course_set_id:  row.course_set_id
            name_jp:        row.track_name_jp
            distance_m:     row.distance_m
            ground_type:    row.ground_type
            turn_direction: row.turn_direction
            distance_type:  row.distance_type
        } to tracks

    return JSON response:
        status: 200
        body: {tracks: tracks}
```

---

**ENDPOINT** `GET /api/tracks/:course_set_id`

PURPOSE: Return full track geometry for rendering.

```
FUNCTION handle_get_track(request, course_set_id):
    -- Load track metadata
    meta = query track_meta where course_set_id = {course_set_id}
    if meta not found:
        return 404 {error: "Track not found"}

    -- Load geometry components
    phases = query track_phases where course_set_id = {course_set_id} order by phase
    corners = query track_corners where course_set_id = {course_set_id} order by start_m
    slopes = query track_slopes where course_set_id = {course_set_id} order by start_m
    straights = query track_straights where course_set_id = {course_set_id} order by start_m
    path_points = query track_path_points where course_set_id = {course_set_id} order by distance_m

    return JSON response:
        status: 200
        body: {
            course_set_id:  meta.course_set_id
            name_jp:        meta.track_name_jp
            distance_m:     meta.distance_m
            ground_type:    meta.ground_type
            turn_direction: meta.turn_direction
            base_time_x:    meta.base_time_x
            base_speed_ms:  meta.base_speed_ms
            phases:         phases
            corners:        corners
            slopes:         slopes
            straights:      straights
            spurt_start:    meta.spurt_start
            path_points:    path_points   -- array of {distance_m, x, y}
            gate_positions: meta.gate_positions
        }
```

---

**ENDPOINT** `GET /api/characters`

PURPOSE: List all characters.

```
FUNCTION handle_get_characters(request):
    query database:
        select id, name_jp, name_en, running_style
        from characters
        order by id

    characters = empty list
    for each row:
        append {id, name_jp, name_en, running_style} to characters

    return JSON response:
        status: 200
        body: {characters: characters}
```

---

**ENDPOINT** `GET /api/characters/:chara_id`

PURPOSE: Character detail with all cards and skill summaries.

```
FUNCTION handle_get_character(request, chara_id):
    chara = query characters where id = {chara_id}
    if chara not found:
        return 404 {error: "Character not found"}

    cards = query cards where chara_id = {chara_id}
    for each card:
        skills = query card_skills join skills where card_id = {card.id}
        card.skills = summarize skills (id, name_jp, rarity, skill_type)

    return JSON response:
        status: 200
        body: {character: chara, cards: cards}
```

---

**ENDPOINT** `POST /api/tracks/:course_set_id/deck`  ← **THE KEY ENDPOINT**

PURPOSE: Given a track and a full deck (1 character card + up to 6 support cards), return the complete activation map — every skill's activation zones on this specific track.

```
FUNCTION handle_post_deck(request, course_set_id):
    -- Parse request body
    body = parse JSON from request body
    chara_id = body.chara_id
    card_id = body.card_id
    support_card_ids = body.support_card_ids   -- array, up to 6
    include_whites = body.include_whites or true
    include_inherited = body.include_inherited or false

    -- Load track geometry
    track = load full track geometry for course_set_id
    if track not found:
        return 404 {error: "Track not found"}

    -- Load deck info
    character = query characters where id = {chara_id}
    card = query cards where id = {card_id} and chara_id = {chara_id}
    support_cards = query support_cards where id in support_card_ids

    -- Collect ALL skills for this deck
    all_skills = empty list

    -- Character card skills
    card_skills = query card_skills join skills where card_id = {card_id}
    for each skill in card_skills:
        if skill.rarity == 1 and not include_whites:
            skip
        mark skill.source = "character"
        mark skill.source_card = card.name_jp
        mark skill.color = source_color("character", skill.rarity)
        append skill to all_skills

    -- Support card skills
    for each sc_id in support_card_ids:
        sc_skills = query support_card_skills join skills where support_card_id = {sc_id}
        for each skill in sc_skills:
            if skill.rarity == 1 and not include_whites:
                skip
            mark skill.source = "support"
            mark skill.source_card = query support_cards.name_jp where id = {sc_id}
            mark skill.color = source_color("support", skill.rarity)
            append skill to all_skills

    -- For each skill, load triggers and effects, then compute activation zones
    skill_results = empty list
    for each skill in all_skills:
        triggers = query skill_triggers where skill_id = {skill.id}
        effects = query skill_effects where skill_id = {skill.id}

        -- Classify skill type from effects
        skill.skill_type = classify_skill_type(effects)
        skill.skill_type_icon = skill_type_icon(skill.skill_type)

        -- Compute activation chance
        -- (use default wisdom stat or user-provided stat)
        skill.activation_chance_pct = calculate_activation_chance(default_wisdom or 1200)

        trigger_results = empty list
        for each trigger in triggers:
            zones = calculate_activation_zones(trigger, track)

            -- Apply inherited scaling if needed
            if include_inherited and skill is inherited:
                for each effect in effects:
                    apply_inherited_scaling(effect, is_inherited=true)

            -- Compute spurt carry-over for each effect
            for each effect in effects:
                carry_over = calculate_spurt_carry_over(effect, zones, track, default_stats)

            -- Build conditions summary string (for display)
            conditions_summary = build_conditions_summary(trigger)

            -- Determine timing display
            timing = determine_timing(trigger)

            append {
                index:               trigger.trigger_index
                timing:              timing
                conditions_summary:  conditions_summary
                activation_zones:    zones
                effects:             format effects with icons
                carry_over:          carry_over
            } to trigger_results

        append {
            id:                     skill.id
            name_jp:                skill.name_jp
            rarity:                 skill.rarity
            source:                 skill.source
            source_card:            skill.source_card
            color:                  skill.color
            skill_type:             skill.skill_type
            skill_type_icon:        skill.skill_type_icon
            sp_cost:                skill.sp_cost
            activation_chance_pct:  skill.activation_chance_pct
            triggers:               trigger_results
        } to skill_results

    -- Compute coverage summary
    coverage = calculate_coverage_summary(skill_results, track)

    -- Build response
    response = {
        track: {
            name_jp:        track.name_jp
            distance_m:     track.distance_m
            ground_type:    track.ground_type
            turn_direction: track.turn_direction
            base_time_x:    track.base_time_x
            base_speed_ms:  track.base_speed_ms
            path_points:    track.path_points
            corners:        track.corners
            phases:         track.phases
            slopes:         track.slopes
            spurt_start:    track.spurt_start
            spurt_start_type: classify_spurt_start_type(track)
        }
        deck: {
            character:  {name_jp: character.name_jp, name_en: character.name_en}
            card:       {name_jp: card.name_jp, rarity: card.rarity}
            support_cards: [{name_jp, rarity} for each in support_cards]
        }
        skills:         skill_results
        coverage_summary: coverage
    }

    return JSON response: status 200, body response
    cache-control: public, stale-while-revalidate, max-age=3600
```

---

**ENDPOINT** `GET /api/tracks/:course_set_id/compare`

PURPOSE: Compare two characters' skill sets on the same track.

```
FUNCTION handle_get_compare(request, course_set_id):
    chara_a = query parameter "a"
    chara_b = query parameter "b"

    if chara_a is missing or chara_b is missing:
        return 400 {error: "Both 'a' and 'b' query parameters are required"}

    -- Run the deck endpoint for each character (with default card)
    deck_a = handle_post_deck logic for chara_a with their default card
    deck_b = handle_post_deck logic for chara_b with their default card

    -- Merge — character A above track, character B below
    return JSON response:
        status: 200
        body: {
            track:      deck_a.track
            character_a: deck_a.deck.character
            character_b: deck_b.deck.character
            skills_a:   deck_a.skills
            skills_b:   deck_b.skills
            overlapping_zones: find zones where both have skills active
        }
```

---

**ENDPOINT** `GET /api/skills/search`

PURPOSE: Filtered skill search across all skills.

```
FUNCTION handle_search_skills(request):
    -- Parse filter parameters
    effect_type = query parameter "effect"     -- "accel", "speed", "recovery", etc.
    distance    = query parameter "distance"   -- "short", "mile", "middle", "long"
    phase       = query parameter "phase"      -- 0, 1, 2, 3
    surface     = query parameter "surface"    -- "turf", "dirt"
    min_value   = query parameter "min_val"    -- minimum effect value
    rarity      = query parameter "rarity"     -- minimum rarity
    running_style = query parameter "style"    -- 1, 2, 3, 4
    limit       = query parameter "limit" or 50

    -- Build query dynamically based on provided filters
    query = "select skills.* from skills
             join skill_triggers on skills.id = skill_triggers.skill_id
             join skill_effects on skills.id = skill_effects.skill_id
             where 1=1"

    if effect_type is not null:
        add filter: "and skill_effects.ability_type in (mapped types for {effect_type})"
    if distance is not null:
        add filter: "and skill_triggers.distance_type = {distance_type_id}"
    if phase is not null:
        add filter: "and (skill_triggers.phase = {phase} or skill_triggers.is_last_spurt = true)"
    if surface is not null:
        add filter: "and skill_triggers.ground_type = {surface_id}"
    if min_value is not null:
        add filter: "and skill_effects.ability_value >= {min_value}"
    if rarity is not null:
        add filter: "and skills.rarity >= {rarity}"
    if running_style is not null:
        add filter: "and skill_triggers.running_style = {running_style}"

    add "group by skills.id"
    add "order by skills.rarity desc, skills.id"
    add "limit {limit}"

    results = execute query

    return JSON response:
        status: 200
        body: {skills: results, count: length(results)}
```

---

### Caching Strategy

```
CACHING:
    Track geometry endpoints:
        cache: immutable, max-age=86400   -- track data never changes

    Deck overlay endpoint:
        cache: public, stale-while-revalidate, max-age=3600
        -- Result depends on track + character + cards
        -- Cache key = url + request body hash

    Character / skill detail:
        cache: stale-while-revalidate, max-age=86400
        -- Changes only on content update

    Search endpoint:
        cache: public, max-age=300
        -- Shorter TTL for frequent queries

    Cache invalidation:
        on content update: purge all cached responses
```

---

## §6 Frontend

### Stack

Static HTML + vanilla JavaScript + CSS. Hosted on Cloudflare Pages. Single-page application. No framework required.

### Pseudo Code

---

**FUNCTION** `INIT_APP()`

PURPOSE: Application entry point. Set up routing, state management, and initial render.

```
FUNCTION init_app():
    -- Initialize application state
    state = {
        selected_track:      null     -- course_set_id
        selected_character:  null     -- chara_id
        selected_card:       null     -- card_id
        support_card_ids:    []       -- up to 6
        include_whites:      true
        include_inherited:   false
        active_filters:      {}       -- type, phase, source filters
        stat_overrides:      {speed: 1200, stamina: 1200, power: 1200, guts: 1200, wisdom: 1200}
        hovered_skill:       null
        expanded_skill:      null
        view_mode:           "deck"   -- "deck" | "compare" | "search"
    }

    -- Parse URL for initial state
    parse_url_parameters(state)

    -- Fetch track list and character list in parallel
    tracks_response     = fetch("/api/tracks")
    characters_response = fetch("/api/characters")

    state.tracks      = tracks_response.tracks
    state.characters  = characters_response.characters

    -- Render the initial UI shell
    render_shell(state)

    -- If URL has track + character, auto-load the deck view
    if state.selected_track and state.selected_character:
        load_and_render_deck_view(state)
```

---

**FUNCTION** `RENDER_SHELL(state)`

PURPOSE: Render the page shell with pickers and controls.

```
FUNCTION render_shell(state):
    clear main_container

    -- Header bar
    render header:
        title: "AlmondEyeDB"
        subtitle: "Skill Activation Zone Visualizer"

    -- Control bar
    render control_bar:
        track_picker:       dropdown of state.tracks, grouped by track_name_jp
        character_picker:   dropdown of state.characters
        card_picker:        dropdown (populated after character selected)
        support_card_pickers: 6 dropdowns (populated after character selected)
        checkbox: "Show white skills" → state.include_whites
        checkbox: "Show inherited" → state.include_inherited
        filter_chips:       toggle buttons for skill types (accel, speed, recovery, green, vision)

    -- Main content area
    render main_content_area:   (empty initially, filled by view renderers)

    -- Token legend (dismissible)
    render legend_panel:
        show icon-to-meaning mappings
        dismiss_button: hide legend
```

---

**FUNCTION** `RENDER_TRACK_VIEW(track_data, deck_data, skills_data, coverage_data)`

PURPOSE: Render the core visualization — the track with skill activation bars overlaid.

```
FUNCTION render_track_view(track_data, deck_data, skills_data, coverage_data):
    clear main_content_area

    -- Determine SVG dimensions from track path_points
    bounds = compute bounding box of track_data.path_points
    svg_width  = bounds.max_x - bounds.min_x + padding * 2
    svg_height = bounds.max_y - bounds.min_y + padding * 2

    -- Apply a scale factor so the track fits in the viewport
    -- Track should be read left-to-right (or curve following)
    scale = compute_scale(svg_width, svg_height, viewport_width, viewport_height)

    create SVG element with viewBox covering bounds

    -- Layer 1: Phase background bands
    for each phase in track_data.phases:
        -- Draw a colored rectangle/band behind the phase section
        -- Colors: Early=light gray, Mid=medium gray, Late=light gray, Last Spurt=red-tinted
        -- Position along the track path between phase.start_m and phase.end_m
        draw_phase_band(svg, track_data.path_points, phase, color=PHASE_COLORS[phase.phase_id])

    -- Layer 2: Corner highlights
    for each corner in track_data.corners:
        if corner.corner_no > 0:
            draw_corner_highlight(svg, track_data.path_points, corner)
            draw_corner_label(svg, corner.label, position at midpoint of corner)

    -- Layer 3: Slope arrows
    for each slope in track_data.slopes:
        if slope.direction == "uphill":
            draw_uphill_arrows(svg, track_data.path_points, slope)
        else if slope.direction == "downhill":
            draw_downhill_arrows(svg, track_data.path_points, slope)

    -- Layer 4: The track path itself
    draw_track_path(svg, track_data.path_points, stroke=dark, fill=none)

    -- Layer 5: Spurt start marker
    if track_data has spurt_start:
        draw_vertical_dashed_line(svg, track_data.path_points, at_meter=track_data.spurt_start.meters)
        draw_label(svg, "SPURT START", at position of dashed line)

        -- First-quarter spurt marker (0-25% of last spurt — premium accel window)
        last_spurt_phase = track_data.phases[3]
        spurt_length = last_spurt_phase.end_m − last_spurt_phase.start_m
        first_quarter_spurt_m = last_spurt_phase.start_m + spurt_length * 0.25
        draw_hairline_marker(svg, track_data.path_points, at_meter=first_quarter_spurt_m, style="dotted")
        draw_label(svg, "¼ spurt", at position of hairline, small_font=true)

    -- Layer 6: Skill activation bars
    -- Sort skills: uniques first, then gold, then white; within each: accel first
    sorted_skills = sort skills_data by (rarity desc, skill_type priority, name)
    -- Priority: acceleration > speed > recovery > lane_change > vision > green > debuff

    y_offset_track = compute vertical offset for skill bars above/below track

    for each skill in sorted_skills:
        -- Skip if filtered out by type/source toggles
        if skill.skill_type is filtered out:
            skip
        if skill.rarity == 1 and not state.include_whites:
            skip
        if skill.source == "inherited" and not state.include_inherited:
            skip

        for each trigger in skill.triggers:
            for each zone in trigger.activation_zones:
                render_skill_bar(svg, skill, trigger, zone, track_data, y_offset_track)

    -- Layer 7: Phase boundary labels
    for each phase in track_data.phases:
        draw_phase_label(svg, track_data.path_points, phase)

    -- Layer 8: Elevation profile (below track)
    draw_elevation_profile(svg, track_data.slopes, track_data.distance_m)

    -- Legend
    render_token_legend(dismissible=true)
```

---

**FUNCTION** `RENDER_SKILL_BAR(svg, skill, trigger, zone, track, y_offset)`

PURPOSE: Draw one activation zone bar for one skill trigger at its position on the track.

```
FUNCTION render_skill_bar(svg, skill, trigger, zone, track, y_offset):
    -- Compute position along the track path
    start_point = get_point_at_distance(track.path_points, zone.start_m)
    end_point   = get_point_at_distance(track.path_points, zone.end_m)

    -- Determine bar dimensions
    bar_length_px = distance_between(start_point, end_point)
    bar_height_px = 8   -- fixed height for skill bars

    -- Determine visual style
    if trigger.timing == "fixed":
        fill_pattern = "solid"
        border_style = "solid"
    else:
        fill_pattern = "hatched"    -- diagonal lines pattern
        border_style = "dashed"

    if skill.skill_type == "acceleration":
        border_width = 3            -- thick border for most important type
        glow = true
    else if skill.skill_type == "vision":
        opacity = 0.5              -- de-emphasized
        fill_pattern = "none"
    else:
        border_width = 1.5

    -- Color by source
    fill_color = skill.color
    -- Adjust opacity by rarity
    if skill.rarity == 1:
        fill_color = lighten(fill_color, 0.3)
    else if skill.rarity >= 5:
        fill_color = saturate(fill_color, 1.2)

    -- Draw the bar
    draw_arc_segment(
        svg = svg,
        path_points = track.path_points,
        from_m = zone.start_m,
        to_m = zone.end_m,
        offset = y_offset,
        height = bar_height_px,
        fill = fill_color,
        fill_pattern = fill_pattern,
        stroke = darken(fill_color, 0.3),
        stroke_width = border_width,
        stroke_style = border_style,
        opacity = opacity or 1.0,
        glow = glow or false
    )

    -- Draw skill label (shortened name)
    draw_label on bar:
        text: truncate(skill.name_jp, 12) + " T" + trigger.index
        font_size: 7

    -- Draw effect badges inside/next to the bar
    for each effect in trigger.effects:
        badge_text = effect.icon + " +" + format_number(effect.ability_value, 2)
        draw_badge(svg, position near bar, text=badge_text)

    -- Draw carry-over badge if applicable
    if trigger.carry_over and trigger.carry_over.has_carry_over:
        draw_badge(svg, position at spurt_start intersection, text="🔥", tooltip=trigger.carry_over.display_text)

    -- Draw duration indicator (bar length already represents duration)
    -- Add a small label showing the scaled duration
    scaled_duration = calculate_duration_display(effect.duration_raw, track.base_time_x)
    draw_duration_label(svg, end_point, text=format_number(scaled_duration, 1) + "s")

    -- Store reference for hover/click interaction
    register_interactive_element(svg_element, {
        skill_id:   skill.id
        trigger:    trigger
        zone:       zone
        on_hover:   highlight_zone_and_show_tooltip
        on_click:   expand_skill_card
    })
```

---

**FUNCTION** `RENDER_SKILL_CARD(skill)`

PURPOSE: Render an expanded detail card for one skill, shown on click/hover.

```
FUNCTION render_skill_card(skill):
    card = create DOM element with class "skill-card"

    -- Header
    card.append:
        rarity_stars:   "★".repeat(skill.rarity)
        skill_name:     skill.name_jp
        skill_type_icon: skill.skill_type_icon
        source_badge:   skill.source with color

    -- SP cost
    if skill.sp_cost:
        card.append: "⭐ {skill.sp_cost}sp"

    -- Activation chance (if not always-active)
    if skill.skill_type != "green" and skill.activation_chance_pct:
        card.append: "🎲 {skill.activation_chance_pct}% chance"

    -- Each trigger
    for each trigger in skill.triggers:
        trigger_section = DOM element

        -- Timing badge
        if trigger.timing == "fixed":
            timing_badge = "📍 Fixed"
        else if trigger.timing == "random":
            timing_badge = "🎲 Random"
        else:
            timing_badge = "✅ Always"

        trigger_section.append timing_badge

        -- Conditions summary
        trigger_section.append trigger.conditions_summary

        -- Activation zones (mini preview)
        zone_list = DOM element
        for each zone in trigger.activation_zones:
            zone_list.append "{zone.zone_label}: {zone.start_m}m – {zone.end_m}m"
            if zone.gradient:
                zone_list.append " ({zone.gradient}% grade)"
        trigger_section.append zone_list

        -- Effects
        for each effect in trigger.effects:
            effect_row = DOM element
            effect_row.append effect.type_icon
            effect_row.append "+{effect.ability_value}"
            scaled_dur = calculate_duration_display(effect.duration_raw, base_time_x)
            effect_row.append "{scaled_dur}s"
            effect_row.append "→ {effect.target}"
            trigger_section.append effect_row

        -- Carry-over info
        if trigger.carry_over and trigger.carry_over.has_carry_over:
            trigger_section.append "🔥 Carry-over: +{trigger.carry_over.meters_saved}m"

        -- Inherited scaling note
        if skill.source == "inherited":
            trigger_section.append "⚠️ Inherited: values reduced (−0.2 str, ×0.6 dur)"

        card.append trigger_section

    -- Stat threshold warning (if skill has stat requirements)
    if skill has stat thresholds:
        for each threshold:
            if current_stat < threshold.value:
                card.append "⚠️ Need {threshold.stat} ≥ {threshold.value} (current: {current_stat})"

    return card
```

---

**FUNCTION** `RENDER_COMPARE_VIEW(track_data, char_a, char_b, skills_a, skills_b)`

PURPOSE: Render two characters' skill sets overlaid on the same track for comparison.

```
FUNCTION render_compare_view(track_data, char_a, char_b, skills_a, skills_b):
    clear main_content_area

    -- Draw the track once (shared)
    draw_track_base(svg, track_data)   -- phases, corners, slopes, path

    -- Character A's skills: offset ABOVE the track
    for each skill in skills_a:
        for each trigger in skill.triggers:
            for each zone in trigger.activation_zones:
                render_skill_bar(svg, skill, trigger, zone, track_data, y_offset = -ABOVE_OFFSET)
                -- Color: character A theme (e.g., red)

    -- Character B's skills: offset BELOW the track
    for each skill in skills_b:
        for each trigger in skill.triggers:
            for each zone in trigger.activation_zones:
                render_skill_bar(svg, skill, trigger, zone, track_data, y_offset = +BELOW_OFFSET)
                -- Color: character B theme (e.g., blue)

    -- Highlight overlapping zones (where both have skills)
    overlaps = find_zone_overlaps(skills_a, skills_b)
    for each overlap in overlaps:
        draw_highlight(svg, overlap, color = "purple", opacity = 0.3)

    -- Character info panels
    render character_a_panel: name, card, stat summary
    render character_b_panel: name, card, stat summary

    -- Coverage comparison table
    render coverage_table:
        side-by-side phase coverage for A vs B
```

---

**FUNCTION** `RENDER_SEARCH_PAGE(state)`

PURPOSE: Render the skill search/filter view.

```
FUNCTION render_search_page(state):
    clear main_content_area

    -- Filter panel
    render filter_panel:
        effect_type_picker: dropdown [Any, Acceleration, Speed(Target), Speed(Current), Recovery, Lane Change, Vision, Green, Debuff]
        distance_picker:    dropdown [Any, Short, Mile, Middle, Long]
        phase_picker:       dropdown [Any, Early, Mid, Late, Last Spurt]
        surface_picker:     dropdown [Any, Turf, Dirt]
        running_style_picker: dropdown [Any, Runner, Chaser, Late Surger, Closer]
        min_value_input:    number input
        rarity_filter:      checkboxes [White, Gold, Pink, Unique]
        sort_by:            dropdown [Rarity, Effect Value, Duration, SP Cost]

    -- Results grid
    results_container = DOM element with CSS grid

    -- Fetch results whenever filters change
    on filter change (debounced 300ms):
        params = build_search_params from state.active_filters
        response = fetch("/api/skills/search?" + params)
        clear results_container
        for each skill in response.skills:
            card = render_compact_skill_card(skill)
            results_container.append card

    -- Compact skill card (smaller than the full detail card)
    FUNCTION render_compact_skill_card(skill):
        card = DOM element, class "skill-card-compact"
        card.append skill.skill_type_icon
        card.append skill.name_jp
        card.append "★".repeat(skill.rarity)
        card.append top effect value and type
        card.append "⭐ {skill.sp_cost}sp"
        -- On hover: show tooltip with full conditions
        -- On click: expand to full skill card
        return card
```

---

**FUNCTION** `HANDLE_INTERACTIONS()`

PURPOSE: Wire up all user interactions.

```
FUNCTION handle_interactions():
    -- Track/character picker changes
    on track_picker change:
        state.selected_track = new_value
        reload_deck_view()

    on character_picker change:
        state.selected_character = new_value
        fetch character's cards
        populate card_picker and support_card_pickers
        reload_deck_view()

    on card_picker change:
        state.selected_card = new_value
        reload_deck_view()

    on support_card_picker change:
        update state.support_card_ids
        reload_deck_view()

    -- Toggle handlers
    on include_whites toggle:
        state.include_whites = !state.include_whites
        re_render skill bars (fade white skills in/out)

    on include_inherited toggle:
        state.include_inherited = !state.include_inherited
        reload_deck_view()

    on skill_type_filter click:
        toggle filter for that type in state.active_filters
        re_render visible skill bars

    -- Hover interactions
    on skill_bar mouseenter:
        state.hovered_skill = skill_id
        highlight the corresponding activation zone on the track
        pulse the bar
        show tooltip: skill name + trigger index + conditions summary

    on skill_bar mouseleave:
        state.hovered_skill = null
        remove highlight
        hide tooltip

    -- Click interactions
    on skill_bar click:
        if state.expanded_skill == skill_id:
            state.expanded_skill = null   -- toggle off
            close skill card
        else:
            state.expanded_skill = skill_id
            open skill card panel with full detail

    on track_zone click:
        find all skills with activation zones covering the clicked meter
        show popup: "Skills active at {distance}m"
        list all skills sorted by type

    on spurt_start_marker click:
        highlight all acceleration skills
        show which accel skills overlap spurt start
        show which accel skills DON'T overlap spurt start (grayed)

    -- Stat slider changes (range: 800 to 2500, matches 5th anniversary cap)
    on stat_slider change (speed/stamina/power/guts/wisdom):
        update state.stat_overrides
        -- Re-evaluate stat thresholds for all skills
        -- Gray out skills whose stat requirements are no longer met
        -- Update activation chance display
        -- Update spurt carry-over calculations

    -- Toggle individual skill on/off (for "what if I drop this skill?" analysis)
    on skill_bar double_click or skill_card toggle button:
        toggle skill.enabled state
        if disabled:
            gray out skill bar on track, remove from coverage_summary
        re_render affected zones and coverage

    -- Hover green skill badge
    on green_skill_badge mouseenter:
        show tooltip with track-specific conditions required:
          season, weather, ground_type, track_id, grade, etc.
        highlight which conditions match current track (green) vs don't (red)

    on green_skill_badge mouseleave:
        hide tooltip

    -- View mode switching
    on compare_mode_button click:
        state.view_mode = "compare"
        prompt for second character
        load compare view

    on search_mode_button click:
        state.view_mode = "search"
        render_search_page(state)
```

---

**FUNCTION** `get_point_at_distance(path_points, distance_m)`

PURPOSE: Map a distance in meters to a (x,y) coordinate on the track SVG.

```
FUNCTION get_point_at_distance(path_points, distance_m):
    idx = round(distance_m)   -- path_points indexed per meter
    if idx < 0:
        idx = 0
    if idx >= length(path_points):
        idx = length(path_points) - 1

    point = path_points[idx]
    return {x: point.x, y: point.y}
```

---

**FUNCTION** `APPLY_VISUAL_LANGUAGE()`

PURPOSE: Define the complete icon/color/kanji visual language. Zero translation dependency.

```
VISUAL_LANGUAGE = {
    -- Effect type icons
    effect_icons: {
        "accel":            "⚡"
        "speed_target":     "🏃"
        "speed_current":    "🏃💨"
        "top_speed":        "🔝"
        "power":            "💪"
        "wisdom":           "🧠"
        "stamina":          "❤️"
        "recovery":         "❤️"
        "lane_change":      "↔️"
        "vision":           "👁️"
        "green_passive":    "🟢"
        "debuff":           "🔻"
    }

    -- Phase kanji badges
    phase_badges: {
        0:  "序"    -- Early
        1:  "中"    -- Mid
        2:  "終"    -- Late
        3:  "追"    -- Last Spurt
    }

    -- Distance kanji badges
    distance_badges: {
        "short":  "短"    -- <=1400m
        "mile":   "マ"    -- 1401-1800m
        "middle": "中"    -- 1801-2400m
        "long":   "長"    -- >2400m
    }

    -- Surface icons
    surface_icons: {
        "turf":  "🌱"
        "dirt":  "🟫"
    }

    -- Position indicators
    position_indicators: {
        "front":    "📍"
        "top3":     "🥉"
        "top":      "🥇"
        "mid":      "📊"
        "back":     "🔻"
    }

    -- Timing indicators
    timing_styles: {
        "fixed":    {border: "solid",  fill: "solid"}
        "random":   {border: "dashed", fill: "hatched"}
        "always":   {border: "dotted", fill: "none", badge: "🟢 always on"}
    }

    -- Skill type visual overrides (applied on top of source color)
    skill_type_styles: {
        "acceleration":  {border_width: 3, glow: true}
        "speed_target":  {border_width: 1.5}
        "speed_current": {border_width: 1.5, glow: true}
        "recovery":      {border_style: "dashed"}
        "lane_change":   {border_style: "dotted", opacity: 0.7}
        "vision":        {opacity: 0.5, border: "none"}
        "green_passive": {render_as: "badge", always_on: true}
        "debuff":        {border_tint: "red"}
    }

    -- Source colors
    source_colors: {
        "character_unique":  "#FF6B6B"   -- red
        "character_gold":    "#FFA726"   -- orange
        "support_gold":      "#42A5F5"   -- blue
        "support_white":     "#BDBDBD"   -- light gray
        "evolved":           "#E040FB"   -- purple
        "inherited":         "#78909C"   -- blue-gray, dashed border
    }

    -- Phase band colors
    phase_colors: {
        0:  "#F5F5F5"    -- Early: light gray
        1:  "#E8E8E8"    -- Mid: medium gray
        2:  "#F5F5F5"    -- Late: light gray
        3:  "#FFECEC"    -- Last Spurt: red-tinted
    }
}

FUNCTION source_color(source, rarity):
    if source == "character" and rarity >= 5:
        return "#FF6B6B"
    if source == "character" and rarity >= 3:
        return "#E040FB"
    if source == "character" and rarity >= 2:
        return "#FFA726"
    if source == "support" and rarity >= 2:
        return "#42A5F5"
    if source == "support":
        return "#BDBDBD"
    if source == "inherited":
        return "#78909C"
    return "#BDBDBD"
```

---

**FUNCTION** `CLASSIFY_SKILL_TYPE(effects)`

PURPOSE: Determine the skill's primary type from its effects.

```
FUNCTION classify_skill_type(effects):
    for each effect in effects:
        if effect.ability_type in [2, 31, 32]:   -- Acceleration types
            return "acceleration"
        if effect.ability_type in [21, 22]:       -- Current Speed types
            return "speed_current"
        if effect.ability_type == 1:              -- Target Speed
            return "speed_target"
        if effect.ability_type in [3, 33]:        -- HP Recovery types
            return "recovery"
        if effect.ability_type == 8:              -- Lane Move Speed
            return "lane_change"
        if effect.ability_type == 9:              -- Vision
            return "vision"
        if effect.ability_type >= 10 and effect.ability_type < 20:  -- Debuff (opponent stat reductions)
            return "debuff"

    -- If no effect type matched, check skill_tag
    if skill_tag in range 601 to 615:
        return "green_passive"

    return "unknown"
```

---

## §7 Content Update Workflow

### Pseudo Code

---

**FUNCTION** `UPDATE_MASTER_MDB(new_mdb_path)`

PURPOSE: Full pipeline for ingesting a new master database when the game updates.

```
FUNCTION update_master_mdb(new_mdb_path):
    log "Starting content update with {new_mdb_path}"

    -- Step 1: Convert Access DB to SQLite
    new_sqlite_path = convert_master_mdb(new_mdb_path)
    log "Converted to {new_sqlite_path}"

    -- Step 2: Diff against current DB
    changes = diff_databases(current_sqlite_path, new_sqlite_path)
    log "Tables changed: {changes.changed_tables}"
    log "Tables added: {changes.added_tables}"
    log "Tables removed: {changes.removed_tables}"

    -- Step 3: Determine if full reimport is needed
    if changes affects core tables (chara_data, card_data, skill_data, support_card_data):
        strategy = "full_reimport"
    else:
        strategy = "incremental_upsert"

    -- Step 4: Import (in transaction)
    begin transaction

    if strategy == "full_reimport":
        -- Clear junction/rebuilt tables
        truncate card_skills, skill_triggers, skill_effects,
                  support_card_effects, support_card_skills

        -- Upsert base tables (match on ID)
        import_characters(new_sqlite_path)     -- upsert on id
        import_cards(new_sqlite_path)          -- upsert on id
        import_skills(new_sqlite_path)         -- upsert on id
        import_support_cards(new_sqlite_path) -- upsert on id

        -- Rebuild derived tables from scratch
        for each skill in skills table:
            normalized = normalize_skill(skill)
            insert skill_triggers from normalized.triggers
            insert skill_effects from normalized.effects

        build_card_skills(new_sqlite_path)
        build_support_card_skills(new_sqlite_path)

    else if strategy == "incremental_upsert":
        -- Only upsert changed tables
        for each changed_table in changes.changed_tables:
            if table is chara_data:    import_characters(new_sqlite_path)
            if table is card_data:     import_cards(new_sqlite_path)
            if table is skill_data:
                import_skills(new_sqlite_path)
                -- Rebuild triggers/effects only for changed skills
                rebuild_triggers_and_effects_for_skills(changes.new_skill_ids)
            if table is support_card_data: import_support_cards(new_sqlite_path)

    -- Step 5: Validate
    errors = validate_import(new_sqlite_path)
    if errors is not empty:
        log "VALIDATION FAILED:"
        for each error in errors:
            log "  - {error}"
        rollback transaction
        return {success: false, errors: errors}

    commit transaction
    log "Content update complete. Strategy: {strategy}"

    -- Step 6: Deploy
    replace current_sqlite_path with new_sqlite_path
    purge_all_api_caches()

    -- Step 7: Keep rollback snapshot
    backup_previous_db with timestamp
    log "Previous DB saved as rollback snapshot (kept for 24h)"

    return {success: true, strategy: strategy}
```

---

**FUNCTION** `UPDATE_TRACK_DATA()`

PURPOSE: Manual process to update track geometry when new tracks are added (rare, ~1-2 per year).

```
FUNCTION update_track_data():
    log "Starting track data update"

    -- Step 1: Discover current hash
    hash = discover_current_gametora_hash()
    -- Check GameTora racetrack page network requests for /data/umamusume/racetracks.*.json

    -- Step 2: Download
    raw_data = download_racetracks_json(hash)
    if download fails:
        return {success: false, error: "Download failed"}

    -- Step 3: Process
    tracks = process_all_courses(raw_data, track_names_map)

    -- Step 4: Generate path_points for each track
    for each track in tracks:
        track.path_points = generate_path_points(track)

    -- Step 5: Compute gate positions for tracks with known run-up data
    for each track in tracks:
        if track has run_up_distance_m:
            track.gate_positions = compute_gate_positions(
                track,
                track.run_up_distance_m,
                track.float_lane_max
            )

    -- Step 6: Validate
    errors = validate_all_tracks(tracks)
    if errors has entries:
        log "Track validation found issues:"
        for each (course_id, error_list) in errors:
            log "  Course {course_id}:"
            for each error in error_list:
                log "    - {error}"
        -- Track validation errors are warnings, not blockers
        -- (some tracks have unusual geometry)

    -- Step 7: Save
    write tracks to "track_data/tracks.json"
    log "Wrote {length(tracks)} courses to track_data/tracks.json"

    -- Step 8: Statistics
    turf_count  = count tracks where ground_type == "turf"
    dirt_count  = count tracks where ground_type == "dirt"
    log "  Turf: {turf_count}, Dirt: {dirt_count}"

    return {success: true, course_count: length(tracks)}
```

---

**FUNCTION** `ROLLBACK_UPDATE()`

PURPOSE: Restore previous database if a content update introduced regressions.

```
FUNCTION rollback_update():
    if no backup exists:
        return {success: false, error: "No rollback snapshot available"}

    restore previous_sqlite_path from backup
    purge_all_api_caches()
    log "Rolled back to previous DB"
    return {success: true}
```

---

## §8 Constants & Formulas Reference

Every game mechanic formula used by the system, documented with pseudo-code definitions.

---

### Game Constants

```
CONSTANTS:
    LANE_WIDTH_HORSE        = 0.625       -- meters (11.25m / 18 lanes)
    COURSE_WIDTH            = 11.25       -- meters (full course width)
    BASHIN                  = 2.5         -- meters (1 horse length)
    FRAME_DURATION_MS       = 66.6        -- milliseconds (~15fps)
    PHASE_TOTAL_SECTIONS    = 24          -- total sections dividing a track
    PHASE_EARLY_SECTIONS    = 4           -- sections for Early phase
    PHASE_MID_SECTIONS      = 12          -- sections for Mid phase
    PHASE_LATE_SECTIONS     = 4           -- sections for Late phase
    PHASE_LAST_SPURT_SECTIONS = 4         -- sections for Last Spurt
    PHASE_EARLY_FRACTION    = 1/6         -- fraction of track for Early
    PHASE_MID_FRACTION      = 1/2         -- fraction of track for Mid
    PHASE_LATE_FRACTION     = 1/6         -- fraction of track for Late
    PHASE_LAST_SPURT_FRACTION = 1/6       -- fraction of track for Last Spurt
    DISPLAY_TIME_MULTIPLIER = 1.18        -- finish time display multiplier
    RAW_VALUE_DIVISOR       = 10000       -- divide raw DB ints by this for display
    STAT_CAP_THRESHOLD      = 1200        -- stats above this are halved
    STAT_CAP_MAX            = 2500        -- absolute stat cap (5th anniversary)
    GREEN_SKILL_LV1         = 40          -- stat bonus for level 1 green skill
    GREEN_SKILL_LV2         = 60          -- stat bonus for level 2 green skill
    INHERITED_STRENGTH_REDUCTION = 0.20   -- how much inherited skills lose
    INHERITED_DURATION_MULTIPLIER = 0.60  -- duration scaling for inherited (−40%)
    INHERITED_RECOVERY_MULTIPLIER = 0.27  -- approximate: standard 5.5%→1.5% (~×0.27), strong 7.5%→3.5% (~×0.47)
                                          -- NOTE: recovery scaling is not a single constant; varies by effect magnitude
    ACTIVATION_CHANCE_FLOOR = 20.0        -- minimum activation chance percentage
    ACTIVATION_CHANCE_DIVISOR = 9000.0    -- divisor in wisdom-based chance formula
```

---

### Formula Definitions

```
-- Skill Duration Scaling
FUNCTION duration_scale(base_duration_s, track_distance_m):
    RETURN base_duration_s * track_distance_m / 1000.0

-- Skill Cooldown Scaling
FUNCTION cooldown_scale(base_cooldown_s, track_distance_m):
    RETURN base_cooldown_s * track_distance_m / 1000.0

-- Activation Chance (wisdom-based pre-race check)
FUNCTION activation_chance(base_wisdom):
    raw = 100.0 - (ACTIVATION_CHANCE_DIVISOR / base_wisdom)
    RETURN max(raw, ACTIVATION_CHANCE_FLOOR)
    -- Returns percentage, e.g., 85.0 means 85% chance

-- Base Speed (varies slightly by track distance)
FUNCTION base_speed(track_distance_m):
    RETURN 20.0 - (track_distance_m - 2000) / 1000.0
    -- At 2000m: 20.0 m/s
    -- At 1200m: 20.8 m/s
    -- At 3600m: 18.4 m/s

-- Finish Display Time
FUNCTION finish_display_time(actual_time_s):
    RETURN actual_time_s * DISPLAY_TIME_MULTIPLIER

-- order_rate threshold (round field_size × rate% before comparing)
FUNCTION order_rate_threshold(field_size, rate_pct):
    RETURN round(field_size * rate_pct / 100.0)
    -- In 9-horse race, order_rate <= 50:
    --   threshold = round(9 * 0.50) = 5
    --   means positions 1-5 qualify (top 5 of 9)

-- Spurt Speed Carry-over (full acceleration profile comparison)
FUNCTION spurt_carry_over(speed_bonus, accel_bonus, base_speed, top_speed, base_accel, power_stat):
    -- Compute two acceleration profiles and compare total distance covered.
    -- Step 1: Baseline (no skill)
    baseline_time = (top_speed − base_speed) / base_accel
    baseline_dist = base_speed × baseline_time + 0.5 × base_accel × baseline_time²

    -- Step 2: Skill-assisted
    boosted_start = base_speed + speed_bonus
    boosted_accel = base_accel + accel_bonus
    adjusted_time = (top_speed − boosted_start) / boosted_accel
    adjusted_dist = boosted_start × adjusted_time + 0.5 × boosted_accel × adjusted_time²

    -- Step 3: Difference in distance covered over the entire acceleration phase
    time_saved = baseline_time − adjusted_time
    meters_saved = (adjusted_dist − baseline_dist) + time_saved × top_speed
    RETURN meters_saved
    -- Reference (2000m/1000pow, base_speed=20, top_speed=24, base_accel=0.424):
    --   Gold Accel +0.40 → +9.16m, Gold Speed +0.35 → +3.17m
    --   Dual +0.25spd+0.30acc → +9.15m, Inherited Dual +0.05+0.10 → +3.97m

-- Speed Meter Gain (total meters gained from a speed skill)
FUNCTION speed_meter_gain(effect_value, duration_s, base_time_x):
    RETURN effect_value * duration_s * base_time_x
    -- Example: 0.25/3s on 2400m → 0.25 * 3.0 * 2.4 = 1.80m
    -- Example: 0.35/1.8s on 2400m → 0.35 * 1.8 * 2.4 = 1.51m

-- Inherited Unique: Strength reduction
FUNCTION inherited_strength(original_value):
    RETURN max(0, original_value - INHERITED_STRENGTH_REDUCTION)
    -- Example: 0.35 → 0.15, 0.45 → 0.25

-- Inherited Unique: Duration reduction
FUNCTION inherited_duration(original_duration):
    RETURN original_duration * INHERITED_DURATION_MULTIPLIER
    -- Example: 5.0s → 3.0s

-- Inherited Unique: Dual skill (speed + accel)
FUNCTION inherited_dual(speed_value, accel_value):
    RETURN {
        speed: max(0, speed_value - INHERITED_STRENGTH_REDUCTION),
        accel: max(0, accel_value - INHERITED_STRENGTH_REDUCTION)
    }
    -- Example: 0.25spd + 0.30acc → 0.05 + 0.10

-- Green Skill Value
FUNCTION green_skill_value(level):
    IF level == 1: RETURN GREEN_SKILL_LV1    -- +40
    IF level == 2: RETURN GREEN_SKILL_LV2    -- +60
    RETURN 0
    -- NOTE: Green skill bonuses bypass stat cap halving (full value even at 2500 cap)

-- Stat Cap Formula (5th Anniversary)
FUNCTION stat_cap(raw_value):
    IF raw_value <= STAT_CAP_THRESHOLD:
        RETURN raw_value
    ELSE:
        RETURN STAT_CAP_THRESHOLD + (raw_value - STAT_CAP_THRESHOLD) / 2
    -- Cap: absolute max 2500

-- bashin to meters conversion
FUNCTION bashin_to_meters(bashin_count):
    RETURN bashin_count * BASHIN
    -- Example: bashin_diff_infront <= 3 → within 7.5m of horse ahead

-- lane count to meters
FUNCTION lane_to_meters(lane_count):
    RETURN lane_count * LANE_WIDTH_HORSE

-- accumulate_time to meters (track-scaled)
FUNCTION accumulatetime_to_meters(accumulate_time_raw, base_time_x):
    RETURN accumulate_time_raw * base_time_x / 10000.0

-- Corner radius from length and angle
FUNCTION corner_radius(corner_length_m, turn_angle_radians):
    RETURN corner_length_m / turn_angle_radians
    -- For typical JRA quarter-circle corners: angle = π/2, radius = length / (π/2)

-- Phase boundary positions
FUNCTION phase_boundaries(track_distance_m):
    RETURN {
        early_start:    0
        early_end:      track_distance_m * PHASE_EARLY_FRACTION
        mid_start:      track_distance_m * PHASE_EARLY_FRACTION
        mid_end:        track_distance_m * (PHASE_EARLY_FRACTION + PHASE_MID_FRACTION)
        late_start:     track_distance_m * (PHASE_EARLY_FRACTION + PHASE_MID_FRACTION)
        late_end:       track_distance_m * (PHASE_EARLY_FRACTION + PHASE_MID_FRACTION + PHASE_LATE_FRACTION)
        last_spurt_start: track_distance_m * (PHASE_EARLY_FRACTION + PHASE_MID_FRACTION + PHASE_LATE_FRACTION)
        last_spurt_end: track_distance_m
    }
    -- Verifies GameTora phase data matches the 1/6 : 1/2 : 1/6 : 1/6 split

-- is_finalcorner activation zone (CRITICAL CORRECTION)
FUNCTION is_finalcorner_zone(track):
    FINAL_CORNER = last positive-numbered corner in track.corners
    IF FINAL_CORNER exists:
        RETURN {start_m: FINAL_CORNER.start_m, end_m: track.distance_m}
        -- INCLUDES the final straight — NOT just the corner!
    ELSE:
        RETURN {start_m: track.distance_m * 3/4, end_m: track.distance_m}
    -- Activation zone = [C4.start_m .. goal], NOT [C4.start_m .. C4.end_m]

-- Skill activation frame ordering
-- On each frame, operations execute in this order:
--   1. Check end of corner
--   2. Activate skills          ← skills fire HERE
--   3. Recover HP by skills
--   4. Update last spurt state
--   5. Update target speed
--   6. Calculate acceleration
--   7. Update phase             ← phase changes HERE
--   8. Calculate distance/position
--   9. Check start of corner
-- Edge case: skill with phase==1&corner!=0 activates when horse exits corner
-- into late-race on the same frame. Skill fires at step 2 (after corner-end check
-- at step 1, before phase update at step 7).
```

---

### 5th Anniversary Mechanics

These mechanics were added in the 5th anniversary update (early 2026). They affect skill value calculations for high-stat builds.

**ZENKAI SPURT** (全開スパート):

```
CONSTANTS ZENKAI_SPURT:
    ZENKAI_SPEED_THRESHOLD = 2000    -- Speed stat must exceed this to trigger
    -- When triggered during last spurt with sufficient HP, continuously gains target speed.
    -- Acceleration uses a separate formula from normal accel:
    --   zenkai_accel = 0.068 × accel_from_power / (course_distance_m / 1000)^1.5
    -- Skill interaction: ability_type=48 skills modify zenkai spurt acceleration (~10% listed value).
    -- Normal acceleration skills do NOT affect zenkai spurt.
    -- Speed is immediately dropped to minimum speed (not decelerated) if HP runs out (known bug).
```

**STAMINA LIMIT BREAK / STAMINA COMPETE** (スタミナ勝負):

```
FUNCTION stamina_limit_break_bonus(stamina_stat, track_distance_m):
    IF stamina_stat <= 1200:
        RETURN 0

    -- Distance factor determines how much the bonus applies
    IF track_distance_m < 2101:  distance_factor = 0.0
    ELSE IF track_distance_m < 2201: distance_factor = 0.5
    ELSE IF track_distance_m < 2401: distance_factor = 1.0
    ELSE IF track_distance_m < 2601: distance_factor = 1.5   -- was 1.2 before 2024-10-29
    ELSE: distance_factor = 1.8                               -- was 1.5 before 2024-10-29

    -- Random factor: 50% × 0.98-1.00, 30% × 0.95-0.98, 20% × 1.00-1.02
    random_factor = roll_random_table()

    bonus = sqrt(stamina_stat − 1200) × 0.0085 × distance_factor × random_factor
    RETURN bonus
    -- Applies as additional target speed buff upon reaching max spurt speed, lasts to finish.
    -- Requires base stamina + skill bonus > 1200 to trigger.
```

**WIZ LIMIT BREAK BUFF:**

```
FUNCTION wiz_limit_break_bonus(base_skill_value, wiz_stat, phase, running_style):
    IF wiz_stat <= 1200:
        RETURN 0
    -- Only applies to rare (gold), pink, and unique skills — NOT white or inherited
    IF skill.rarity NOT IN (gold, pink, unique):
        RETURN 0
    -- Only Target Speed (ability_type=1) and Current Speed with Natural Decel (ability_type=22)
    IF skill.type NOT IN (speed_target, speed_current_with_decel):
        RETURN 0

    wiz_over = wiz_stat − 1200

    -- Wiz multiplier lookup (41 thresholds):
    --   1→0.0, then +0.02 per 20 up to 201→0.2
    --   221→0.26, then +0.06 per 20 up to 401→0.8
    --   421→0.81, then +0.01 per 20 up to 801→1.0
    --   901→1.01, then +0.01 per 100 up to 1901→1.11, 9999→1.12
    multiplier = lookup_wiz_threshold_table(wiz_over)

    -- Phase × strategy coefficient table:
    --   Front Runner:   0.26 early, 0.23 mid, 0.19 late, 0.16 last_spurt
    --   Pace Chaser:    0.21 all phases
    --   Late Surger:    0.19 early, 0.18 mid, 0.23 late, 0.24 last_spurt
    --   End Closer:     0.15 early, 0.17 mid, 0.25 late, 0.27 last_spurt
    phase_coef = WIZ_LIMIT_BREAK_PHASE_COEF[running_style][phase]

    bonus = base_skill_value × multiplier × phase_coef
    RETURN bonus
    -- The wiz stat used is subject to motivation and skill modifiers, but NOT strategy proficiency.
    -- For skills affecting multiple umas, the caster's wiz stat determines the bonus.
```

---

### Spurt Start Classification Table

```
SPURT_START_TYPES = {
    "final_straight": {
        description:         "Spurt starts on the final straight (home stretch)"
        tracks:              ["Chukyo 1200m", "Nakayama 2500m", "Kyoto 3000m", "Kyoto 3200m", "Ooi 1200m"]
        final_corner_accels: false
        note:                "Need final-straight accel skills"
    },
    "final_corner_early": {
        description:         "Spurt starts early in the final corner"
        tracks:              ~30% of G1 tracks
        final_corner_accels: true
        note:                "Standard final-corner accels work"
    },
    "final_corner_late": {
        description:         "Spurt starts late in the final corner"
        tracks:              ["Nakayama 1200m", "Kyoto 1600m", "Tokyo 2000m"]
        final_corner_accels: false
        note:                "Maruzensky/Dober fail — need extended final-corner accels"
    },
    "final_corner_very_late": {
        description:         "Spurt starts very late in the final corner"
        tracks:              ["Hanshin 1600m", "Tokyo 1600m"]
        final_corner_accels: false
        note:                "Even inherited Taiki Shuttle fails"
    },
    "just_before_final_corner": {
        description:         "Spurt starts just before the final corner begins"
        tracks:              ["Tokyo 2400m"]
        final_corner_accels: true
        note:                "Final-corner accels WORK — spurt starts moments before C4"
    },
    "corner_not_final": {
        description:         "Spurt starts on a corner that is NOT the final corner"
        tracks:              ["Nakayama 2000m", "Hanshin 2000m", "Kyoto 2200m", "Ooi 1800m", "Chukyo 1800m dirt", "Ooi 2000m"]
        final_corner_accels: false
        note:                "Corner is too early — final corner comes later"
    },
    "straight": {
        description:         "Spurt starts on a straight that is not the final straight"
        tracks:              []
        final_corner_accels: false
        note:                "Need straight-timing accel skills"
    }
}

OVERALL_SPURT_STATS = {
    corner_spurt:        "76.7% of G1 tracks"
    final_corner_spurt:  "63.3% of G1 tracks"
    straight_spurt:      "23.3% of G1 tracks"
    final_straight_spurt: "13.3% of G1 tracks"
}
```

---

### Skill Type Classification

```
SKILL_TYPE_CATEGORIES = {
    "acceleration": {
        ability_types:      [2, 31, 32]
        icon:               "⚡"
        visual:             "thick solid border (3px), glow effect"
        competitive_value:  "Most important — must hit at spurt start"
        display_priority:   1
    },
    "speed_target": {
        ability_types:      [1]
        icon:               "🏃"
        visual:             "solid bar"
        competitive_value:  "Universal — good in all phases. Useless during spurt acceleration."
        display_priority:   2
    },
    "speed_current": {
        ability_types:      [21, 22]
        icon:               "🏃💨"
        visual:             "solid bar + glow"
        competitive_value:  "Rarer, always better than Target Speed"
        display_priority:   2
    },
    "recovery": {
        ability_types:      [3, 33]
        icon:               "❤️"
        visual:             "dashed bar"
        competitive_value:  "Scales with distance. Mostly Long only."
        display_priority:   3
    },
    "lane_change": {
        ability_types:      [8]
        icon:               "↔️"
        visual:             "dotted bar, subtle"
        competitive_value:  "Situational — can be harmful"
        display_priority:   5
    },
    "vision": {
        ability_types:      [9]
        icon:               "👁️"
        visual:             "50% opacity, grayed out"
        competitive_value:  "Does nothing — default FoV already max"
        display_priority:   6
    },
    "green_passive": {
        skill_tags:         [601, 602, ..., 615]
        icon:               "🟢"
        visual:             "badge (always-on indicator)"
        competitive_value:  "Speed green bypasses stat cap halving"
        display_priority:   4
        always_active:      true
        notes:              "Lv1=+40, Lv2=+60, full value even above 1200 stat cap"
    },
    "debuff": {
        ability_types:      [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
        icon:               "🔻"
        visual:             "red-tinted border"
        competitive_value:  "Niche — concentrated on dedicated debuff characters"
        display_priority:   7
    }
}

STANDARD_DURATION_TIERS = {
    "weak":     {base_duration: 1.8,  examples: "Speed Star (base)",                     visual: "short bar, light color"}
    "standard": {base_duration: 2.4,  examples: "Most corner/straight speed skills",     visual: "medium bar"}
    "premium":  {base_duration: 4.0,  examples: "Never Give Up, evolved Speed Star",     visual: "long bar, saturated color"}
    "ultimate": {base_duration: 5.0,  examples: "Many character uniques",                visual: "longest bar, brightest"}
}
```

---

### Condition Semantics (for Display)

```
CONDITION_SEMANTICS = {
    "near_count":
        threshold: "abs(distance_gap) < 3m AND abs(lane_gap) < 3 horse_lanes"
        display:   "horses within 3m and 3 lanes"

    "is_surrounded":
        threshold: "ahead 0-3m AND within 1.5 lanes; behind 0-3m AND within 1.5 lanes; outside ±1.5m AND within 3 lanes"
        display:   "blocked front, back, and side"

    "blocked_front":
        threshold: "distance_gap 0-2m AND lane_gap within (1.0 - 0.6 × gap/2m) × 0.75 lanes"
        display:   "horse directly ahead within 2m"

    "visiblehorse":
        threshold: "within 20m base distance AND within vision cone"
        display:   "horses visible within 20m cone"

    "order_rate":
        note:      "rounded to nearest integer: round(field_size × rate%)"
        example:   "order_rate <= 50 in 9-horse race → 5 → top 5 positions"

    "bashin_diff_infront":
        threshold: "each bashin = 2.5m"
        display:   "{value} horse lengths ahead → {value * 2.5}m ahead"

    "accumulatetime":
        threshold: "raw value (from DB) × base_time_x = actual seconds"
        display:   "{actual_seconds}s into the race"

    "is_exist_chara_id":
        threshold: "specific character ID present in the race"
        display:   "character #{chara_id} is in the race"
        note:      "used by skills that trigger when a specific uma is present (e.g., rival skills)"
}
```

---

## Verification

### Spec Coverage Verification

The following checks ensure this spec completely covers the reference documentation:

- [ ] Every formula from the 3 community docs captured in §8
- [ ] Every algorithm from visualizer.md §1c-1h present in §4
- [ ] Every endpoint from visualizer.md Phase 2 present in §5
- [ ] Every frontend component from visualizer.md Phase 3 present in §6
- [ ] process_tracks.py logic fully covered in §2
- [ ] schema_visualization.sql schema fully described in pseudo code in §3
- [ ] All data fields from data.md mapped to pseudo code structures
- [ ] is_finalcorner correction documented in §4 with CRITICAL warning
- [ ] Inherited scaling formulas in §4 AND §8
- [ ] Spurt carry-over computation in §4
- [ ] Spurt start classification in §4
- [ ] 6-source skill discovery in §3
- [ ] Condition string parser covers all token groups from §1e of visualizer.md

### Implementation Verification

- [ ] **Track pipeline:** Run process_all_courses → verify 138 courses, Nakayama 10606 assertions pass
- [ ] **Activation zones:** Peerless Heroine on Tokyo 2400m → T1 zones = C1(400-575m), C2(575-900m), C3(1350-1600m); T2 = Last Spurt(2000-2400m)
- [ ] **is_finalcorner:** Verify zones span C4.start through goal, not C4.end
- [ ] **Import pipeline:** Almond Eye (1129) → ≥12 skills, Curren (1134) → ≥11 skills
- [ ] **Frontend:** Tokyo 2400m + Almond Eye → all skill bars render, hover/click work, spurt marker shows
- [ ] **Content update:** Run against older master.mdb snapshot → diff output, no regressions
