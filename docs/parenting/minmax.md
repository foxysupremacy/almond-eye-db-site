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

## Giới hạn và cách đọc UI

Gene trực tiếp chỉ được kiểm tra trên sáu slot Parent/Grandparent bảo vệ; GGP không bị cảnh báo như gene hiện có của Ace. Pink từ các thế hệ sâu hơn vẫn có thể đóng góp vào forecast của từng lần train thông qua branch donors.

Thiếu course, style hoặc factor donor thì UI báo phần dữ liệu chưa xác định, không coi đó là cây sạch. Cảnh báo `6★` và `12★` chỉ phản ánh ngưỡng của mô hình planning; dưới `6★` UI không hiện cảnh báo lệch gene. Nếu giảm pink gây hụt rank, tradeoff hiển thị Uma, aptitude trước/sau và target rank còn thiếu; số G1 mất chỉ hiện khi lớn hơn 0.

Engine không tự tìm kiếm toàn bộ cây, không chặn candidate có gene lệch, không tự sửa target genetic và không trộn penalty gene vào affinity score.
