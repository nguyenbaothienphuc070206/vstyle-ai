# Gợi ý nội dung form nộp bài Audition (bản nháp)

> Bản nháp để đội tham khảo và **viết lại bằng lời của đội**. Kiểm tra lại số liệu, link và phần mô tả quy trình làm việc thực tế của đội trước khi nộp.

## I. Thông tin giải pháp

**Tên giải pháp:** Vstyle · Việt phục Remix — AI Stylist phối Việt phục theo gu Gen Z

**Nhu cầu người dùng và tình huống sử dụng** *(≤ 2000 ký tự)*

Học sinh, sinh viên ngày càng muốn mặc Việt phục trong lễ tốt nghiệp, chụp kỷ yếu, du xuân ngày Tết, đám cưới người thân hay đi dạo phố cuối tuần. Nhưng các bạn thường gặp ba khó khăn: (1) không biết loại áo nào hợp dịp nào, nên phối màu và phụ kiện ra sao cho vừa hiện đại vừa đúng lễ; (2) thông tin trên mạng lẫn lộn, dễ phối sai đặc trưng (vạt cài sang trái, bỏ thân con của áo ngũ thân, mặc áo tứ thân thiếu yếm…); (3) người có nhu cầu đặc biệt — ngồi xe lăn, khó cài cúc, da nhạy cảm — gần như không có hướng dẫn may mặc phù hợp.

Tình huống chính: sinh viên gõ một câu "Lễ tốt nghiệp tháng 6 ở Sài Gòn, trời nóng, mình thích tối giản" hoặc tải ảnh một tấm vải/bộ đồ mình thích, nhận ngay 3 bản phối đã được kiểm tra chuẩn văn hóa, xem mockup hoặc ảnh minh họa, đọc lời bình giải thích vì sao hợp, so sánh các phương án, rồi lưu lookbook và chia sẻ kèm caption.

**Tóm tắt giải pháp**

Vstyle là web app kết hợp Gemini với một cơ sở tri thức văn hóa có nguồn thẩm định. Gemini hiểu câu nói tự nhiên và ảnh cảm hứng, xếp hạng bản phối, viết lời bình/caption và vẽ ảnh minh họa; còn bộ quy tắc văn hóa tất định chấm điểm "Chuẩn" và cảnh báo mọi cách phối làm sai lệch đặc trưng. Người dùng có hai cách: AI Stylist một câu lệnh hoặc hành trình 9 bước (bối cảnh → thích ứng → nhân vật → y phục → phong cách → màu → phụ kiện → gợi ý → kết quả), kèm kiểm tra hài hòa màu, so sánh phương án, lookbook và chia sẻ.

**Tác động kỳ vọng** *(≤ 3000 ký tự)*

- Với người trẻ: giảm rào cản để mặc Việt phục đúng và đẹp; mỗi gợi ý đi kèm lý do và nguồn nên người dùng *học* được đặc trưng áo (ngũ thân, vạt hữu nhậm, cổ lập lĩnh…) thay vì chỉ nhận một bức ảnh.
- Với văn hóa: định dạng "Remix có giới hạn" — sáng tạo phối lớp, sneaker, màu hiện đại nhưng không phá các quy tắc cốt lõi; mỗi lookbook được chia sẻ là một lần lan tỏa kiến thức có kiểm chứng.
- Với cộng đồng người khuyết tật: thông số may đo thích ứng đã xác thực giúp người ngồi xe lăn, khó cài cúc… cũng mặc được Việt phục một cách tự tin — đúng tinh thần "vừa với mọi cơ thể".
- Với nhà may, hội nhóm Việt phục, trường học: có thể mở rộng thành công cụ tư vấn đồng phục lễ, kỷ yếu, sự kiện văn hóa; cơ sở tri thức mở rộng được khi có thêm nguồn thẩm định.

**Hướng tiếp cận và giải pháp kỹ thuật** *(≤ 6000 ký tự)*

- Frontend React 19 + Tailwind CSS 4, backend Express (Node.js) triển khai trên Google AI Studio / Cloud Run; khóa Gemini chỉ nằm ở server.
- Cơ sở tri thức JSON (y phục, phụ kiện, dịp, thời tiết, luật văn hóa, nguồn, điều chỉnh thích ứng) được validate bằng zod và kiểm tra toàn vẹn quan hệ khi khởi động; chỉ bản ghi APPROVED + có nguồn đã thẩm định mới được dùng.
- Rule engine văn hóa tất định: cùng bản phối luôn cho cùng kết quả KEEP / CONSIDER / WARNING, điểm Chuẩn, lý do và nguồn.
- Bộ gợi ý tất định chấm điểm có trọng số (dịp, y phục, phong cách, màu, phụ kiện, thời tiết, thích ứng, văn hóa), loại mọi ứng viên bị cảnh báo, rồi mới đưa cho Gemini xếp hạng.
- Kiểm tra hài hòa màu: chuyển màu sang HSL/Lab, xác định quan hệ màu, độ tương phản WCAG, số điểm nhấn và đối chiếu gợi ý màu trích từ dữ liệu của từng dịp.
- Ảnh người dùng được thu nhỏ và xóa EXIF ngay trên trình duyệt; mọi lời gọi Gemini đặt `store: false`; giới hạn tần suất theo IP và trần tạo ảnh toàn cục để bảo vệ hạn mức.
- Khả năng chịu lỗi: timeout, retry một lần, model dự phòng, cắt output quá dài, và chế độ dự phòng hoàn chỉnh khi không có khóa.
- Chất lượng: 194 bài test tự động, kiểm tra kiểu TypeScript, kiểm thử giao diện bằng Playwright, kiểm tra khả năng tiếp cận WCAG 2.2 AA bằng axe-core.

## II. Ứng dụng Gemini & Prompting

**Cách sử dụng Gemini**

| Nhiệm vụ | Model | Đầu vào | Đầu ra |
|---|---|---|---|
| Hiểu câu nói | gemini-3.8-flash | Câu tiếng Việt + allow-list ID | JSON: dịp, thời tiết, phong cách, màu, y phục, phụ kiện, nhu cầu |
| Xếp hạng bản phối | gemini-3.8-flash | Bối cảnh + ứng viên đã qua rule engine | Top 3 ID ứng viên |
| Lời bình | gemini-3.8-flash | Bản phối + kết quả văn hóa bất biến + nguồn | Tiêu đề, nhận xét, giao hòa bản sắc, mẹo mặc |
| Caption | gemini-3.8-flash | Bản phối + điểm Chuẩn/Chất | Caption, hook, hashtag |
| Đọc ảnh cảm hứng | gemini-3.8-flash (đa phương thức) | Ảnh người dùng | Bảng màu, món đồ nhận ra, gợi ý y phục/phong cách |
| Vẽ ảnh bản phối | gemini-3.1-flash-image | Prompt dựng từ dữ liệu đã xác thực (+ ảnh người dùng nếu đồng ý) | Ảnh minh họa 3:4 có SynthID |

**Chiến lược và quy trình prompting** *(≤ 5000 ký tự)*

1. *Tách vai trò:* Gemini là "người hiểu và diễn đạt", dữ liệu + rule engine là "người quyết định". System instruction của mọi tác vụ nhắc rõ điều Gemini không được làm (tạo luật, thêm sử liệu, đổi điểm, suy diễn cơ thể).
2. *Structured output:* mỗi tác vụ gửi JSON schema; các trường ID dùng `enum` bằng chính allow-list server tạo ra, có giá trị `NONE` khi không chắc → Gemini không thể "bịa" ID. Server vẫn validate lại bằng zod.
3. *Grounding:* prompt chỉ chứa dữ liệu đã duyệt (đặc trưng kết cấu, quy tắc bất biến, lý do của rule engine, tên nguồn). Với ảnh AI, đặc trưng và quy tắc được chèn nguyên văn, kèm câu phủ định rõ ràng (vạt hữu nhậm, không lẫn hanfu/hanbok/kimono).
4. *Giọng văn:* một đoạn "VOICE" dùng chung: tiếng Việt có dấu, giọng stylist thân thiện với Gen Z, tôn trọng di sản, tối đa 1 emoji.
5. *Kiểm thử và cải tiến:* đội chạy các câu mẫu (tốt nghiệp trời nóng, cưới ở Huế trời lạnh, kỷ yếu Remix, Tết ngồi xe lăn…), so output với dữ liệu, siết prompt khi thấy Gemini thêm sử liệu hoặc chọn sai ID; bộ test giả lập các lỗi JSON sai, ID lạ, timeout, 429 để đảm bảo luôn có kết quả an toàn.
6. *Xử lý kết quả:* cắt text quá dài thay vì bỏ, chuẩn hóa hashtag, lọc màu hex sai, khớp màu ảnh với bảng màu đã duyệt bằng khoảng cách màu Lab; nếu vẫn lỗi thì dùng kết quả tất định và báo rõ trên giao diện.

## III. Minh chứng (đội tự điền)

- URL video giới thiệu: …
- URL demo (ai.studio): …
- URL repository: https://github.com/nguyenbaothienphuc070206/vstyle-ai (nhánh `vstyle-v2-ai-arena`)
- URL chia sẻ cuộc trò chuyện với Gemini: …
