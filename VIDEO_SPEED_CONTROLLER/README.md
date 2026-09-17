# Video Speed Controller

Browser extension dùng để điều chỉnh tốc độ video HTML5 trên YouTube và các website khác.

## Tính năng

- Phím tắt tùy biến để tăng, giảm và reset tốc độ.
- Giữ modifier + lăn chuột trên video để đổi tốc độ.
- Badge mờ hiển thị tốc độ ở góc video.
- Chỉ hiện badge khi player thực sự được sử dụng; bỏ qua YouTube hover preview và video preview bị mute.
- Click badge để chuyển preset, chuột phải để về `1×`.
- Popup cấu hình default speed, step, presets, shortcut và opacity.
- Cấu hình được đồng bộ bằng `browser.storage.sync`.

## Chạy development

```bash
npm install
npm run dev
```

## Build Chrome / Edge

```bash
npm run build
```

Sau khi build, load unpacked từ `.output/chrome-mv3`:

1. Mở `chrome://extensions` hoặc `edge://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked** và trỏ đến `.output/chrome-mv3`.

## Build Firefox

```bash
npm run build:firefox
```

Firefox là target phụ; hành vi fullscreen và các phím tắt do browser giữ lại có thể khác Chrome/Edge.

## Lưu ý

- Extension cần chạy trên nhiều website nên content script dùng match pattern `*://*/*`.
- Shortcut chỉ hoạt động khi trang web đang focus. Browser/OS có thể giữ lại một số tổ hợp phím.
- Các player không dùng thẻ `<video>` HTML5 hoặc chạy trong cross-origin iframe bị chặn có thể không được hỗ trợ.
