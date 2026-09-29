# PvP / Master Challenge recommendations — handoff

## Đã làm

- Thêm `scripts/build-pvp-recommendations.ts` để chuyển response game sang JSON camelCase, bỏ `data_headers` (viewer/session metadata), giữ nguyên event type chưa biết và các giá trị running-style gốc.
- Tạo `lib/data/generated/pvp-recommendations.json` từ `../1790656129872-0.json`: 3 event, 7 course, 1.945 skill recommendation và 13 scenario support card.
- Thêm kiểu dữ liệu vào `lib/data/types.ts`; expose dataset qua `lib/data/registry.ts` và `DataStore` trong `lib/api/data-store.ts`.
- Thêm lệnh `bun run data:build:pvp-recommendations -- path/to/response.json`. `data:refresh` chạy bước này nếu tìm thấy file ở `lib/data/source/game/pvp-recommendations.json` hoặc theo biến `PVP_RECOMMENDATIONS_SOURCE`. Thư mục capture đã được gitignore.
- Cập nhật hướng dẫn data pipeline trong `README.md`.
- Chạy `extract-mdb.ts` trên `master.mdb`: `lib/data/generated/cards.json` được cập nhật từ 559 lên 560 card, thêm card `30318`: 「[めぐるぐるぐるトレセン日和]ライスシャワー」, rarity 3, release `2026-09-27`. Để chạy được lần này, dùng Node với một loader tạm vì Node không resolve import extensionless `./env`; Bun không resolve `node:sqlite`.
- Build lại PvP recommendations sau khi cập nhật MDB; cảnh báo thiếu card `30318` đã hết.

## Quy ước dữ liệu đã xác nhận

- `event_type = 1`: Champions Meeting.
- `event_type = 3`: Master Challenge.
- Có thể xuất hiện `event_type = 2`; chưa giải mã, cần giữ nguyên và không gán nhãn suy đoán.
- `runningStyleValues` hiện lưu mã số gốc. Chưa xác minh ý nghĩa từng mức `0/1/2`, nên chưa dùng để xếp hạng/hiển thị nhãn ưu tiên.
- Card `30318` hiện mới có metadata từ MDB: `type` còn `null`, tên Anh đang fallback sang tiếng Nhật, chưa có skill hint/event. Cần GameTora crawl để bổ sung nếu nguồn đã có dữ liệu.

## Việc dự kiến

1. **Nối recommendations với event/course đang chọn.** Dùng `eventId` làm khóa event và `raceCourseSetId` + `eventSubId` để phân biệt course; tránh chỉ dựa vào tên hoặc thứ tự mảng. Đối chiếu với `PVP_EVENTS`/`GlobalTrackBar` hiện tại và xử lý Master Challenge có nhiều course.
2. **Thêm bộ lọc Game Recommended trong danh sách skill hiện tại.** Khi đã chọn event/course, lọc theo running style; hiển thị skill theo thiết kế skill row hiện có và ghi rõ đây là gợi ý từ game, tách khỏi điểm của recommendation engine.
3. **Master Challenge nhiều course.** Thêm lựa chọn course con (5 race ở capture hiện tại) trong cùng ngữ cảnh event, đồng bộ với course/điều kiện đua đang chọn.
4. **Gợi ý inheritance.** Dùng `recommendedSuccessionCharacters` trong Parenting/Parent Deck làm bộ lọc “game suggested” theo running style.
5. **Nguồn cấp skill.** Từ skill recommendation, cho xem support cards trong `supportCardIds`, ưu tiên card có trong registry và fallback dễ hiểu cho ID chưa được site nhận diện.
6. **Scenario cards.** Tìm vị trí phù hợp trong luồng chọn deck/scenario để trình bày `recommendedScenarioSupportCards`, không trộn với gợi ý skill PvP.
7. **Xác minh mã running-style.** Tra ý nghĩa `0/1/2` từ game/schema trước khi đổi sang nhãn như không đề xuất/đề xuất/ưu tiên.
8. **Bổ sung card mới.** Chạy GameTora crawl cho `30318` khi có dữ liệu để cập nhật tên tiếng Anh, loại card và skill/event metadata.
9. **Sửa cách chạy pipeline MDB bằng lệnh chuẩn.** Xử lý import extensionless `./env` cho Node strip-types và giữ runtime `node:sqlite`; hiện Bun không thay thế được do chưa resolve `node:sqlite` trong môi trường này.
10. **Kiểm tra sau khi làm UI.** Chạy typecheck, test liên quan và build; kiểm tra cả CM một course lẫn Master Challenge nhiều course.

## Lệnh cập nhật dữ liệu

```bash
bun run data:build:pvp-recommendations -- ../1790656129872-0.json
```

Hoặc đặt capture mới tại `lib/data/source/game/pvp-recommendations.json` rồi chạy `bun run data:refresh`. Dataset đã chuẩn hóa trong `lib/data/generated/` là phần được commit; response game thô không commit.
