# Minmax cây gia phả và gene lệch mục tiêu

## Bối cảnh

Khi train Parent hoặc Grandparent, pink factor tăng aptitude nhưng cũng có thể đóng góp vào white genetic của run. Sáu donor của một run gồm hai parent và bốn grandparent. Nếu aptitude của pink lệch course hoặc running style của Ace, gene tương ứng có thể trở thành genetic không mong muốn trong cây.

Mục tiêu của minmax là giữ aptitude đủ để farm G1 và tạo pink factor mong muốn, đồng thời giảm số sao pink lệch mục tiêu. Đây là một bài toán tradeoff: giảm sao có thể làm hụt aptitude rank hoặc giảm số G1 mà Uma đủ điều kiện tham gia.

## Giải pháp

Engine thuần TypeScript nằm ở `lib/parenting/minmax.ts`. Nó nhận course, running style, cấu hình pink goals và pedigree đã resolve; dữ liệu factor được tra qua `lib/data/registry.ts`. `lib/parenting/minmax-context.ts` dùng chung cách resolve Parent, Grandparent, lựa chọn đã lưu và factor goals cho planner cùng recommendation.

Course xác định ba aptitude mục tiêu: surface (`Turf`/`Dirt`), distance và style. Engine ưu tiên distance bucket của course, rồi mới suy ra từ chiều dài nếu bucket không có. Category nào chưa xác định thì được bỏ khỏi phép so sánh; không tự điền Turf hay Runner. Trạng thái **Good genetic planning** chỉ xuất hiện khi đủ surface, distance, style và dữ liệu các nhóm được đánh giá không báo risk.

Với mỗi Uma, kết quả tách hai tình huống:

- **Dùng run đã train:** kiểm tra factor white aptitude thực tế của Uma hiện tại. Thay pink goal không xóa gene đã có; UI gợi ý đổi run hoặc retrain nếu phát hiện gene lệch.
- **Train/retrain theo cây hiện tại:** cộng pink stars riêng trên sáu donor của branch đó. Pink của chính Uma được train và phần cây sâu hơn không bị cộng nhầm vào branch.

Các mốc rủi ro theo mô hình cấu hình là `0–5★` dưới ngưỡng cảnh báo, `6–11★` có nguy cơ thường xuyên roll, và `12★+` được xem là chắc chắn trong mô hình này. Đây không phải phần trăm xác suất đã đo. Aptitude projection dùng bảng threshold hiện có trong registry: `1–3★` tăng một rank, `4–6★` tăng hai, `7–9★` tăng ba, `10★+` tăng bốn; rank khởi đầu bị giới hạn ở A.

Khi forecast lệch mục tiêu đạt 6★, engine thử tổ hợp giảm sao cục bộ. Nó xếp trước những tổ hợp giữ được aptitude farm và điều kiện A để tạo output pink; tiếp theo là ít hụt aptitude, ít mất G1, ít thay đổi donor và tổng sao thấp. Với donor bị đề xuất bỏ pink, engine có thể gợi ý thay bằng pink đúng surface, distance hoặc style của Ace nếu donor đạt A và các branch được đánh giá không bị giảm aptitude/G1 thêm. Gợi ý chỉ để tham khảo, không tự sửa cấu hình.

## Xếp hạng candidate

Khi đặt candidate vào slot, Parent Planning, worker recommendation và picker dùng cùng minmax assessment/comparator. Ưu tiên lần lượt: ít aptitude gap hơn, ít gene lệch thực tế hơn, ít forecast ở mốc `12★`, rồi `6★`, ít dữ liệu chưa biết hơn, nhiều G1 schedulable hơn; affinity giữ là điểm riêng và chỉ phân định sau các tiêu chí minmax.

Các run trong Hall of Fame của cùng character cũng được so sánh theo minmax trước blue stars và rank score để run sạch hơn không bị loại sớm. Picker hỗ trợ chọn tối đa ba target genetic cho mỗi Uma khi factor đạt ít nhất 6★; lựa chọn dùng cấu trúc state/share hiện có.

## Spark suggester cho GGP/GGGP

`lib/parenting/spark-suggester.ts` mở rộng lớp minmax thành bộ đề xuất tự động cho một nhánh. Khi nhánh đã đủ ba trainee (1 P + 2 GP), chip "Suggest sparks" trên đầu nhánh chạy engine và mở preview popover; không gì được ghi vào slot cho tới khi bấm Apply.

### Mô hình điểm

Score là **tuple lexicographic** (so sánh từng thành phần, không phải tổng có trọng số) — muốn thay đổi ưu tiên giữa các tầng chỉ có cách đổi thứ tự tuple, không thể "tăng hệ số":

1. **Không gene rác (hard):** tổng sao pink lệch target trong pool sáu donor của mỗi run train (P, hai GP) giữ ≤ `JUNK_STAR_CAP` (5★) — dưới ngưỡng roll 6★; từng cặp GGP với hai GGGP con của nó cũng bị kẹp tương tự. Target floor lệch mà cần ≥ 6★ để đạt thì được đánh dấu unmet kèm warning thay vì vỡ ngưỡng.
2. **Khớp target aptitude:** tổng khoảng cách rank còn thiếu của ba trainee, có trọng số priority cho aptitude on-target. Target B/A là ambition, không siết điều kiện G1 của calendar (floor vẫn theo C/D/E).
3. **Tối đa số genetics on-target (rải rộng trước, sâu sau):** mỗi pool chạm ngưỡng roll 6★ nhận full trọng số — genetic đó coi như "lấy được" vì qua các lượt retrain của loop luôn có cơ hội rớt cả hai, tối đa cả 3 category của Ace; 12★ chỉ cộng thêm bonus chắc chắn nhỏ (`GENETIC_GUARANTEE_BONUS` = +10% trọng số). Vì vậy khi budget dư, engine chia 6/6 (hoặc 6/6/6) cho hai–ba genetic thay vì dồn 12★ cho một. Preview headline cho cả hai con số: số pool lấy được (`obtainableGenetics`) và kỳ vọng roll mỗi lượt (`expectedGenetics`, 12★ = 1.0, 6–11★ ≈ 0.4). Khi không tối đa được hết, ưu tiên ace Turf theo Distance > Style > Turf và ace Dirt theo Distance > Dirt > Style.
4. **Không để slot trống:** sao on-target không bị tính là chi phí, và mọi slot tự do còn lại sau DP được điền bằng pink on-target theo thứ tự priority (ưu tiên apt vừa chạm ngưỡng 6★/12★ tiếp theo) — mọi genetic khớp target Ace đều có ích nên không slot nào bị bỏ "no factor". Ngoại lệ: chưa chọn course/style thì không biết on-target nên giữ cảnh báo hiện có.

### Thuật toán tìm kiếm

`suggestBranchSparks(context, branch)` chạy theo pipeline sau (đều là hàm thuần, không đụng config đầu vào):

1. **Gate:** nhánh thiếu trainee → trả `null`. Lấy target từ `aceGeneticTarget(course, runningStyle)` và trọng số `geneticPriorityWeights`.
2. **Pin input cố định theo từng sub-branch GP:** slot GGP/GGGP đã có pink chỉnh tay (`factorGoals[slot]` có key `pink`) hoặc card mang factor thực (`factorKnowledge`) → đưa vào `kept`, sao của nó thành `fixed` của trainee GP; pink GGP kept còn chảy thêm vào pool cố định `fixedP` của trainee P.
3. **Dựng trainee model** (`buildTrainee`): targets = floor farm mặc định (trừ aptitude đã tắt) ← overlay `slotAptitudeGoals[slot]` ← ép "A" cho pink của chính trainee (giữ output A cho red factor); base aptitude lấy từ card.
4. **DP từng sub-branch** (`enumerateSubBranch`): duyệt từng aptitude liên quan (lọc bằng `usefulTotals`), trạng thái = (vector sao GGP, số slot GGGP đã dùng); mỗi aptitude chọn tổng ∈ {0} ∪ usefulTotals rồi chia g/h cho GGP/GGGP, giữ entry tốt nhất cho mỗi cặp khóa.
5. **Ghép cặp hai sub-branch:** với mỗi cặp allocation, chấm thêm score của trainee P (pool P = `fixedP` + phần GGP của cả hai sub — chỉ GGP chảy lên P) rồi lấy tổng lexicographic nhỏ nhất.
6. **Điền leftovers + realize:** slot tự do còn lại thành pink on-target theo priority; gán pink 3★/slot theo thứ tự sao giảm dần.
7. **Verify bằng evaluator thật:** overlay phân bổ vào config, chạy `evaluateParentingMinmax` + `evaluateParentingBranch` để build report — mọi con số hiển thị (stars, status, risk, targets) đến từ evaluator, không phải từ score DP.

### Bản đồ module

| File | Trách nhiệm |
| --- | --- |
| `lib/parenting/spark-suggester.ts` | Engine + types (`BranchSparkSuggestion`, `SparkTraineeOutcome`, …); constants `JUNK_STAR_CAP`, `GENETIC_ROLL_STARS`, `GENETIC_GUARANTEE_STARS`, `GENETIC_GUARANTEE_BONUS`; helper `aptitudeGroup`, `geneticPriorityWeights`, `branchTraineeSlots`, `branchIsComplete` |
| `lib/parenting/loop-planner.ts` | `TargetRank`, `slotAptitudeGoals` (10 aptitude × E–A), `disabledFarmAptitudes`, `farmGoals()` (Partial — key thiếu = bị tắt), projection `target`/`missingPinkStars`/`targetStatus` cho cả 10 aptitude |
| `lib/parenting/g1-calendar.ts` | Goals dạng `Partial`; race cần aptitude đã tắt nhận trạng thái muted `excluded` (kiểm tra trước career-blocked) |
| `lib/parenting/state.ts` | Normalize 10 key aptitude × rank E–A + `disabledFarmAptitudes` (dedupe, thứ tự canonical); share-hash truyền nguyên `loopConfig` |
| `features/parenting/hooks/use-pedigree-model.ts` | `setAptitudeGoal` (null = xoá key), `setDisabledFarmAptitudes` (**một** lần ghi cho cả tập), `applyBranchSparks` (batch `factorGoals`, giữ field blue) |
| `features/parenting/components/aptitude-controls.tsx` | `AptitudeCell` ladder E–A + khóa theo base (`targetFloorIndex`/`baseLocksTarget` đọc từ `projection.base`; "?" = chưa chọn parent = mở hết) |
| `features/parenting/components/farm-focus-toggles.tsx` | Chip "Farm focus" 6 toggle (Surface + Distance) |
| `features/parenting/pedigree/parent-pedigree-canvas.tsx` | `BranchSparkSuggester`: chip per branch, preview popover, Apply |

### Bất biến khi bảo trì

- **`aptitudeScore` phải giữ tính cộng theo từng aptitude** — DP và phép ghép cặp chỉ đúng vì tổng score = Σ per-aptitude với coupling duy nhất là ngân sách slot. Nếu thêm ràng buộc chéo aptitude (vd bonus khi đủ cả 3 category), phải đổi cấu trúc tìm kiếm chứ không sửa được ở score.
- **Sao on-target phải free ở tier 4** (= 0): nếu tính chúng là chi phí, DP sẽ để slot trống và phá rule "no none".
- **Off-target chỉ enumerate tổng [1, 4]★ và kẹp ≤ `JUNK_STAR_CAP`** trong `usefulTotals`: target floor cần ≥6★ off-target sẽ luôn unmet (kèm warning) thay vì vỡ cap — đó là hành vi chủ đích. Thêm ngưỡng mới (vd band 7★/10★ cho on-target) thì cập nhật `usefulTotals`.
- **Score DP chỉ phục vụ tìm kiếm; report luôn build từ evaluator thật.** Hai nơi có thể lệch nhau khi đổi một bên — sau khi sửa `aptitudeScore` hoặc evaluator, chạy lại `spark-suggester.test.ts`.
- **Multi-value control phải commit đúng MỘT `updateConfig` mỗi event** — `updateConfig` dựng config từ render closure nên gọi setter lặp trong cùng một handler sẽ ghi đè lẫn nhau (bug "toggle không bấm được" đã xảy ra một lần; regression test riêng).
- **Engine không đọc lock ladder của UI**: target dưới base vẫn hợp lệ về phía engine (gap = 0 vì projection đã đạt) — lock chỉ là ràng buộc nhập liệu trên `AptitudeCell`.
- Engine không đổi pink của chính P/GP, không chọn genetic target thay user, giữ nguyên slot `kept`, và không đụng nhánh còn thiếu trainee. Trainee là veteran import thì suggestion mô tả **run retrain tương lai** (đúng semantics `assessForUse`), preview hiện chip "retraining".

### Test map

- `lib/parenting/spark-suggester.test.ts` — mỗi rule một test: gate null, spread 6/6 Long+Leader (turf) / Medium+Dirt (dirt), junk cap ≤5★/pool, off-target unmet-không-vỡ, kept slots, no-none (11/11 slot có pink on-target), farm focus off, warning pink GP cố định, veteran retraining, priority weights, no-course.
- `tests/dom/parenting-aptitude.interaction.tsx` — ladder E–A + Clear + khóa theo base (base A ẩn ladder, dưới base disabled).
- `tests/dom/parenting-farm-focus.interaction.tsx` — toggle giữ trạng thái sau click (regression stale-closure).
- `lib/parenting/state.test.ts` / `g1-calendar.test.ts` — normalize (E–A, style keys, junk-strip, canonical order) + race `excluded`.

**Farm focus toggle:** `disabledFarmAptitudes` trong loopConfig cho phép tắt từng aptitude surface/distance (chip "Farm focus" cạnh dòng Ace genetics). Aptitude bị tắt: mất floor target mặc định, race cần nó rời lịch G1 với trạng thái `excluded`, engine không phân sao cho nó — budget dồn cho các aptitude còn bật. Target C/D/E đặt tay trên slot vẫn thắng toggle.

## Giới hạn và cách đọc UI

Gene trực tiếp chỉ được kiểm tra trên sáu slot Parent/Grandparent bảo vệ; GGP không bị cảnh báo như gene hiện có của Ace. Pink từ các thế hệ sâu hơn vẫn có thể đóng góp vào forecast của từng lần train thông qua branch donors.

Thiếu course, style hoặc factor donor thì UI báo phần dữ liệu chưa xác định, không coi đó là cây sạch. Cảnh báo `6★` và `12★` chỉ phản ánh ngưỡng của mô hình planning; dưới `6★` UI không hiện cảnh báo lệch gene. Nếu giảm pink gây hụt rank, tradeoff hiển thị Uma, aptitude trước/sau và target rank còn thiếu; số G1 mất chỉ hiện khi lớn hơn 0.

Engine không tự tìm kiếm toàn bộ cây, không chặn candidate có gene lệch, không tự sửa target genetic và không trộn penalty gene vào affinity score.
