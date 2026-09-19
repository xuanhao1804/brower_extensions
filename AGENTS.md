# Repository agent instructions

Trả lời người dùng bằng tiếng Việt; giữ API, function, class, variable và browser concepts bằng English. Ưu tiên: correctness → security → maintainability → simplicity → performance → developer experience.

## Start every task

1. Đọc `docs/context/PROJECT.md` và `docs/context/CURRENT.md`.
2. Đọc entry liên quan trong `docs/context/DECISIONS.md` nếu task đụng đến lựa chọn đã xác lập.
3. Đọc `docs/context/HISTORY.md` nếu task phụ thuộc công việc cũ, Issue provenance hoặc commit grouping.
4. Với product-code task, đọc `docs/context/ENGINEERING.md`.
5. Nếu có `.codegraph/` và cần hiểu kiến trúc, dùng CodeGraph trước khi grep hoặc đọc source rộng.
6. Xem code/config hiện tại là authoritative nếu documentation bị stale.

## One task, one GitHub Issue

- Mỗi top-level task có objective và outcome độc lập dùng đúng một GitHub Issue; tạo Issue khi objective/scope đã rõ.
- Clarification, bug fix và follow-up phục vụ cùng outcome phải dùng lại Issue hiện tại. Không tạo Issue cho từng commit hay bước con.
- Giữ Issue mở khi công việc chưa hoàn thành hoặc chưa push.
- Trước khi đóng, comment outcome, verification, commit đã push và Pull Request nếu có. Chỉ đóng sau khi push thành công.
- Nếu GitHub không khả dụng, tiếp tục local work an toàn, ghi phần chưa đồng bộ vào `CURRENT.md` và báo recovery step.

## Keep context current

Trước khi hoàn tất mọi repository-related task:

- Chỉ cập nhật `PROJECT.md` khi stable project facts thay đổi.
- Cập nhật `CURRENT.md` với trạng thái mới nhất.
- Append `DECISIONS.md` khi có durable decision.
- Append entry ngắn vào `docs/context/sessions/YYYY-MM.md` cho completed top-level task.
- Không lưu raw transcript, secret, credential, `.env` value, temporary attachment hay bản sao đầy đủ của Git log.

## Verify and publish

- Chạy verification tương xứng; review diff để tìm secret, stale statement, generated noise và file không liên quan.
- Chỉ stage file thuộc task. Giữ nguyên unrelated user changes.
- Dùng focused commit có số Issue; tự động push current upstream branch trừ khi người dùng nói không push.
- Nếu commit/push thất bại, không rollback/xóa work; giữ Issue mở, ghi blocker và recovery step vào `CURRENT.md`, rồi báo người dùng.

## Essential extension constraints

- Mặc định: TypeScript strict, WXT, Manifest V3, Chrome/Edge primary, Firefox secondary; chỉ dùng React khi UI đủ phức tạp.
- Phân tách content script, service worker/background, popup/options/side panel, page-world injection, storage, messaging và backend.
- Áp dụng least privilege; không secret trong extension, `eval`/remote executable code/CSP bypass hay permission “cho chắc”.
- Message protocol phải typed; event listener/observer phải cleanup; không dựa vào persistent service-worker memory.
- Với SPA/dynamic DOM, xử lý route/element lifecycle và duplicate injection; tránh observer/polling nặng.
- UI injected phải tránh CSS collision/layout shift; popup không giữ critical state.
- Khi sửa code: đọc architecture trước, chỉ sửa phần cần thiết. Với bug: root cause → fix → why → side effects → verification.
