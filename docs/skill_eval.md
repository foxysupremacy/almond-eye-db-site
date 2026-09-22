# Hệ Thống Đánh Giá Kỹ Năng (Skill Evaluation Engine Architecture)

Tài liệu này mô tả chi tiết toàn bộ cơ chế, công thức toán học, mô hình vật lý và thuật toán phân loại được sử dụng trong module đánh giá kỹ năng của **AlmondEyeDB** (`almond-eye-db-site/lib/evaluator/`).

---

## 1. Tổng Quan Kiến Trúc (Engine Overview)

Hệ thống đánh giá không chấm điểm kỹ năng theo độ hiếm hay mô tả tĩnh, mà **mô phỏng giá trị chiến thuật thực tế** của kỹ năng khi đặt trên một **hình học đường đua cụ thể (Course Geometry)** và kết hợp với **lối chạy của Uma Musume (Running Style)**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 INPUT PARAMETERS                                       │
│  • Skill Data (Condition Groups, Effects, Base Time)                                   │
│  • Course Geometry (Length, Spurt Line 2/3, Corners, Straights, Slopes)                │
│  • Running Style (Runner, Leader, Betweener, Chaser, Great Escape)                     │
│  • Race Parameters (9-uma room, isParentMode, Active Trigger Zones)                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                6-STEP EVALUATION PIPELINE                              │
│  1. Parent Deck Mode & White Unique Transformation                                     │
│  2. Effect Classification & Active Zone Region Extraction                              │
│  3. Phase-Aware Velocity Model (v_early=18.0, v_mid=20.5, v_late=26.0 m/s)             │
│  4. Style Gating & Independent Multi-Group Rank Envelope Overlap                       │
│  5. Tactical Classification (Fastest Accel, Carry-Over, Style-Aware Speed, Recovery)  │
│  6. Multi-Stage Synergy Stacking & Penalty Deductions                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                SKILL EVALUATION RESULT                                 │
│  • Score (0 – 100) & Stars (1★ – 5★)                                                  │
│  • Tier (S, A, B, C, D, F) & Tactical Category                                         │
│  • Badges & Special Effects (Carry-Over, Rank Trap, Fires in Accel, Stamina Demand...) │
│  • Step-by-Step Calculation Breakdown & Formulas                                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Quy Trình Đánh Giá 6 Bước (6-Step Pipeline)

### Bước 1: Chuyển Đổi Kế Thừa (Parent Deck Transformation)

Khi kích hoạt chế độ **Parent Deck** (`isParentMode = true`):
- Các kỹ năng Vàng (`rarity: 2`) được kế thừa sẽ suy giảm sức mạnh thành dạng Kỹ năng Trắng tương ứng (`whiteId`, `inheritedWhiteNameEn`, `inheritedWhiteNameJp`).
- Kỹ năng Unique của ngựa cha mẹ được tự động co giãn về thông số bản thừa kế (Inherited Unique).
- Gán metadata `factorTier` phục vụ việc xếp hạng nhân giống (Parenting Affinity).

---

### Bước 2: Phân Loại Hiệu Ứng & Vùng Kích Hoạt (Zone & Effect Extraction)

Hệ thống bóc tách toàn bộ các nhóm điều kiện (`conditionGroups`) của kỹ năng:
1. **Phân loại Effect Types**:
   - **Gia tốc (`type: 31`)**: Tăng gia tốc tức thời ($m/s^2$).
   - **Mục tiêu tốc độ (`type: 27`)**: Nâng trần tốc độ tối đa ($m/s$).
   - **Hiện tại tốc độ (`type: 21`, `type: 22`)**: Cộng thẳng vận tốc tức thì $\Delta v$ (bỏ qua độ trễ gia tốc).
   - **Hồi phục (`type: 9`, `type: 10`)**: Hồi phục thể lực (% HP tối đa).
   - **Passive (`type: 1` – `type: 8`)**: Tăng chỉ số nền (Speed, Stamina, Power, Guts, Wisdom).
   - **Guts Spurt (`type: 48`)**: Tốc độ bứt phá khi so kè (追い比べ).
2. **Khớp Hình học Đường đua (Course Geometry Matching)**:
   - Lấy danh sách vùng hợp lệ (`regions: [{start, end}]`) từ công cụ tính vùng kích hoạt (`computeAllZones`).
   - Xác định cự ly bắt đầu sớm nhất `triggerStartMeters` và muộn nhất `triggerEndMeters`.
   - Nếu kỹ năng không có bất kỳ điểm kích hoạt nào trên sân $\rightarrow$ Phân loại `invalid` (Tier F, 15 điểm).

---

### Bước 3: Mô Hình Vận Tốc Theo Phase (Phase-Aware Velocity Model)

Trong *Uma Musume*, thời lượng kỹ năng co giãn tuyến tính theo cự ly đường đua:
$$T_{\text{race}} = \left( \frac{\text{base\_time}}{10\,000} \right) \times \left( \frac{D_{\text{course}}}{1\,000} \right)$$

Khoảng cách kỹ năng duy trì hiệu lực ($S_{\text{meters}}$) phụ thuộc trực tiếp vào vận tốc trung bình của ngựa tại phase kích hoạt:
$$S_{\text{meters}} = T_{\text{race}} \times v_{\text{phase}}$$

| Giai đoạn (Race Phase) | Phạm vi cự ly trên đường đua | Vận tốc mô hình ($v_{\text{phase}}$) | Ví dụ thời lượng $3.0\text{s}$ trên Tokyo 2400m |
| :--- | :--- | :--- | :--- |
| **Phase 0 (Early Race)** | $d < \frac{1}{3} D_{\text{spurt}}$ | **$18.0\text{ m/s}$** | $3.0 \times 2.4 \times 18.0 = \mathbf{129.6\text{m}}$ |
| **Phase 1 (Mid Race)** | $\frac{1}{3} D_{\text{spurt}} \le d < D_{\text{spurt}}$ | **$20.5\text{ m/s}$** | $3.0 \times 2.4 \times 20.5 = \mathbf{147.6\text{m}}$ |
| **Phase 2 & 3 (Late & Spurt)** | $d \ge D_{\text{spurt}}$ ($\ge \frac{2}{3} D_{\text{course}}$) | **$26.0\text{ m/s}$** | $3.0 \times 2.4 \times 26.0 = \mathbf{187.2\text{m}}$ |

> [!NOTE]
> Mô hình vận tốc theo phase giải quyết triệt để sai số của giả định vận tốc tĩnh $20\text{ m/s}$ cũ, giúp tính toán chính xác tuyệt đối hiện tượng **Carry-Over (終盤接続)** và độ bao phủ của kỹ năng.

---

### Bước 4: Đánh Giá Lối Chạy & Bẫy Thứ Hạng (Style & Rank Envelope)

#### A. Tự động nhận diện Style (Auto Style Detection)
- Khi người dùng chưa chỉ định lối chạy (`runningStyle = undefined`), nếu kỹ năng có điều kiện ràng buộc cụ thể (ví dụ `running_style==1`), hệ thống tự động suy ra profile của Runner để chấm điểm chuẩn xác. Nếu kỹ năng dùng chung cho mọi style, barem trung lập (Neutral) sẽ được áp dụng.

#### B. Khung vị trí kỳ vọng (Expected Rank Envelope)
Trong phòng đấu 9 người (Room Match / Champions Meeting):
- **Runner (1)**: Hạng 1 – 2
- **Leader (2)**: Hạng 2 – 5
- **Betweener (3)**: Hạng 4 – 7
- **Chaser (4)**: Hạng 4 – 9

#### C. Đánh giá Overlap độc lập theo từng Group
Với các kỹ năng phức hợp nhiều giai đoạn (Multi-group như `Ring-a-Link` của Victoire Pisa: Group 0 yêu cầu giữa chặng hạng $\ge 50\%$, Group 1 yêu cầu đường thẳng cuối hạng $\le 50\%$):
- Hệ thống tính toán `positionOverlap` **riêng biệt cho từng Group**.
- **Không gộp điều kiện giữa các phase** để tránh tạo thành giao điểm bất khả thi `[5, 5]`.
- **Quy tắc xử phạt**:
  - Nếu một active group có **$0\%$ overlap** (ví dụ Almond Eye Unique Group 1 yêu cầu hạng $\le 3$ trên Chaser 4–9) $\rightarrow$ Gán bẫy **`Rank Trap` / `rank_mismatch`** (Phạt $-25$ điểm, gán Tier F / `rank_invalid`).
  - Nếu $\text{Overlap} \le 25\%$ $\rightarrow$ Gán cảnh báo **`Weak Position Match`** (Phạt $-25$ điểm).
  - Nếu $\text{Overlap} \le 50\%$ $\rightarrow$ Gán cảnh báo **`Partial Position Match`** (Phạt $-12$ điểm).
  - Nếu kỹ năng yêu cầu style khác hoàn toàn (`style_mismatch`) $\rightarrow$ Phạt $-50$ điểm.

---

### Bước 5: Phân Loại Chiến Thuật (Tactical Classification)

#### 1. Kỹ năng Gia tốc (Acceleration - Type 31)
Hiệu quả của kỹ năng gia tốc phụ thuộc vào **độ trễ kích hoạt so với vạch Spurt** ($\Delta d = d_{\text{fire}} - D_{\text{spurt}}$):

| Phân loại chiến thuật | Khoảng cách so với vạch Spurt ($\Delta d$) | Tier | Điểm | Ý nghĩa chiến thuật |
| :--- | :--- | :---: | :---: | :--- |
| **Valid Fastest Accel (有効最速加速)** | **$-15\text{m} \le \Delta d \le 50\text{m}$** | **S** | **95** | **Vàng mười**: Nổ ngay thời điểm bắt đầu tăng tốc, rút ngắn tối đa thời gian đạt tốc độ đỉnh. |
| **Delayed Accel (遅延加速)** | **$50\text{m} < \Delta d \le 140\text{m}$** | **C** | **65** | Nổ trễ khi ngựa đã đạt được phần lớn vận tốc; hiệu quả gia tốc bị suy giảm. |
| **Position Accel (ポジション加速)** | Kích hoạt ở Mid-race ($d < D_{\text{spurt}} - 15\text{m}$) | **B** | **75** | Giúp ngựa đổi làn hoặc bứt nhẹ để cải thiện vị trí giữa chặng. |
| **Dead Accel (無効加速)** | $\Delta d > 140\text{m}$ (sau Spurt) hoặc $d < \frac{1}{6} D$ | **F** | **15** | **Vô hiệu hoàn toàn**: Nổ khi ngựa đã đạt tốc độ tối đa (hòa ga) hoặc quá sớm đầu trận. |

##### Quy Tắc Ngoại Lệ Hình Học: Đường Thẳng / Dốc Sát Vạch Spurt (Geometry Exception Rules):
- **Đường thẳng sát Spurt ($\Delta d_{\text{straight}} \le 50\text{m}$)**:
  - Ví dụ tại **ParisLongchamp 2400m**: Vạch Spurt ở $1600\text{m}$ (cuối Cua 4), trong khi đoạn thẳng giả (*Fausse Ligne Droite*) bắt đầu ngay tại **$1617\text{m}$** ($\Delta d = 17\text{m}$).
  - Mặc dù kỹ năng là *Final Straight Accel*, độ trễ $17\text{m} \le 50\text{m}$ nằm trọn trong vùng vàng gia tốc $\rightarrow$ **Vẫn được xếp loại Valid Fastest Accel (Tier S, 95đ)**!
  - Trái lại, tại **Tokyo 2400m** (Spurt $1600\text{m}$, thẳng cuối $1875\text{m}$, $\Delta d = 275\text{m}$) hay **Kyoto 2200m** (Spurt $1467\text{m}$, thẳng cuối $1800\text{m}$, $\Delta d = 333\text{m}$), kỹ năng này là **Dead Accel (Tier F, 15đ)**.
- **Dốc xuống bao trùm vạch Spurt (Downhill Spurt Overlap)**:
  - Khi triền dốc xuống kéo dài qua vạch Spurt (như dốc $1017\text{m} - 1617\text{m}$ tại Longchamp hoặc dốc C3 tại Kyoto $2200\text{m}$), kỹ năng dốc xuống nổ trước vạch Spurt sẽ tạo thành **Carry-Over** đỉnh cao, giúp ngựa bắt đầu Spurt với vận tốc ban đầu $> 22\text{ m/s}$.

#### 2. Kỹ năng Chuyển tiếp (Carry-Over Connection - 終盤接続)
- Nếu kỹ năng tốc độ (Type 27/21/22) kích hoạt trước vạch Spurt nhưng thời lượng kéo dài băng qua vạch Spurt ($d_{\text{start}} < D_{\text{spurt}}$ và $d_{\text{start}} + S_{\text{meters}} > D_{\text{spurt}}$):
  - Phân loại: **`carry_over` (Tier S, 95 điểm, 5★)**.
  - Ý nghĩa: Giúp ngựa bước vào giai đoạn Spurt với vận tốc ban đầu cao hơn hẳn đối thủ, rút ngắn giai đoạn tăng tốc tự nhiên.

#### 3. Kỹ năng Hiện tại Tốc độ (Instant Current Speed - Type 21/22)
- Phân loại: **`current_speed` (Tier A/S, tối thiểu 88 điểm, 4★ - 5★)**.
- Ý nghĩa: Cộng trực tiếp vận tốc ngay lập tức, không chịu độ trễ quán tính (Zero Acceleration Lag), phát huy hiệu quả ở mọi thời điểm trên đường đua.

#### 4. Kỹ năng Mục tiêu Tốc độ (Target Speed - Type 27) & Ma Trận Phân Hóa Lối Chạy

Hệ thống áp dụng **Ma trận Điểm chuẩn Theo Lối chạy (Style-Aware Phase Weighting)** để phản ánh chính xác vai trò chiến thuật của từng lối chạy:

| Lối chạy (Running Style) | Early Speed (Phase 0) | Mid Speed (Phase 1) | Late Speed (Phase 2 & 3) |
| :--- | :---: | :---: | :---: |
| **Runner (Trốn / Nige)** | **Tier S (90đ, 5★)**<br>*Sống còn tranh chấp số 1* | **Tier S (88đ, 5★)**<br>*Nới rộng vùng an toàn* | **Tier B (75đ, 3★)**<br>*Thứ yếu sau Accel & Mid* |
| **Leader (Tiên phong / Senkou)** | **Tier A (78đ, 4★)**<br>*Định hình nhóm đầu* | **Tier S (88đ, 5★)**<br>*Bảo vệ vùng an toàn 2–4* | **Tier A (85đ, 4★)**<br>*Bứt tốc săn đuổi Runner* |
| **Betweener (Sashi)** | **Tier C (65đ, 2★)**<br>*Tránh vọt lên top quá sớm* | **Tier A (82đ, 4★)**<br>*Gom đàn, giữ tầm với* | **Tier S (92đ, 5★)**<br>*Vũ khí kết liễu chủ lực* |
| **Chaser (Oikomi)** | **Tier C (62đ, 2★)**<br>*Bảo toàn vị trí 7–9* | **Tier A (80đ, 4★)**<br>*Áp sát trước khúc cua* | **Tier S (95đ, 5★)**<br>*Tổng lực càn quét về đích* |
| **Neutral (Dùng chung / Chưa chọn style)** | **Tier B (72đ, 3★)** | **Tier A (82đ, 4★)** | **Tier A (85đ, 4★)** |

##### Ba Cảnh Báo Chiến Thuật Đi Kèm:
1. **`Fires during Acceleration` (Warning)**:
   - Xuất hiện khi kỹ năng Target Speed kích hoạt trong khoảng $D_{\text{spurt}} \rightarrow D_{\text{spurt}} + 130\text{m}$ (khi ngựa chưa hoàn thành việc tăng tốc lên đỉnh Spurt).
   - Nhắc nhở người dùng rằng trần tốc độ tạm thời bị giảm hiệu quả trong ramp gia tốc.
2. **`High Stamina Demand` (Warning)**:
   - Xuất hiện khi kỹ năng Late Speed chạy trên đường đua dài ($\ge 2000\text{m}$) hoặc có độ lớn $\ge 3500$.
   - Cảnh báo tốc độ nước rút cực đại làm tăng tốc độ tiêu hao thể lực theo hàm bậc 3 ($v^3$), cần đảm bảo đủ Stamina/Heal chống sập nguồn $30\text{m}$ trước vạch đích.
3. **`Heavy / Bad Turf Stamina Penalty` (Critical Warning)**:
   - Xuất hiện khi thi đấu trên mặt sân **Heavy / Bad (Nặng/Xấu)** ở cự ly $\ge 2400\text{m}$ (như giải đấu Longchamp Prix de l'Arc de Triomphe).
   - Mặt sân xấu làm tăng tốc độ đốt HP thêm $10\% - 15\%$. Ngựa có Stamina $< 1600$ bắt buộc phải sở hữu ít nhất 1 kỹ năng Hồi phục Vàng (Gold Recovery) để tránh sập vận tốc hoàn toàn ở $200\text{m}$ cuối.

#### 5. Kỹ năng Hồi phục (Recovery - Type 9/10)
Điểm số co giãn trực tiếp theo cự ly thi đấu:
- **Đường dài / Trung bình ($\ge 2000\text{m}$)**: **Tier S (88 điểm, 5★)** kèm badge `Stamina Safety` (Bảo vệ thể lực bắt buộc).
- **Đường dặm ($1400\text{m} - 2000\text{m}$)**: **Tier A (80 điểm, 4★)**.
- **Đường ngắn ($\le 1400\text{m}$)**: **Tier C (60 điểm, 2★)** kèm badge `Low Stamina Demand` (Thừa thãi thể lực, ít giá trị biên).

---

### Bước 6: Multi-Stage Synergy & Điểm Tổng Kết

1. **Thưởng Kỹ Năng Đa Giai Đoạn (Multi-Stage Synergy)**:
   - Khi kỹ năng sở hữu nhiều `conditionGroups` cùng kích hoạt hợp lệ trên đường đua (ví dụ vừa tăng tốc giữa chặng vừa bứt phá đường thẳng cuối):
     $$\text{CompositeBonus} = \sum_{g \in \text{secondary}} \Big( W_{\text{type}} \times \text{DurationFactor}_g \Big)$$
   - Thưởng cộng thêm $+8$ đến $+15$ điểm vào tổng điểm và gắn badge **`Multi-Stage Activation Synergy`**.
2. **Khấu Trừ Điểm Phạt Trap**:
   $$\text{FinalScore} = \text{BaseScore} + \text{CompositeBonus} - \text{TrapPenalties}$$
3. **Phân cấp Thừa kế Nhân giống (`factorTier`)**:
   - $5★ \rightarrow \text{Factor Tier S}$
   - $4★ \rightarrow \text{Factor Tier A}$
   - $3★ \rightarrow \text{Factor Tier B}$
   - $1★ - 2★ \rightarrow \text{Factor Tier C}$

---

## 3. Các Ca Điển Hình (Case Studies)

### Ca 1: Victoire Pisa (`Ring-a-Link` - ID 101431) trên Tokyo 2400m Turf
- **Lối chạy**: Betweener (Hạng kỳ vọng: 4–7).
- **Group 0**: Giữa chặng, `order_rate >= 50%` (hạng 5–9) $\rightarrow$ Overlap $75\%$ với Betweener.
- **Group 1**: Đường thẳng cuối, `order_rate <= 50%` (hạng 1–5) $\rightarrow$ Overlap $50\%$ với Betweener.
- **Đánh giá**:
  - Cả 2 group đều có overlap dương $\rightarrow$ **Không bị bẫy Rank Trap**.
  - Kích hoạt cả 2 phase $\rightarrow$ Thưởng **`Multi-Stage Synergy` (+8đ)**.
  - Late Speed trên Betweener đạt điểm trần $\rightarrow$ **Tier S (100 điểm, 5★)**.

### Ca 2: Almond Eye (`Assured Victory` - ID 101291) trên Kyoto 2200m Turf
- **Group 0**: Giữa chặng cua, `order_rate <= 50%` (hạng 1–5).
- **Group 1**: Nước rút, `order <= 3` (hạng 1–3).
- **Khi đánh giá trên Runner / Leader**: Cả 2 group đều thỏa mãn hoàn hảo $\rightarrow$ **Tier S (95 – 100 điểm)**.
- **Khi đánh giá trên Chaser (hạng 4–9)**: Group 1 có Overlap = $0\%$ $\rightarrow$ Bắt chính xác bẫy **`Rank Trap`**, hạ về **Tier F / `rank_invalid`**.

### Ca 3: Seiun Sky (`Angling & Scheming` - ID 102001)
- **Điều kiện**: Cuối chặng cua, `order == 1`.
- **Trên Runner**: Nổ đúng vạch Spurt cua cuối $\rightarrow$ **Fastest Accel (Tier S, 95 điểm, 5★)**.
- **Trên Betweener (hạng 4–7)**: Overlap = $0\%$ $\rightarrow$ **Rank Trap (Tier F, 15 điểm, 1★)**.

### Ca 4: ParisLongchamp 2400m Turf Heavy Ground (Still in Love & Almond Eye)
- **Đặc điểm**: Vạch Spurt $1600\text{m}$, Fausse Ligne Droite $1617\text{m}$, mặt cỏ nặng Bad/Heavy.
- **Still in Love (Betweener)**: Trang bị dàn gom cụm Mid-race (*Tail of Victory*, *Sorry Gotta Go*, *Blitzing Spirit*) kết hợp cự ly dốc xuống $1017\text{m}-1617\text{m}$ $\rightarrow$ Carry-Over tốc độ cao qua $1600\text{m}$, chiến thắng áp đảo 4 trận với thời gian $109.3\text{s} - 109.8\text{s}$.
- **Almond Eye (Leader)**: Nổ *Peerless Heroine* đường thẳng giả $1617\text{m}$ ($\Delta d = 17\text{m}$) $\rightarrow$ Tận dụng trọn vẹn ramp gia tốc hợp lệ, về đích đầu 2 trận với thời gian $109.387\text{s}$ và $110.127\text{s}$.
- **Ngược lại, Neo Universe (Runner)**: Thiếu Stamina trên cỏ nặng ($1233$) và không có Gold Recovery $\rightarrow$ Sập nguồn ở $200\text{m}$ cuối, về bét $114.5\text{s} - 115.3\text{s}$ (chậm hơn $> 5.0\text{s}$).
