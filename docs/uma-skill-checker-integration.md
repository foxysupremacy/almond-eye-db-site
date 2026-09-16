# uma-skill-checker — Giải thích & Kế hoạch tích hợp vào almond-eye-db-site

> Tài liệu tham khảo, viết ngày 2026-09-13. Số liệu (445 skills, 1907 skills, tỷ lệ khớp tên) được kiểm chứng trực tiếp trên code tại thời điểm viết.

---

## Phần 1 — uma-skill-checker là gì?

### 1.1. Vấn đề nó giải quyết

Người chơi Umamusume **chụp màn hình các danh sách skill trong game** (màn hình因子/inheritance khi kết thúccareer, màn hình技能試験/skill exam, màn hìnhスキルセット/skill set) và muốn biết: *danh sách này chứa những skill nào, mỗi skill mấy sao (★0–3), và so với một danh sách skill mục tiêu thì thiếu/cái gì?*

uma-skill-checker trả lời câu hỏi đó **hoàn toàn trong trình duyệt** — upload/kéo-thả ảnh, OCR bằng Tesseract.js, ghép (stitch) các screenshot cuộn dọc thành một ảnh dài, đếm sao bằng phân tích pixel, rồi khớp tên skill với từ điển. Không có server, không có API, ảnh không bao giờ rời khỏi máy người dùng.

### 1.2. Bốn công cụ con (4 trang HTML tĩnh)

| Trang | Tên | Vai trò | Trạng thái |
|---|---|---|---|
| `index.html` | UmaSimple OCR | OCR danh sách skill đơn giản, dán kết quả "○/✗" về spreadsheet | **Đã retired** (2026-09-08), chỉ còn làm hub chuyển tool |
| `special.html` | UmaStar OCR | OCR màn hình **因子 (inheritance/factor)** cho 6 người: 親A/祖A1/祖A2/親B/祖B1/祖B2, kèm số sao từng skill | **Flagship** |
| `exam.html` | UmaExam OCR | OCR màn hình技能試験 (133 skill cố định trong game), có phân tích nhóm (17 skill SP70, 59 skill green, cặp awakening) | Active |
| `uma-skill-deck.html` | UmaSkill Deck | **Không OCR.** Quản lý "template" (bộ skill mục tiêu) + "bảng so sánh" (skill × ứng viên, bấm để set ★0–3), export/import JSON | Active |

Luồng sử dụng điển hình: OCR ở special/exam → kết quả được ghi vào localStorage (`umaSkillDeck:ocrHandoff:special` / `:exam`) → mở Deck (trang riêng hoặc iframe drawer trong special.html) → Deck hiện banner "読み込む" → số sao từng người đổ vào bảng so sánh để đối chiếu ứng viên kế thừa.

### 1.3. Pipeline OCR (tất cả chạy client-side trên `<canvas>`)

Toàn bộ logic nặng nằm trong `js/common.js` (~1.600 dòng, các hàm thuần, không đụng localStorage), `js/stitch.js` (ghép ảnh), `js/skillset-cards.js` + `js/skillset-ocr.js` (màn hình skill set — mới, **chưa nối vào UI**).

1. **Nhận ảnh** — upload nhiều file / kéo-thả → canvas, thu nhỏ về tối đa 3000px.
2. **Kiểm tra chất lượng** — từ chối ảnh <400px hoặc độ nét Laplacian <120 (`too-small`/`blurry`).
3. **Stitch** (special/exam) — phát hiện header/footer trùng giữa 2 screenshot, tìm đường nối tối ưu hóa "bad-pixel rate", tự sắp xếp lại thứ tự ảnh khi đường nối không chắc chắn.
4. **Tìm dòng skill** — mask xanh lá (vùng tên skill) + xanh dương (vùng category) để neo đầu/cuối danh sách, lọc dòng giả bằng tỷ lệ pixel vàng (dòng có sao).
5. **Đếm sao** — đếm blob pixel vàng trong vùng sao của từng dòng → ★0–3.
6. **OCR** — Tesseract.js 4 (từ CDN, engine `jpn`, psm 6/7) chạy trên tối đa 3 biến thể tiền xử lý mỗi dòng (binarize thích nghi / invert / gốc).
7. **Khớp tên** — chuẩn hóa văn bản (NFKC → bỏ dấu câu → **bản đồ sửa lỗi OCR ~250 ký tự** `CHAR_CONFUSION_MAP` trong `js/common.js:85-333` → bản đồ ký tự đồng nhất `HOMOGLYPH_MAP` như `カ→力`) rồi: khớp từ điển sửa lỗi → khớp chuỗi con chính xác → Levenshtein fuzzy với ngưỡng theo độ dài → bỏ kết quả confidence <55. Xử lý hòa kết quả bằng logic "chứng minh 2 dòng khác nhau" dựa trên số sao.
8. **Ghi kết quả** — bảng tìm thấy/không tìm thấy + nút copy "cột ○" về spreadsheet, hoặc handoff sang Deck.

### 1.4. Dữ liệu & định danh skill — điểm quan trọng nhất khi tích hợp

**Từ điển master: `uma-skill-deck-skills.json`** (445 entry):

```json
{ "masterVersion": "2026-09-11b",
  "skills": [ { "id": "1", "name": "右回り○",
    "tags": { "distance":[], "style":[], "phase":[], "coursePos":[],
              "environment":["right_turn"], "trackVenue":[],
              "effect":["speed_up"], "scenario":[] } } ] }
```

- 445 entry = **toàn bộ skill kế thừa được (white skills)**; skill vàng/unique/evolved **cố tình nằm ngoài phạm vi**.
- Tag theo 8 trục (distance, style, phase, coursePos, environment, trackVenue, effect, scenario) — định nghĩa enum trong `js/uma-skill-deck-core.js:63-104`.
- `exam.html` hardcode thêm `EXAM_SKILL_LIST` (133 skill thi, chính tả cố ý khác master để user VLOOKUP spreadsheet không vỡ, ví dụ `右回り〇` dùng U+3007 thay vì U+25CB) và `AWAKENING_PAIR_MAP` (ví dụ `右回りの目覚め` → `右回り〇`).

⚠️ **Định danh skill: KHÔNG dùng `id` của deck để map sang site.** Tôi đã kiểm chứng trực tiếp:

- `id` trong `uma-skill-deck-skills.json` là số thứ tự "1".."445" (legacy), **không phải game skill ID**. Tra theo ID vào `almond-eye-db-site/lib/data/skills.json` → **khớp 0/445**.
- Khớp theo `name` (tên Nhật) vào `nameJp` của site: **439/445 khớp chính xác 100%**.
- 6 entry còn lại là nhóm skill awakening "目覚め" (`左回りの目覚め`, `右回りの目覚め`, `春/夏/秋/冬の目覚め`) — **không tồn tại trong `skills.json` của site** (tôi đã tra cả MDB game: không có tên này trong `skill_data`/`text_data` cat 47). Nghĩa là phép map đúng là: **tên Nhật chuẩn hóa + `AWAKENING_PAIR_MAP` quy 6 skill này về skill gốc ○ tương ứng**.
- Lưu ý chuẩn hóa: `normalizeText` của checker hợp nhất `◎→○`, nên `根幹距離◎` và `根幹距離○` trùng nhau sau chuẩn hóa — phía site cần chốt cách xử lý (khuyến nghị: map ◎ về skill ○ gốc, vì deck master vốn chỉ có ○).

### 1.5. Mô hình riêng tư & kiến trúc nội bộ

- **Riêng tư tuyệt đối**: mọi thứ chạy trong browser; test `npm run check:privacy` là gate chặn leak PII (đường dẫn máy cá nhân, email) trước khi push lên GitHub Pages công khai.
- **Phân tầng kỷ luật**: `common.js` (hàm OCR thuần, không biết tên skill) → `stitch.js` (ghép ảnh) → `skillset-cards.js` (thuần ImageData→rect) → `skillset-ocr.js` (orchestration) → `uma-skill-deck-core.js` (lớp dữ liệu agnostic, một global duy nhất, event delegation qua `data-usd-act`) → các trang HTML tự giữ state/glue của mình.
- **CSS token hóa**: `css/tokens.css` (màu/spacing/typography qua biến `--uma-*`, accent 6 biến đổi theo từng tool), `common.css` (component), `shell.css` (drawer/FAB/tabs), kèm **bất biến khóa 3 phiên bản** (version token trong 3 file CSS + `?v=` trên mọi HTML/JS + hằng runtime `EXPECTED_COMMON_CSS_VERSION`) do `npm run test:verify` kiểm tra.
- **Tests**: OCR headless chạy trên trang thật (`test:ocr`), normalization collision (`test:norm`), visual regression screenshot (`test:visual*`), stitch (`test:stitch`), và cả gia đình `skillset:*` cho vòng nghiên cứu màn hình skill set.

---

## Phần 2 — Tích hợp vào almond-eye-db-site

### 2.1. Vì sao đáng tích hợp / giá trị mang lại

Site hiện trả lời "đế tôi nên nuôi skill/card nào", nhưng **đầu vào là tay** — user phải tự nhập lại skill của các mã đã nuôi từ game. uma-skill-checker bổ sung đúng mảnh còn thiếu: **đầu vào bằng ảnh chụp màn hình**, cho ra skill + số sao của cha/ông có kế thừa, tức nguyên liệu cho Parent Deck và loạt "Trained Umas/veterans". Kết hợp với luồng kyumaru hiện có (payload `#data=`), site sẽ có đủ 3 đường nhập dữ liệu: DLL tự động, JSON/URL dán tay, và ảnh OCR.

### 2.2. Các ràng buộc từ phía site (đã xác minh)

| Ràng buộc | Chi tiết |
|---|---|
| Framework | vinext (App Router + RSC trên Vite), deploy Cloudflare Worker **không server runtime** → mọi tính năng phải chạy client-side. Checker vốn đã 100% client-side ✓ |
| Route mới | Tạo `app/<tên>/page.tsx` là có route ngay (tiền lệ: `app/import/page.tsx` là trang `"use client"` standalone không chrome header/footer). Không cần sửa config — vinext tự sinh routing lúc build |
| Tab mới | Hoặc mở rộng `Tab` union + `TABS` trong `app/page.tsx:21-34`; hash `#ocr` được miễn phí; **phải giữ nguyên logic bỏ qua hash lạ** (`applyHash`) để không phá `#share=`/`#data=` |
| Dữ liệu skill | Chỉ được đọc JSON game qua `lib/data/registry.ts` (quy tắc gateway); skills.json có 1907 skill với `id` = **game ID thật** (200012…), `nameJp`, `nameEn`, `rarity` |
| Style | Tailwind v4 + token `globals.css`, palette warm zinc/emerald, dark mode qua class `.dark`; **không** mang theo Tailwind CDN của checker; animation tuân DESIGN.md §13 (≤300ms, easing token) |
| Persistence | localStorage `almondeye_owned_cards` / `almondeye_owned_umas`, IndexedDB `lib/db/veterans-db.ts` cho payload lớn (3.1MB), event `almondeye_inventory_updated` báo cross-tab |

### 2.3. Kiến trúc tích hợp đề xuất

**Nguyên tắc: nhิน checker như một "thư viện đầu vào", không nhin nó như một app.** Copy các module JS thuần sang site (hoặc import), thay UI shell của checker bằng UI React của site.

```
almond-eye-db-site/
├─ app/ocr/page.tsx                  ← trang standalone mới (hoặc tab "OCR" trong app/page.tsx)
├─ components/ocr/                   ← UI React mới viết: dropzone, tiến trình, bảng kết quả
├─ lib/ocr/                          ← port từ uma-skill-checker/js/
│  ├─ stitch.ts                      ← từ js/stitch.js (ghép ảnh)
│  ├─ detect-rows.ts                 ← từ common.js (detectSkillRows, assessImageQuality…)
│  ├─ stars.ts                       ← từ common.js (computeRowStarCounts…)
│  ├─ normalize.ts                   ← từ common.js (CHAR_CONFUSION_MAP, HOMOGLYPH_MAP, normalizeText)
│  └─ match.ts                       ← matchAllSkills (khớp với dictionary truyền vào)
└─ lib/ocr/skill-map.ts              ← MỚI: bridge skill checker ↔ site (xem 2.4)
```

**Điểm tách quan trọng:** `common.js` của checker vốn được viết tách bạch (hàm thuần, nhận dictionary từ bên ngoài — `buildSkillDictionary`), nên port gần như máy móc. Phần **không** nên port: `index.html` (retired), UI shell/Tailwind CDN, `uma-skill-deck*` (bảng so sánh của checker bị **thay thế** bởi chính deck/store của site — đó là chỗ mạnh nhất của tích hợp, xem 2.5).

**Tesseract.js:** hiện load từ CDN. Trong site (Cloudflare Worker + Vite), nên cài `tesseract.js` qua npm và tự host worker/wasm/lang data (`jpn.traineddata` ~ vài MB) trong `dist/client` để (a) không phụ thuộc CDN bên ngoài, (b) khớp mô hình riêng tư. Cache lang data qua IndexedDB hoặc Cache API.

### 2.4. Bridge định danh skill (mảnh ghép bắt buộc)

Viết `lib/ocr/skill-map.ts` chạy lúc build (script trong `scripts/`) sinh `lib/data/skill-ocr-map.json`:

1. Đầu vào: `uma-skill-checker/uma-skill-deck-skills.json` + `AWAKENING_PAIR_MAP` (extract từ `exam.html:1105-1113`) + `lib/data/skills.json`.
2. Logic: `checker.name` → chuẩn hóa (dùng chính `normalizeText`) → tra `nameJp` trong skills.json → xuất map `{ checkerName → siteSkillId }`.
3. Kiểm chứng đã làm: **439/445 khớp trực tiếp**; 6 "目覚め" quy qua `AWAKENING_PAIR_MAP` về skill ○ gốc rồi map tiếp → **đủ 445/445 về mặt khái niệm**.
4. Chèn 1 bước verify vào `prebuild`: fail build nếu tỷ lệ map < 100% (skill mới thêm vào game sẽ tự bị bắt).

Sản phẩm: OCR trả về *tên Nhật* → map tức thì sang `siteSkillId` (number, cùng không gian ID với share-codec V3, `eventSkills`, skill-resolver) → toàn bộ hạ tầng hiển thị skill sẵn có của site (popover, hover card, tier…) dùng được ngay mà không phải dịch gì thêm.

### 2.5. Luồng end-to-end sau tích hợp (đề xuất UX)

1. User ở tab **Parent Deck / Parenting**, bấm "Import từ ảnh chụp màn hình" → mở route/tab OCR (hoặc modal).
2. Kéo-thả bộ screenshot (theo từng người: 親A, 祖A1… — giữ nguyên mô hình 6 người của special.html).
3. Site chạy stitch → detect rows → đếm sao → OCR → map sang siteSkillId.
4. Bảng kết quả: mỗi người một cột, mỗi skill một dòng, hiện **tên song ngữ EN/JP theo DESIGN.md §1**, icon, số sao; hàng dưới ngưỡng confidence đánh dấu "cần soát" thay vì im lặng bỏ.
5. Nút "Áp dụng": skill của người kế thừa ghi vào **store của site** (localStorage `almondeye_owned_umas` / IndexedDB veterans hoặc trực tiếp preset-reducer) — từ đó Parent Deck, Ace Complement Finder, rec-engine dùng dữ liệu thật thay vì input tay.
6. Có thể giữ khái niệm "template" của UmaSkill Deck bằng cách ánh xạ về **filter 8 trục tag** mà site đã có trong skill data — checker tag mọi skill theo đúng các trục đó.

### 2.6. Phân kỳ thực hiện

| Phase | Nội dung | Phạm vi |
|---|---|---|
| **P0 — PoC** (nhỏ) | Port `common.js` + `stitch.js` sang TS thuần (không UI), test headless bằng chính fixture ảnh của checker (`tests/stitch`, `test-images/`); viết `skill-map.ts` + verify 445/445 | 1–2 ngày |
| **P1 — Trang OCR** | `app/ocr/page.tsx` (standalone, `"use client"`), UI dropzone + bảng kết quả song ngữ, tự host Tesseract.js; nhin special.html làm spec tương tác | vài ngày |
| **P2 — Cầu nối dữ liệu** | Nút "Áp dụng" ghi vào store của site; map sang veterans/Parent Deck; giữ `#hash` compatibility | vài ngày |
| **P3 — Đánh đổi** | (a) thay trang Deck của checker bằng bảng so sánh nội bộ site, hoặc (b) giữ link ra checker GitHub Pages trong giai đoạn chuyển tiếp; port skill-set OCR (`skillset-cards/ocr`) khi nó được nối UI ở repo gốc | sau |

### 2.7. Rủi ro & lưu ý

- **© Tesseract.js size**: lang data `jpn` vài MB — cần lazy-load khi user mở trang OCR, không chặn initial bundle.
- **Chính tả phiên bản**: `exam.html` cố tình giữ chính tả khác master (〇 vs ○, ngoặc half-width) cho spreadsheet; khi map về site phải luôn đi qua `normalizeText`, tuyệt đối không so string thô.
- **◎ vs ○**: chốt chính sách map (khuyến nghị ◎→○ gốc) trước khi viết `skill-map.ts`.
- **Kéo theo test**: checker có bộ visual/OCR test + fixture ảnh chất lượng; nên port ít nhất `test:norm` (normalization collision) và fixture stitch để giữ độ tin cậy sau khi port sang TS.
- **Hai repo rời nhau**: checker sẽ vẫn tiến hóa ở repo riêng (lưu ý module `skillset-ocr` còn "chưa nối UI" tại repo gốc). Nếu port sang site, cần ghi rõ ở cả hai nơi phần nào là nguồn sự thật để tránh fork lệch — hoặc sau P1, site trở thành nguồn sự thật mới và repo gốc giữ vai trò archive + research.
