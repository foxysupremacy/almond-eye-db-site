# Báo Cáo Phân Tích Thực Chứng & Bộ Quy Luật Đánh Giá Skills Theo Track Và Style

Tài liệu này tổng hợp toàn bộ kết quả phân tích dữ liệu thực tế từ 11 trận đấu đỉnh cao (`raceData/`), kết hợp cùng mô hình vật lý và hình học đường đua trong **AlmondEyeDB**, nhằm xây dựng bộ quy luật đánh giá kỹ năng chuẩn xác cho từng đường đua và từng lối chạy.

---

## MỤC LỤC

1. [Tổng Quan Dữ Liệu Thực Chứng (Empirical Dataset Overview)](#1-tổng-quan-dữ-liệu-thực-chứng)
2. [Quy Luật Đánh Giá Kỹ Năng Theo Từng Đường Đua (Track-Specific Rules)](#2-quy-luật-đánh-giá-kỹ-năng-theo-từng-đường-đua)
   - [2.1. ParisLongchamp 2400m Turf (Prix de l'Arc de Triomphe)](#21-parislongchamp-2400m-turf)
   - [2.2. Kyoto 2200m Turf (Outer / 外回り)](#22-kyoto-2200m-turf)
   - [2.3. Tokyo 2400m Turf (Japan Derby / Japan Cup)](#23-tokyo-2400m-turf)
3. [Quy Luật Đánh Giá Kỹ Năng Theo Từng Lối Chạy (Style-Specific Rules)](#3-quy-luật-đánh-giá-kỹ-năng-theo-từng-lối-chạy)
   - [3.1. Runner (Trốn / 逃げ)](#31-runner-trốn--逃げ)
   - [3.2. Leader (Tiên phong / 先行)](#32-leader-tiên-phong--先行)
   - [3.3. Betweener (Gom cụm / 差し)](#33-betweener-gom-cụm--差し)
   - [3.4. Chaser (Bứt phá / 追込)](#34-chaser-bứt-phá--追込)
4. [Cơ Chế Thể Lực & Ảnh Hưởng Của Mặt Sân Cỏ Nặng (Heavy Turf Stamina Breakdown)](#4-cơ-chế-thể-lực--mặt-sân-cỏ-nặng)
5. [Phân Tích Chi Tiết Các Ca Điển Hình (Case Studies)](#5-phân-tích-chi-tiết-các-ca-điển-hình)
6. [Ma Trận Tra Cứu Khuyến Nghị Kỹ Năng (Master Recommendation Matrix)](#6-ma-trận-tra-cứu-khuyến-nghị-kỹ-năng)

---

## 1. Tổng Quan Dữ Liệu Thực Chứng

Tập dữ liệu gồm 11 trận đấu (Room Match) với 99 lượt chạy của các Uma Musume chuẩn meta thuộc các bản ghi ngày 20–21/09/2026:

| Tên File | Đường đua | Cự ly | Mặt sân | Thời tiết | Luật đặc biệt | Ngựa vô địch (1st) | Style | Thời gian về đích |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: | :---: |
| `Admire Groove-109.2218s` | ParisLongchamp (10201) | 2400m | Bad (Heavy) | Sunny | No Debuffs | **Admire Groove** | Betweener | **109.222s** |
| `Almond Eye-109.3871s` | ParisLongchamp (10201) | 2400m | Bad (Heavy) | Sunny | No Debuffs | **Almond Eye** | Leader | **109.387s** |
| `Almond Eye-110.1267s` | ParisLongchamp (10201) | 2400m | Bad (Heavy) | Sunny | No Debuffs | **Almond Eye** | Leader | **110.127s** |
| `Buena Vista-109.9035s` | ParisLongchamp (10201) | 2400m | Bad (Heavy) | Sunny | No Debuffs | **Buena Vista** | Chaser | **109.903s** |
| `Still in Love-109.3643s` | ParisLongchamp (10201) | 2400m | Bad (Heavy) | Sunny | No Debuffs | **Still in Love** | Betweener | **109.364s** |
| `Still in Love-109.4332s` | ParisLongchamp (10201) | 2400m | Bad (Heavy) | Sunny | No Debuffs | **Still in Love** | Betweener | **109.433s** |
| `Still in Love-109.7552s` | ParisLongchamp (10201) | 2400m | Bad (Heavy) | Sunny | No Debuffs | **Still in Love** | Betweener | **109.755s** |
| `Still in Love-109.8901s` | ParisLongchamp (10201) | 2400m | Bad (Heavy) | Sunny | No Debuffs | **Still in Love** | Betweener | **109.890s** |
| `Still in Love-99.6508s` | Kyoto Outer (10008) | 2200m | Good | Sunny | Standard | **Still in Love** | Betweener | **99.651s** |
| `Victoire Pisa-101.0042s` | Kyoto Outer (10008) | 2200m | Good | Sunny | Standard | **Victoire Pisa** | Betweener | **101.004s** |
| `Victoire Pisa-111.0081s` | Tokyo (10006) | 2400m | Hard | Sunny | Standard | **Victoire Pisa** | Betweener | **111.008s** |

### Nhận định ban đầu:
- **Betweener (Sashi)** áp đảo với **8/11 chiến thắng** (Still in Love: 5 trận, Victoire Pisa: 2 trận, Admire Groove: 1 trận).
- **Leader (Senkou)** giành **2 chiến thắng** (đều do Almond Eye với Unique cực kỳ tối ưu cho cự ly 2400m).
- **Chaser (Oikomi)** giành **1 chiến thắng** (Buena Vista).
- **Runner (Nige)** có trận về nhì sát nút (Seiun Sky: $109.445\text{s}$, chỉ kém Almond Eye $0.058\text{s}$), tuy nhiên các ca Runner khác bị tụt lại nghiêm trọng do sập thể lực.

---

## 2. Quy Luật Đánh Giá Kỹ Năng Theo Từng Đường Đua

### 2.1. ParisLongchamp 2400m Turf (Prix de l'Arc de Triomphe)

Đường đua ParisLongchamp là sân đua nổi tiếng của Pháp với cấu trúc hình học hoàn toàn khác biệt so với các trường đua tiêu chuẩn của JRA tại Nhật Bản.

```
0m                                  1000m       1417m   1600m  1617m          1867m                 2400m
├── S1 (Đoạn thẳng đối diện 1000m) ──┼─── C3 ────┼─ C4 ──┼─★────┼─ S2 (Đoạn ───┼── S3 (Đích 533m) ──┤
│    Dốc lên (+2.0%, 400m-1000m)     │ Dốc xuống (-2.0%) │ Dốc  │  thẳng giả)  │                    │
│                                    │ (1017m - 1400m)   │ -1.5%│  (250m)      │                    │
└────────────────────────────────────┴───────────────────┴──────┴──────────────┴────────────────────┘
                                                            ▲
                                                   Vạch Spurt = 1600m
```

#### Quy luật 1: Kỹ năng Gia tốc Đường thẳng (Straight Accel) là "Valid Fastest Accel"
- Vạch Spurt bắt đầu tại **$1600\text{m}$** (cuối Cua 4).
- Đoạn thẳng giả (*Fausse Ligne Droite* - $S2$) bắt đầu tại **$1617\text{m}$**.
- Khoảng cách kích hoạt: $\Delta d = 1617\text{m} - 1600\text{m} = \mathbf{17\text{m}} \le 50\text{m}$.
- **Hệ quả**: Kỹ năng gia tốc yêu cầu đường thẳng cuối/đường thẳng Spurt nổ chỉ trễ đúng $17\text{m}$, nằm trọn trong vùng vàng gia tốc $\rightarrow$ **Xếp Tier S (95 điểm)**!
- *Lưu ý*: Đây là ngoại lệ hình học đặc biệt của Longchamp. Trên Tokyo 2400m hay Kyoto 2200m, kỹ năng này bị Dead Accel.

#### Quy luật 2: Dốc xuống dài $1017\text{m} - 1617\text{m}$ và hiện tượng Carry-Over
- Cua 3 và Cua 4 nằm trên triền dốc xuống liên tục dài $600\text{m}$ ($-2.0\%$ và $-1.5\%$).
- Kỹ năng dốc xuống như **Downhill Specialist (下り坂巧者)** hoặc các kỹ năng tốc độ giữa chặng nổ trong khoảng $1450\text{m} - 1590\text{m}$ với thời lượng $\approx 3.0\text{s} \times 2.4 \times 20.5 = 147.6\text{m}$ sẽ **băng thẳng qua vạch $1600\text{m}$**.
- **Hệ quả**: Đạt trạng thái **Carry-Over (終盤接続)** hoàn hảo $\rightarrow$ Ngựa bước vào Spurt với vận tốc ban đầu $> 22\text{ m/s}$ thay vì $20.5\text{ m/s}$, rút ngắn $30\%$ thời gian tăng tốc lên $26\text{ m/s}$.

#### Quy luật 3: Kỹ năng đặc thù sân Longchamp
- **Child of Longchamp (ロンシャンの申し子)**: Tăng cùng lúc $+60$ Speed, $+60$ Stamina, $+60$ Wisdom $\rightarrow$ Giá trị chỉ số tương đương 3 kỹ năng xanh Gold $\rightarrow$ **Tier S+ (100 điểm)**.
- **Longchamp Racecourse ○ / ◎ (ロンシャンレース場○/◎)**: Tăng $+40 / +60$ Stamina trực tiếp $\rightarrow$ Cực kỳ quan trọng để bù đắp tiêu hao thể lực trên mặt cỏ nặng.

---

### 2.2. Kyoto 2200m Turf (Outer Course / 外回り)

Đường đua Kyoto 2200m (sân thi đấu Nữ Hoàng Elizabeth Cup / Queen Elizabeth II Cup):

```
0m                                    800m            1467m 1500m         1800m             2200m
├── S1 (Thẳng 400m) ──┼── C1/C2 ──────┼────── C3 ───────┼─★─┼─── C4 ──────┼── S (Thẳng đích 400m) ──┤
│                     │               │ Lên đồi Kyoto   │   │ Cua cuối    │                         │
│                     │               │ rồi đổ dốc C3   │   │             │                         │
└─────────────────────┴───────────────┴─────────────────┴───┴─────────────┴─────────────────────────┘
                                                          ▲
                                                 Vạch Spurt = 1467m
```

#### Quy luật 1: Điểm Spurt $1467\text{m}$ nằm trên đồi Cua 3 (Downhill C3)
- Vạch Spurt $1467\text{m}$ xuất hiện trước khi vào Cua cuối ($1500\text{m}$).
- Vị trí này nằm trên triền dốc xuống của Cua 3.
- **Valid Fastest Accel**: Kỹ năng gia tốc kích hoạt khi "ở dốc xuống cuối trận" hoặc "nửa sau Cua 3" nổ đúng $\Delta d = 0\text{m} \rightarrow$ **Tier S (95 điểm)**.
- **Cua cuối (C4)** bắt đầu ở $1500\text{m}$ ($\Delta d = 33\text{m} \le 50\text{m}$) $\rightarrow$ Kỹ năng gia tốc Cua cuối vẫn nằm trong vùng hữu hiệu $\rightarrow$ **Tier S / Tier A (90 điểm)**.

#### Quy luật 2: Kỹ năng Gia tốc Đường thẳng cuối là "Dead Accel"
- Đường thẳng cuối bắt đầu ở **$1800\text{m}$**.
- Độ trễ so với Spurt: $\Delta d = 1800\text{m} - 1467\text{m} = \mathbf{333\text{m}} \gg 140\text{m}$.
- **Hệ quả**: Khi ngựa chạm tới $1800\text{m}$, nó đã hoàn tất giai đoạn gia tốc từ $1467\text{m} \rightarrow 1600\text{m}$ và đang chạy ở tốc độ cực đại $26\text{ m/s}$. Kỹ năng gia tốc đường thẳng nổ tại đây bị lãng phí hoàn toàn $\rightarrow$ **Dead Accel (Tier F, 15 điểm)**.

---

### 2.3. Tokyo 2400m Turf (Japan Derby / Japan Cup)

Đường đua danh giá nhất Nhật Bản với đường thẳng cuối dài $525\text{m}$ và cua góc rộng:

```
0m                                        1475m      1600m     1875m       2000m             2400m
├── S1 ──────┼── C1/C2 ──────┼── S2 ──────┼─────────── C4 ──────┼────────── S3 (Thẳng đích 525m) ──┤
│            │               │            │           ▲         │ Dốc lên                          │
│            │               │            │     Vạch Spurt      │ (+1.5%, 1950m-2150m)             │
└────────────┴───────────────┴────────────┴─────────────────────┴──────────────────────────────────┘
```

#### Quy luật 1: Cua 4 bao trọn vạch Spurt $1600\text{m}$
- Cua 4 kéo dài từ $1475\text{m} \rightarrow 1875\text{m}$. Vạch Spurt $1600\text{m}$ nằm ở đúng $\approx \frac{1}{3}$ Cua 4.
- **King of Accel**: Kỹ năng gia tốc kích hoạt ở Cua cuối như **Checking the King (王手)**, **Angling & Scheming (アングリング×スキーミング)** (trên Runner hạng 1) nổ ngay tại $1600\text{m}$ ($\Delta d = 0\text{m}$) $\rightarrow$ **Tier S+ (100 điểm, 5★)**.
- Thực chứng: Trong trận `Victoire Pisa-111.0081s`, Victoire Pisa trang bị *王手* và bứt phá ngoạn mục giành chiến thắng tuyệt đối.

#### Quy luật 2: Đường thẳng cuối cách Spurt $275\text{m}$
- $\Delta d = 1875\text{m} - 1600\text{m} = \mathbf{275\text{m}}$.
- Kỹ năng Straight Accel kích hoạt ở $1875\text{m}$ bị trễ hoàn toàn $\rightarrow$ **Dead Accel (Tier F, 15 điểm)**.

---

## 3. Quy Luật Đánh Giá Kỹ Năng Theo Từng Lối Chạy

```
Phòng Đấu 9 Ngựa (Champions Meeting / Room Match):
┌────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│   Hạng 1   │   Hạng 2    │   Hạng 3    │   Hạng 4    │ Hạng 5 – 9  │
├────────────┴─────────────┼─────────────┼─────────────┼─────────────┤
│ ◄────── Runner ────────► │             │             │             │
│            ◄────────── Leader ────────►│             │             │
│                          ◄────────── Betweener ─────►│             │
│                                        ◄────────── Chaser ────────►│
└────────────────────────────────────────────────────────────────────┘
```

### 3.1. Runner (Trốn / 逃げ)

- **Mục tiêu tối thượng**: Chiếm giữ Hạng 1 trước khi bước vào Cua 4. Nếu mất vị trí dẫn đầu, Runner mất toàn bộ giá trị kích hoạt của Unique Accel (ví dụ *Angling & Scheming* yêu cầu `order == 1`).
- **Ưu tiên kỹ năng**:
  1. **Early Speed (Phase 0) - Tier S (90đ)**: Bắt buộc phải có để thắng cuộc đua mở cổng (Gate Dash) và xác lập vị trí số 1 trước khi đàn ngựa ổn định cự ly.
  2. **Mid Speed (Phase 1) - Tier S (88đ)**: Kỹ năng duy trì khoảng cách đệm (Buffer Margin), ngăn chặn Leader vượt lên ở giữa chặng.
  3. **Fastest Accel (Spurt) - Tier S (95đ)**: Bắt buộc nổ đúng vạch $1600\text{m}$ khi đang giữ hạng 1.
- **Thực chứng từ Seiun Sky ($109.445\text{s}$)**:
  - Trang bị đầy đủ chuỗi kỹ năng tốc độ mở đầu và giữa chặng, nổ Unique gia tốc tại $1600\text{m}$, dẫn đầu phần lớn cuộc đua và chỉ chịu thua Almond Eye ở $20\text{m}$ cuối cùng do sức mạnh bứt tốc vượt trội của Leader.

### 3.2. Leader (Tiên phong / 先行)

- **Mục tiêu tối thượng**: Duy trì phong độ trong top 2–4, bám sát đuôi Runner và tung cú đấm quyết định ở đầu chặng Spurt.
- **Ưu tiên kỹ năng**:
  1. **Mid Speed & Position Keep - Tier S (88đ)**: Cực kỳ quan trọng để không bị rơi xuống hạng 5–6 (nơi bị lẫn vào đàn Betweener).
  2. **Carry-Over Connection - Tier S (95đ)**: Kỹ năng tốc độ nổ cuối Mid-race kéo dài sang Spurt.
  3. **Unique Multi-Stage**: Điển hình là **Peerless Heroine** của Almond Eye:
     - Group 0: Tăng tốc giữa chặng Cua (`order_rate <= 50%` $\rightarrow$ Hạng 1–5, Leader thỏa mãn 100%).
     - Group 1: Bứt phá đường thẳng cuối (`order <= 3` $\rightarrow$ Leader bám đuổi Runner thỏa mãn hoàn hảo).
     - Kết quả: Almond Eye chiến thắng áp đảo 2 trận với thời gian $109.387\text{s}$ và $110.127\text{s}$.

### 3.3. Betweener (Gom cụm / 差し)

- **Vị thế thực tế trong dữ liệu**: **Thống trị tuyệt đối với 8/11 trận thắng**.
- **Nguyên nhân chiến thuật**:
  - Đàn Betweener trong phòng 9 người rất đông (thường 4–5 ngựa), tạo ra mật độ cạnh tranh cực lớn ở giữa chặng.
  - Các kỹ năng kích hoạt khi có sự cạnh tranh vị trí hoặc vượt mặt phát huy hiệu quả tối đa:
    - **Tail of Victory (尻尾の滝登り)**: Kích hoạt khi có $\ge 3$ kỹ năng nổ giữa chặng. Toàn bộ 8 ngựa vô địch Betweener đều trang bị kỹ năng này.
    - **Sorry, Gotta Go! (お先に失礼っ！)**: Tăng tốc bứt phá giữa chặng khi vượt mặt.
    - **Blitzing Spirit (突撃魂)**: Kỹ năng chuyên dụng của Betweener giúp rút ngắn khoảng cách với nhóm dẫn đầu.
    - **Archline Professor (弧線のプロフェッサー)**: Tốc độ cua giữa chặng.
  - Khi bước vào Spurt, đàn Betweener đã gom sát sau lưng Leader và đồng loạt bung toàn bộ Late-race Speed để càn quét về đích.

### 3.4. Chaser (Bứt phá / 追込)

- **Đặc điểm**: Giữ vị trí cuối đàn (hạng 6–9), bảo tồn thể lực và bùng nổ toàn lực ở $400\text{m}$ cuối.
- **Thực chứng từ Buena Vista ($109.903\text{s}$)**:
  - Tận dụng cự ly thẳng dài của Longchamp ($S2 + S3 = 783\text{m}$) và trang bị **Daring Attack (強攻策)** để kéo vị trí lên nhóm giữa trước khi Spurt, sau đó dùng Unique **To Our Vista** kết liễu cuộc đua.

---

## 4. Cơ Chế Thể Lực & Mặt Sân Cỏ Nặng (Heavy Turf)

### 4.1. Hệ số tiêu hao thể lực trên cỏ nặng (Bad/Heavy Turf)

Trong cơ chế game *Uma Musume*, thể lực tiêu hao mỗi giây được tính theo công thức:
$$HP_{\text{drain}} = 20.0 \times \alpha_{\text{ground}} \times \left( \frac{v}{v_{\text{base}}} \right)^3 \times \beta_{\text{phase}}$$

Trong đó:
- Trên mặt sân **Good (Lành)**: $\alpha_{\text{ground}} = 1.00$.
- Trên mặt sân **Heavy / Bad (Nặng / Xấu)**: $\alpha_{\text{ground}} = \mathbf{1.10} - \mathbf{1.15}$ (tiêu hao tăng thêm $10\% - 15\%$).
- Khi vận tốc nước rút đạt $v \approx 26.0\text{ m/s}$ ($v^3 \approx 17576$), tốc độ đốt HP tăng gấp **$2.5$ lần** so với giai đoạn đầu trận.

### 4.2. Giải mã hiện tượng sập nguồn của Neo Universe ($114.5\text{s} - 115.3\text{s}$)

Trong toàn bộ 8 trận tại Longchamp 2400m Bad Turf, ngựa mang số hiệu Runner của Neo Universe đều về đích ở vị trí thứ 8 với thời gian $114.5\text{s} - 115.3\text{s}$ (chậm hơn top đầu hơn **$5.0\text{ giây}$**, tương đương cách biệt $> 25$ chiều dài thân ngựa):

| Thông số | Ngựa Vô Địch (Still in Love / Almond Eye) | Ngựa Về Bét (Neo Universe Runner) |
| :--- | :---: | :---: |
| **Speed** | **2180 – 2225** | 1346 |
| **Stamina** | **1700 – 1810** | **1233** |
| **Power** | 1600 – 1727 | 1390 |
| **Guts** | 1200 – 1317 | 796 |
| **Wisdom** | 1600 – 1838 | 1643 |
| **Aptitude Longchamp / Long** | **S / A** | **B / Proper Nige G** |
| **Kỹ năng Hồi phục (Heal)** | Có Recovery / Factor | Không có Gold Heal hữu hiệu |
| **Hiện tượng $200\text{m}$ cuối** | Duy trì $25.8 - 26.0\text{ m/s}$ | **Cạn sạch HP, tụt vận tốc xuống $< 18\text{ m/s}$** |

> [!CAUTION]
> **Quy luật Thể lực Sân Dài Mặt Cỏ Nặng ($\ge 2400\text{m}$, Heavy Turf)**:
> 1. Mức Stamina cơ bản $\le 1200$ là **ngưỡng tử thần** đối với cự ly 2400m Heavy.
> 2. Bắt buộc phải có chỉ số Stamina $\ge 1600$ (kèm Guts $\ge 1200$) HOẶC trang bị ít nhất **1 Kỹ năng Hồi phục Vàng (Gold Heal, Type 9/10, $+5.5\%$ HP)**.
> 3. Mọi kỹ năng Late Speed cực mạnh đều trở nên vô nghĩa nếu ngựa bị cạn kiệt HP trước vạch đích $150\text{m}$.

---

## 5. Phân Tích Chi Tiết Các Ca Điển Hình (Case Studies)

### Ca 1: Combo "Động Cơ Vàng Giữa Chặng" (Mid-Race Engine) của Still in Love
- **Các chiến thắng**: $109.364\text{s}$, $109.433\text{s}$, $109.755\text{s}$, $109.890\text{s}$ trên Longchamp và $99.651\text{s}$ trên Kyoto.
- **Bộ khung kỹ năng chuẩn mực**:
  1. *Scarlet Lily's Elation (Unique)*: Nổ đúng thời điểm cần thiết.
  2. *Tail of Victory (尻尾の滝登り)*: Kích nổ dây chuyền khi gom cụm.
  3. *Sorry, Gotta Go! (お先に失礼っ！)*: Bứt phá đổi làn vượt đối thủ.
  4. *The Perfect Spot! (いいとこ入った！)*: Khóa vị trí chiến thuật thuận lợi.
  5. *Blitzing Spirit (突撃魂)*: Tăng tốc cực mạnh cho Betweener.
- **Quy luật rút ra**: Đối với Betweener, **Mid-race Speed quan trọng không kém Late-race Speed**. Nếu không có dàn skill Mid-race để lọt vào top 4–6 trước vạch Spurt, ngựa sẽ bị kẹt làn (trapped behind) và không thể phát huy gia tốc nước rút.

### Ca 2: Bẫy Thứ Hạng (Rank Trap) của Almond Eye trên Chaser vs Thăng Hoa trên Leader
- Kỹ năng Unique của Almond Eye (**Peerless Heroine**):
  - Group 1 yêu cầu: `order <= 3` (Hạng 1–3).
- **Trên Leader**: Ngựa duy trì vị trí 2–4 ở giữa chặng, khi bước vào đầu đường thẳng nước rút dễ dàng vươn lên hạng 3 $\rightarrow$ Thỏa mãn điều kiện Group 1 $\rightarrow$ Kích hoạt bứt tốc cực đại $\rightarrow$ **Vô địch 2 lần**.
- **Trên Chaser**: Chaser xuất phát từ hạng 7–9, đến đầu Spurt thường chỉ mới lên tới hạng 5–6. Điều kiện `order <= 3` có tỷ lệ trùng khớp $0\%$ tại thời điểm kiểm tra $\rightarrow$ **Dính bẫy Rank Trap hoàn toàn**, kỹ năng không nổ.

---

## 6. Ma Trận Tra Cứu Khuyến Nghị Kỹ Năng (Master Matrix)

Bảng tổng hợp khuyến nghị kỹ năng theo từng cặp (Đường đua, Lối chạy):

| Nhóm Kỹ Năng | ParisLongchamp 2400m Turf | Kyoto 2200m Turf | Tokyo 2400m Turf |
| :--- | :--- | :--- | :--- |
| **Gia tốc Cua Cuối (Final Corner Accel)** | **Tier S (92đ)**<br>Nổ cuối C4 cách Spurt $0\text{m}-17\text{m}$. | **Tier S (90đ)**<br>Nổ tại $1500\text{m}$ ($\Delta d = 33\text{m}$). | **Tier S+ (100đ)**<br>Nổ ngay tại Spurt $1600\text{m}$ (*王手* cực mạnh). |
| **Gia tốc Đường Thẳng (Straight Accel)** | **Tier S (95đ)**<br>Đoạn thẳng giả $S2$ bắt đầu ở $1617\text{m}$ ($\Delta d = 17\text{m}$). | **Tier F (15đ) - DEAD**<br>Thẳng bắt đầu ở $1800\text{m}$ ($\Delta d = 333\text{m}$). | **Tier F (15đ) - DEAD**<br>Thẳng bắt đầu ở $1875\text{m}$ ($\Delta d = 275\text{m}$). |
| **Kỹ năng Dốc Xuống (Downhill Skills)** | **Tier S (95đ)**<br>Dốc kéo dài tới $1617\text{m}$, tạo Carry-over tuyệt đối. | **Tier S (95đ)**<br>Spurt nằm ngay trên dốc C3 ($1467\text{m}$). | **Tier B (70đ)**<br>Dốc không nằm ở vị trí Spurt. |
| **Mid-Race Speed Stack (Gom cụm giữa chặng)** | **Bắt buộc cho Betweener/Leader**<br>Đặc biệt hiệu quả chống kẹt xe trên cua dốc. | **Ưu tiên cao**<br>Định hình vị trí trước khi leo đồi C3. | **Ưu tiên cao**<br>Chuẩn bị bước đà vào C4. |
| **Kỹ năng Hồi Phục (Recovery)** | **Bắt buộc tối thượng (Tier S+)**<br>2400m + Cỏ nặng: cần $\ge 1$ Gold Heal nếu Stamina $< 1600$. | **Khuyến nghị cao (Tier A)**<br>Cự ly 2200m cần thể lực vững chắc. | **Khuyến nghị cao (Tier A)**<br>Cự ly 2400m đòi hỏi Stamina chuẩn. |

---

## 7. Kết Luận & Đề Xuất Cho Bộ Đánh Giá Engine

1. **Khắc phục giả định thẳng cuối**:
   - Engine cần kiểm tra khoảng cách thực tế từ `spurtStart.meters` tới điểm bắt đầu của đoạn thẳng tiếp theo. Nếu $\Delta d \le 50\text{m}$ (như tại ParisLongchamp $1617\text{m}$ so với $1600\text{m}$), kỹ năng Straight Accel phải được công nhận là **Valid Fastest Accel (Tier S)** thay vì bị gán cờ Dead Accel.
2. **Bổ sung cảnh báo mặt sân nặng**:
   - Khi cự ly $\ge 2400\text{m}$ và `groundCondition` là `Bad` hoặc `Heavy`, hệ số yêu cầu thể lực cần nâng lên cấp độ nghiêm ngặt (`Critical Stamina Demand`).
