# 📘 User Guide — Hướng dẫn cài đặt & triển khai dự án

> **Dự án**: Relief Connection Support Platform  
> **Phiên bản**: 1.1  
> **Cập nhật**: 2026-03-02  
> **Đối tượng**: Developer (thành viên nhóm PBL3)

Tài liệu này hướng dẫn bạn thực hiện các bước mà **AI Agent không thể làm thay**, bao gồm: tạo account dịch vụ, lấy API key, setup database, cấu hình GitHub, và deploy.

---

## 📋 Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Tạo Supabase Project & Database](#2-tạo-supabase-project--database)
3. [Lấy Google Gemini API Key](#3-lấy-google-gemini-api-key)
4. [Cấu hình biến môi trường](#4-cấu-hình-biến-môi-trường)
5. [Chạy Database Migration](#5-chạy-database-migration)
6. [Chạy dự án cục bộ (Local)](#6-chạy-dự-án-cục-bộ-local)
7. [Cấu hình GitHub Repository](#7-cấu-hình-github-repository)
8. [Git Workflow cho nhóm](#8-git-workflow-cho-nhóm)
9. [Deploy lên Production](#9-deploy-lên-production)
10. [Troubleshooting & FAQ](#10-troubleshooting--faq)
11. [Trạng thái hiện tại của dự án](#11--trạng-thái-hiện-tại-của-dự-án-sprint-2)
12. [Bạn cần làm tiếp (Action Items)](#12--bạn-cần-làm-tiếp-action-items)

> 💡 **Bản đồ**: Dự án sử dụng **OpenStreetMap + Leaflet.js** — miễn phí, không cần API key.

---

## 1. Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy bạn đã cài đặt:

| Phần mềm | Phiên bản tối thiểu | Kiểm tra |
|-----------|---------------------|----------|
| **.NET SDK** | 8.0 trở lên | `dotnet --version` |
| **Node.js** | 18.x trở lên | `node --version` |
| **npm** | 9.x trở lên | `npm --version` |
| **Git** | 2.x trở lên | `git --version` |
| **Visual Studio Code** | Latest | — |
| **Trình duyệt** | Chrome/Edge/Firefox (mới nhất) | — |

### VS Code Extensions (Khuyến nghị)
- **C# Dev Kit** (Microsoft) — IntelliSense cho .NET
- **ESLint** — Lint cho TypeScript/React
- **Prettier** — Code formatter
- **GitLens** — Git history visualization
- **REST Client** hoặc **Thunder Client** — Test API

---

## 2. Tạo Supabase Project & Database

### 2.1 Tạo tài khoản Supabase

1. Truy cập [https://supabase.com](https://supabase.com)
2. Đăng ký bằng GitHub account
3. Click **"New Project"**

### 2.2 Tạo Project

Điền thông tin:

| Trường | Giá trị |
|--------|---------|
| **Name** | `relief-connect` |
| **Database Password** | Tạo một password mạnh (GHI NHỚ LẠI!) |
| **Region** | `Southeast Asia (Singapore)` — gần Việt Nam nhất |
| **Plan** | Free (đủ cho PBL3) |

> ⚠️ **QUAN TRỌNG**: Lưu lại Database Password ngay — bạn sẽ không thể xem lại sau!

### 2.3 Bật PostGIS Extension

Sau khi project được tạo:

1. Vào **Database** → **Extensions** (sidebar trái)
2. Tìm **`postgis`** trong thanh tìm kiếm
3. Click **Enable**
4. Đợi cho extension được kích hoạt (khoảng 10 giây)

> PostGIS là bắt buộc cho các chức năng bản đồ (REQ-MAP-01 → REQ-MAP-05). Nó cho phép lưu trữ và truy vấn dữ liệu không gian (spatial data) như tọa độ GPS, vùng ưu tiên (polygon), và tính khoảng cách.

### 2.4 Lấy Connection String

1. Vào **Project Settings** (icon bánh răng) → **Database**
2. Trong phần **Connection string**, chọn tab **URI**
3. Copy connection string, có dạng:
   ```
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
4. **Thay `[YOUR-PASSWORD]`** bằng database password bạn đã tạo ở bước 2.2

### 2.5 Cấu hình Supabase Storage (cho Upload ảnh)

1. Vào **Storage** (sidebar trái)
2. Click **"New Bucket"**
3. Tạo bucket với:
   - **Name**: `post-images`
   - **Public**: ✅ Bật (cho phép truy cập ảnh từ frontend)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp`
   - **File size limit**: `5MB` (theo SRS Section 4.2)
4. Tạo thêm 1 bucket:
   - **Name**: `avatars`
   - **Public**: ✅ Bật
   - **File size limit**: `2MB`

---

## 3. Lấy Google Gemini API Key

### 4.1 Truy cập Google AI Studio

1. Truy cập [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Đăng nhập bằng Google Account
3. Click **"Create API key"**
4. Chọn project `relief-connect-pbl3` (hoặc tạo mới)
5. **Copy API Key** — lưu lại an toàn

### 4.2 Kiểm tra API Key

Chạy lệnh sau trong terminal để test:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Xin chào, bạn là ai?"}]}]}'
```

Nếu nhận được response JSON chứa `candidates` → Key hoạt động tốt!

> 💰 **Gemini API Pricing**: Free tier cho 15 requests/phút, 1500 requests/ngày. Đủ cho PBL3.

---

## 5. Cấu hình biến môi trường

### 5.1 Backend — `appsettings.Development.json`

Mở file `src/ReliefConnect.API/appsettings.Development.json` và cập nhật:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=YOUR_SESSION_POOLER_HOST;Port=5432;Database=postgres;Username=postgres.YOUR_PROJECT_REF;Password=YOUR_DATABASE_PASSWORD;SSL Mode=Require;Trust Server Certificate=true;No Reset On Close=true"
  },
  "Jwt": {
    "Key": "TẠO_MỘT_CHUỖI_NGẪU_NHIÊN_ÍT_NHẤT_32_KÝ_TỰ_Ở_ĐÂY_!!!",
    "Issuer": "ReliefConnect",
    "Audience": "ReliefConnectClient",
    "ExpiryMinutes": 60
  },
  "Frontend": {
    "Urls": [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175"
    ]
  },
  "Gemini": {
    "ApiKey": "YOUR_GEMINI_API_KEY",
    "Model": "gemini-2.0-flash"
  }
}
```

> ℹ️ **CORS — Frontend:Urls**: Backend cho phép nhiều origin vì Vite có thể tự động tăng port (5173 → 5174 → 5175) nếu port đang bị chiếm. Nếu bạn dùng port khác, hãy thêm vào danh sách này.

### Cách tạo JWT Secret Key:
```bash
# PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# Hoặc dùng online: https://generate-random.org/api-key-generator
```

### 5.2 Frontend — `.env`

Tạo file `client/.env`:

```env
VITE_API_URL=http://localhost:5164/api
# Không cần API key cho bản đồ — OpenStreetMap miễn phí!
```

> ⚠️ **KHÔNG BAO GIỜ** commit file `.env` lên GitHub! Nó đã được thêm vào `.gitignore`.

### 5.3 Tạo file `.env.example` (cho teammates)

File này KHÔNG chứa giá trị thật, chỉ là template. Đã tạo sẵn, bạn chỉ cần đảm bảo nó tồn tại.

---

## 6. Chạy Database Migration

Sau khi đã cấu hình connection string ở bước 5:

### 6.1 Cài đặt EF Core Tools (nếu chưa có)

```bash
dotnet tool install --global dotnet-ef
```

> Nếu đã cài rồi, bạn có thể update bằng: `dotnet tool update --global dotnet-ef`

### 6.1.5 Cài đặt EF Core Design Package (BẮT BUỘC)

Package `Microsoft.EntityFrameworkCore.Design` **bắt buộc** phải có trong startup project (`ReliefConnect.API`) để `dotnet ef` hoạt động. Nếu thiếu, bạn sẽ gặp lỗi:

```
Your startup project 'ReliefConnect.API' doesn't reference Microsoft.EntityFrameworkCore.Design.
```

**Cách sửa**: Package này đã được thêm sẵn vào `.csproj`. Chỉ cần chạy:

```bash
cd src/ReliefConnect.API
dotnet restore
```

### 6.2 Tạo Migration (ĐÃ CÓ SẴN)

Migration đã được tạo sẵn trong `src/ReliefConnect.Infrastructure/Migrations/`. Nếu cần tạo lại:

```bash
cd src/ReliefConnect.API
dotnet ef migrations add InitialCreate --project ../ReliefConnect.Infrastructure
```

### 6.3 Áp dụng Migration vào Database

> ⚠️ **QUAN TRỌNG**: Do bug của Npgsql 10.x với Supabase PgBouncer pooler, lệnh `dotnet ef database update` 
> sẽ gặp lỗi `ObjectDisposedException`. Sử dụng **SQL Script** thay thế.

**Bước 1**: Export SQL script (đã có sẵn file `migration.sql` ở root project):

```bash
cd src/ReliefConnect.API
dotnet ef migrations script --project ../ReliefConnect.Infrastructure --idempotent --output ../../migration.sql
```

**Bước 2**: Chạy SQL trên Supabase Dashboard:

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Click **"New query"**
3. **Copy toàn bộ nội dung** file `migration.sql` và paste vào editor
4. Click **"Run"** (hoặc Ctrl+Enter)
5. Chờ script chạy xong — sẽ thấy "Success" ở kết quả

### 6.4 Kiểm tra

1. Quay lại Supabase Dashboard → **Table Editor**
2. Bạn sẽ thấy các bảng đã được tạo:
   - `AspNetUsers` (Identity User)
   - `AspNetRoles` (Identity Roles)
   - `Pings` (Map Items)
   - `PingFlags` (SOS Alerts)
   - `Zones` (Priority Zones)
   - `SupplyItems` (Supply Warehouses)
   - `Posts` (Social Posts)
   - `Comments`
   - `Reactions`
   - `Conversations` (Chatbot)
   - `Messages` (Chat Messages)
   - `Notifications`
   - `SystemLogs`

### 6.5 Tạo Admin User đầu tiên

Sau khi migration thành công, bạn cần tạo Admin account. Có 2 cách:

**Cách 1: Dùng SQL Editor trên Supabase**

Vào Supabase → **SQL Editor** → chạy:

```sql
-- Đầu tiên register một user qua API, rồi update role:
UPDATE "AspNetUsers"
SET "Role" = 9, "VerificationStatus" = 2
WHERE "Email" = 'admin@reliefconnect.vn';
```

**Cách 2: Tạo Seed Data** (AI Agent sẽ làm file seed cho bạn sau)

---

## 7. Chạy dự án cục bộ (Local)

### 7.1 Backend

```bash
cd src/ReliefConnect.API
dotnet run
```

Backend sẽ chạy tại: `http://localhost:5164`
Swagger UI: `http://localhost:5164/swagger`

### 7.2 Frontend

```bash
cd client
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173` (hoặc `5174`, `5175` nếu port 5173 đang bị chiếm)

> ⚠️ **Lưu ý**: Nếu Vite chạy trên port khác 5173, không cần lo — backend CORS đã hỗ trợ ports 5173-5175. Nếu dùng port khác, hãy thêm vào `Frontend:Urls` trong `appsettings.Development.json`.

### 7.3 Kiểm tra kết nối

1. Mở `http://localhost:5173` → Login page hiển thị
2. Mở `http://localhost:5164/swagger` → Swagger API docs hiển thị
3. Thử Register một user mới → Kiểm tra trong Supabase Table Editor

---

## 8. Cấu hình GitHub Repository

### 8.1 Khởi tạo Git (nếu chưa có)

```bash
cd "c:\Dev Language\Works\3. PBL\PBL3\Website-to-support-people-in-need"
git init
git add .
git commit -m "chore: initial project setup - Sprint 0 complete"
```

### 8.2 Tạo GitHub Repository

1. Truy cập [https://github.com/new](https://github.com/new)
2. Tạo repository:
   - **Name**: `Website-to-support-people-in-need`
   - **Visibility**: Public hoặc Private (tùy yêu cầu khoa)
   - **KHÔNG chọn** Initialize with README (đã có sẵn)

### 8.3 Kết nối & Push

```bash
git remote add origin https://github.com/YOUR_USERNAME/Website-to-support-people-in-need.git
git branch -M main
git push -u origin main
```

### 8.4 Mời thành viên nhóm

1. Vào repo → **Settings** → **Collaborators**
2. Click **"Add people"**
3. Thêm email/username của 3 thành viên còn lại
4. Quyền: **Write** (cho phép push và tạo PR)

### 8.5 Cấu hình Branch Protection (Khuyến nghị)

Vào **Settings** → **Branches** → **Add rule**:

| Tùy chọn | Giá trị |
|----------|---------|
| **Branch name pattern** | `main` |
| **Require a pull request** | ✅ |
| **Require approvals** | 1 |
| **Require status checks** | ✅ (khi đã có CI) |

---

## 9. Git Workflow cho nhóm

### 9.1 Branch Strategy

```
main                ← Production-ready code (merge chỉ qua PR)
├── develop         ← Integration branch
├── feature/auth    ← Feature branches
├── feature/map
├── feature/social
├── feature/chatbot
├── fix/bug-xxx     ← Bug fix branches
└── docs/xxx        ← Documentation branches
```

### 9.2 Commit Convention

Sử dụng **Conventional Commits**:

```
feat:     Tính năng mới           (feat: add login page)
fix:      Sửa bug                 (fix: resolve JWT expiry issue)
docs:     Documentation           (docs: update README setup guide)
style:    CSS/formatting          (style: update button colors)
refactor: Code refactoring        (refactor: extract auth service)
test:     Thêm/sửa tests         (test: add auth controller tests)
chore:    Build/config thay đổi   (chore: update .gitignore)
```

### 9.3 Quy trình làm việc

```bash
# 1. Tạo feature branch
git checkout develop
git pull origin develop
git checkout -b feature/map-markers

# 2. Code & commit
git add .
git commit -m "feat: implement map markers with custom icons"

# 3. Push & tạo PR
git push origin feature/map-markers
# → Tạo Pull Request trên GitHub: feature/map-markers → develop

# 4. Review & merge
# Ít nhất 1 thành viên review → Approve → Merge
```

---

## 10. Deploy lên Production

### 10.1 Backend — Deploy lên Azure / Railway / Render

**Option A: Railway (Đơn giản nhất)**

1. Truy cập [https://railway.app](https://railway.app)
2. Đăng nhập bằng GitHub
3. **New Project** → **Deploy from GitHub Repo**
4. Chọn repo, set build command:
   ```
   Root Directory: src/ReliefConnect.API
   Build: dotnet publish -c Release -o out
   Start: dotnet out/ReliefConnect.API.dll
   ```
5. Thêm Environment Variables (giống `appsettings.json`)
6. Deploy!

**Option B: Render (Free tier)**

1. Truy cập [https://render.com](https://render.com)
2. New → Web Service → Connect GitHub
3. Cấu hình tương tự

### 10.2 Frontend — Deploy lên Vercel / Netlify

**Option A: Vercel (Khuyến nghị cho React)**

1. Truy cập [https://vercel.com](https://vercel.com)
2. Import GitHub repository
3. Cấu hình:
   - **Framework**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**: Thêm `VITE_API_URL`
4. Deploy!

### 10.3 Supabase — Đã sẵn sàng

Supabase database đã chạy trên cloud, không cần deploy thêm. Chỉ cần đảm bảo connection string trong production environment trỏ đúng.

---

## 11. Troubleshooting & FAQ

### ❓ `dotnet ef` không tìm thấy
```bash
dotnet tool install --global dotnet-ef
# Restart terminal sau khi cài
```

### ❓ Lỗi "doesn't reference Microsoft.EntityFrameworkCore.Design"

Lỗi này xảy ra khi startup project thiếu package EF Core Design. **Đã được sửa** bằng cách thêm package vào `.csproj`. Chạy:
```bash
cd src/ReliefConnect.API
dotnet restore
```

### ❓ Lỗi kết nối Database — Connection String sai định dạng

Sai phổ biến: dán **cả URI string** từ Supabase vào trường `Username`.

**❌ SAI:**
```
Username=postgres.postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

**✅ ĐÚNG** — Chỉ lấy **project reference** (chuỗi sau `db.` và trước `.supabase.co`):
```
Username=postgres.cegpzxwttsykftmhwale
```

Cách tìm project ref:
1. Vào Supabase → **Project Settings** → **General**
2. Copy **Reference ID** (vd: `cegpzxwttsykftmhwale`)
3. Username = `postgres.` + Reference ID

### ❓ Lỗi SSL khi kết nối Supabase
Thêm vào connection string:
```
SSL Mode=Require;Trust Server Certificate=true
```

### ❓ CORS error khi Frontend gọi API
1. Kiểm tra `Frontend:Url` trong `appsettings` có đúng port không
2. Đảm bảo backend đang chạy trước khi frontend gọi API
3. Kiểm tra `UseCors("AllowFrontend")` đã có trong `Program.cs`

### ❓ Bản đồ không hiển thị

Bản đồ sử dụng **OpenStreetMap + Leaflet.js** — miễn phí, không cần API key.

1. **Kiểm tra kết nối mạng**: Tiles được tải từ `tile.openstreetmap.org`
2. **Kiểm tra Console (F12)** để xem lỗi JavaScript
3. **Dark theme**: Tiles dark dùng `basemaps.cartocdn.com` — nếu bị block, map sẽ hiện trắng
4. **Thử reload trang** — Leaflet cần container DOM đúng kích thước

### ❓ Gemini API trả về 429 (Too Many Requests)
- Free tier giới hạn 15 requests/phút
- Implement caching cho các câu hỏi thường gặp
- Thêm retry logic với exponential backoff

### ❓ Gemini Model sai tên
Đảm bảo trường `Gemini.Model` trong `appsettings.Development.json` là `"gemini-2.0-flash"`, **KHÔNG phải** `"gemini-3.0-flash"` (model này không tồn tại).

### ❓ Port đã bị chiếm (Address already in use)
```bash
# Windows - tìm process đang dùng port 5164:
netstat -ano | findstr :5164
# Kill process:
taskkill /PID <PID> /F
```

### ❓ Migration lỗi "relation already exists"
```bash
# Remove migration rồi tạo lại:
dotnet ef migrations remove --project ../ReliefConnect.Infrastructure
dotnet ef migrations add InitialCreate --project ../ReliefConnect.Infrastructure
dotnet ef database update --project ../ReliefConnect.Infrastructure
```

---

## 12. 📊 Trạng thái hiện tại của dự án (Sprint 2)

> **Cập nhật**: 2026-03-02 18:00

### ✅ Đã hoàn thành
| Module | Chi tiết |
|--------|----------|
| **Auth System** | Register, Login, JWT, Profile update, Role verification |
| **Map Backend** | PingController (CRUD + spatial), ZoneController (CRUD), SupplyController (CRUD) |
| **Map Frontend** | OpenStreetMap + Leaflet.js, custom SVG markers (4 types), SOS creation flow (3 bước), zone polygon rendering, filter bar + zone toggle |
| **SignalR** | SOSAlertHub cho real-time SOS blinking |
| **Design System** | Glassmorphism, dark/light theme, i18n (VI/EN), responsive |

### 🔄 Sprint 2 — Đang triển khai (~65%)
| Task | Status | Ghi chú |
|------|--------|---------|
| Marker clustering | ⬜ | Cần khi có >50 markers |
| Route display (polylines) | ⬜ | Backend endpoint sẵn, cần frontend polyline rendering |
| SOS blinking via SignalR | ⬜ | Hub sẵn, cần frontend listener |
| Radius slider filter | ⬜ | UI + re-fetch pings with radius param |
| A* Router algorithm | ⬜ | `AStarRouter.cs` |
| Priority Analyzer | ⬜ | `PriorityAnalyzer.cs` |
| SOS Monitor service | ⬜ | `SOSMonitorService.cs` (BackgroundService) |
| Unit tests | ⬜ | PingService, ZoneService tests |

---

## 13. 🚀 Bạn cần làm tiếp (Action Items)

### Ưu tiên CAO — Làm ngay

#### 1. ✅ Bản đồ OpenStreetMap
Bản đồ đã chuyển sang **OpenStreetMap + Leaflet.js** — miễn phí, không cần API key.
Chỉ cần kết nối internet là bản đồ sẽ hoạt động ngay.

#### 2. Chạy Database Migration
Nếu chưa chạy migration (mục 6 ở trên), chạy ngay để backend có database.

#### 3. Test toàn bộ flow
```bash
# Terminal 1 — Backend:
cd src/ReliefConnect.API
dotnet run

# Terminal 2 — Frontend:
cd client
npm run dev
```

Sau đó:
1. Mở `http://localhost:5173` → Bản đồ phải hiện (nếu đã sửa API key)
2. Register 1 account → Login → Map sẽ có mock data
3. Thử click filter chips (Cần giúp, Muốn cho, etc.)
4. Thử toggle "Vùng ưu tiên" (zones) 
5. Thử click floating SOS button (góc phải dưới)
6. Mở Swagger `http://localhost:5164/swagger` → Test các API

### Ưu tiên TRUNG BÌNH — Làm khi Sprint 2 tiếp tục

#### 4. Tạo dữ liệu test cho Zones
Backend chưa có seed data. Tạo vài zones qua Swagger hoặc SQL:

```sql
-- Ví dụ: Tạo vùng ưu tiên Đà Nẵng
INSERT INTO "Zones" ("Name", "BoundaryGeoJson", "RiskLevel", "CreatedAt")
VALUES (
  'Vùng lũ Hải Châu',
  '{"type":"Polygon","coordinates":[[[108.18,16.04],[108.24,16.04],[108.24,16.08],[108.18,16.08],[108.18,16.04]]]}',
  4,
  NOW()
);

-- Vùng ưu tiên Huế
INSERT INTO "Zones" ("Name", "BoundaryGeoJson", "RiskLevel", "CreatedAt")
VALUES (
  'Vùng ngập Thừa Thiên Huế',
  '{"type":"Polygon","coordinates":[[[107.55,16.43],[107.65,16.43],[107.65,16.50],[107.55,16.50],[107.55,16.43]]]}',
  3,
  NOW()
);
```

#### 5. Tạo SupplyItem test data
```sql
INSERT INTO "SupplyItems" ("Name", "Quantity", "Lat", "Lng", "CreatedAt")
VALUES 
  ('Kho gạo Đà Nẵng', 500, 16.06, 108.22, NOW()),
  ('Kho nước Huế', 1000, 16.46, 107.59, NOW());
```

### Ưu tiên THẤP — Chuẩn bị cho Sprint tiếp theo
- [ ] Push code lên GitHub (nếu chưa)
- [ ] Mời team members vào repo
- [ ] Review các API contracts trong Swagger

---

## 📞 Liên hệ hỗ trợ

| Vấn đề | Người phụ trách |
|--------|----------------|
| Architecture & Algorithm | Leader (Opus) |
| Backend API | Backend Dev (Sonnet) |
| Frontend UI | Frontend Dev (Gemini Pro) |
| Documentation | Research (Gemini Flash) |
| Supabase & Cloud | **Bạn (Manual Setup)** |
| GitHub & Git | **Bạn (Manual Setup)** |

---

> **Checklist nhanh — Bạn cần làm NGAY:**
> 
> - [x] **Bản đồ OpenStreetMap** — Đã chuyển từ Google Maps sang OpenStreetMap + Leaflet.js (miễn phí)
> - [ ] Tạo Supabase project + bật PostGIS (nếu chưa)
> - [ ] Chạy `migration.sql` trên Supabase SQL Editor (nếu chưa)
> - [ ] Test: `dotnet run` + `npm run dev` → mở `localhost:5173`
> - [ ] Tạo test data (Zones + SupplyItems) qua SQL Editor
> - [ ] Push code lên GitHub
