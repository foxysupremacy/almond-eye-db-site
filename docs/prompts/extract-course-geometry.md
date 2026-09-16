# Course Corner Geometry Extraction Plan

## Goal

Compute exact per-corner turn angles and radii for all 138 race courses, replacing our current approximation (hardcoded 90° corners → 1-3% oval closure error).

## Current State

We have from GameTora JSON (`data/track_data/tracks.json`):
- Corner `start_m`, `end_m`, `length_m` — positions along the track
- `turn_direction` — left/right/straight
- No curvature data — corners are approximated as PI/2 circular arcs

Our pair-based proportional algorithm gives equal radii within each 180° pair, but unequal pair lengths (e.g., Tokyo: C1+C2=575m vs C3+C4=525m) produce different perpendicular displacement, leaving a residual y-offset.

## What We Need

For each corner on each track:
```json
{
  "label": "C1",
  "start_m": 325, "end_m": 575,
  "turn_angle_deg": 78.3,    // actual arc turn angle
  "radius_m": 183.0           // actual arc radius
}
```

## Data Sources to Explore

### Source 1: Unity Mesh Vertices (Authoritative)
The game's 3D track models contain the exact centerline as mesh geometry. If we can extract the inner-rail vertex loop:
1. Project vertices to 2D (drop Y/elevation)
2. Order vertices along the track direction
3. Sample at 1m intervals
4. For each corner segment: fit a circle (least-squares) to the sampled points → radius; turn angle = arc_length / radius

### Source 2: Reverse-Engineering from Known References
JRA publishes official track diagrams with turn radii. Tokyo Racecourse specifications are public. We could:
1. Collect known reference data for 1-2 tracks (Tokyo, Nakayama)
2. Verify our model against references
3. Generalize to other tracks using proportional length ratios

### Source 3: Community Reverse-Engineered Data
The Uma Musume community (GameTora, Discord, wiki contributors) may have already extracted track geometry. Check:
- GameTora's racetrack pages for any hidden geometry data
- JP wiki track data pages
- Community diagram/datamine projects

## Calculation Method (Once We Have Centerline Points)

For a sequence of 2D points `[(x₁,y₁), ..., (xₙ,yₙ)]` within a corner segment:

```
1. Fit circle: minimize Σ(rᵢ - R)² where rᵢ = distance from (xᵢ,yᵢ) to center (Cx,Cy)
   → Use least-squares algebraic circle fit (Taubin or Kasa method)

2. Radius R = 1/κ where κ = fitted curvature

3. Arc length = segment length (from GameTora start_m/end_m)

4. Turn angle θ = arc_length / R

5. Verify: θ should be within [30°, 150°] for any single corner
   → For a 4-corner oval: C1+C2 ≈ 180°, C3+C4 ≈ 180°
   → Total turn across all corners = 360° (closed loop)
```

## Fallback: If No Geometry Source Found

Accept the pair-based proportional model with a post-processing normalization step:
1. Compute path_points as currently (pair-based PI turn angles)
2. After computing all points, apply a gentle shear/rotation to snap start and goal to the same y-level
3. Distribute the correction evenly across all points (sub-pixel adjustment per meter)
4. This preserves corner curvature ratios while guaranteeing visual closure

## Output

`data/track_data/corner_geometry.json` — per-track corner angles and radii, used by `generate_path_points.py` instead of computed proportional turn angles.
