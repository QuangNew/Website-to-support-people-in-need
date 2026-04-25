# Release Checklist — ReliefConnect

**Last Updated:** 2026-04-23  
**Dùng checklist này TRƯỚC MỖI LẦN deploy lên production.**  
Mỗi section phải PASS hết trước khi qua section tiếp theo.

---

## 0. Pre-flight Checks

- [ ] Bạn đã đọc qua [AZURE_DEPLOYMENT_GUIDE.md](./AZURE_DEPLOYMENT_GUIDE.md) ít nhất 1 lần
- [ ] Azure CLI đã login: `az account show` hiện đúng subscription
- [ ] Biết rõ các biến sau (ghi vào notepad riêng, KHÔNG commit):
  - [ ] Supabase connection string
  - [ ] JWT key (≥32 bytes)
  - [ ] Google OAuth Client ID
  - [ ] Gmail App Password (SMTP)
  - [ ] Gemini API key
  - [ ] Supabase anon key + URL

---

## 1. Schema & Database

### 1.1 Migrations
- [ ] Tất cả EF Core migrations đã áp dụng vào Supabase (chạy SQL thủ công trong SQL Editor)
- [ ] Kiểm tra: `SELECT COUNT(*) FROM "__EFMigrationsHistory";` — đếm đủ số migration
- [ ] Không có migration pending: `dotnet ef migrations list --startup-project ../ReliefConnect.API` hiện tất cả đã applied

### 1.2 Database extensions & indexes
- [ ] PostGIS enabled: `SELECT PostGIS_Version();` trả về version
- [ ] Spatial index trên Pings: `SELECT indexname FROM pg_indexes WHERE tablename = 'Pings' AND indexdef LIKE '%GIST%';`
- [ ] BlacklistedTokens table tồn tại
- [ ] ContentViolations table tồn tại
- [ ] VerificationHistory table tồn tại

### 1.3 Storage
- [ ] Supabase storage bucket `avatars` tồn tại và public
- [ ] Supabase storage bucket `post-images` tồn tại và public
- [ ] Cả hai bucket có anon INSERT RLS policy
- [ ] CORS trên Supabase Storage cho phép production frontend URL
- [ ] Không có orphaned `/uploads/` URLs: `SELECT COUNT(*) FROM "Pings" WHERE "ConditionImageUrl" LIKE '/uploads/%';` — phải = 0

---

## 2. Security — Bảo mật

### 2.1 Secrets management
- [ ] `appsettings.json` chứa **KHÔNG CÓ secrets thật** (chỉ placeholder rỗng)
- [ ] `appsettings.Development.json` nằm trong `.gitignore` ✅ (đã có)
- [ ] `appsettings.Production.json` chứa **KHÔNG CÓ secrets thật**
- [ ] `client/.env.production` chỉ chứa public keys (VITE_ vars là public!)
- [ ] Chạy kiểm tra secrets trong git history:
  ```powershell
  git log --all --oneline -S "password" -- "*.json" "*.env"
  git log --all --oneline -S "Password" -- "*.json" "*.env"  
  git log --all --oneline -S "ApiKey" -- "*.json" "*.env"
  ```
  Nếu tìm thấy secrets → phải rotate (đổi) tất cả keys bị lộ

### 2.2 Azure App Settings
- [ ] `ASPNETCORE_ENVIRONMENT` = `Production`
- [ ] `ConnectionStrings__DefaultConnection` — connection string Supabase
- [ ] `Jwt__Key` — ≥256-bit (≥32 bytes), tạo bằng:
  ```powershell
  [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
  ```
- [ ] `Jwt__Issuer` = `ReliefConnect`
- [ ] `Jwt__Audience` = `ReliefConnectClient`
- [ ] `Google__ClientId` — Google OAuth Client ID
- [ ] `Smtp__Host` = `smtp.gmail.com`
- [ ] `Smtp__Port` = `587`
- [ ] `Smtp__User` — email address
- [ ] `Smtp__Password` — Gmail App Password (16 ký tự, không có space)
- [ ] `Gemini__ApiKey` — key từ Google AI Studio
- [ ] `Frontend__Urls__0` — URL chính xác của Static Web App (bao gồm `https://`)

### 2.3 Application security
- [ ] JWT key validated at startup (fail-fast nếu < 256-bit) — đã có trong `Program.cs`
- [ ] HtmlSanitizer active trên posts và comments (XSS prevention)
- [ ] Rate limiting trên auth endpoints (5 attempts / 15 min)
- [ ] Image upload validation (MIME type + size) cả frontend và backend
- [ ] Response compression enabled (Brotli + Gzip)
- [ ] CORS restricted — chỉ cho phép origins đã cấu hình
- [ ] Security headers đã set: `X-Content-Type-Options`, `X-Frame-Options`, `CSP`, `HSTS`

---

## 3. Frontend Configuration

- [ ] `client/.env.production` có `VITE_API_URL` đúng (URL backend + `/api`)
- [ ] `client/.env.production` có `VITE_GOOGLE_CLIENT_ID` đúng
- [ ] `client/.env.production` có `VITE_SUPABASE_URL` đúng
- [ ] `client/.env.production` có `VITE_SUPABASE_ANON_KEY` đúng
- [ ] `client/public/staticwebapp.config.json` tồn tại với `navigationFallback` cho SPA routing (Vite sẽ copy vào `dist/`)

---

## 4. Build Verification — Kiểm tra build

### 4.1 Backend
```powershell
cd src
dotnet build ReliefConnect.slnx -c Release
# ✅ Phải: "Build succeeded. 0 Warning(s) 0 Error(s)"
```
- [ ] Backend build thành công với 0 errors
- [ ] Backend build với 0 warnings (hoặc chỉ warnings không nghiêm trọng)

### 4.2 Frontend
```powershell
cd client
pnpm install
pnpm build
# ✅ Phải tạo thư mục dist/ không lỗi
```
- [ ] `pnpm build` thành công (0 errors)
- [ ] TypeScript không lỗi: `pnpm exec tsc --noEmit`
- [ ] ESLint passes: `pnpm lint`
- [ ] Thư mục `dist/` được tạo và chứa `index.html`
- [ ] `staticwebapp.config.json` có trong `dist/` (tự động copy từ `client/public/`)

---

## 5. Authentication & Authorization

- [ ] Login flow hoạt động (email + password)
- [ ] Google OAuth login hoạt động
- [ ] Logout blacklists JWT token (kiểm tra `BlacklistedTokens` table)
- [ ] Rate limiting active trên auth endpoints
- [ ] Role policies enforce đúng:
  - [ ] `RequireAdmin` — chỉ Admin
  - [ ] `RequireVolunteer` — Volunteer + Admin
  - [ ] `RequirePersonInNeed` — PersonInNeed + Admin
  - [ ] `RequireSponsor` — Sponsor + Admin
  - [ ] `RequireVerified` — tất cả roles đã verified
- [ ] Admin dashboard chỉ Admin truy cập được

---

## 6. Core Flow Smoke Tests

> Chạy thủ công hoặc bằng Playwright: `npx playwright test`

| # | Flow | Cách kiểm tra | Status |
|---|------|---------------|--------|
| 1 | Register & Login | Đăng ký tài khoản mới → login | ☐ |
| 2 | Google OAuth | Login bằng Google | ☐ |
| 3 | Logout | Logout → token bị blacklist | ☐ |
| 4 | Admin dashboard | Login admin → dashboard load | ☐ |
| 5 | Create SOS ping | Tạo SOS mới trên map | ☐ |
| 6 | Volunteer accept | Volunteer nhận và hoàn thành SOS | ☐ |
| 7 | Sponsor offer | Sponsor tạo offer help | ☐ |
| 8 | Post CRUD | Tạo / sửa / xóa post | ☐ |
| 9 | Comment moderation | Hide & restore comment | ☐ |
| 10 | Direct message | Gửi tin nhắn giữa 2 users (mở 2 tab khác browser) → tin nhắn hiện realtime | ☐ |
| 11 | Map load | Map hiển thị markers & clusters | ☐ |
| 12 | Forgot password | Quên MK → nhận email → reset | ☐ |

---

## 7. Chatbot & AI

- [ ] Gemini API key hoạt động (kiểm tra trên Google AI Studio)
- [ ] Chat panel mở và AI phản hồi
- [ ] Image upload trong chat hoạt động (JPEG/PNG/WebP, ≤4MB)
- [ ] Error states hiện user-friendly messages (timeout, rate limit, safety block)

---

## 8. Map & SOS

- [ ] Map loads với tile layer visible (OpenStreetMap)
- [ ] Pings load và hiển thị markers
- [ ] SOS creation flow hoạt động end-to-end
- [ ] Ping detail panel hiển thị đúng
- [ ] OSRM routing hoạt động
- [ ] Marker clustering hoạt động ở các zoom levels

---

## 9. Background Services

- [ ] `TokenCleanupService` — dọn expired blacklisted tokens mỗi giờ
- [ ] `PingFlagMonitorService` — monitor SOS ping flags
- [ ] `SoftDeleteCleanupService` — hard-delete sau retention period
- [ ] `MessageCleanupService` — dọn tin nhắn cũ
- [ ] Email jobs gửi được (kiểm tra bằng forgot password flow)

> **Lưu ý:** Hangfire bị disabled khi dùng Supabase pooler connection. Các hosted services vẫn chạy bình thường.

---

## 10. Azure Infrastructure

### 10.1 App Service
- [ ] WebSocket enabled: `az webapp config show --name reliefconnect-api --resource-group reliefconnect-rg --query "webSocketsEnabled"`
- [ ] Always On enabled (B1+): `az webapp config show --name reliefconnect-api --resource-group reliefconnect-rg --query "alwaysOn"`
- [ ] Health check configured: Azure Portal → App Service → Monitoring → Health check → Path: `/health`
- [ ] HTTPS Only enabled: Azure Portal → App Service → Settings → TLS/SSL → HTTPS Only: On

### 10.2 Static Web Apps
- [ ] Frontend accessible qua HTTPS
- [ ] SPA routing hoạt động (refresh trên sub-route không bị 404)
- [ ] Assets load đúng (CSS, JS, images)

---

## 11. Deployment Execution

### 11.1 Backend Deploy
```powershell
cd src/ReliefConnect.API
dotnet publish -c Release -o ./publish --runtime linux-x64 --self-contained false
Compress-Archive -Path ./publish/* -DestinationPath ./publish.zip -Force
az webapp deploy --name reliefconnect-api --resource-group reliefconnect-rg --src-path ./publish.zip --type zip
```
- [ ] Deploy command hoàn thành không lỗi
- [ ] `GET /health` returns healthy sau deploy

### 11.2 Frontend Deploy
```powershell
cd client
pnpm build
swa deploy ./dist --deployment-token $TOKEN --env production
```
- [ ] Deploy command hoàn thành không lỗi
- [ ] Frontend loads tại production URL

---

## 12. Post-Deploy Verification

Chạy checklist này **SAU KHI deploy xong**:

- [ ] `GET /health` returns `{ status: "healthy", timestamp: "..." }`
- [ ] Frontend loads tại production URL
- [ ] Login hoạt động với production credentials
- [ ] Map loads và hiện pings
- [ ] Chat panel phản hồi
- [ ] SignalR notifications hoạt động (tạo SOS → notification popup)
- [ ] Email gửi được (test forgot password)
- [ ] Google OAuth login hoạt động
- [ ] Admin dashboard accessible (chỉ admin role)
- [ ] Image upload hoạt động (avatar, post images)

---

## 13. Rollback Plan

Nếu deploy gặp lỗi nghiêm trọng:

```powershell
# Xem lịch sử deployments
az webapp deployment list --name reliefconnect-api --resource-group reliefconnect-rg -o table

# Restart app (fix cold start / memory issues)
az webapp restart --name reliefconnect-api --resource-group reliefconnect-rg

# Nếu cần rollback code: checkout commit trước → build lại → deploy lại
git log --oneline -5   # tìm commit trước
git checkout <COMMIT_HASH>
# Chạy lại Bước 11.1
```

---

## Sign-Off

| Vai trò | Tên | Ngày | Status |
|---------|-----|------|--------|
| Developer | | | ☐ Approved |
| Reviewer | | | ☐ Approved |
| Tester | | | ☐ Approved |

---

> **Nhắc nhở cuối:** Sau khi deploy thành công, hãy:
> 1. Lưu lại tất cả biến môi trường ở nơi an toàn (password manager)
> 2. Test lại toàn bộ core flows ít nhất 1 lần
> 3. Monitor logs 24h đầu: `az webapp log tail --name reliefconnect-api --resource-group reliefconnect-rg`
