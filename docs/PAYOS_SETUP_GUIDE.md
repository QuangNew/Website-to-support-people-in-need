# PayOS Setup Guide

Hướng dẫn kết nối PayOS cho tính năng **Ủng hộ / Donate** trong ReliefConnect.

---

## 1. Đăng ký tài khoản PayOS

1. Truy cập [my.payos.vn](https://my.payos.vn) và nhấn **Đăng ký**.
2. Điền thông tin: email, mật khẩu, số điện thoại.
3. Xác minh OTP gửi về điện thoại.

---

## 2. Xác minh tài khoản (KYC)

Sau khi đăng ký, bạn cần xác minh để kích hoạt nhận tiền thật:

| Loại | Yêu cầu |
|------|---------|
| Cá nhân | CCCD/CMND (2 mặt) + ảnh selfie |
| Doanh nghiệp | Giấy ĐKKD + CCCD người đại diện |

> Thời gian duyệt thường 1–3 ngày làm việc.

---

## 3. Tạo kênh thanh toán (Payment Channel)

1. Đăng nhập → **Quản lý kênh** → **Tạo kênh mới**.
2. Điền:
   - **Tên kênh**: `ReliefConnect Donation`
   - **Loại**: Website
   - **URL Website**: `https://<your-domain>.azurestaticapps.net`
3. Sau khi tạo, bạn sẽ thấy 3 thông tin quan trọng:
   - `Client ID`
   - `API Key`
   - `Checksum Key`

---

## 4. Cấu hình trong ReliefConnect

### Local Development

Mở (hoặc tạo) `src/ReliefConnect.API/appsettings.Development.json`:

```json
{
  "PayOS": {
    "ClientId": "<your-client-id>",
    "ApiKey": "<your-api-key>",
    "ChecksumKey": "<your-checksum-key>"
  }
}
```

> **Lưu ý:** File này được gitignore. **Không commit** thông tin xác thực.

### Azure App Service (Production)

Thêm vào **Configuration → Application Settings**:

```
PayOS__ClientId     = <your-client-id>
PayOS__ApiKey       = <your-api-key>
PayOS__ChecksumKey  = <your-checksum-key>
```

### Supabase SQL Editor

Để bật bảng lưu lịch sử ủng hộ trên môi trường Supabase hiện tại, chạy file sau trong **SQL Editor**:

- `docs/plans/2026-04-23-donation-records.sql`

> File SQL này chỉ tạo bảng `DonationRecords` và các index cần cho donate. Nó **không** ghi vào `__EFMigrationsHistory` vì migration EF hiện tại còn gộp thêm các thay đổi chat/profile chưa muốn áp dụng cùng lúc.

---

## 5. Cấu hình Webhook

PayOS gửi webhook khi thanh toán thành công. Bạn cần đăng ký URL webhook:

1. Trên portal PayOS → kênh của bạn → **Webhook URL**.
2. Nhập URL:
   ```
   https://<your-api-domain>/api/donation/webhook
   ```
3. Nhấn **Lưu** và **Test Webhook** để kiểm tra kết nối.

> ReliefConnect tự động xác minh chữ ký HMAC-SHA256 trên mọi webhook. Request giả mạo sẽ bị từ chối với HTTP 401.
>
> Donate page hiện còn poll `GET /api/donation/status/{orderCode}` và endpoint này sẽ hỏi lại PayOS khi bản ghi local vẫn đang `Pending`, nên UI vẫn cập nhật được nếu webhook đến chậm.

---

## 6. Kiểm tra tích hợp (Sandbox)

PayOS cung cấp môi trường sandbox để test không tốn tiền thật:

1. Trên portal → **Cài đặt** → bật **Chế độ Sandbox**.
2. Dùng thẻ test do PayOS cung cấp trong docs của họ.
3. Kiểm tra:
   - Tạo donation → xem QR hiện ra.
   - Quét QR bằng app ngân hàng (sandbox) → webhook được gọi.
   - Donation chuyển sang trạng thái `Paid` → hiện trong lịch sử.

---

## 7. URL Redirect (Return/Cancel)

Hệ thống tự động tạo redirect URL dựa trên `Frontend:Urls` trong cấu hình:

| Trường hợp | URL |
|------------|-----|
| Thành công | `{frontendUrl}/donate?status=success` |
| Huỷ | `{frontendUrl}/donate?status=cancelled` |

> Sau khi redirect, trang `/donate` tiếp tục poll API để xác nhận trạng thái thực.

---

## 8. Giới hạn kỹ thuật

| Tham số | Giá trị |
|---------|---------|
| Số tiền tối thiểu | 2.000 VND |
| Số tiền tối đa | 50.000.000 VND |
| Lịch sử hiển thị | 1.000 giao dịch gần nhất |
| Thời gian lưu lịch sử | 3 tháng |
| Thời gian hết hạn QR | 15 phút |
| Lời nhắn tối đa | 200 ký tự |
| `description` gửi PayOS | 9 ký tự (`"UNGHO"`) |

---

## 9. Bảo mật

- Webhook endpoint không yêu cầu xác thực JWT nhưng **bắt buộc** xác minh HMAC-SHA256.
- `ChecksumKey` **không bao giờ** được expose ra frontend.
- `ClientId` và `ApiKey` chỉ dùng server-to-server.
- Tất cả secrets phải lưu trong Azure App Settings hoặc `appsettings.Development.json` (gitignored).

---

## 10. Liên hệ hỗ trợ PayOS

- Docs: [docs.payos.vn](https://docs.payos.vn)
- Email: support@payos.vn
- Portal: [my.payos.vn](https://my.payos.vn)
