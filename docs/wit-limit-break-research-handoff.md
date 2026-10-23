# Wit Limit Break — bàn giao nghiên cứu ngày 2026-10-20

## Mục tiêu phiên tiếp theo

Tìm bằng chứng trực tiếp từ game JP cho bảng Wit Limit Break, đặc biệt cách xử lý
ranh giới Wit 1600 / 1601 / 1602, hệ số tối đa và các loại skill chịu tác dụng.
Đây là nghiên cứu riêng; chưa có yêu cầu sửa evaluator hoặc UI.

## Nguồn local

- Repo: `/Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site`
- Bundle: `/Users/fubuki/Documents/AlmondEyeDB/Umamusume_2.31.8_RE_bundle_20261019`
- Race cũ: `/Users/fubuki/Documents/AlmondEyeDB/raceData`
- Tài liệu tham khảo trong repo: `docs/references/Uma Musume Race Mechanics.md`,
  mục `Wiz Limit Break Buff`, bắt đầu khoảng dòng 1383.

Bundle thu từ Steam JP Windows x64, game 2.31.8, Unity 2022.3.62f2, ngày
2026-10-19. Đọc `README_VI.md` trong bundle trước khi dùng helper.

## Đã xác nhận từ bundle

1. Metadata có `Gallop.RaceParamDefine.WizLimitBreakBuffParam`, gồm:
   - `PhaseParamArray`: hệ số theo phase và running style.
   - `TargetAbilityTypeArray`: ability types được áp dụng.
   - `SkillSelectionRuleArray`: quy tắc theo rarity, có `IsExcludeSuccessionSkill`.
   - `WizCoefArray`: mỗi entry có `WizThreshold` và `Multiply`.
   - `CourseDistanceCoefArray`: mỗi entry có `CourseDistanceThreshold` và `Multiply`.
2. Có method liên quan, kèm địa chỉ native; metadata không chứng minh method đã chạy.
3. Object graph runtime có một object cấu hình `WizLimitBreakBuff` khác null,
   nhưng nội dung bị giới hạn depth: `truncated: true`.

Nguồn chính trong bundle:

- `raw_data/output/il2cpp_20261019_run2/dump.cs`: khoảng dòng 282686–282743
  cho schema; `RaceParamDefine.WizLimitBreakBuff` ở khoảng dòng 283229.
- `raw_data/output/il2cpp_20261019_race/race_manager_graph.json`: khoảng dòng
  60089–60094 cho object runtime.
- `raw_data/output/il2cpp_20261019_research/declarations.jsonl`: metadata đầy đủ,
  nên parse từng dòng JSON và lọc `full_name` thay vì in cả dòng lớn.

**Chưa xác nhận:** giá trị các entry trong bảng runtime; phép so sánh ngưỡng;
pipeline stat; buff thực nhận trên một skill; hệ số tối đa khả dụng trong game.

## Nơi có khả năng tìm được — thứ tự ưu tiên

### 1. Đọc trực tiếp object cấu hình runtime

Đường tham chiếu đã thấy trong graph:

```text
Gallop.RaceManager instance
  → _horseManager
  → _horseRaceInfos[0]
  → Gallop.HorseRaceInfo::<ParamDefine>k__BackingField
  → Gallop.RaceParamDefine::WizLimitBreakBuff
  → WizCoefArray
```

Trong graph lịch sử, object cuối có type
`Gallop.RaceParamDefine.WizLimitBreakBuffParam`, address `0x35236fb80`.
Địa chỉ chỉ dùng để nhận diện phiên cũ, KHÔNG dùng lại để đọc phiên mới.

Ưu tiên export object này thành root riêng rồi đọc đầy đủ các mảng phía trên.
Helper graph hiện bắt đầu từ RaceManager với depth 5 nên object cấu hình bị cắt;
chỉ tăng depth toàn bộ graph sẽ gây dữ liệu rất lớn. Xem cách đọc field trong
`helpers/bridge_agent_race_snapshot.js` và cách export array/list đầy đủ trong
`helpers/bridge_agent_race_simulation.js`.

Offset khai báo của đúng build này, để đối chiếu metadata (ưu tiên field API):

| Object | Field | Offset |
|---|---|---:|
| `Gallop.HorseRaceInfo` | `<ParamDefine>k__BackingField` | `0x188` |
| `Gallop.RaceParamDefine` | `WizLimitBreakBuff` | `0x160` |
| `WizLimitBreakBuffParam` | `WizCoefArray` | `0x28` |
| `WizCoef` | `WizThreshold` | `0x10` |
| `WizCoef` | `Multiply` | `0x14` |

Export kèm `paramDefineVersion`, game version, class thực tế, độ dài mảng,
mọi entry, lỗi đọc và mọi truncation. Xác định entry array là object hay value type
bằng metadata; không tự giả định layout. Không giữ dữ liệu trainer/account không cần thiết.

### 2. Truy nguồn ScriptableObject / asset cấu hình

`Gallop.RaceParamDefine` kế thừa `UnityEngine.ScriptableObject`: bảng có thể nằm
trong asset cấu hình thay vì hardcode trong DLL. Chưa xác định tên/path asset.

Đầu mối: `Gallop.RaceLoaderRaceParamDefine`:

- Fields: `<RaceParamDefine>k__BackingField`, `_resInfoRaceParamDefine`, `_resInfo`.
- `OnLoadEnd`: RVA `0x3c89b70`.
- `OnLoad`: RVA `0x3c89bf0`.
- `RegisterPathOnSimulator`: RVA `0x3c89c70`.
- `OnLoadEndOnSimulator`: RVA `0x3c89b10`.

Theo reference/path loader để tìm asset nếu có game install/cache tương ứng.
Bundle hiện không được xác nhận chứa asset này.

### 3. Native: tìm nơi đọc và áp dụng bảng

Đây là declaring types/RVA đã kiểm tra từ metadata, KHÔNG gán nhầm sang
`Gallop.HorseRaceInfo`:

| Type | Method | RVA |
|---|---|---:|
| `Gallop.HorseRaceAIBase` | `UpdateActivateStatusWizLimitBreakBuff` | `0x3c26ae0` |
| `Gallop.HorseRaceAIBase` | `GetWizLimitBreakBuffValue` | `0x3c26240` |
| `Gallop.HorseRaceAIBase` | `CreateWizLimitBreakBuffCalculator` | `0x26b570` |
| `Gallop.HorseRaceAIReplay` | `CreateWizLimitBreakBuffCalculator` | `0x3c28a50` |

`Gallop.HorseRaceAIBase` giữ `_wizLimitBreakBuffCalculator` ở offset `0xd0`.
Đọc class thực tế của calculator trước: metadata có cả interface và bản `Null`;
một getter chuyển tiếp hoặc stub không chứng minh công thức đã có trong client.

Files hỗ trợ:

- `raw_data/dlls/umamusume_2.31.8_20261019/GameAssembly.runtime.dll`
- `raw_data/ram_dump/GameAssembly_il2cpp_20261019_research.bin` (offset file = RVA)
- `raw_data/output/il2cpp_20261019_research/methods.index.jsonl`
- `raw_data/output/il2cpp_20261019_research/native_symbols.jsonl`
- `raw_data/output/il2cpp_20261019_research/native_unwind_functions.jsonl`

Disassembly race đóng gói chỉ là tập chọn lọc, chưa thấy các body trọng tâm trên
trong file disassembly đó. Cần phân tích đúng vùng native và callers; giữ alias
ở địa chỉ dùng chung và lưu ý unwind region có thể chỉ bao phủ một chunk.

### 4. Xác nhận hành vi trong race

Sau khi có bảng/lookup, kiểm tra cùng skill ở các điểm quanh ngưỡng, chẳng hạn
1599 / 1600 / 1601 / 1602 / 1621, với stat tham chiếu trong race đã được xác định.
Giữ cố định skill ID, level, rarity, style, phase, motivation và các buff khác.
Nếu không giữ các điều kiện này, chênh lệch tốc độ không cô lập được tác dụng Wit.

Đọc return value/effect đã resolve nếu có thể, thay vì chỉ suy từ finish time.
Không tự tạo mẫu bằng cách sửa stat/game state trong phiên chỉ được yêu cầu đọc.
Replay có thể dùng kết quả nạp sẵn và calculator Null: không suy ra client tính race.

## Cảnh báo về bảng tham khảo và code hiện có

- Tài liệu cộng đồng ghi bảng hệ số trung gian kết thúc ở `1.12`.
  Điều này chưa được xác nhận từ bảng runtime của bundle, và chưa chứng minh bậc
  đó đạt được với giới hạn stat hiện tại.
- Cột threshold là phần Wit vượt 1200, không phải Wit tuyệt đối.
- Có bất đồng cách diễn giải ranh giới: tài liệu có ví dụ phần dư 125 chọn hàng
  141 (`0.14`), trong khi một số bảng truyền miệng xem hàng là ngưỡng dưới.
- Code cũ `lib/skill-rating/simulator.ts::wisdomMultiplier` dùng `Math.ceil`:
  Wit 1600 → `0.80`, 1601 → `0.81`, 1602 → `0.81`.
- Simulator công khai dưới đây dùng first threshold >= excess:
  Wit 1600 → `0.80`, 1601 → `0.80`, 1602 → `0.81`.
- Vì vậy không lấy code của chúng ta hoặc simulator khác làm bằng chứng game
  chắc chắn có bước nhảy từ 1600 sang 1601. Cần đọc comparator/lookup thực tế.
- Kiểm tra riêng stat dùng cho threshold: raw/base/adjusted, motivation, skill
  modifiers, phép chia đôi phần vượt 1200, aptitude và rounding. Chưa coi toàn bộ
  mô tả stat pipeline trong tài liệu là đã được bundle xác nhận.
- Engine site đang dùng đi qua `lib/race-impact`; sự tồn tại của hàm trong
  `lib/skill-rating` không đồng nghĩa site đã áp dụng nó.

Nguồn ngoài đã đọc, chỉ dùng đối chiếu:

- <https://raw.githubusercontent.com/pittua/umamusume_race_calculator/main/calculator.js>
  (`WIZ_LB_TABLE`, `calcWizLBMultiplier`; bản triển khai cộng đồng, không phải source game).
- <https://note.com/uma_analysis66/n/n0a19b02bf4f3>
  (tác giả simulator mô tả buff Wit lên skill; không xác nhận chính xác ngưỡng 1601).

## Đầu ra mong muốn của phiên nghiên cứu

1. Bảng runtime/asset đầy đủ, có provenance build và không truncation.
2. Lookup/comparator và stat pipeline có bằng chứng địa chỉ/call path hoặc phép đo.
3. Kết quả quanh 1600/1601; phân biệt bậc hệ số với cơ chế mới được mở khóa.
4. Hệ số cao nhất trong config và bậc cao nhất thực sự đạt được: báo riêng.
5. Phạm vi skill/rarity/target được tăng, phase/style coefficients và công thức áp dụng.
6. Ghi rõ kết luận nào được xác nhận, kết luận nào vẫn là giả thuyết; chưa sửa rating.

## Prompt dùng cho chat mới

```text
Đọc docs/wit-limit-break-research-handoff.md trong repo AlmondEyeDB trước.
Nghiên cứu riêng Wit Limit Break trên bundle
/Users/fubuki/Documents/AlmondEyeDB/Umamusume_2.31.8_RE_bundle_20261019.
Ưu tiên lấy bảng WizCoefArray thực tế, xác minh comparator và stat pipeline,
đặc biệt Wit 1600/1601/1602, hệ số tối đa và loại skill chịu tác dụng.
Phân biệt metadata, cấu hình đã nạp, mã thực thi và quan sát runtime.
Chỉ nghiên cứu và lưu bằng chứng/kết quả; chưa sửa evaluator hoặc UI.
```
