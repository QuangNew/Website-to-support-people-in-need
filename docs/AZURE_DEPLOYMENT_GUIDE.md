# Hướng dẫn Deploy ReliefConnect lên Azure

## Tổng quan kiến trúc

```
Internet
   │
   ├─► Azure Static Web Apps  ──► React SPA (client/)
   │         │
   │         │  API calls /api/*
   │         ▼
   └─► Azure App Service  ──► ASP.NET Core 10 (src/)
               │
               ▼
          Supabase PostgreSQL (đám mây — giữ nguyên)
```

| Thành phần | Dịch vụ Azure | Ghi chú |
|---|---|---|
| Backend ASP.NET Core | App Service (Linux, Free/B1) | Tier F1 dùng được cho demo |
| Frontend React | Static Web Apps (Free) | CDN toàn cầu, SSL miễn phí |
| Database | Supabase (giữ nguyên) | Không cần di chuyển |
| Background jobs | Hangfire (chạy trong App Service) | Dùng Supabase PostgreSQL làm storage |

---

## Bước 0 — Chuẩn bị

### Công cụ cần cài

```powershell
# Azure CLI
winget install Microsoft.AzureCLI

# .NET 10 SDK (nếu chưa có)
winget install Microsoft.DotNet.SDK.10

# Node.js + pnpm (nếu chưa có)
winget install OpenJS.NodeJS
npm install -g pnpm
```

### Đăng nhập Azure

```powershell
az login
az account show   # Xác nhận đúng subscription
```

---

## Bước 1 — Áp dụng Migration vào Supabase

> **Tại sao không dùng `dotnet ef database update`?**  
> Supabase dùng PgBouncer (transaction-mode pooler) — không tương thích với Npgsql 10.x khi chạy migration trực tiếp.  
> Giải pháp: chạy script SQL thủ công trong Supabase SQL Editor.

### 1.1 Mở Supabase SQL Editor

1. Vào [supabase.com](https://supabase.com) → chọn project
2. Menu trái → **SQL Editor** → **New query**

### 1.2 Chạy migration bootstrap

Copy toàn bộ nội dung file [`migration_apply.sql`](../migration_apply.sql) vào SQL Editor và nhấn **Run**.

Script này sẽ:
- Tạo bảng `__EFMigrationsHistory` (tracking EF migrations)
- Stamp 8 migration cũ là đã áp dụng (bảng đã có từ migration.sql gốc)
- Tạo bảng `BlacklistedTokens` mới
- Stamp 2 migration mới

### 1.3 Kiểm tra kết quả

```sql
SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
```

Kết quả mong đợi: **10 dòng**.

```sql
-- Kiểm tra bảng mới đã có
SELECT COUNT(*) FROM "BlacklistedTokens";
```

---

## Bước 2 — Deploy Backend (Azure App Service)

### 2.1 Tạo Resource Group và App Service Plan

```powershell
# Đặt tên biến (thay đổi theo ý muốn)
$RG      = "reliefconnect-rg"
$LOC     = "southeastasia"        # hoặc eastasia, australiaeast
$PLAN    = "reliefconnect-plan"
$APPNAME = "reliefconnect-api"    # phải unique toàn cầu → .azurewebsites.net

az group create --name $RG --location $LOC

# Free tier (F1) — dùng được cho demo, không có custom domain SSL
az appservice plan create `
  --name $PLAN `
  --resource-group $RG `
  --sku F1 `
  --is-linux

# Tạo App Service với runtime .NET 10
az webapp create `
  --name $APPNAME `
  --resource-group $RG `
  --plan $PLAN `
  --runtime "DOTNETCORE:10.0"
```

> **Lưu ý**: F1 (Free) bị giới hạn 60 phút CPU/ngày. Dùng B1 (~$13/tháng) cho môi trường thực tế:  
> `--sku B1`

### 2.2 Cấu hình Application Settings (biến môi trường)

Đây là bước **quan trọng nhất** — thay thế toàn bộ secrets trong `appsettings.json`:

```powershell
az webapp config appsettings set `
  --name $APPNAME `
  --resource-group $RG `
  --settings `
    "ASPNETCORE_ENVIRONMENT=Production" `
    "ConnectionStrings__DefaultConnection=Host=aws-1-ap-southeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.YOUR_PROJECT_ID;Password=YOUR_DB_PASSWORD;SSL Mode=Require;Trust Server Certificate=true;No Reset On Close=true" `
    "Jwt__Key=YOUR_256_BIT_SECRET_KEY_MINIMUM_32_CHARS" `
    "Jwt__Issuer=ReliefConnect" `
    "Jwt__Audience=ReliefConnectClient" `
    "Jwt__ExpiryMinutes=60" `
    "Google__ClientId=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com" `
    "Smtp__Host=smtp.gmail.com" `
    "Smtp__Port=587" `
    "Smtp__User=your-email@gmail.com" `
    "Smtp__Password=YOUR_GMAIL_APP_PASSWORD" `
    "Smtp__From=noreply@reliefconnect.vn" `
    "Gemini__ApiKey=YOUR_GEMINI_API_KEY" `
    "Gemini__Model=gemini-2.5-flash" `
    "Frontend__Urls__0=https://YOUR_STATIC_WEB_APP.azurestaticapps.net"
```

> **Tạo JWT Key ngẫu nhiên (32+ bytes):**
> ```powershell
> [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
> ```

> **Gmail App Password**: Google Account → Security → 2-Step Verification → App passwords

### 2.3 Build và publish backend

```powershell
cd "c:\Dev Language\Works\3. PBL\PBL3\Website-to-support-people-in-need\src\ReliefConnect.API"

# Build release
dotnet publish -c Release -o ./publish --runtime linux-x64 --self-contained false

# Zip để upload
Compress-Archive -Path ./publish/* -DestinationPath ./publish.zip -Force

# Deploy lên Azure
az webapp deploy `
  --name $APPNAME `
  --resource-group $RG `
  --src-path ./publish.zip `
  --type zip
```

### 2.4 Kiểm tra backend

```powershell
# Health endpoint
Invoke-RestMethod "https://$APPNAME.azurewebsites.net/health"
# Kết quả mong đợi: { "status": "healthy", "timestamp": "..." }

# Xem logs realtime (nếu có vấn đề)
az webapp log tail --name $APPNAME --resource-group $RG
```

---

## Bước 3 — Deploy Frontend (Azure Static Web Apps)

### 3.1 Tạo Static Web App

```powershell
$STATIC = "reliefconnect-web"   # tên resource, không cần unique

az staticwebapp create `
  --name $STATIC `
  --resource-group $RG `
  --location "eastasia" `
  --sku Free
```

Sau khi tạo xong, lấy URL:

```powershell
az staticwebapp show `
  --name $STATIC `
  --resource-group $RG `
  --query "defaultHostname" -o tsv
# Ví dụ: happy-meadow-0abc123.azurestaticapps.net
```

### 3.2 Cập nhật CORS trên backend

Quay lại Bước 2.2, cập nhật `Frontend__Urls__0` với URL thực tế vừa lấy:

```powershell
az webapp config appsettings set `
  --name $APPNAME `
  --resource-group $RG `
  --settings "Frontend__Urls__0=https://happy-meadow-0abc123.azurestaticapps.net"
```

### 3.3 Build frontend

Tạo file `.env.production` trong thư mục `client/` với nội dung thực tế:

```env
VITE_API_URL=https://reliefconnect-api.azurewebsites.net/api
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

> **Bảo mật**: `.env.production` được gitignore. Không commit file này.

```powershell
cd "c:\Dev Language\Works\3. PBL\PBL3\Website-to-support-people-in-need\client"

pnpm install
pnpm build
# Output: dist/ folder
```

### 3.4 Deploy frontend

```powershell
# Lấy deployment token
$TOKEN = az staticwebapp secrets list `
  --name $STATIC `
  --resource-group $RG `
  --query "properties.apiKey" -o tsv

# Deploy bằng SWA CLI
npx @azure/static-web-apps-cli deploy ./dist `
  --deployment-token $TOKEN `
  --env production
```

### 3.5 Kiểm tra frontend

Mở trình duyệt: `https://happy-meadow-0abc123.azurestaticapps.net`

---

## Bước 4 — Cấu hình Google OAuth

Google OAuth cần biết redirect URI cho production. Vào [Google Cloud Console](https://console.cloud.google.com):

1. **APIs & Services** → **Credentials** → chọn OAuth 2.0 Client ID của bạn
2. Thêm vào **Authorized JavaScript origins**:
   ```
   https://happy-meadow-0abc123.azurestaticapps.net
   ```
3. Thêm vào **Authorized redirect URIs**:
   ```
   https://happy-meadow-0abc123.azurestaticapps.net
   https://reliefconnect-api.azurewebsites.net/signin-google
   ```
4. Nhấn **Save**

---

## Bước 5 — Cấu hình Supabase Storage (CORS)

Vào Supabase → **Storage** → **Policies** hoặc **Settings** → thêm origin production:

```
https://happy-meadow-0abc123.azurestaticapps.net
```

---

## Kiểm tra cuối cùng (Checklist)

```powershell
# 1. Backend health
Invoke-RestMethod "https://reliefconnect-api.azurewebsites.net/health"

# 2. Migrations đã áp dụng (chạy trong Supabase SQL Editor)
# SELECT COUNT(*) FROM "__EFMigrationsHistory";  -- phải là 10

# 3. API đăng ký hoạt động
$body = @{ username="test_$(Get-Random)"; email="test$(Get-Random)@test.com"; password="Test1234!"; fullName="Test User" } | ConvertTo-Json
Invoke-RestMethod "https://reliefconnect-api.azurewebsites.net/api/auth/register" -Method POST -Body $body -ContentType "application/json"
```

| Kiểm tra | Lệnh / Cách kiểm tra |
|---|---|
| ✅ Backend chạy | `GET /health` → `{ status: "healthy" }` |
| ✅ Frontend load | Mở URL Static Web App, trang landing hiển thị |
| ✅ Đăng nhập hoạt động | Login với tài khoản test |
| ✅ Bản đồ hiển thị | Vào `/map`, markers load |
| ✅ SOS realtime | Tạo SOS, kiểm tra SignalR thông báo |
| ✅ Chatbot hoạt động | Gửi tin nhắn trong chatbot |
| ✅ Email gửi được | Quên mật khẩu → nhận email |

---

## Các lệnh hữu ích sau khi deploy

```powershell
# Xem logs realtime
az webapp log tail --name reliefconnect-api --resource-group reliefconnect-rg

# Restart backend
az webapp restart --name reliefconnect-api --resource-group reliefconnect-rg

# Xem tất cả app settings hiện tại
az webapp config appsettings list --name reliefconnect-api --resource-group reliefconnect-rg

# Deploy lại sau khi có code mới
dotnet publish -c Release -o ./publish --runtime linux-x64 --self-contained false
Compress-Archive -Path ./publish/* -DestinationPath ./publish.zip -Force
az webapp deploy --name reliefconnect-api --resource-group reliefconnect-rg --src-path ./publish.zip --type zip

# Deploy lại frontend
pnpm build
npx @azure/static-web-apps-cli deploy ./dist --deployment-token $TOKEN --env production
```

---

## Workflow migration cho tương lai

Khi cần thêm entity hoặc thay đổi schema:

```powershell
# 1. Tạo migration mới (từ thư mục Infrastructure)
cd src/ReliefConnect.Infrastructure
dotnet ef migrations add TenMigration --startup-project ../ReliefConnect.API

# 2. Xem SQL sẽ chạy
dotnet ef migrations script --startup-project ../ReliefConnect.API --idempotent -o migration_new.sql

# 3. Chạy migration_new.sql trong Supabase SQL Editor
#    (vì dotnet ef database update không hoạt động với Supabase pooler)

# 4. Deploy lại backend (Bước 2.3)
```

---

## Xử lý sự cố thường gặp

| Lỗi | Nguyên nhân | Giải pháp |
|---|---|---|
| `Application Error` khi mở web | Thiếu env var | Xem logs: `az webapp log tail` |
| `InvalidOperationException: ConnectionStrings:DefaultConnection must be configured` | `ConnectionStrings__DefaultConnection` chưa set | Kiểm tra App Settings |
| `InvalidOperationException: Jwt:Key must be at least 256 bits` | `Jwt__Key` quá ngắn | Tạo key mới ≥ 32 ký tự |
| CORS error trên browser | `Frontend__Urls__0` chưa khớp với URL Static Web App | Cập nhật App Setting, restart |
| Google login không hoạt động | Authorized origins chưa có URL production | Cập nhật Google Cloud Console |
| Chatbot không phản hồi | `Gemini__ApiKey` sai hoặc hết quota | Kiểm tra key trên Google AI Studio |
| `dotnet ef database update` lỗi `ObjectDisposedException` | Supabase PgBouncer không tương thích | Dùng SQL Editor thay thế (xem Bước 1) |
