# Định dạng .contest của Themis

## Đã biết

Tệp `.contest` là một tệp **ZIP thông thường**. Khi mở, Themis giải nén nó vào thư mục làm việc `ThemisContest`, gồm:

```
Tasks/
  <TÊN_BÀI>/
    Test01/
      <TÊN_BÀI>.INP
      <TÊN_BÀI>.OUT
    Test02/
      ...
Contestants/          (bài làm của thí sinh; để trống)
```

- Mỗi thư mục trong `Tasks` là một bài; tên thư mục là **tên bài** (mã bài), cũng là tên tệp dữ liệu và tên tệp bài làm (`BAI1.CPP`, `BAI1.PAS`, `BAI1.PY`).
- Mỗi thư mục con của bài là một test, chứa `<TÊN_BÀI>.INP` và `<TÊN_BÀI>.OUT`.

Nguồn: tài liệu hướng dẫn Themis do cộng đồng giáo viên chia sẻ (các bài viết 2013–2015 về Themis và tiện ích sinh test). Cần đối chiếu lại trên phiên bản Themis đang dùng.

## Exporter tạo ra gì

`apps/api/src/modules/conversion/infrastructure/exporters/contest.exporter.ts`:

```
Tasks/<CODE>/TestNN/<CODE>.INP|.OUT    xuống dòng CRLF (Themis chạy trên Windows)
Contestants/                           thư mục rỗng
DeBai.md                               đề bài (tuỳ chọn "Kèm đề bài"), ngoài Tasks để Themis không coi là test
DOC-TRUOC.txt                          hướng dẫn + giới hạn thời gian/bộ nhớ từng bài
```

Mã bài (`TaskCode`) chỉ gồm `A–Z`, `0–9`, `_`, bắt đầu bằng chữ cái, tối đa 16 ký tự, duy nhất trong bộ đề. AI và parser ưu tiên tên bài mà đề tự ghi (`SUM.INP`, `Tên chương trình: DAYSO.*`), nếu không có thì `BAI1`, `BAI2`...

## Chưa xác minh — cần làm trước khi ra mắt

1. **Tệp cấu hình bài** (giới hạn thời gian, bộ nhớ, điểm mỗi test, kiểu so sánh). Themis lưu một tệp cấu hình nhỏ trong thư mục mỗi bài (các nguồn ghi tên khác nhau: `settings.cfg` hoặc `settings`), nhưng định dạng bên trong chưa được công bố. Hiện exporter **không** ghi tệp này; giới hạn từng bài nằm trong `DOC-TRUOC.txt` để giáo viên nhập trong Themis.
   - Cách làm: trên một máy có Themis, tạo bài, đặt giới hạn, rồi mở tệp cấu hình mà Themis sinh ra; thêm một `TaskSettingsWriter` vào exporter để ghi đúng định dạng đó. Khi có, mục tiêu "mở là chấm, không cần thiết lập" mới hoàn toàn đạt.
2. Tên thư mục test: `Test01` hay `test1` — Windows không phân biệt hoa thường; Themis nhận mọi thư mục con, nhưng nên thử với một bộ đề thật.
3. Tệp ngoài `Tasks/` và `Contestants/` (`DeBai.md`, `DOC-TRUOC.txt`): cần xác nhận Themis bỏ qua khi mở `.contest`. Nếu không, tắt "Kèm đề bài" và chuyển hướng dẫn vào email/trang tải về.
