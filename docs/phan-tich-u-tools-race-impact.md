# Phân tích phép đo hiệu quả kỹ năng theo đường đua

## Mục đích

Tài liệu này tổng hợp kết quả khảo sát trang U-tools về hiệu quả nhân vật và kỹ năng theo một giải đấu cụ thể, đối chiếu với GameTora, `umasim`, `uma-clock-emu` và kiến trúc hiện tại của AlmondEye DB. Mục tiêu là xác định phần nào có thể tái tạo, dữ liệu nào đã có sẵn, phần nào còn thiếu và cách triển khai một hệ thống đo minh bạch hơn.

Kết luận chính là AlmondEye đã có lớp xác định **kỹ năng có thể kích hoạt ở đâu**. Phần còn thiếu là một bộ máy mô phỏng đối chứng để đo **kỹ năng giúp tiết kiệm bao nhiêu thời gian hoặc tạo ra bao nhiêu khoảng cách**. Không nên sao chép trực tiếp điểm `[バ]` của U-tools vì thuật toán lõi và các giả định đầu vào không được công khai trên trang.

## Phạm vi khảo sát

Các nguồn được xem xét gồm:

- U-tools trang hiệu quả nhân vật cho Champions Meeting đặc biệt tháng 9 năm 2026.
- U-tools giao diện chi tiết hiệu quả kỹ năng.
- GameTora trang nhân vật, danh sách kỹ năng và Skill Condition Viewer.
- Kho mã nguồn `mee1080/umasim` và bộ tính đua theo khung thời gian.
- Kho `urakagi/uma-clock-emu`, nguồn mà phần đua của `umasim` cho biết đã được chuyển đổi từ đó.
- Kiến trúc hiện tại của AlmondEye DB, đặc biệt là skill-zone engine, evaluator và track renderer.

Không có mã nguồn dự án nào được thay đổi trong giai đoạn khảo sát. Việc tương tác với U-tools chỉ nhằm quan sát hành vi của giao diện và dữ liệu đã gửi xuống trình duyệt.

## Kết quả quan sát trên U-tools

### Điểm nhân vật là tổng điểm của ba ô kỹ năng

Với Still in Love trên Longchamp 2400 m, U-tools hiển thị:

| Thành phần | Giá trị |
|---|---:|
| Kỹ năng độc nhất | 3.623 バ |
| Ô tiến hóa 1 | 1.980 バ |
| Ô tiến hóa 2 | 2.793 バ |
| Tổng trên thẻ nhân vật | 8.396 バ |

Công thức quan sát được là:

```text
Điểm nhân vật
= kỳ vọng của kỹ năng độc nhất
+ kỳ vọng của kỹ năng được chọn trong ô tiến hóa 1
+ kỳ vọng của kỹ năng được chọn trong ô tiến hóa 2
```

Tổng chính xác mà trang hiển thị là `8.39649`. Sai khác với phép cộng các số nhìn thấy chỉ đến từ việc từng thành phần được làm tròn trên giao diện.

### Phép tính lõi đã được chuẩn bị trước khi mở hộp chi tiết

Dữ liệu phía trình duyệt đã có các trường tương đương với:

```text
score            Điểm kỳ vọng của kỹ năng
courseEffect.d   Phân phối kết quả theo vị trí hoặc mẫu kích hoạt
courseEffect.r   Min max trung bình trung vị và tỷ lệ kích hoạt
courseEffect.f   Dữ liệu chênh lệch vận tốc lớn nhất dùng cho biểu đồ
```

Thẻ nhân vật chỉ đọc `skill.score` và cộng ba giá trị. Hộp chi tiết nhận các mảng đã tính sẵn rồi vẽ biểu đồ bằng ECharts. Vì vậy, mã chạy trong trình duyệt chủ yếu làm ba việc:

1. Hiển thị điểm đã có.
2. Phân loại các mẫu thành mức hiệu quả.
3. Vẽ phân phối và đường vận tốc tham chiếu.

Không tìm thấy bằng chứng cho thấy trình duyệt thực hiện lại toàn bộ mô phỏng cuộc đua khi mở hộp chi tiết.

### Các nút điều khiển không cùng tác động lên phép tính

| Điều khiển | Hành vi quan sát được | Có đổi điểm kỳ vọng không |
|---|---|---:|
| Chọn nhân vật | Đổi nhãn đoạn đường từ dạng chung sang các đoạn thẳng và góc cua được đánh số | Không quan sát thấy |
| Chọn viên điểm màu hồng | Mở chi tiết một kỹ năng | Không |
| Nút đổi môi trường | Đổi cách diễn giải thứ hạng giữa Champions Meeting và League of Heroes | Không |
| Nút tăng giảm cấp kỹ năng độc nhất | Đổi giá trị hiệu ứng thô được hiển thị | Không |

Ví dụ điều kiện `20 đến 70 phần trăm` được hiển thị là hạng 2 đến 6 khi có 9 người chạy trong Champions Meeting. Sau khi đổi sang League of Heroes với 12 người chạy, nó trở thành hạng 2 đến 8.

Ở cấp kỹ năng độc nhất khác nhau, các giá trị hiển thị thay đổi như sau:

| Cấp | Gia tốc | Tốc độ mục tiêu | Điểm kỳ vọng |
|---:|---:|---:|---:|
| 1 | 0.400 m/s² | 0.450 m/s | 3.62 バ |
| 2 | 0.408 m/s² | 0.455 m/s | 3.62 バ |
| 5 | 0.432 m/s² | 0.495 m/s | 3.62 バ |

Điểm kỹ năng `3.62 バ` và tổng nhân vật `8.40 バ` không đổi. Điều này cho thấy nút cấp độ trong hộp chi tiết chỉ dùng để xem dữ liệu hiệu ứng thô, không yêu cầu hệ thống tính lại kết quả đã chuẩn bị trước.

### Thời lượng kỹ năng được nhân với hệ số cự ly

U-tools hiển thị thời lượng theo quy tắc:

```text
Thời lượng thực = thời lượng cơ sở × cự ly tính theo kilomet
```

Với đường đua 2400 m, hệ số là `2.4`. Do đó:

- `4 giây × 2.4 = 9.6 giây`
- `5 giây × 2.4 = 12.0 giây`

Cooldown cũng được trình bày theo cùng hệ số trong giao diện.

### Tỷ lệ kích hoạt và tỷ lệ hiệu quả là hai đại lượng khác nhau

U-tools tách riêng:

- **Tỷ lệ kích hoạt** là xác suất kỹ năng thực sự phát động.
- **Tỷ lệ hiệu quả** là tỷ lệ mẫu kết quả vượt qua ngưỡng hữu ích nội bộ.

Phía trình duyệt nhận phân phối kết quả đã tính sẵn, sau đó chia các mẫu thành các mức gần với rất cao, cao, bình thường và thấp. Ngưỡng phân loại có phụ thuộc vào vận tốc cuối tham chiếu và loại kỹ năng. Vì vậy, tỷ lệ hiệu quả không đơn giản là tỷ lệ kỹ năng kích hoạt đúng phase.

## Đối chiếu với GameTora

GameTora phù hợp để kiểm tra dữ liệu đầu vào:

- Tên và mô tả kỹ năng.
- Hiệu ứng thô.
- Điều kiện kích hoạt.
- Nhân vật sở hữu kỹ năng.
- Quy tắc scale đặc biệt của giá trị hoặc thời lượng.

GameTora không cung cấp điểm `[バ]` tương đương U-tools. Do đó nên dùng GameTora và `master.mdb` làm nguồn kiểm chứng metadata, không dùng làm nguồn chuẩn cho kết quả mô phỏng.

AlmondEye hiện đã dùng GameTora trong pipeline dữ liệu thẻ và metadata kỹ năng. Điều này giúp giảm đáng kể công việc nhập dữ liệu nếu phát triển lớp race impact.

## Đối chiếu với umasim và uma clock emu

`umasim` có bộ tính đua theo khung thời gian. Mỗi bước cập nhật vận tốc theo vận tốc mục tiêu, gia tốc hoặc giảm tốc rồi cập nhật vị trí. Dạng rút gọn của bước tính là:

```text
Nếu vận tốc hiện tại nhỏ hơn vận tốc mục tiêu
    vận tốc mới = min vận tốc hiện tại + thời gian bước × gia tốc và vận tốc mục tiêu
Ngược lại
    vận tốc mới = max vận tốc hiện tại + thời gian bước × giảm tốc và vận tốc mục tiêu

vị trí mới = vị trí hiện tại + vận tốc mới × thời gian bước
```

Sau khi vượt vạch đích, hệ thống tính thời gian cuộc đua. Đây là cơ sở phù hợp cho phép so sánh đối chứng giữa một lượt chạy không có kỹ năng và một lượt chạy có kỹ năng.

README của `umasim` ghi rõ phần `/race` được port từ `uma-clock-emu`. `umasim` sử dụng giấy phép AGPL v3. Nếu sao chép trực tiếp mã nguồn, AlmondEye phải xem xét nghĩa vụ giấy phép. Hướng an toàn hơn là dùng các công thức đã được mô tả công khai để viết một implementation độc lập, sau đó dùng `umasim` làm oracle kiểm chứng.

## Hiện trạng AlmondEye

AlmondEye đã có các thành phần sau:

- Parser cho condition và precondition.
- Course phases, góc cua, đoạn thẳng và dốc.
- Vùng kích hoạt cố định và vùng kích hoạt ngẫu nhiên.
- Chuyển điều kiện tỷ lệ thứ hạng thành thứ hạng cụ thể theo số người chạy.
- Phân loại target speed, current speed, acceleration, recovery, passive và debuff.
- Track renderer có overlay vùng kích hoạt.
- Evaluator chiến thuật với tier và điểm từ 0 đến 100.

Evaluator hiện tại trả lời câu hỏi **thời điểm đó tốt hay xấu về mặt chiến thuật**. Nó chưa tính thời gian về đích hoặc khoảng cách thực tế. Ví dụ, nhiều ngưỡng của acceleration đang là rule heuristic theo khoảng cách so với điểm bắt đầu cuối race.

Vì vậy không nên thay evaluator hiện tại bằng điểm `[バ]`. Nên giữ evaluator cho phần giải thích chiến thuật và bổ sung một race impact engine độc lập.

## Mô hình đề xuất cho AlmondEye

### Nguyên tắc đo

Mỗi kỹ năng được đo bằng hai lần chạy có cùng đầu vào:

1. Lượt chuẩn không có kỹ năng cần đo.
2. Lượt đối chứng có kỹ năng được kích hoạt tại một vị trí hợp lệ.

Kết quả chính là:

```text
Thời gian tiết kiệm = thời gian chuẩn − thời gian có kỹ năng
Khoảng cách tương đương = vận tốc tham chiếu gần đích × thời gian tiết kiệm
Số thân ngựa = khoảng cách tương đương / 2.5 m
```

Hằng số `1 バ = 2.5 m` đã có trong tài liệu cơ học cuộc đua của dự án. Tuy nhiên cần coi cách quy đổi chính xác của U-tools là chưa xác minh cho đến khi so sánh nhiều fixture.

### Luồng xử lý

```text
Dữ liệu skill và course
          │
          ▼
Skill zone engine hiện có
Xác định các cửa sổ kích hoạt hợp lệ
          │
          ▼
Activation sampling
Sinh các vị trí hoặc xác suất kích hoạt
          │
          ├───────────────┐
          ▼               ▼
Race baseline       Race có kỹ năng
          │               │
          └───────┬───────┘
                  ▼
        So sánh thời gian về đích
                  │
                  ▼
     Δtime  Δmeter  バ  phân phối
```

### Cấu trúc kết quả đề xuất

```ts
type RaceImpactResult = {
  activationRate: number
  usefulRate: number

  expectedTimeGainSeconds: number
  expectedDistanceGainMeters: number
  expectedBashin: number

  minBashin: number
  maxBashin: number
  meanBashin: number
  medianBashin: number

  samples: Array<{
    activationMeter: number
    timeGainSeconds: number
    distanceGainMeters: number
    bashin: number
  }>
}
```

Nên giữ lại các mẫu thay vì chỉ lưu một điểm tổng. Khi công thức hoặc dữ liệu đầu vào thay đổi, hệ thống có thể tính lại thống kê và giải thích vì sao một kỹ năng có điểm đó.

### Định nghĩa tỷ lệ đề xuất

```text
Tỷ lệ kích hoạt
= xác suất kỹ năng thực sự phát động

Tỷ lệ kích hoạt hữu ích
= xác suất kỹ năng phát động và tạo ra Δtime lớn hơn ngưỡng tối thiểu

Hiệu quả có điều kiện
= số lần kích hoạt hữu ích / tổng số lần đã kích hoạt
```

Ngưỡng hữu ích cần được định nghĩa bằng thời gian hoặc số thân ngựa, không nên dùng một bucket bí mật. Giao diện nên hiển thị ngưỡng đang áp dụng.

## Phạm vi MVP

Phiên bản đầu nên tập trung vào:

1. Target speed.
2. Current speed.
3. Acceleration.
4. Vùng kích hoạt cố định và ngẫu nhiên theo khoảng cách.
5. Cấp kỹ năng độc nhất.
6. Số người chạy của Champions Meeting và League of Heroes.
7. Một hồ sơ ngựa tham chiếu cho từng running style.
8. So sánh một kỹ năng với baseline.

Đầu ra nên có:

| Chỉ số | Ý nghĩa |
|---|---|
| Expected バ | Giá trị trung bình sau khi tính cả xác suất |
| Time saved | Thời gian về đích tiết kiệm được |
| Distance gain | Khoảng cách tương đương gần vạch đích |
| Activation | Xác suất kỹ năng phát động |
| Useful | Xác suất kỹ năng tạo tác động vượt ngưỡng |
| Range | Min và max theo các vị trí kích hoạt đã xét |

Chưa nên đưa vào MVP:

- Lane blocking và cạnh tranh đường chạy.
- Tương tác đầy đủ giữa nhiều ngựa.
- Debuff lên đối thủ.
- Recovery và quyết định spurt phụ thuộc stamina đầy đủ.
- Nhiều kỹ năng kích hoạt đồng thời.
- Mô hình thứ hạng động chính xác theo từng frame.

Các điều kiện phụ thuộc thứ hạng hoặc trạng thái đối thủ nên được tách thành giả định có thể chọn. Hệ thống không nên giả vờ rằng course geometry đủ để suy ra xác suất của chúng.

## Kế hoạch kiểm chứng

### Kiểm chứng dữ liệu đầu vào

- So sánh tên, condition, effect và special scaling với GameTora.
- So sánh raw effect và condition group với `master.mdb`.
- Kiểm tra duration scaling trên các cự ly khác nhau.

### Kiểm chứng bộ máy vật lý

- Chạy cùng một profile không kỹ năng trong AlmondEye và `umasim`.
- So sánh vận tốc tại các phase boundary.
- So sánh thời gian về đích.
- Thêm từng loại kỹ năng độc lập rồi so sánh delta.

### Kiểm chứng với U-tools

Fixture đầu tiên nên là Still in Love trên Longchamp 2400 m vì đã có đầy đủ số liệu quan sát:

- Unique expected `3.62 バ`.
- Activation `100 phần trăm`.
- Useful `100 phần trăm`.
- Card total `8.40 バ`.
- Hiệu ứng unique cấp 5 gồm `0.432 m/s²` hoặc `0.495 m/s`.
- Duration lần lượt `9.6 giây` và `12.0 giây`.

Sau đó lấy ít nhất 20 kỹ năng đại diện cho:

- Fixed trigger.
- Random trigger.
- Acceleration tại điểm bắt đầu cuối race.
- Acceleration muộn.
- Target speed cuối race.
- Current speed.
- Hai nhánh điều kiện OR.
- Kỹ năng có recovery phụ.

Không nên đặt tiêu chí đầu tiên là khớp tuyệt đối U-tools. Nên kiểm tra theo thứ tự:

1. Vùng kích hoạt có trùng không.
2. Thứ tự xếp hạng kỹ năng có gần nhau không.
3. Min, max và phân phối có cùng hình dạng không.
4. Giá trị tuyệt đối có nằm trong sai số đã chọn không.

Nếu chỉ lệch một hệ số gần như cố định, nguyên nhân có thể là quy đổi `[バ]`. Nếu thứ tự hoặc hình dạng phân phối lệch, nguyên nhân nằm ở mô hình vận tốc, activation sampling hoặc điều kiện kích hoạt.

## Rủi ro và câu hỏi còn mở

| Vấn đề | Tác động | Cách xử lý |
|---|---|---|
| U-tools không công khai thuật toán lõi | Không thể bảo đảm khớp điểm tuyệt đối | Dùng U-tools làm black-box benchmark và công khai giả định của AlmondEye |
| Profile ngựa tham chiếu chưa biết | Cùng kỹ năng có thể tạo delta khác nhau | Định nghĩa preset có version và cho phép người dùng xem thông số |
| Xác suất thứ hạng phụ thuộc cuộc đua nhiều ngựa | Course geometry không đủ để suy ra | Tách probability model khỏi zone engine |
| Điều kiện OR có nhiều hiệu ứng | Có thể chọn nhánh khác nhau theo thời điểm | Mô phỏng từng condition group rồi áp dụng logic ưu tiên rõ ràng |
| Special scaling của kỹ năng mới | Dễ sai effect value theo level | Đối chiếu GameTora và master.mdb, thêm fixture riêng |
| Giấy phép AGPL của umasim | Sao chép mã có thể ảnh hưởng giấy phép dự án | Clean-room implementation và chỉ dùng kết quả làm oracle |

## Quyết định kiến trúc đề xuất

1. Giữ nguyên skill-zone engine làm nguồn sự thật cho vị trí kích hoạt.
2. Giữ evaluator hiện tại cho nhận xét chiến thuật và tier.
3. Thêm race-impact engine thuần TypeScript không phụ thuộc UI.
4. Trả về phân phối và metric vật lý, không chỉ một điểm tổng.
5. Đặt mọi giả định trong một `SimulationProfile` có version.
6. Tính trước các event phổ biến trong pipeline build nếu chi phí runtime quá cao.
7. Chỉ hiển thị tổng điểm nhân vật sau khi người dùng có thể mở từng thành phần và xem phép tính.

## Bước tiếp theo

Đề xuất tiếp tục bằng một technical spike nhỏ, chưa làm UI:

1. Chốt `SimulationProfile` đầu tiên cho Longchamp 2400 m và bốn running style.
2. Viết baseline integrator và ba effect handler cho target speed, current speed và acceleration.
3. Tạo fixture cho Still in Love và một số kỹ năng đơn giản có trigger cố định.
4. So sánh kết quả với `umasim` và U-tools.
5. Chỉ sau khi sai số được hiểu rõ mới thiết kế bảng xếp hạng và hộp chi tiết.

Tiêu chí hoàn thành spike là giải thích được toàn bộ đường đi từ condition đến activation sample, từ effect đến delta thời gian, và từ delta thời gian đến số thân ngựa. Việc khớp tuyệt đối một con số U-tools chưa phải điều kiện bắt buộc ở vòng đầu.

## Nguồn tham khảo

- U-tools hiệu quả nhân vật 2026 09: https://xn--gck1f423k.xn--1bvt37a.tools/race/vsevents/chm2/effects
- U-tools Race tools: https://xn--gck1f423k.xn--1bvt37a.tools/race/
- GameTora Still in Love: https://gametora.com/umamusume/characters/109701-still-in-love
- GameTora Skill List: https://gametora.com/umamusume/skills
- GameTora Skill Condition Viewer: https://gametora.com/umamusume/skill-condition-viewer
- umasim: https://github.com/mee1080/umasim
- umasim RaceCalculator: https://github.com/mee1080/umasim/blob/main/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/RaceCalculator.kt
- uma-clock-emu: https://github.com/urakagi/uma-clock-emu

