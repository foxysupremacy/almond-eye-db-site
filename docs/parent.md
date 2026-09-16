# Parent Selection & Track Dynamics Guide

> **Document Version:** 1.0  
> **Target Audience:** AlmondEyeDB Users, Competitive Umamusume Trainers, and Developers.  
> **Scope:** Universal mechanics governing race track geometry, late-race spurts, skill timing, parent factor selection (因子周回), and the core physics behind competitive recommendations.

---

## 1. Executive Summary & The Fundamental Rule

In *Umamusume: Pretty Derby*, competitive success in PvP events (**Champions Meeting / チャンピオンズミーティング** and **League of Heroes / リーグオブヒーローズ**) is primarily determined by **Parent Selection (継承親)**.

### The Fundamental Rule of Parent Selection
> **A parent's inherited unique skill is only as good as the track geometry at the exact $\frac{2}{3}$ race mark.**
>
> A skill rated **S-Tier (Must-Have)** on one racetrack can become completely **F-Tier (Dead / Useless)** on another racetrack simply because the $\frac{2}{3}$ mark moves from a corner to a straight, or because a slope appears before or after the transition line.

### Native vs. Inherited Unique Skills
When breeding an ace racer, unique skills inherited from parents differ from native unique skills:

| Property | Native Unique Skill (固有スキル) | Inherited Unique Skill (継承固有) |
| :--- | :--- | :--- |
| **Skill Icon** | Rainbow / Gold Unique | White Skill (Normal) |
| **Acceleration Value ($a$)** | $+0.40\text{ m/s}^2$ (standard) | $+0.20\text{ m/s}^2$ (halved) |
| **Speed Value ($v$)** | $+0.35\text{ m/s}$ (standard) | $+0.15\text{ m/s}$ (reduced) |
| **Base Duration ($T_{\text{base}}$)** | $5.0\text{ s}$ (standard) | $3.0\text{ s}$ (shortened) |
| **Skill Point Cost** | Free (Learned at start) | $160–200\text{ Pt}$ |
| **Trigger Reliability** | 100% on condition fulfillment | Dependent on factor inheritance roll & affinity (相性) |

Despite halved values, **Inherited Acceleration Uniques are non-negotiable win conditions** because base acceleration in the game is severely capped. Without stacking multiple acceleration sources at the spurt line, an Uma will lose 3–10 horse lengths before reaching top speed.

---

## 2. Universal Race Phase Anatomy

Every racetrack in the game—from Sapporo 1000m to Stayers Stakes 3600m—is divided into four discrete phases based on race length $L$:

```
0m                                                                                  Lm
┌───────────────┬───────────────────────────────┬───────────────┬──────────────────┐
│   Phase 0     │            Phase 1            │    Phase 2    │     Phase 3      │
│  Early Race   │           Mid-Race            │   Late Race   │    Last Spurt    │
│    (序盤)      │            (中盤)             │     (終盤)     │ (ラストスパート)  │
└───────────────┴───────────────────────────────┴───────────────┴──────────────────┘
0               1/6 L                           2/3 L           5/6 L              L
                                                  ▲
                                         THE SPURT LINE (S_late)
                                         Target Speed Spikes Here!
```

### Phase Definitions

1. **Phase 0 — Early Race (序盤: $0 \to \frac{1}{6} L$):**
   - Gate opening, initial positioning, and fighting for lanes.
   - Horses run at opening target velocity ($v_{\text{open}} \approx 18.0–19.5\text{ m/s}$).
2. **Phase 1 — Mid-Race (中盤: $\frac{1}{6} L \to \frac{2}{3} L$):**
   - Position Keep system (ペースダウン / ペースアップ) controls pacing.
   - Horses cruise at mid-race baseline velocity ($v_{\text{mid}} \approx 19.5–20.5\text{ m/s}$).
   - Stamina conservation occurs here.
3. **Phase 2 — Late Race / Spurt (終盤: $\frac{2}{3} L \to \frac{5}{6} L$):**
   - **Begins at exactly $S_{\text{late}} = L \times \frac{2}{3}$.**
   - Target speed immediately jumps from cruising speed ($v_{\text{mid}}$) to sprint target speed ($v_{\text{spurt}} \approx 23.0–24.5\text{ m/s}$).
   - **Acceleration is the primary limiting factor.**
4. **Phase 3 — Last Spurt / Final Straight (ラストスパート: $\frac{5}{6} L \to L$):**
   - Full-power sprint to the finish line.
   - Guts (根性) and remaining stamina determine stamina decay and final spurt retention.

---

## 3. The 6 Core Course Dynamics ("The Discovered Rules")

The AlmondEyeDB evaluation engine classifies and rates all skills based on **six fundamental track dynamics**:

```
                       ┌─────────────────────────────────────────┐
                       │      Skill Tactical Evaluation Engine   │
                       └────────────────────┬────────────────────┘
                                            │
         ┌──────────────────┬───────────────┴──────────────┬──────────────────┐
         ▼                  ▼                              ▼                  ▼
┌──────────────────┐┌──────────────────┐        ┌──────────────────┐┌──────────────────┐
│ 1. Valid Fastest ││ 2. Carry-Over    │        │ 3. Dead Accel    ││ 4. Delayed Accel │
│    Acceleration  ││    (終盤接続)    │        │    (無効加速)    ││    (遅延加速)    │
│  [Tier S+ / S]   ││  [Tier S+ / S]   │        │     [Tier F]     ││   [Tier B / C]   │
└──────────────────┘└──────────────────┘        └──────────────────┘└──────────────────┘
                            │                              │
                            ▼                              ▼
                 ┌──────────────────┐           ┌──────────────────┐
                 │ 5. Current Speed │           │ 6. Style/Rank    │
                 │    (現在速度)    │           │    Trap          │
                 │   [Tier S / A]   │           │     [Tier F]     │
                 └──────────────────┘           └──────────────────┘
```

---

### Rule 1: Valid Fastest Acceleration (最速有効加速 — Tier S+ / S)

- **Definition:** An acceleration skill that activates at or within **$0\text{m}$ to $30\text{m}$** of the late-race spurt line ($S_{\text{late}}$).
- **Physics Mechanism:**
  At $S_{\text{late}} = \frac{2}{3} L$, the target speed leaps from $v_{\text{mid}}$ to $v_{\text{spurt}}$.
  The horse's acceleration formula is:
  $$\frac{dv}{dt} = a_{\text{base}} + a_{\text{skill}}$$
  Normal base acceleration is only $\sim 0.35–0.45\text{ m/s}^2$. Ramping up from $20.0\text{ m/s}$ to $23.5\text{ m/s}$ requires $\approx 7.0–8.5\text{ seconds}$ and $\approx 150–180\text{ meters}$ of running.
  Adding $+0.20\text{ m/s}^2$ from an inherited acceleration skill cuts this ramp-up duration down to $\approx 5.0\text{ seconds}$, saving **$0.3–0.6\text{ seconds}$** of real race time ($\approx 2–4\text{ horse lengths}$).
- **Parent Hunting Rule:**
  - If $\frac{2}{3} L$ is inside a corner (e.g. Kyoto 2200m, Hanshin 2000m, Nakayama 2500m):
    **Corner Accels** (Seiun Sky *Angling×Scheming*, Mejiro Dober *Kanata*, Mejiro Ryan *Let's Anabolic*) are mandatory.
  - If $\frac{2}{3} L$ is on a straight (e.g. Tokyo 2400m, Hanshin 1600m):
    **Straight Accels** (Mejiro Bright, Narita Taishin *Straight Shot*) are mandatory; corner accels trigger late or not at all.

---

### Rule 2: Carry-Over / Late-Race Connection (終盤接続 — Tier S+ / S)

- **Definition:** A mid-race speed skill that triggers shortly before the $\frac{2}{3}$ line and **remains active across the $S_{\text{late}}$ boundary into Phase 2**.
- **The Carry-Over Formula:**
  $$\text{Trigger Start} < S_{\text{late}} \quad \text{AND} \quad \text{Trigger Start} + d_{\text{eff}} \ge S_{\text{late}}$$
  where effective distance $d_{\text{eff}} = T_{\text{scaled}} \times v_{\text{mid}}$.
- **Physics Mechanism:**
  Normally, horses enter Phase 2 at baseline cruising speed ($v_{\text{mid}} \approx 20.0\text{ m/s}$).
  When a speed skill carries over across the spurt line, the horse enters Phase 2 with a higher entry velocity:
  $$v_{\text{entry}} = v_{\text{mid}} + \Delta v_{\text{skill}} \approx 20.7\text{ m/s}$$
  Because the horse is already traveling at $20.7\text{ m/s}$ when target speed spikes to $23.5\text{ m/s}$, the velocity gap that must be bridged by acceleration shrinks:
  $$\Delta v_{\text{required}} = 23.5 - 20.7 = 2.8\text{ m/s} \quad (\text{instead of } 3.5\text{ m/s})$$
  This effectively **bypasses $\sim 0.35\text{ seconds}$ of the acceleration curve without needing an acceleration skill!**

#### The Kyoto 2200m Downhill Case Study
On Kyoto 2200m (Turf Outer):
- Total length: $L = 2200\text{m}$.
- Spurt line: $S_{\text{late}} = 2200 \times \frac{2}{3} = \mathbf{1466.7\text{m}}$.
- Downhill section: **$1375\text{m} \to 1525\text{m}$**.
- Any downhill-triggered skill (e.g., Alt Mejiro Dober, Valentine Ryan) triggers at **$1375\text{m}$**.
- Duration scaled: $T_{\text{base}} = 2.4\text{s} \implies 2.4 \times \frac{2200}{1000} = \mathbf{5.28\text{s}}$.
- Distance covered: $5.28\text{s} \times 20\text{ m/s} \approx \mathbf{105.6\text{m}}$.
- End of skill: $1375 + 105.6 = \mathbf{1480.6\text{m}}$.
- Overlap past spurt line: $1480.6 - 1466.7 = \mathbf{+13.9\text{m}}$ into late race.
- **Result: 100% deterministic Carry-Over (終盤接続)**, making downhill skills top-tier parent picks!

---

### Rule 3: Dead Acceleration (無効加速 — Tier F)

- **Definition:** An acceleration skill that activates after top sprint speed has already been attained, or before the late-race spurt begins.
- **Physics Mechanism:**
  Acceleration only works when $v < v_{\text{target}}$.
  Once a horse completes its ramp-up to maximum sprint speed ($v \approx 23.5\text{ m/s}$), acceleration does **$0.0\text{ m/s}$** of work:
  $$\text{Effective Speed Gain} = 0$$
- **Classic Trap Examples:**
  - Equipping **Final Straight Accel** on Kyoto 2200m: The final straight starts at $1797\text{m}$. By $1797\text{m}$ ($+330\text{m}$ after the spurt line), all horses are already at maximum sprint speed. **0% effect.**
  - Equipping **Corner Accel** on a track where the corner occurs during mid-race (Phase 1): The horse is already at mid-race cruising speed ceiling, so acceleration does nothing.

---

### Rule 4: Delayed Acceleration (遅延加速 — Tier B / C)

- **Definition:** An acceleration skill that activates between **$+30\text{m}$ and $+180\text{m}$** after the late-race spurt line.
- **Physics Mechanism:**
  The horse has already completed $30\%–70\%$ of its acceleration ramp using base acceleration.
  Because the skill only boosts the tail end of the ramp, the time and distance saved are drastically reduced:
  $$\text{Efficiency Loss} \approx \min\left(80\%, \frac{\Delta S}{180\text{m}} \times 100\%\right)$$
- **Example:**
  On Kyoto 2200m, Corner 4 starts at $1550\text{m}$ ($+83.3\text{m}$ after spurt start). An accel skill requiring "Final Corner" activates late, losing $\approx 45\%$ of its potential value.

---

### Rule 5: Instant Current Speed (現在速度 — Tier S / A)

- **Definition:** A skill using effect types `21` or `22` that directly alters **Current Velocity** ($v_{\text{current}}$) rather than Target Velocity ($v_{\text{target}}$).
- **Difference Between Speed Types:**

```
Target Speed (Type 27):
Current Speed:  20.0 m/s ────┐ (Must accelerate up to reach new target)
Target Speed:   20.0 m/s ───► 20.35 m/s

Current Speed (Type 21/22):
Current Speed:  20.0 m/s ───► 20.35 m/s (INSTANT JUMP, zero ramp-up delay!)
```

- **Why it Matters for Parents:**
  - Unlike target speed skills, **Current Speed skills are 100% effective even while the horse is accelerating** in Phase 2!
  - They give an immediate instant lead against rivals, making them premier parent choices for all distances.

---

### Rule 6: Running Style & Rank Traps (順位・脚質不一致 — Tier F)

- **Definition:** Inheriting a top-tier skill whose trigger condition conflicts with the horse's tactical running style or expected position.
- **Champions Meeting (9 Umamusume) Position Breakdown:**

| Strategy (脚質) | Expected Typical Rank | Viable Order Triggers | Incompatible Rank Conditions (Traps) |
| :--- | :--- | :--- | :--- |
| **Runner (逃げ)** | **1st – 2nd** | `order == 1`, `order <= 2` | `order >= 4` (Never triggers) |
| **Leader (先行)** | **2nd – 5th** | `order_rate 20%–50%` | `order == 1` (Lost if Runner exists) |
| **Betweener (差し)** | **4th – 7th** | `order_rate 40%–80%` | `order <= 2` (Impossible position) |
| **Chaser (追込)** | **5th – 9th** | `order_rate 50%–90%` | `order <= 3` (Impossible position) |

- **Classic Trap:**
  Equipping Seiun Sky's *Angling×Scheming* (`order == 1`) on a Betweener or Leader. Unless the race has zero Runners and the Leader breaks into 1st, the skill has a **0% activation rate**.

---

## 4. Mathematical Modeling & Course Scaling

Every calculation in AlmondEyeDB uses the official game formulas:

### 1. Duration Scaling Formula
Base skill duration from the master database ($T_{\text{base}}$ in centiseconds) scales proportionally to the racetrack length:
$$T_{\text{scaled}} = \left(\frac{T_{\text{base}}}{10000}\right) \times \left(\frac{L}{1000}\right)$$

*Example on Kyoto 2200m ($L = 2200\text{m}$):*
- White Skill Base Time: $T_{\text{base}} = 18000\text{ cs} = 1.80\text{ s}$.
- Scaled Duration: $1.80 \times \frac{2200}{1000} = \mathbf{3.96\text{ seconds}}$.

### 2. Distance Traveled Formula
At standard cruising velocity ($v \approx 20.0\text{ m/s}$):
$$d_{\text{eff}} \approx T_{\text{scaled}} \times 20.0\text{ m/s}$$
- A $3.96\text{s}$ skill covers $\approx \mathbf{79.2\text{ meters}}$.
- A $5.28\text{s}$ skill covers $\approx \mathbf{105.6\text{ meters}}$.

### 3. Spurt Line Timing Offset ($\Delta S$)
$$\Delta S = S_{\text{trigger}} - S_{\text{late}} = S_{\text{trigger}} - \left(\frac{2}{3} L\right)$$

| Offset Value ($\Delta S$) | Dynamic Classification | Tactical Verdict | Rating Tier |
| :--- | :--- | :--- | :--- |
| **$-20\text{m} \le \Delta S \le +25\text{m}$** (Accel) | **Valid Fastest Accel** | Triggers immediately at the spurt line. Maximum lengths saved. | **Tier S+ / S** |
| **$\Delta S < 0$ and $S_{\text{trigger}} + d_{\text{eff}} > S_{\text{late}}$** (Speed) | **Carry-Over (終盤接続)** | Carries speed boost past the $2/3$ mark into Phase 2. | **Tier S+ / S** |
| **$+25\text{m} < \Delta S \le +180\text{m}$** (Accel) | **Delayed Accel** | Partial acceleration benefit; loses $30\%–70\%$ value. | **Tier B / C** |
| **$\Delta S > +180\text{m}$** (Accel) | **Dead Accel** | Triggers after cruising at top sprint speed. Completely wasted. | **Tier F** |

---

## 5. Parent Selection Blueprint: Step-by-Step Workflow

When planning parent factor farming (因子周回), follow this 5-step checklist:

```
┌────────────────────────────────────────────────────────┐
│ STEP 1: Track Geometry Analysis                        │
│ Find the 2/3 Spurt Line (S_late = L * 2/3)             │
│ Is it in a Corner, Straight, or on a Slope?            │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ STEP 2: Anchor Acceleration Parent                     │
│ Select the #1 Valid Accel for your Running Style:      │
│ • Runner: Angling (Seiun Sky)                          │
│ • Betweener/Chaser: Anabolic (Ryan) or Kanata (Dober)  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ STEP 3: Secondary Parent (Carry-Over or Current Speed) │
│ • Look for Downhill/Uphill slopes spanning the 2/3 mark│
│ • Select Current Speed uniques (Almond Eye, Mecha Hie) │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ STEP 4: White Skill Factor Optimization                │
│ Convert Gold event skills to White inheritable factors │
│ (e.g., Arc Maestro -> Corner Recovery ○)               │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ STEP 5: Affinity (相性) & Pedigree Matching            │
│ Verify grandparent compatibility to guarantee 3-star   │
│ spark chance during training inheritance gates.        │
└────────────────────────────────────────────────────────┘
```

---

## 6. Gold-to-White Factor Inheritance Reference

Gold skills from support card decks **do not inherit directly as Gold skills**. Instead, parents pass them down as **White skill factors**.

The table below details high-priority conversions handled automatically by AlmondEyeDB:

| Support Card Gold Skill | Inheritable White Skill | Effect Type | Factor Priority |
| :--- | :--- | :--- | :--- |
| **Arc Maestro (円弧のマエストロ)** | **Corner Recovery ○ (コーナー回復◯)** | $5.5\% \to 1.5\%$ HP Heal | **Tier S** |
| **Top Runner (トップランナー)** | **Leader Pride (先頭プライド)** | Mid-Race Target Speed | **Tier S** |
| **Professor of Curvature (弧線のプロフェッサー)** | **Corner Adept ○ (コーナー巧者◯)** | General Corner Speed | **Tier S** |
| **Rising Dragon (昇り龍)** | **Outer Outflank (外角追い抜き)** | Late-Race Speed | **Tier A** |
| **Turbulent Flow (怒涛の追撃)** | **Tail Catch (尻尾掴み)** | Late-Race Current Speed | **Tier S** |
| **Non-Stop Girl (ノンストップガール)** | **Tareuma Avoidance (垂れウマ回避)** | Hybrid Accel + Lane | **Tier S** |
| **Agile Footwork (神速)** | **Rapid (快速)** | Current Speed + Heal | **Tier S** |

---

## 7. How AlmondEyeDB Automates These Rules

AlmondEyeDB implements the entire logic described in this guide programmatically across its modular parenting architecture:

1. **[`lib/parenting/`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parenting/)**:
   - **[`aptitude-evaluator.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parenting/aptitude-evaluator.ts)**: Evaluates whether an Uma requires pink factors (1-4-7-10 stars) for track surface/distance and Medium G1 circuit farming.
   - **[`deck-analyzer.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parenting/deck-analyzer.ts)**: Scans the equipped support card deck to prevent character collisions and identify scarce hunt targets.
   - **[`skill-evaluator.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parenting/skill-evaluator.ts)**: Implements 2/3 spurt line timing, 5-tier community roles (★5 Hybrid, ★4 Fastest Accel, ★3 Carry-Over, Mid/End Speed, Synergy), and white kit evaluations.
   - **[`single-recommender.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parenting/single-recommender.ts)**: Scores and ranks individual parents across user veterans and character templates.
   - **[`lineage-combinations.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parenting/lineage-combinations.ts)**: Generates 6-slot bloodlines, 2-parent combinations (Your Lineage + Friend Borrow), and actionable friend borrow blueprints.
   - **[`use-parent-recommender.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parenting/use-parent-recommender.ts)**: Headless React hook with memoized combinations, recommendations, and deck analysis.
2. **[`lib/affinity-engine.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/affinity-engine.ts)**:
   - Computes Post-2.0 compatibility (+3 points per overlapping G1 race win) and relation type affinity points.
   - Calculates Parent-to-Parent pair affinity and total 6-slot lineage score.
3. **[`lib/factor-decoder.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/factor-decoder.ts)**:
   - Decodes numeric factor IDs into Blue stats, Pink aptitudes, Green uniques, and White skills/races/scenarios.
   - Calculates total 9★ Blue lineage totals.
4. **UI Components**:
   - **[`BestCombinationModal`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/components/parenting/best-combination-modal.tsx)**: Dual-stream combination explorer (From Your History vs. Ideal Borrow Blueprint).
   - **[`ParentingView`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/components/parenting/parenting-view.tsx)**: Interactive 6-slot pedigree tree with 1-click auto-selection and affinity breakdown header.

---

## 8. Deep Compatibility & Bloodline Affinity Mechanics

> Sourced from: [Crazyfellow's Parenting & Gene guide.md](file:///Users/fubuki/Documents/AlmondEyeDB/docs/parenting/Crazyfellow%27s%20Parenting%20&%20Gene%20guide.md) (Chapter 1)

### The Post-2.0 Modern Compatibility System
Since the JP 2.0 Anniversary overhaul (and active on Global as of June 2026), the compatibility calculation was streamlined and rebalanced:

1. **G1 Only**: Only overlapping G1 race wins grant bonus compatibility points (**+3 points per shared win**).
2. **Obsolete Factors**: G2/G3 races, Pre-OP/OP races, and old race titles (Classic Triple Crown, Triple Tiara) **no longer contribute** any compatibility.
3. **Parent-to-Parent Overlap**: Overlapping G1 wins between Parent 1 and Parent 2 directly contribute to the overall lineage score.
4. **No Duplicate Race Bonus**: Winning the same G1 race twice (e.g. Arima Kinen in both Classic and Senior years) grants **no extra compatibility points**; each unique G1 race counts at most once per pairing.
5. **Rating Thresholds**:
   - **◎ Double Circle (High)**: $> 150\text{ points}$
   - **◯ Single Circle (Normal)**: $51–150\text{ points}$
   - **△ Triangle (Low)**: $< 50\text{ points}$
   - **Competitive Benchmark**: While in-game ◎ triggers at 151 points, competitive PvP builds target $\mathbf{\ge 300\text{ points}}$, with optimal lineages reaching $\mathbf{\approx 500\text{ points}}$.

### Individual Compatibility Link Theory (Polaris & Shoppo Patent Research)
While the game UI presents a single aggregate rating symbol (◎ / ◯ / △), Cygames' patent and extensive empirical research by Polaris (@BourBon_Polaris) and Shoppo (@shoppo_ura) confirm that compatibility operates through **discrete individual links**:

$$\text{Total Score} = \text{Link}(P_1 \to T) + \text{Link}(P_2 \to T) + \text{Link}(P_1 \to P_2) + \sum_{i=1}^2 \sum_{j=1}^2 \text{Link}(GP_{i,j} \to P_i \to T)$$

> [!WARNING]
> **The Hidden "Weak Link" Hazard**:
> A lineage can reach ◎ (e.g. 155 points) through high race count on one branch while containing an extremely weak individual link (e.g. Fuji Kiseki with poor base compatibility and low shared races with Kitasan Black). In this scenario, factors originating from the weak grandparent will suffer drastically reduced inheritance proc rates despite the overall ◎ rating.

---

## 9. The Exact Inheritance Probability Formula (Polaris & Shoppo Patent Model)

> Sourced from: [Crazyfellow's Parenting & Gene guide.md](file:///Users/fubuki/Documents/AlmondEyeDB/docs/parenting/Crazyfellow%27s%20Parenting%20&%20Gene%20guide.md) (Bonus Chapter)

### The Mathematical Formula
Verified across thousands of controlled trial runs, factor inheritance at the mid-run inheritance gates (Classic April & Senior April) follows the patent formula:

$$\text{Inheritance Chance} = \text{Base Odds per Type} \times \left(1 + \frac{\text{Individual Compatibility Score}}{100}\right)$$

### Base Factor Activation Rates (at 0 Compatibility)

| Factor Category | 1★ Rate | 2★ Rate | 3★ Rate |
| :--- | :---: | :---: | :---: |
| **Blue Stats** (Speed, Stamina, Power, Guts, Wit) | 70% | 80% | **90%** |
| **Red Aptitude & Aptitude Whites** (Ground, Distance, Style) | 1% | 3% | **5%** |
| **Green Unique Skill** (Inherited Unique) | 5% | 10% | **15%** |
| **Race Factors** (G1 Race Trophies) | 1% | 2% | **3%** |
| **White Skill Factors & Scenario Factors** | 3% | 6% | **9%** |

#### Calculation Example:
For a **3★ Green Unique Skill** (base chance $15\%$) on a parent with an individual compatibility score of $200$:
$$\text{Inheritance Chance} = 15\% \times \left(1 + \frac{200}{100}\right) = 15\% \times 3.0 = \mathbf{45.0\%}$$

### Grandparent Inheritance Halving Rule
Grandparent factors have approximately **half the inheritance proc probability** of direct parent factors because grandparent compatibility values are weighted at a lower scale in the inheritance gate engine.

### The Truth About Gold Inheritance Events
Polaris and community data confirmed that the **Gold Inheritance Animation** does not grant an extra proc roll or hidden percentage multiplier. Rather, it is a visual celebratory trigger indicating that at least one **3★ factor** was successfully rolled during that inheritance gate.

---

## 10. Career G1 Farming & Aptitude Economics

> Sourced from: [VN Community Guide.md](file:///Users/fubuki/Documents/AlmondEyeDB/docs/parenting/VN%20Community%20Guide.md) & [Crazyfellow's Parenting & Gene guide.md](file:///Users/fubuki/Documents/AlmondEyeDB/docs/parenting/Crazyfellow%27s%20Parenting%20&%20Gene%20guide.md) (Chapter 3 & 4)

### The 1-4-7-10 Pink Factor Star Formula
Initial aptitude rank upgrades follow a strict non-linear step curve:

$$\text{Rank Bumps} = \begin{cases} 
+1 \text{ Rank} & \text{requires } 1\text{ Pink Star} \\
+2 \text{ Ranks} & \text{requires } 4\text{ Pink Stars} \\
+3 \text{ Ranks} & \text{requires } 7\text{ Pink Stars} \\
+4 \text{ Ranks} & \text{requires } 10\text{ Pink Stars} \\
> +4 \text{ Ranks} & \mathbf{Impossible\text{ at start (capped at }+4)}
\end{cases}$$

### Career Farming Thresholds vs. Ace Target Requirements

```
                       Aptitude Requirement Spectrum
Career Survival Floor                                   Competitive Ace Target
┌───────────────────────────┐                           ┌───────────────────────────┐
│ Turf / Dirt: Rank D       │                           │ Turf / Dirt: Rank A       │
│ Distance:    Rank C       │ ────────────────────────► │ Distance:    Rank S       │
│ (Reliable G1 Career Wins) │                           │ (+5% Speed Boost in PvP!) │
└───────────────────────────┘                           └───────────────────────────┘
```

- **Career Parent Run**: To win career G1 races across the calendar without failing, an Uma only needs **Turf/Dirt at Rank D** and **Distance at Rank C**.
- **Final Ace Target**: The final PvP racer requires **Distance S** (provides a critical $+5\%$ multiplier to maximum sprint speed).

### The 9★ Dirt Great-Grandparent (GGP) Methodology (VN Guide)
To bridge the gap between Turf-only and Dirt rotations:
1. **Breed/Rent a 9★ Dirt GGP**: A dedicated foundation ancestor with 9★ Dirt factors.
2. **Elevate Parents & Grandparents**:
   - Seiun Sky (Dirt G $\to$ D via 7★ Dirt pink factors).
   - Fuji Kiseki (Dirt F $\to$ D via 4★ Dirt; Long E $\to$ C via 6★ Long).
3. **Unlock the 22–26 G1 Circuit**: Enables running both Turf (Derby, Japan Cup, Arima) and Dirt G1s (February Stakes, Champions Cup, Tokyo Daishoten), massively boosting shared G1 counts to maximize compatibility.

### Red Factor Generation & The "Aptitude Dilution Hazard"
At the end of a training run, the generated Red factor is chosen at random with **equal probability across all aptitudes that finish at Rank A or above**:

> [!CAUTION]
> **Aptitude Dilution Hazard**:
> - If an Uma has 3 native A aptitudes (e.g. Haru Urara: Dirt A, Short A, Betweener A), hunting for Dirt has a $\frac{1}{3} = \mathbf{33.3\%}$ chance.
> - If a player carelessly elevates native B aptitudes to A (e.g. Mayano Top Gun with 5 native A's + Betweener B + Chaser B $\to$ 7 A-ranks), the chance of rolling the desired Red factor collapses to $\frac{1}{7} = \mathbf{14.3\%}$!
> - **Rule**: Never raise unwanted B-rank proficiencies to A on parent farming runs.

---

## 11. Factor Generation Mechanics & The Supergene "Mummy" Strategy

> Sourced from: [Crazyfellow's Parenting & Gene guide.md](file:///Users/fubuki/Documents/AlmondEyeDB/docs/parenting/Crazyfellow%27s%20Parenting%20&%20Gene%20guide.md) (Chapter 4, 5, 7)

### Factor Generation Rules Summary

| Factor Type | Eligibility Requirement | Base Roll Chance | 3★ Generation Probability |
| :--- | :--- | :---: | :---: |
| **Blue Stats** | 1 of 5 stats chosen at random (20%) | Stat $\ge 600\text{ (B)}$ | $600–1099\text{ (B to S+)}: \approx \mathbf{5\%–6\%}$<br/>$\ge 1100\text{ (SS / 1200+)}: \approx \mathbf{10\%}$ |
| **Red Aptitudes** | Chosen among aptitudes ending at $\ge \text{Rank A}$ | 100% (1 guaranteed) | $1\text{★: } 20\% \quad 2\text{★: } 70\% \quad \mathbf{3\text{★: } 10\%}$ |
| **White Skills** | Skill **must be learned** during career | White: $20\%–35\%$<br/>**Gold: $40\%–70\%$** | Flat $\approx \mathbf{5\%}$ for 3★ |
| **Race Trophies** | Must finish in **1st Place** in that G1 | $20\%–30\%$ per G1 won | Flat $\approx \mathbf{5\%}$ for 3★ |

### The "Supergene Mummy" Principle
1. **Support Deck Synchronization**: Use the same core support cards across parent farming runs. Since purchasing the **Gold version** of a skill doubles factor appearance odds ($40\%–70\%$) and common lineage factors add $+2.5\%$ to $+5\%$ per ancestor, synchronized decks rapidly reinforce high-priority white skills.
2. **Support Deck Scarcity Hunting**: When breeding parents for an ace, prioritize skills that **cannot be acquired from the ace's training support deck**. If an essential track skill is absent from the deck, it must be hunted through parent white factors (+25 bonus in AlmondEyeDB).
3. **4th Anniversary Aptitude White Factors (遺伝子 / Idenshi)**:
   - Lineage with $\ge 6$ Red stars of that type: $\approx \mathbf{40\%}$ generation chance.
   - Lineage with $\ge 12$ Red stars of that type: $\mathbf{100\%}$ **guaranteed generation**!
4. **Awakening Factors (目覚め)**:
   - **Stat Awakening**: Requires $12+$ successful training sessions in that stat.
   - **Directional Factors (Right/Left Turn)**: Requires $6+$ race wins with that turn direction.
   - **Seasonal Factors (Spring, Summer, Autumn, Winter)**: Requires $6+$ race wins in that season ($5$ additional wins for Summer outside Debut).

---

## 12. Future Architecture Roadmap & Reference Sitemap

### Future Architectural Enhancements for AlmondEyeDB

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AlmondEyeDB Parenting Engine                    │
├──────────────────────────────────┬─────────────────────────────────────┤
│ Current Implementation (Active)  │ Future Design Roadmap               │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • Post-2.0 G1 (+3) Affinity      │ 1. Polaris Inheritance Probability  │
│ • 1-4-7-10 Pink Star Patching    │    Calculator (Live % Estimates)    │
│ • 2/3 Spurt Line Physics Engine  │ 2. Red Aptitude Dilution Advisor    │
│ • 5-Tier Community Roles         │    (Warnings on unwanted B->A)      │
│ • Support Deck Scarcity Hunting  │ 3. 4th Anniv Idenshi Predictor      │
│ • Dual-Stream Pedigree Synthesis │    (6★ 40%, 12★ 100% guarantee)     │
│ • Backwards-Compatible Shim      │ 4. 22–26 G1 Circuit Clash Planner   │
└──────────────────────────────────┴─────────────────────────────────────┘
```

1. **Polaris Inheritance Probability Inspector**:
   - Implement the patent formula $P = P_{\text{base}} \times (1 + S/100)$ to show users live predicted percentages for inheriting their 3★ Blue stats, Distance S Red factors, and critical White acceleration skills.
2. **Red Factor Dilution Advisor**:
   - Add a tactical badge warning users when an Uma candidate has native B-rank aptitudes that could be accidentally promoted to A rank, preserving high target Red odds.
3. **4th Anniversary Idenshi Predictor**:
   - Display a visual badge when a 6-slot bloodline reaches 12★ in a specific Red aptitude, confirming a 100% guaranteed Aptitude White Factor drop.
4. **G1 Circuit Schedule Visualizer**:
   - Provide an interactive calendar view displaying shared G1 wins and highlighting Tiara vs. Triple Crown race clashes.

### Authoritative Documentation References
For in-depth source reading, raw data points, and community research logs, refer to the local repository documentation:
- **[`docs/parenting/Crazyfellow's Parenting & Gene guide.md`](file:///Users/fubuki/Documents/AlmondEyeDB/docs/parenting/Crazyfellow%27s%20Parenting%20&%20Gene%20guide.md)**:
  - *Chapter 1*: Post-2.0 G1-only compatibility and individual link theory.
  - *Chapter 2 & Bonus Chapter*: Exact patent formulas, base proc rates, and Polaris (@BourBon_Polaris) / Shoppo (@shoppo_ura) empirical verification.
  - *Chapter 3 & 6*: Red factor mechanics, S-rank stat bonuses, and aptitude dilution strategy.
  - *Chapter 4 & 5*: Blue/White/Race factor generation rates and the Supergene Mummy strategy.
  - *Chapter 7*: 4th Anniversary Aptitude White factors (Idenshi) and Awakening factors.
  - *5th Anniversary Section*: Inheritance-Only Umas (継承専用ウマ娘) and Bulk Inheritance system.
- **[`docs/parenting/VN Community Guide.md`](file:///Users/fubuki/Documents/AlmondEyeDB/docs/parenting/VN%20Community%20Guide.md)**:
  - Practical 4-step workflow for 9★ Dirt GGP farming, parent/grandparent career survival thresholds (Turf/Dirt D, Distance C), and pink spark economics.

