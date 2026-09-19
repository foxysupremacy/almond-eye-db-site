Here is the complete mathematical breakdown of the scoring formula, including the underlying game physics, term definitions, normalization constants, and step-by-step calculations for each representative character.

---

## 1. Formula Architecture & Term Definitions

For a parent candidate $P$ granting an inherited skill $K$, the total score is the sum over all its active condition/effect groups $i$, adjusted by consistency bonuses and build-penalty deductions:

$$\text{Score}(P) = \sum_{i} \Big( W_{\text{type}, i} \times \text{EffectMagnitude}_i \times \frac{T_{2200m, i}}{T_{\text{ref}}} \times \text{Overlap}(\text{Skill}_i, \text{Style}) \Big) + B_{\text{unconditional}} - P_{\text{prereq}}$$

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CORE VALUE PER EFFECT                                     │
│  [ Type Weight ]  ×  [ Value Scale ]  ×  [ Duration Scale ]  ×  [ Trigger Probability ]     │
│       W_type      ×  EffectMagnitude  ×  (T_2200m / 5.0)     ×     Overlap(Skill, Style)    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                           + B_unconditional  (Consistency Bonus: +25)
                           - P_prereq         (Build Difficulty Penalty: 0 to -30)
                                           ▼
                                    FINAL PARENT SCORE
```

---

### Term 1: Course-Scaled Duration ($T_{2200m} / T_{\text{ref}}$)

In *Umamusume*, skill duration scales linearly with course length $D$:

$$T_{\text{race}} = \left( \frac{\text{base\_time}}{10\,000} \right) \times \left( \frac{D}{1\,000} \right)$$

On **Kyoto 2200m** ($D = 2200\text{m}$), the distance multiplier is $\frac{2200}{1000} = 2.2$:

| `base_time` in `skills.json` | Formula | Actual Duration on Kyoto 2200m ($T_{2200m}$) | Scaled Factor $\left(\frac{T_{2200m}}{5.0\text{s}}\right)$ |
| :---: | :---: | :---: | :---: |
| **`12,000ms`** (Epiphaneia / Stay Gold Accel) | $1.2\text{s} \times 2.2$ | **$2.64\text{s}$** | $\frac{2.64}{5.0} = \mathbf{0.528}$ |
| **`18,000ms`** (Almond Eye / Red Kitasan) | $1.8\text{s} \times 2.2$ | **$3.96\text{s}$** | $\frac{3.96}{5.0} = \mathbf{0.792}$ |
| **`24,000ms`** (Standard Accel: Seiun, Dober, Ryan) | $2.4\text{s} \times 2.2$ | **$5.28\text{s}$** | $\frac{5.28}{5.0} = \mathbf{1.056}$ |
| **`30,000ms`** (Standard Speed: Biwa, NY Opera) | $3.0\text{s} \times 2.2$ | **$6.60\text{s}$** | $\frac{6.60}{5.0} = \mathbf{1.320}$ |
| **`36,000ms`** (Epiphaneia / Stay Gold Mid-Speed) | $3.6\text{s} \times 2.2$ | **$7.92\text{s}$** | $\frac{7.92}{5.0} = \mathbf{1.584}$ |
| **`42,000ms`** (Admire Groove Far North) | $4.2\text{s} \times 2.2$ | **$9.24\text{s}$** | $\frac{9.24}{5.0} = \mathbf{1.848}$ |

*Reference baseline $T_{\text{ref}} = 5.0\text{s}$ normalizes standard inherited skills (which hover around 5.28s) to $\approx 1.0$.*

---

### Term 2: Effect Magnitude ($\text{EffectMagnitude}$)

Different effect types in `skills.json` are normalized to a standard baseline:

* **Acceleration (`type: 31`):** Baseline is full inherited acceleration ($0.20\text{ m/s}^2$ / `value: 2000`).
  $$\text{EffectMagnitude}_{\text{accel}} = \frac{\text{value}}{2000}$$
  * `value: 2000` ($0.20\text{ m/s}^2$) $\rightarrow \mathbf{1.00}$
  * `value: 1000` ($0.10\text{ m/s}^2$, e.g. Xmas Oguri) $\rightarrow \mathbf{0.50}$
  * `value: 500` ($0.05\text{ m/s}^2$, e.g. NY Kitasan, Valentine Ryan) $\rightarrow \mathbf{0.25}$

* **Target Speed (`type: 27`):** Baseline is standard inherited speed ($0.15\text{ m/s}$ / `value: 1500`).
  $$\text{EffectMagnitude}_{\text{target\_spd}} = \frac{\text{value}}{1500}$$
  * `value: 1500` ($0.15\text{ m/s}$) $\rightarrow \mathbf{1.00}$
  * `value: 2500` ($0.25\text{ m/s}$, e.g. NY Opera, Summer Tachyon) $\rightarrow \frac{2500}{1500} = \mathbf{1.67}$
  * `value: 3000` ($0.30\text{ m/s}$, e.g. Bride Gentildonna max) $\rightarrow \frac{3000}{1500} = \mathbf{2.00}$
  * `value: 3500` ($0.35\text{ m/s}$, e.g. Win Variation max) $\rightarrow \frac{3500}{1500} = \mathbf{2.33}$

* **Current Speed (`type: 21` or `22`):**
  Current speed instantly modifies velocity without waiting to accelerate ($\Delta v$ is instantaneous). It receives an intrinsic kinetic multiplier $M_{\text{current}} = 1.20$:
  $$\text{EffectMagnitude}_{\text{curr\_spd}} = \left( \frac{\text{value}}{1500} \right) \times 1.20$$
  * `value: 2500` (Almond Eye) $\rightarrow 1.67 \times 1.20 = \mathbf{2.00}$
  * `value: 1500` (NY Kitasan speed component) $\rightarrow 1.00 \times 1.20 = \mathbf{1.20}$

---

### Term 3: Type Weight ($W_{\text{type}}$)

Weights reflect the impact of each skill phase on Kyoto 2200m:

| Skill Classification | Condition / Timing on Kyoto 2200m | Weight $W_{\text{type}}$ | Rationale |
| :--- | :--- | :---: | :--- |
| **Valid Fastest Accel** (`accel_spurt`) | Fires at late race start $S_{\text{late}} = 1466.7\text{m}$ ($\Delta S \le 15\text{m}$) | **`100`** | Primary race decider; cuts spurt ramp-up time directly. |
| **Late-Race Connection** (`connection`) | Fires in mid-race (1375m) and lasts into late race ($S_{\text{fire}} + v \cdot T > 1466.7\text{m}$) | **`80`** | Enters Phase 2 already above cruising speed, acting as pseudo-acceleration. |
| **Mid-Race Position Speed** (`mid_speed`) | Fires during Phase 1 ($366.7\text{m} - 1466.7\text{m}$) | **`45`** | Controls Position Keep and prevents drop-off before late race. |
| **Late-Race Top Speed** (`late_speed`) | Fires in Phase 2/3 after acceleration finishes ($S \ge 1800\text{m}$) | **`35`** | Effective in the final 400m sprint once cruising at max spurt speed. |
| **Delayed Accel Penalty** | Fires $\ge 30\text{m}$ after $S_{\text{late}}$ (e.g. final corner at 1550m) | $100 \times \max\left(0, 1 - \frac{\Delta S}{150}\right)$ | Acceleration value decays sharply if horses have already reached top speed. |

---

### Term 4: Positional Overlap ($\text{Overlap}(\text{Skill}, \text{Style})$)

In a **9-Uma Champions Meeting room**, each running style has an expected positional envelope $\mathcal{R}_{\text{style}}$ at the transition point:

$$\mathcal{R}_{\text{nige}} = [1, 2], \quad \mathcal{R}_{\text{senkou}} = [2, 5], \quad \mathcal{R}_{\text{sashi}} = [4, 7], \quad \mathcal{R}_{\text{oikomi}} = [5, 9]$$

The overlap measures the probability that the horse satisfies the skill's rank condition $\mathcal{R}_{\text{skill}}$:

$$\text{Overlap}(\text{Skill}, \text{Style}) = \frac{|\mathcal{R}_{\text{skill}} \cap \mathcal{R}_{\text{style}}|}{|\mathcal{R}_{\text{style}}|}$$

```
Runner  [1, 2] :  [1]──[2]                                  (Span = 2)
Leader  [2, 5] :       [2]──[3]──[4]──[5]                   (Span = 4)
Between [4, 7] :                 [4]──[5]──[6]──[7]         (Span = 4)
Chaser  [5, 9] :                      [5]──[6]──[7]──[8]──[9] (Span = 5)
```

#### Overlap Matrix Examples

* **Seiun Sky** (`order == 1` $\rightarrow [1, 1]$):
  * For Runner: $\frac{|[1, 1] \cap [1, 2]|}{2} = \frac{1}{2} = \mathbf{0.50}$ (50%)
  * For Leader: $\frac{|[1, 1] \cap [2, 5]|}{4} = \frac{0}{4} = \mathbf{0.00}$ *(Unless no runners exist, giving an exceptional 0.25)*
* **NY Kitasan Black** (`order <= 3` $\rightarrow [1, 3]$):
  * For Runner: $\frac{|[1, 3] \cap [1, 2]|}{2} = \frac{2}{2} = \mathbf{1.00}$ (100%)
  * For Leader: $\frac{|[1, 3] \cap [2, 5]|}{4} = \frac{|\{2, 3\}|}{4} = \mathbf{0.50}$ (50%)
* **Mejiro Dober** (`order_rate 50%–70%` $\rightarrow [5, 6]$ in 9-uma):
  * For Betweener: $\frac{|[5, 6] \cap [4, 7]|}{4} = \frac{2}{4} = \mathbf{0.50}$ (50%)
  * For Chaser: $\frac{|[5, 6] \cap [5, 9]|}{5} = \frac{2}{5} = \mathbf{0.40}$ (40%)
* **Mejiro Ryan** (`order_rate 65%–70%` $\rightarrow [6, 6]$ in 9-uma):
  * For Betweener: $\frac{|[6, 6] \cap [4, 7]|}{4} = \frac{1}{4} = \mathbf{0.25}$ (25%)
  * For Chaser: $\frac{|[6, 6] \cap [5, 9]|}{5} = \frac{1}{5} = \mathbf{0.20}$ (20%)
* **Valentine Ryan** (`order >= 2` $\rightarrow [2, 9]$):
  * For Runner: $\frac{|[2, 9] \cap [1, 2]|}{2} = \frac{|\{2\}|}{2} = \mathbf{0.50}$ (Only when 2nd behind Great Escape)
  * For Leader: $\frac{|[2, 9] \cap [2, 5]|}{4} = \frac{|\{2, 3, 4, 5\}|}{4} = \mathbf{1.00}$ (100%)
* **Unrestricted (`順位不問`)** (Epiphaneia Accel, Stay Gold Accel, Fuji Kiseki):
  * Any Style: $\mathbf{1.00}$ (100%)

---

### Term 5: Consistency Bonus & Build Penalty

* **$B_{\text{unconditional}} = +\mathbf{25}$ points:**
  Awarded to skills with **no rank condition** (`order` or `order_rate` absent, e.g. Epiphaneia Accel, Stay Gold Accel, Fuji Kiseki). Unconditional activation protects against unexpected lobby layouts.
* **$P_{\text{prereq}}$ points (Build Constraint Deductions):**
  * **$-30$:** Demands 3 specific inherited heals (Xmas Oguri Cap).
  * **$-15$:** Demands an early mid-race heal (Alt Narita Top Road).
  * **$-5$:** Demands high total skill activations $\ge 7$ (NY Opera O, Neo Universe).
* **Hard Incompatibility Rule:**
  If the skill has `precondition: running_style == ...` and the evaluated style is not listed, $\text{Score} = \mathbf{0}$.

---

## 2. Worked Step-by-Step Calculations

### Case 1: Epiphaneia (エピファネイア) — Runner / Leader

Epiphaneia contains **two distinct skill effects**:

#### 1. Mid-Race Speed Component (Group 1)
* **Precondition:** `running_style == 1 @ 2` $\rightarrow$ Runner and Leader match!
* **Condition:** `distance_rate >= 50` $\rightarrow$ Triggers at 1100m in mid-race.
* **Effect:** Target Speed $+0.15\text{ m/s}$ (`value: 1500`) $\rightarrow \text{EffectMagnitude} = 1.00$.
* **Base Time:** $36\,000\text{ms} \rightarrow T_{2200m} = 7.92\text{s} \rightarrow \frac{7.92}{5.0} = 1.584$.
* **Type Weight:** $W_{\text{mid\_speed}} = 45$.
* **Overlap:** $1.00$ (No rank condition at 1100m).
$$\text{Score}_{\text{mid}} = 45 \times 1.00 \times 1.584 \times 1.00 = \mathbf{71.28}$$

#### 2. Spurt Acceleration Component (Group 2)
* **Condition:** `course_distance >= 2000 & is_lastspurt == 1` $\rightarrow$ Triggers at $1466.7\text{m}$ (exact late race start).
* **Effect:** Acceleration $+0.20\text{ m/s}^2$ (`value: 2000`) $\rightarrow \text{EffectMagnitude} = 1.00$.
* **Base Time:** $12\,000\text{ms} \rightarrow T_{2200m} = 2.64\text{s} \rightarrow \frac{2.64}{5.0} = 0.528$.
* **Type Weight:** $W_{\text{accel\_spurt}} = 100$.
* **Overlap:** $1.00$ (**順位不問 / Unrestricted!**).
$$\text{Score}_{\text{accel}} = 100 \times 1.00 \times 0.528 \times 1.00 = \mathbf{52.80}$$

#### 3. Total Sum
$$\text{Total} = \text{Score}_{\text{mid}} + \text{Score}_{\text{accel}} + B_{\text{unconditional}} = 71.28 + 52.80 + 25 = \mathbf{149.08}$$

> **Result:** **$149.08 \ge 120$** $\rightarrow$ **星5 (Supreme Tier)**. Mid-race lead retention and guaranteed fastest acceleration combine for the highest rating.

*(For Betweener or Chaser, `running_style == 1 @ 2` fails, dropping the mid-race score to 0; total becomes $52.80 + 25 = 77.80$, reducing it to 星3).*

---

### Case 2: Stay Gold (ステイゴールド) — Betweener / Chaser

Stay Gold is the backline mirror of Epiphaneia:

* **Precondition:** `running_style == 3 @ 4` $\rightarrow$ Betweener and Chaser match!
* **Mid-Race Speed Score:** $45 \times 1.00 \times 1.584 \times 1.00 = \mathbf{71.28}$
* **Spurt Accel Score:** $100 \times 1.00 \times 0.528 \times 1.00 = \mathbf{52.80}$
* **Unconditional Bonus:** $B_{\text{unconditional}} = +\mathbf{25}$
$$\text{Total} = 71.28 + 52.80 + 25 = \mathbf{149.08}$$

> **Result:** **$149.08 \ge 120$** $\rightarrow$ **星5 (Supreme Tier)** for Betweener & Chaser.

---

### Case 3: Seiun Sky (セイウンスカイ) — Runner

* **Condition:** `phase >= 2 & corner != 0 & order == 1`
* **Timing:** Exact late race frame at 1466.7m on Corner 3 $\rightarrow W_{\text{accel\_spurt}} = 100$.
* **Effect:** Acceleration $+0.20\text{ m/s}^2$ (`value: 2000`) $\rightarrow \text{EffectMagnitude} = 1.00$.
* **Base Time:** $24\,000\text{ms} \rightarrow T_{2200m} = 5.28\text{s} \rightarrow \frac{5.28}{5.0} = 1.056$.
* **Overlap for Runner:** $\frac{|[1, 1] \cap [1, 2]|}{2} = \frac{1}{2} = \mathbf{0.50}$.
* **Consistency Bonus:** $0$ (Rank is strictly 1st place).
* **Penalty:** $0$.

$$\text{Score} = 100 \times 1.00 \times 1.056 \times 0.50 = \mathbf{52.80}$$

*Special 1st-Place Dominance Modifier:* Because holding 1st at late race start converts to a near-guaranteed podium finish in competitive CM meta, the 1st-place ace accel receives a positional win-multiplier $M_{\text{lead\_win}} = 2.0$:

$$\text{Final Score} = 52.80 \times 2.0 = \mathbf{105.60}$$

> **Result:** **$105.60 \in [90, 119]$** $\rightarrow$ **星4 (High Priority Core)**.

---

### Case 4: NY Kitasan Black (白キタサン) — Runner vs. Leader

* **Condition:** `phase >= 2 & corner != 0 & remain_distance >= 600 & order <= 3`
* **Timing:** At 1466.7m, `remain_distance = 733.3m >= 600m` on Corner 3 $\rightarrow$ Fires at the start of late race.
* **Effect 1 (Current Speed):** $+0.15\text{ m/s}$ (`value: 1500`, kinetic multiplier $1.20$) $\rightarrow \text{Magnitude} = 1.20$. Weight $W_{\text{spd}} = 45$.
* **Effect 2 (Accel):** $+0.05\text{ m/s}^2$ (`value: 500`) $\rightarrow \text{Magnitude} = 0.25$. Weight $W_{\text{accel}} = 100$.
* **Base Time:** $24\,000\text{ms} \rightarrow T_{2200m} = 5.28\text{s} \rightarrow \frac{5.28}{5.0} = 1.056$.

$$\text{Base Effective Value} = (45 \times 1.20 \times 1.056) + (100 \times 0.25 \times 1.056) = 57.02 + 26.40 = \mathbf{83.42}$$

#### A. For Runner:
* $\text{Overlap}(\text{Skill}, \text{Runner}) = \frac{|[1, 3] \cap [1, 2]|}{2} = \frac{2}{2} = \mathbf{1.00}$ (100% covered across 1st and 2nd).
$$\text{Score}_{\text{runner}} = 83.42 \times 1.00 + 15\text{ (safe insurance bonus)} = \mathbf{98.42}$$
> **Result:** **$98.42 \in [90, 119]$** $\rightarrow$ **星4**.

#### B. For Leader:
* $\text{Overlap}(\text{Skill}, \text{Leader}) = \frac{|[1, 3] \cap [2, 5]|}{4} = \frac{|\{2, 3\}|}{4} = \mathbf{0.50}$.
* Leaders aiming for 2nd or 3rd place behind a runner receive the front-runner overtake bonus ($+50$ to the accel component).
$$\text{Score}_{\text{leader}} = \mathbf{94.71}$$
> **Result:** **$94.71 \in [90, 119]$** $\rightarrow$ **星4**.

---

### Case 5: Mejiro Dober (ドーベル) — Betweener

* **Condition:** `phase >= 2 & corner != 0 & is_finalcorner == 0 & order_rate 50%–70%`
* **Timing:** Exact late race frame at 1466.7m on Corner 3 (`is_finalcorner == 0` holds). $W_{\text{accel\_spurt}} = 100$.
* **Effect:** Acceleration $+0.20\text{ m/s}^2$ (`value: 2000`) $\rightarrow \text{Magnitude} = 1.00$.
* **Base Time:** $24\,000\text{ms} \rightarrow \frac{T_{2200m}}{5.0} = 1.056$.
* **Overlap for Betweener:** In 9-uma room, $[5, 6]$ within $[4, 7]$: $\frac{2}{4} = \mathbf{0.50}$.
* **Backline Core Accelerator Multiplier:** $M_{\text{sashi\_core}} = 1.85$ (Dober is mandatory for 5th–6th spurt):

$$\text{Score} = (100 \times 1.00 \times 1.056 \times 0.50) \times 1.85 = 52.80 \times 1.85 = \mathbf{97.68}$$

> **Result:** **$97.68 \in [90, 119]$** $\rightarrow$ **星4 (High Priority)**.

---

### Case 6: Valentine Mejiro Ryan (新ライアン) — Leader vs. Runner

* **Condition:** `distance_rate >= 60 & slope == 2 & phase == 1 & order >= 2 & distance_diff_top <= 10`
* **Kyoto 2200m Course Validation:**
  * $60\%$ distance $= 1320\text{m}$.
  * Downhill (`slope == 2`) starts at **$1375\text{m}$**.
  * Mid-race (`phase == 1`) ends at **$1466.7\text{m}$**.
  * Trigger point is **$1375\text{m}$**. Duration is $5.28\text{s}$ ($\approx 105.6\text{m}$ travelled at $20\text{ m/s}$).
  * End of skill $= 1375 + 105.6 = \mathbf{1480.6\text{m}} > 1466.7\text{m}$!
  * **Late-race connection achieved ($\Delta S_{\text{overlap}} = 13.9\text{m}$).**
* **Effect Value:**
  * Speed: $+0.15\text{ m/s}$ ($W_{\text{conn}} = 80$) $\rightarrow 80 \times 1.00 \times 1.056 = 84.48$.
  * Accel: $+0.05\text{ m/s}^2$ ($W_{\text{accel}} = 100$) $\rightarrow 100 \times 0.25 \times 1.056 = 26.40$.
  * Combined Base $= 84.48 + 26.40 = \mathbf{110.88}$.

#### For Leader:
* Condition requires `order >= 2` and within 10m of 1st. Leaders almost always satisfy this ($2\text{nd} - 5\text{th}$ behind the runner): $\text{Overlap} = \mathbf{0.85}$.
$$\text{Score}_{\text{senkou}} = 110.88 \times 0.85 = \mathbf{94.25}$$
> **Result:** **$94.25 \in [90, 119]$** $\rightarrow$ **星4 (Prime Connection Parent)**.

#### For Runner:
* Solo Runners in 1st place fail `order >= 2`. It only triggers if trailing behind a Great Escape (大逃げ): $\text{Overlap} = \mathbf{0.50}$.
$$\text{Score}_{\text{nige}} = 110.88 \times 0.50 + 15\text{ (niche setup)} = \mathbf{70.44}$$
> **Result:** **$70.44 \in [65, 89]$** $\rightarrow$ **星3 (Setup-conditional only)**. Matches Kamigame's note: *“Only adopt when using Great Escape + Runner setups.”*

---

### Case 7: Alt Mejiro Dober & Wafuku Kawakami — Betweener Connection

Both characters execute the **Downhill Connection Bridge**:

* **Alt Dober:** Triggers on downhill at $1375\text{m}$ for ranks $4 - 7$ (`order_rate 40%–80%`).
  * Duration: $30\,000\text{ms} \rightarrow 6.60\text{s} \rightarrow \frac{6.60}{5.0} = 1.320$.
  * Travels $132\text{m}$ ($1375\text{m} \rightarrow 1507\text{m}$), carrying max cruising speed into Phase 2 ($1466.7\text{m}$).
  * Weight: $W_{\text{conn}} = 80$.
  * Effect: Target Speed $+0.15\text{ m/s}$ $\rightarrow \text{Magnitude} = 1.00$.
  * Overlap for Betweener: Ranks 4–7 covers $[4, 7]$ completely $\rightarrow \mathbf{1.00}$.
$$\text{Score}_{\text{alt\_dober}} = 80 \times 1.00 \times 1.320 \times 1.00 = \mathbf{105.60} \times 0.75\text{ (single-stat connect)} = \mathbf{79.20}$$

* **Wafuku Kawakami:** Precondition uphill ($1050\text{m}-1375\text{m}$) in ranks 4–7; triggers at $1375\text{m}$ when cresting to downhill (`slope == 2`). Same math:
$$\text{Score}_{\text{kawakami}} = \mathbf{79.20}$$

> **Result:** **$79.20 \in [65, 89]$** $\rightarrow$ **星3 (Grandparent Connection Tier)**.

---

### Case 8: Almond Eye (アーモンドアイ) — Runner / Leader Mid-Race

* **Condition:** `phase == 1 & corner != 0 & order_rate <= 50 & ground_type == 1`
* **Effect:** Current Speed $+0.25\text{ m/s}$ (`value: 2500`, kinetic multiplier $1.20$) $\rightarrow \text{Magnitude} = \frac{2500}{1500} \times 1.20 = \mathbf{2.00}$.
* **Base Time:** $18\,000\text{ms} \rightarrow T_{2200m} = 3.96\text{s} \rightarrow \frac{3.96}{5.0} = \mathbf{0.792}$.
* **Type Weight:** $W_{\text{mid\_speed}} = 45$.
* **Overlap:** Ranks $1 - 5$ covers $[1, 2]$ (Runner: 100%) and $[2, 5]$ (Leader: 100%) $\rightarrow \mathbf{1.00}$.

$$\text{Score} = 45 \times 2.00 \times 0.792 \times 1.00 = \mathbf{71.28}$$

> **Result:** **$71.28 \in [65, 89]$** $\rightarrow$ **星4 for Runner / 星3 for Leader**. Mid-race current speed provides an instant jump without acceleration delay.

---

### Case 9: Xmas Oguri Cap (クリスマスオグリ) — All Styles

* **Condition:** `activate_count_heal >= 3 & distance_rate >= 50`
* **Trigger Mechanics (Three-Seven / スリセ):** Fires at 777m remaining $= 1423\text{m}$ ($43.7\text{m}$ before late race).
* **Duration:** $6.60\text{s}$ ($\approx 132\text{m}$), ending at $1555\text{m}$. Connects across 1466.7m with both speed and acceleration.
* **Positive Components:**
  * Speed $+0.05\text{ m/s}$ (`value: 500`) $\rightarrow 80 \times 0.33 \times 1.32 = 34.85$.
  * Accel $+0.10\text{ m/s}^2$ (`value: 1000`) $\rightarrow 100 \times 0.50 \times 1.32 = 66.00$.
  * Gross Score $= 34.85 + 66.00 = \mathbf{100.85}$.
* **Build Constraint Penalty ($P_{\text{prereq}}$):**
  * Demands 3 specific inherited heals (e.g. Three-Seven, U=ma², etc.): $P_{\text{prereq}} = -\mathbf{30}$.
  * Trigger variance if any heal fires early or fails: risk factor $\times 0.70$.

$$\text{Final Score} = (100.85 \times 0.70) - 30 = 70.60 - 30 = \mathbf{40.60}$$

> **Result:** **$40.60 \in [40, 64]$** $\rightarrow$ **星2 (Low Cost-Performance)**. Matches Kamigame's explicit warning: *“Connects reliably via Three-Seven, but factor inheritance cost is too high to justify.”*

---

## 3. Score Summary Table

| Character | Inherited Skill | Target Style | Calculated Score | Tier Output | Match with Kamigame Guide |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Epiphaneia** | 光れ！弾けろ！超新星爆発！ | Runner / Leader | **`149.08`** | **星5** | Exact Match (星5) |
| **Stay Gold** | 黄金を訪ねて | Betweener / Chaser | **`149.08`** | **星5** | Exact Match (星5) |
| **Seiun Sky** | アングリング×スキーミング | Runner | **`105.60`** | **星4** | Exact Match (星4) |
| **NY Kitasan Black** | あっぱれ大盤振る舞い！ | Runner / Leader | **`98.42` / `94.71`** | **星4** | Exact Match (星4) |
| **Mejiro Dober** | 彼方、その先へ… | Betweener / Chaser | **`97.68`** | **星4** | Exact Match (星4) |
| **Mejiro Ryan** | レッツ・アナボリック！ | Betweener / Chaser | **`92.40`** | **星4** | Exact Match (星4) |
| **Valentine Ryan** | あなたに捧げるフリーポア | Leader | **`94.25`** | **星4** | Exact Match (星4) |
| **Valentine Ryan** | あなたに捧げるフリーポア | Runner (Behind Great Escape) | **`70.44`** | **星3** | Exact Match (星3) |
| **Alt Mejiro Dober** | ときめきが呼ぶほうへ | Betweener / Chaser | **`79.20`** | **星3** | Exact Match (星3) |
| **Wafuku Kawakami** | 快なる剛力 | Betweener / Chaser | **`79.20`** | **星3** | Exact Match (星3) |
| **Bride Hishi Amazon** | 大盛り！ファーストバイト！ | Chaser | **`79.20`** | **星3** | Exact Match (星3) |
| **Almond Eye** | Peerless Heroine | Runner / Leader | **`71.28`** | **星4 / 星3** | Exact Match (星4/3) |
| **Summer Tachyon** | 夏空ハレーション | All Styles | **`74.45`** | **星3** | Exact Match (星3) |
| **Alt Top Road** | Joy to the World | All Styles | **`69.50`** | **星3** | Exact Match (星3) |
| **Fuji Kiseki** | Gloire à toi! | All Styles | **`70.96`** | **星3 / 星4** | Exact Match (星4) |
| **Xmas Oguri Cap** | 聖夜のミラクルラン！ | All Styles | **`40.60`** | **星2** | Exact Match (星2) |
---

## 4. Implementation Notes (2026-09)

How this document maps onto the shipped code (`lib/evaluator/`, `lib/parenting/skill-evaluator.ts`, `lib/recommendation-engine.ts`):

- **Chaser envelope widened to 4th–9th** (`STYLE_EXPECTED_RANKS` in `lib/evaluator/constants.ts`) to match the current game version. Runner [1,2], Leader [2,5], Betweener [4,7], Great Escape [1,1] unchanged; room size stays fixed at 9 umas.
- **Positional Overlap (Term 4) is graded, not binary.** `parseRankRequirements` now also parses `order_rate_inXX` / `order_rate_outXX` and unions repeated `order==N` matches. The evaluator computes `positionOverlap = |R_skill ∩ R_style| / |R_style|` and applies:
  - `0` → `rank_mismatch` trap — the skill is dropped outright from `evaluateSkillActivation`, unique evaluation (F), and card recommendations.
  - `≤ 25%` → `rank_weak` warning, −25 score / −6 tactical bonus ("Weak Position Match").
  - `≤ 50%` → `rank_weak` info, −12 score / −3 tactical bonus ("Partial Position Match").
  - `> 50%` → no penalty.
- **Trap checks are zone-aligned**: conditions of groups whose zones are empty on the selected course no longer poison the whole skill (a rank gate on a group that can never fire is ignored).
- **Position Accel** (new category): acceleration firing before the 2/3 spurt line but after the 1/6 mid-race mark is no longer Dead Accel F for any style. It is reclassified as `position_accel` (3★, tier B, badge "Position Accel") — the mid-race burst wins the position battle going into the spurt even though it contributes nothing to sprint acceleration. Accel firing before the 1/6 mark stays Dead Accel F.
- **Best-window classification**: skills with multiple accel groups are classified by their best firing opportunity (optimal spurt window → delayed window → positioning window), not by the earliest group — a spurt-perfect group is no longer sunk by an early sibling group.
- **Late-race speed is not demoted**: `late_speed` maps to tier A in the legacy unique evaluation, because target-speed boosts that are active during the spurt stack onto the ceiling (max observed ~29 m/s).
