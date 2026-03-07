# 📋 User Manual Tasks — Relief Connection Support Platform
> **Cập nhật**: 2026-03-03 | Những việc cần user tự thực hiện (AI không thể làm được)

---

## 🔴 PHẢI LÀM (Blocking — App không chạy được nếu thiếu)

### 1. Enable PostGIS Extension trên Supabase
> Cần thiết cho spatial queries (bản đồ, zones, khoảng cách)

1. Vào **Supabase Dashboard** → **Database** → **Extensions**
2. Tìm `postgis` → Click **Enable**

### 2. Chạy Migration SQL
> Tạo toàn bộ 16 bảng + cập nhật schema mới (Google OAuth, Email Verification)

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy **toàn bộ nội dung** file [`migration.sql`](migration.sql) vào editor
3. Click **Run**

Migration bao gồm:
- `20260228165225_InitialCreate` — Tạo tất cả bảng (AspNetUsers, Pings, Posts, Zones, ...)
- `20260303065344_AddAuthFields` — Thêm 5 cột mới vào `AspNetUsers`:
  - `GoogleId` — Google OAuth ID
  - `EmailVerificationCode` — Mã xác minh email 6 chữ số
  - `EmailVerificationCodeExpiry` — Hạn mã xác minh
  - `RequestedRole` — Vai trò yêu cầu xác minh
  - `VerificationReason` — Lý do xác minh

### 3. Tạo tài khoản Admin + Promote test accounts
> Đã tạo 5 tài khoản qua API. Cần chạy SQL promote sau khi migration xong.

**Tài khoản test đã đăng ký:**

| Username | Email | Mật khẩu | Vai trò |
|----------|-------|-----------|---------|
| `admin_test` | admin@reliefconnect.test | `Admin123@` | Admin (Role=9) |
| `volunteer_test` | volunteer@reliefconnect.test | `Volunteer123@` | Volunteer (Role=3) |
| `sponsor_test` | sponsor@reliefconnect.test | `Sponsor123@` | Sponsor (Role=2) |
| `person_in_need_test` | need@reliefconnect.test | `NeedHelp123@` | PersonInNeed (Role=1) |
| `guest_test` | guest@reliefconnect.test | `Guest123@` | Guest (Role=0) |

**Chạy SQL promote** (cuối file `migration.sql` hoặc trực tiếp trong Supabase SQL Editor):
```sql
-- Admin account
UPDATE "AspNetUsers"
SET "Role" = 9, "VerificationStatus" = 2, "EmailConfirmed" = true
WHERE "UserName" = 'admin_test';

-- Volunteer account
UPDATE "AspNetUsers"
SET "Role" = 3, "VerificationStatus" = 2, "EmailConfirmed" = true
WHERE "UserName" = 'volunteer_test';

-- Sponsor account
UPDATE "AspNetUsers"
SET "Role" = 2, "VerificationStatus" = 2, "EmailConfirmed" = true
WHERE "UserName" = 'sponsor_test';

-- Person In Need account
UPDATE "AspNetUsers"
SET "Role" = 1, "VerificationStatus" = 2, "EmailConfirmed" = true
WHERE "UserName" = 'person_in_need_test';

-- Guest account (keep as Guest, just verify email)
UPDATE "AspNetUsers"
SET "EmailConfirmed" = true
WHERE "UserName" = 'guest_test';
```

---

## 🟡 NÊN LÀM (Chức năng đầy đủ hơn)

### 4. Cấu hình Google OAuth (Sign-In with Google)
> Nếu không cấu hình, nút Google Sign-In sẽ không hiện (fallback graceful)

**Bước 1 — Google Cloud Console:**
1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới (hoặc chọn project hiện có)
3. **APIs & Services** → **OAuth consent screen** → External → Đặt tên "ReliefConnect"
4. **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173`, `http://localhost:5174`, `http://localhost:5175`
5. Copy **Client ID** (dạng `XXXX.apps.googleusercontent.com`)

**Bước 2 — Điền Client ID vào 2 nơi:**

**Backend** — Sửa file `src/ReliefConnect.API/appsettings.Development.json`:
```json
"Google": {
  "ClientId": "YOUR_REAL_CLIENT_ID.apps.googleusercontent.com"
}
```

**Frontend** — Thêm vào file `client/.env`:
```env
VITE_GOOGLE_CLIENT_ID=YOUR_REAL_CLIENT_ID.apps.googleusercontent.com
```

### 5. Cấu hình SMTP (Gửi email xác minh thật)
> Dev mode: mã xác minh sẽ in ra console log (không cần SMTP). Production: cần SMTP.

**Option A — Gmail (dễ nhất cho dev):**
1. Bật 2FA cho Gmail
2. Tạo **App Password** tại https://myaccount.google.com/apppasswords
3. Sửa `src/ReliefConnect.API/appsettings.Development.json`:

```json
"Smtp": {
  "Host": "smtp.gmail.com",
  "Port": 587,
  "User": "your-gmail@gmail.com",
  "Password": "xxxx-xxxx-xxxx-xxxx",
  "From": "your-gmail@gmail.com"
}
```

**Option B — Mailgun/SendGrid (production):**
- Tạo tài khoản, verify domain, dùng SMTP credentials của họ

### 6. Kiểm tra Gemini API Key
> Key hiện tại: `AIzaSyDPJL5aDxhxhiKBihHZZuN0elxhCRIoBQ4`

- Kiểm tra key còn hoạt động không (free tier: 15 req/phút, 1500 req/ngày)
- Nếu hết hạn, tạo key mới tại [Google AI Studio](https://aistudio.google.com/apikey)
- Sửa trong `src/ReliefConnect.API/appsettings.Development.json` → `Gemini:ApiKey`

---

## 🔒 BẢO MẬT (Trước khi push lên GitHub)

### 7. Ẩn thông tin nhạy cảm
> **QUAN TRỌNG** — File `appsettings.Development.json` chứa mật khẩu DB, API key, JWT key

| Thông tin | File | Rủi ro |
|-----------|------|--------|
| Supabase DB password | `appsettings.Development.json` | 🔴 Cao — ai cũng truy cập được DB |
| Gemini API key | `appsettings.Development.json` | 🔴 Cao — hết quota |
| JWT signing key | `appsettings.Development.json` | 🟡 Trung — giả mạo token |

**Cách xử lý:**
```bash
# Thêm vào .gitignore
echo "src/ReliefConnect.API/appsettings.Development.json" >> .gitignore

# Hoặc dùng user-secrets
cd src/ReliefConnect.API
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "your-conn-string"
dotnet user-secrets set "Gemini:ApiKey" "your-key"
```

---

## 📦 Sprint 3 Chuẩn bị (Khi bắt đầu Social Network)

### 8. Tạo Supabase Storage Buckets
1. Supabase → **Storage** → **New Bucket**: `post-images`
   - Public: ✅
   - MIME: `image/jpeg, image/png, image/webp`
   - Max size: 5MB
2. Bucket: `avatars`
   - Public: ✅
   - Max size: 2MB

### 9. Seed dữ liệu test (tùy chọn)
```sql
-- Vùng ưu tiên test
INSERT INTO "Zones" ("Name", "BoundaryGeoJson", "RiskLevel", "CreatedAt")
VALUES 
  ('Vùng lũ Hải Châu', '{"type":"Polygon","coordinates":[[[108.18,16.04],[108.24,16.04],[108.24,16.08],[108.18,16.08],[108.18,16.04]]]}', 4, NOW()),
  ('Vùng ngập Thừa Thiên Huế', '{"type":"Polygon","coordinates":[[[107.55,16.43],[107.65,16.43],[107.65,16.50],[107.55,16.50],[107.55,16.43]]]}', 3, NOW());

-- Supply items test
INSERT INTO "SupplyItems" ("Name", "Quantity", "CoordinatesLat", "CoordinatesLong", "CreatedAt")
VALUES 
  ('Kho gạo Liên Chiểu', 500, 16.0718, 108.1530, NOW()),
  ('Kho thuốc Thanh Khê', 200, 16.0640, 108.1780, NOW());
```

---

## ✅ Tổng hợp Checklist

| # | Task | Mức độ | Status |
|---|------|--------|--------|
| 1 | Enable PostGIS trên Supabase | 🔴 Blocking | ⬜ |
| 2 | Chạy `migration.sql` trên Supabase SQL Editor | 🔴 Blocking | ⬜ |
| 3 | Promote test accounts qua SQL | 🔴 Blocking | ⬜ |
| 4 | Cấu hình Google OAuth Client ID | 🟡 Nên làm | ⬜ |
| 5 | Cấu hình SMTP cho email thật | 🟡 Nên làm | ⬜ |
| 6 | Kiểm tra Gemini API key | 🟡 Nên làm | ⬜ |
| 7 | Ẩn secrets trước khi push GitHub | 🔒 Bảo mật | ⬜ |
| 8 | Tạo Storage buckets (Sprint 3) | 📦 Sau | ⬜ |
| 9 | Seed dữ liệu test | 📦 Tùy chọn | ⬜ |
