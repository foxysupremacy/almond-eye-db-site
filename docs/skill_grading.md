# Skill Grading & Race-Impact Logic

Tài liệu này mô tả đúng implementation hiện tại của Visualizer. Mục tiêu là
trả lời hai câu hỏi khác nhau, không trộn chúng thành một con số:

1. **Tactical Verdict** — hiệu ứng này có giá trị chiến thuật thế nào trên
   track và style đang chọn?
2. **Race Impact** — với profile stats và các giả định động, trigger này có
   xác suất phát động và lợi thế vật lý ước lượng ra sao?

`Tactical Verdict` không phải xác suất thắng. `Race Impact` cũng không phải
mô phỏng đủ toàn bộ đoàn đua hoặc dự báo thắng/thua.

## 1. Inputs dùng để chấm

Mỗi lần GlobalTrackBar thay đổi, evaluator nhận:

| Input | Ảnh hưởng |
|---|---|
| Course geometry | corner, straight, slope, phase, distance và vùng trigger hợp lệ |
| Spurt line | mặc định tại `2/3 × course length`, hoặc `course.spurtStart.meters` nếu track định nghĩa riêng |
| Running style | style gate, rank envelope và phase weight của speed skill |
| Racer count | chuyển `order` / `order_rate` thành cửa sổ thứ hạng thực |
| Race parameters | ví dụ heavy/bad ground và rule cấm debuff |
| Race-impact profile | Speed/Stamina/Power/Guts/Wisdom và override điều kiện động |

Profile mặc định được lưu riêng trong localStorage tại
`visualizer.impact-profile.v1`:

```text
Speed   2200
Stamina 1800
Power   1700
Guts    1500
Wisdom  1800
```

Mọi stat phải là số nguyên từ 1 đến 3000. Override xác suất động phải nằm
trong 0–100%; profile lỗi hoặc cũ sẽ được merge lại với default an toàn.

## 2. Chuẩn bị trigger: zones, duration và coverage

Mỗi `conditionGroup` là một trigger độc lập. Zone engine tính `regions[]`
theo geometry thật của course; một region có `{ start, end }` theo mét.

- Không có region hợp lệ: trigger/skill là **Invalid on Course**, `F`, 15 điểm.
- Có nhiều region: evaluator giữ từng region, không biến chúng thành một
  trigger cố định giả.
- Trigger random vẫn có một vùng geometry hợp lệ; random chỉ nói vị trí fire
  thực tế nằm trong vùng đó.

### Duration scale

`base_time` được lưu theo đơn vị 1/10000 giây ở course 1000m. Thời lượng
trên track hiện tại là:

```text
durationSeconds = (base_time / 10000) × (courseLength / 1000)
```

Vận tốc dùng để ước lượng coverage theo phase:

| Giai đoạn tại điểm fire | Vận tốc dùng cho coverage |
|---|---:|
| Early (`meter < spurt / 3`) | 18.0 m/s |
| Mid | 20.5 m/s |
| Late / Spurt (`meter >= spurt`) | 26.0 m/s |

```text
coverageMeters = durationSeconds × phaseVelocity
```

Coverage là cơ sở để nhận diện carry-over và để chấm Race Impact; nó không
thay thế simulator đầy đủ.

## 3. Style và rank gates

Khi người dùng đã chọn style ở GlobalTrackBar, evaluator kiểm tra
`running_style==N` trực tiếp. Sai style bị phạt 50 tactical points và gắn
`No Activation`.

Với điều kiện rank, mỗi active condition group được xét riêng. Đây là điểm
quan trọng với skill nhiều phase: không giao cắt rank của Trigger 1 và Trigger
2 thành một điều kiện bất khả thi.

Envelope mặc định:

| Style | Rank envelope |
|---|---|
| Runner | 1–2 |
| Leader | 2–5 |
| Betweener | 4–7 |
| Chaser | 4–9 |
| Great Escape | 1 |

```text
rankOverlap = ranks(trigger window ∩ style envelope) / ranks(style envelope)
```

| Overlap | Tactical consequence |
|---:|---|
| 0% | `Rank Trap`, -25 points |
| ≤25% | `Weak Position Match`, -25 points |
| ≤50% | `Partial Position Match`, -12 points |
| >50% | không phạt |

Khi chưa chọn style, tactical evaluator dùng profile `neutral`; Race Impact
không giả vờ suy ra rank probability từ course geometry.

## 4. Tactical Verdict: loại effect và base score

Effect được phân loại tập trung tại `lib/evaluator/effects.ts`:

| Raw type | Loại |
|---:|---|
| 21, 22 | Current Speed |
| 27 | Target Speed |
| 31 | Acceleration |
| 48 | Zenkai Spurt Acceleration |
| 9 | Recovery |
| 1–5 | Passive |
| opponent target / negative value / 10 / 14 | Debuff |

Negative effect hoặc effect nhắm đối thủ được ưu tiên là Debuff, nên không bị
chấm nhầm thành speed/accel cho bản thân.

### Acceleration type 31

Đặt `ΔS = triggerStart - spurtLine`:

| Timing | Category | Điểm tactical cơ sở |
|---|---|---:|
| `-15m ≤ ΔS ≤ +50m` | Valid Fastest Accel | `98 - max(0, ΔS) × 0.2` |
| `+50m < ΔS ≤ +140m` | Delayed Accel | `max(40, 75 - (ΔS - 50) × 0.35)` |
| trước `-15m`, nhưng từ start Phase 1 | Position Accel | 72 |
| quá sớm, trước Phase 1 | Dead Accel | 10 |
| sau `+140m` | Dead Accel | 15 |

Khoảng `+50m` tồn tại để xử lý geometry thật như Longchamp, nơi final straight
có thể bắt đầu rất sát spurt line. Accel được chọn theo **cơ hội firing tốt
nhất** trong các region accel hợp lệ, không theo region sớm nhất một cách mù
quáng.

### Zenkai type 48

Type 48 không bị coi là type 31. Trigger Zenkai-only được gắn category
`Zenkai Spurt Accel`, base 84 điểm / tier A, hiển thị raw `m/s²` và timing.
Cơ chế Power-scaled đầy đủ chưa được mô phỏng, nên Race Impact gắn trạng thái
`provisional` thay vì bịa distance gain hoặc gọi nó là Fastest Accel.

### Speed, recovery và utility

1. **Carry-over**: target/current speed fire trước spurt nhưng coverage đi qua
   spurt line → 95 điểm, tier S.
2. **Current Speed**: 88 điểm tối thiểu, tier A; cộng velocity trực tiếp nên
   không có acceleration lag.
3. **Target Speed**: chọn profile theo phase và style:

| Style | Early | Mid | Late |
|---|---:|---:|---:|
| Runner | 90 | 88 | 75 |
| Leader | 78 | 88 | 85 |
| Betweener | 65 | 82 | 92 |
| Chaser | 62 | 80 | 95 |
| Neutral | 72 | 82 | 85 |

4. **Recovery**: 88 trên course ≥2000m, 80 ở middle distance, 60 trên sprint
   ≤1400m.
5. **Passive / Debuff**: baseline lần lượt 75 / 72.

Các warning không nhất thiết làm thay đổi score: target speed fire trong
`spurtLine…spurtLine+130m` gắn `Fires during Acceleration`; speed mạnh/late
trên track dài gắn cảnh báo stamina; track heavy/bad ≥2400m gắn cảnh báo
stamina critical.

## 5. Nhiều trigger: chain hay alternative

Sau khi evaluator tính verdict cho từng active group, nó xác định semantics
từ raw condition.

### Chain

Nếu có `is_activate_other_skill_detail==1`, trigger đó là continuation của
trigger trước. Tactical Verdict cuối:

```text
totalTacticalScore = Σ(active trigger scores) + multiStageBonus
multiStageBonus = min(15, round(0.4 × weighted duration/effect contribution))
```

Không có trần 100. Điểm trên 100 chỉ biểu thị tổng giá trị của nhiều effect
trong cùng chuỗi trên course hiện tại; không phải phần trăm thắng.

Trong Race Impact, trigger con hiển thị xác suất **conditional on the prior
trigger firing**. Marker này không phải roll 50% và không được đếm như
`activate_count`. Xác suất toàn chain mới nhân các trigger với nhau:

```text
P(chain) = Π P(trigger_i | trigger_{i-1} đã thỏa)
```

### Alternative

Các group không mang marker trên là những cách fire thay thế của cùng skill.

- Tactical Verdict: lấy active trigger có score cao nhất.
- Race Impact: mixture theo activation rate chuẩn hóa giữa các path.
- Không cộng effect của alternatives, tránh score/physical gain ảo.

Trigger không có zone không góp vào tổng ở cả hai mode.

## 6. Race Impact: probability và breakdown không cap

Race Impact được tính cho **từng trigger**, rồi mới aggregate theo chain hoặc
alternative. Nó có breakdown độc lập:

```text
activationScore = round(P(activation) × 45)
effectScore     = round(effectMagnitude × 48)
timingScore     = round(timingQuality × 34)
durationScore   = round(clamp(duration / 5, 0, 1.5) × 18)
coverageScore   = round(clamp(coverage / 120, 0, 1.5) × 16)
raceImpactTactical = sum(all five scores)
```

Race-impact tactical score cố ý không cap. Một trigger có effect mạnh, đúng
timing và duration/coverage tốt có thể vượt 100; chain có thể tiếp tục cộng
các contribution hợp lệ.

### Activation rate

```text
P(activation) = geometryRate × wisdomRate × rankRate × dynamicRate
wisdomRate    = max(100 - 9000 / BaseWisdom, 20) / 100
```

- `geometryRate` là 1 khi zone hợp lệ, 0 khi không.
- `rankRate` là overlap style/rank của trigger đó (hoặc 1 nếu không có rank
  gate / không chọn style).
- `dynamicRate` là tích các condition động thực sự cần telemetry/override.
- `is_activate_other_skill_detail==1` bị loại khỏi `dynamicRate`; nó là chain
  dependency, không phải random condition.

UI hiển thị trực tiếp từng factor (ví dụ `geometry 100% × wisdom 95% ×
style/rank 50%`) để một tỷ lệ thấp luôn truy nguyên được.

### Dynamic priors

Các condition như blocked, overtake, nearby, surrounded, activation count và
visibility dùng lookup theo thứ tự:

1. telemetry sample đủ lớn của đúng course + style;
2. telemetry global cùng style;
3. fallback neutral 50%, hoặc override người dùng.

Mỗi result ghi `track`, `global` hoặc `manual`, sample count và confidence.
Priors được aggregate build-time từ replay frame telemetry bằng
`bun run build:race-impact-priors`; raw replay không được bundle. Current
pipeline có thể đo các state frame xác nhận được (blocked/nearby/surrounded/
overtake); state không decode được đáng tin cậy sẽ fallback manual thay vì
tuyên bố đó là xác suất thật.

## 7. Baseline-vs-skill physics

Physics v1 chỉ mô hình effect trực tiếp:

| Effect | Conditional distance gain |
|---|---|
| Current Speed | `Δv × duration` |
| Target Speed | `Δv × duration × 0.55` trong accel window, ngược lại `× 0.85` |
| Acceleration | `0.5 × a × min(duration, 5)² × timingQuality` |

Mỗi random region lấy start/mid/end làm representative samples. Với mỗi sample:

```text
timeGain = distanceGain / phaseVelocity
bashin   = distanceGain / 2.5m
expected = conditional mean × P(activation)
```

UI có thể hiển thị min/mean/median/max sample, expected time/distance/bashin và
`usefulRate`. Heal, passive, debuff và Zenkai vẫn có tactical impact nhưng
không có direct physical estimate hoàn chỉnh; UI nói rõ `partial` hoặc
`provisional`.

## 8. Thứ tự ưu tiên khi đọc UI

1. Xem **Course Activation Windows** trước: trigger có zone không?
2. Đọc **Trigger Verdict**: effect đúng loại và timing đúng chưa?
3. Đọc **Race Impact / Activation formula**: style/rank hoặc dynamic gate có
   làm xác suất thấp không?
4. Đọc **Tactical Verdict** cuối: chain được tổng hợp, alternatives chỉ lấy
   path tốt nhất.
5. Dùng `Race Impact` để so sánh tương đối, không diễn giải nó như cơ hội
   thắng cuộc đua.

## 9. Source of truth trong code

| Module | Trách nhiệm |
|---|---|
| `lib/skill-engine/zones.ts` | geometry/condition → activation regions |
| `lib/evaluator/effects.ts` | raw effect → category duy nhất |
| `lib/evaluator/rank-parser.ts` | rank window và style overlap |
| `lib/evaluator/evaluator.ts` | Tactical Verdict, trigger aggregation |
| `lib/race-impact/evaluate.ts` | independent trigger impact, physics v1, aggregate |
| `lib/race-impact/prior.ts` | prior lookup và fallback |
| `lib/race-impact/profile.ts` | profile validation + localStorage sync |
| `scripts/build-race-impact-priors.ts` | build aggregate telemetry prior JSON |

Chi tiết condition vocabulary và mechanics raw nằm trong
[`visualizer.md`](visualizer.md); rationale/giới hạn của impact model nằm trong
[`phan-tich-u-tools-race-impact.md`](phan-tich-u-tools-race-impact.md).
