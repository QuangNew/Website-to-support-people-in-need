# Hướng dẫn Cập nhật Code cho Web đã Deploy — Chi tiết từng bước

**Last Updated:** 2026-04-24  
**Dành cho:** Người lần đầu cập nhật code lên production  
**Yêu cầu:** Đã deploy thành công theo [AZURE_DEPLOYMENT_GUIDE.md](AZURE_DEPLOYMENT_GUIDE.md)

---

## Mục lục

1. [Tổng quan quy trình](#tổng-quan-quy-trình)
2. [Cách 1 — Tự động qua CI/CD (Khuyến nghị)](#cách-1--tự-động-qua-cicd-khuyến-nghị)
3. [Cách 2 — Deploy thủ công bằng CLI](#cách-2--deploy-thủ-công-bằng-cli)
4. [Khi nào cần cập nhật Azure App Settings](#khi-nào-cần-cập-nhật-azure-app-settings)
5. [Khi nào cần chạy Database Migration](#khi-nào-cần-chạy-database-migration)
6. [Khi nào cần cập nhật GitHub Secrets/Variables](#khi-nào-cần-cập-nhật-github-secretsvariables)
7. [Quy trình đầy đủ từ A-Z (ví dụ thực tế)](#quy-trình-đầy-đủ-từ-a-z)
8. [Kiểm tra sau khi deploy](#kiểm-tra-sau-khi-deploy)
9. [Rollback — Quay về phiên bản cũ](#rollback--quay-về-phiên-bản-cũ)
10. [Xử lý sự cố](#xử-lý-sự-cố)
11. [Checklist nhanh](#checklist-nhanh)

---

## Tổng quan quy trình

Khi bạn thay đổi code và muốn cập nhật lên production, có **2 cách**:

```
Thay đổi code trên máy local
        │
        ├── Cách 1 (tự động): git push origin main
        │       │
        │       └── GitHub Actions tự build + deploy
        │               ├── client/** thay đổi → deploy frontend
        │               └── src/** thay đổi → deploy backend
        │
        └── Cách 2 (thủ công): Build local → az webapp deploy / swa deploy
```

**Khuyến nghị:** Dùng **Cách 1 (CI/CD)** vì an toàn hơn — có chạy test tự động trước khi deploy.

---

## Cách 1 — Tự động qua CI/CD (Khuyến nghị)

### Điều kiện tiên quyết (chỉ cần setup 1 lần)

Bạn cần đã hoàn thành:
- ✅ Push code lên GitHub (`git push origin main`)
- ✅ Thêm 2 secrets vào GitHub repo (xem [CICDWorkflow.md](CICDWorkflow.md) — Bước 2)
  - `AZURE_STATIC_WEB_APPS_API_TOKEN` — token deploy frontend
  - `AZURE_WEBAPP_PUBLISH_PROFILE` — profile deploy backend

> **Chưa setup CI/CD?** Xem chi tiết tại [CICDWorkflow.md](CICDWorkflow.md).

---

### Bước 1 — Sửa code trên máy local

Sửa code bình thường trong VS Code hoặc IDE bất kỳ. Ví dụ:
- Sửa bug frontend → thay đổi file trong `client/src/...`
- Thêm API endpoint → thay đổi file trong `src/...`
- Sửa cả hai → cả hai workflow sẽ chạy song song

### Bước 2 — Test local trước khi push

```powershell
# ── Test backend ──
cd "c:\Dev Language\Works\3. PBL\PBL3\Website-to-support-people-in-need\src"
dotnet build ReliefConnect.slnx -c Release
# Phải hiện: "Build succeeded. 0 Warning(s) 0 Error(s)"

dotnet test ReliefConnect.Tests/ReliefConnect.Tests.csproj -c Release
# Phải hiện: "Passed!" — nếu test fail, CI/CD cũng sẽ chặn deploy

# ── Test frontend ──
cd "c:\Dev Language\Works\3. PBL\PBL3\Website-to-support-people-in-need\client"
pnpm build
# Phải tạo thư mục dist/ không lỗi
```

> **Lưu ý:** Bước này không bắt buộc nhưng **rất khuyến nghị**. Nếu bạn push code lỗi build, workflow sẽ fail và không deploy — nhưng bạn phải chờ 2-5 phút mới biết kết quả.

### Bước 3 — Kiểm tra file nhạy cảm trước khi commit

```powershell
# Xem file nào đang staged
git diff --name-only --cached

# Tìm secrets trong staged files
git diff --cached | Select-String -Pattern "password|secret|apikey" -CaseSensitive:$false
```

**Danh sách file KHÔNG ĐƯỢC push:**

| File | Lý do |
|------|-------|
| `appsettings.Development.json` | Chứa DB password, JWT key |
| `client/.env.local` | Chứa override local |
| Bất kỳ file có `password=`, `ApiKey=` | Secrets nhúng thẳng |

> Nếu thấy file nhạy cảm trong staged → chạy `git reset HEAD <file>` để bỏ ra.

### Bước 4 — Commit và push

```powershell
cd "c:\Dev Language\Works\3. PBL\PBL3\Website-to-support-people-in-need"

# Stage các file đã thay đổi
git add .

# Hoặc stage từng file cụ thể (an toàn hơn)
git add client/src/stores/mapStore.ts
git add src/ReliefConnect.API/Controllers/MapController.cs

# Commit với message mô tả
git commit -m "fix: optimize map ping caching on zoom"

# Push lên main → CI/CD tự động chạy
git push origin main
```

### Bước 5 — Theo dõi tiến trình deploy

1. Mở trình duyệt → vào repo trên GitHub
2. Click tab **Actions** (thanh menu phía trên)
3. Bạn sẽ thấy 1 hoặc 2 workflow đang chạy (tuỳ file nào thay đổi):
   - **Deploy Frontend → Azure Static Web Apps** (nếu `client/**` thay đổi)
   - **Deploy Backend → Azure App Service** (nếu `src/**` thay đổi)
4. Click vào workflow đang chạy → xem từng bước
5. ✅ Xanh = thành công | ❌ Đỏ = thất bại

**Thời gian trung bình:**
- Frontend: ~2-3 phút
- Backend: ~3-5 phút

### Bước 5b — Deploy lại mà KHÔNG cần commit mới

Nếu workflow fail vì lý do tạm thời (Azure timeout, network issue) và bạn muốn thử lại:

1. Tab **Actions** → chọn workflow cần deploy lại
2. Nhấn **Run workflow** (nút bên phải)
3. Chọn branch `main` → nhấn **Run workflow**

> Cách này deploy lại đúng commit hiện tại mà không tạo commit rỗng.

---

## Cách 2 — Deploy thủ công bằng CLI

Dùng khi: CI/CD chưa setup, hoặc cần deploy nhanh mà không qua GitHub.

### Deploy Backend thủ công

```powershell
# ═══ Biến cần thiết ═══
$RG      = "reliefconnect-rg"
$APPNAME = "reliefconnect-api"

# ═══ Build ═══
cd "c:\Dev Language\Works\3. PBL\PBL3\Website-to-support-people-in-need\src\ReliefConnect.API"
dotnet publish -c Release -o ./publish --runtime linux-x64 --self-contained false

# ═══ Nén và deploy ═══
Compress-Archive -Path ./publish/* -DestinationPath ./publish.zip -Force
az webapp deploy --name $APPNAME --resource-group $RG --src-path ./publish.zip --type zip

# ═══ Dọn dẹp ═══
Remove-Item ./publish -Recurse -Force
Remove-Item ./publish.zip -Force
```

### Deploy Frontend thủ công

```powershell
# ═══ Biến cần thiết ═══
$RG     = "reliefconnect-rg"
$STATIC = "reliefconnect-web"

# ═══ Build ═══
cd "c:\Dev Language\Works\3. PBL\PBL3\Website-to-support-people-in-need\client"
pnpm install
pnpm build

# ═══ Lấy token và deploy ═══
$TOKEN = az staticwebapp secrets list `
  --name $STATIC --resource-group $RG `
  --query "properties.apiKey" -o tsv

swa deploy ./dist --deployment-token $TOKEN --env production
```

---

## Khi nào cần cập nhật Azure App Settings

Bạn chỉ cần cập nhật App Settings khi thay đổi code **thêm/sửa biến cấu hình**. Các trường hợp cụ thể:

| Thay đổi code | Cần cập nhật App Settings? | Hành động |
|---|---|---|
| Sửa bug logic, UI, CSS | ❌ Không | Chỉ cần push code |
| Thêm API endpoint mới (không dùng config mới) | ❌ Không | Chỉ cần push code |
| Thêm service mới cần API key (ví dụ: thêm Stripe) | ✅ Có | Thêm key vào App Settings |
| Đổi tên biến config trong code | ✅ Có | Đổi tên tương ứng trên Azure |
| Thay đổi CORS domain | ✅ Có | Cập nhật `Frontend__Urls__0` |

### Cách cập nhật App Settings

**Cách 1 — Azure Portal (trực quan):**

1. Vào [portal.azure.com](https://portal.azure.com)
2. Tìm App Service `reliefconnect-api`
3. Menu trái → **Settings** → **Environment variables**
4. Tab **App settings** → tìm biến cần sửa → click **Edit** → sửa → **OK**
5. Nhấn **Apply** ở trên → **Confirm**
6. App tự restart trong ~30 giây

**Cách 2 — Azure CLI:**

```powershell
# Thêm/sửa một biến
az webapp config appsettings set `
  --name reliefconnect-api `
  --resource-group reliefconnect-rg `
  --settings "TenBien=GiaTri"

# Ví dụ: thêm Stripe key
az webapp config appsettings set `
  --name reliefconnect-api `
  --resource-group reliefconnect-rg `
  --settings "Stripe__SecretKey=sk_live_xxxxx"

# Restart sau khi sửa (nếu muốn áp dụng ngay)
az webapp restart --name reliefconnect-api --resource-group reliefconnect-rg
```

---

## Khi nào cần chạy Database Migration

| Thay đổi code | Cần migration? | Hành động |
|---|---|---|
| Sửa logic Controller/Service | ❌ Không | Push code |
| Thêm property vào Entity class | ✅ Có | Tạo migration → chạy SQL |
| Thêm Entity/DbSet mới | ✅ Có | Tạo migration → chạy SQL |
| Thêm index hoặc thay đổi relationship | ✅ Có | Tạo migration → chạy SQL |

### Quy trình Migration

```powershell
# 1. Tạo migration mới
cd "c:\Dev Language\Works\3. PBL\PBL3\Website-to-support-people-in-need\src\ReliefConnect.Infrastructure"
dotnet ef migrations add TenMigration --startup-project ../ReliefConnect.API

# 2. Xuất SQL script
dotnet ef migrations script --startup-project ../ReliefConnect.API --idempotent -o migration_new.sql

# 3. Mở Supabase SQL Editor
#    → Paste nội dung file migration_new.sql
#    → Nhấn Run

# 4. Kiểm tra migration đã áp dụng
#    SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId" DESC LIMIT 5;

# 5. Push code (migration file) + deploy backend
git add .
git commit -m "feat: add new entity migration"
git push origin main
```

> **⚠️ QUAN TRỌNG:** Luôn chạy SQL migration trên Supabase **TRƯỚC** khi deploy backend mới. Nếu deploy backend trước khi schema sẵn sàng, app sẽ crash.

---

## Khi nào cần cập nhật GitHub Secrets/Variables

| Tình huống | Cần cập nhật? | Ở đâu |
|---|---|---|
| Thay đổi code bình thường | ❌ Không | — |
| Đổi API URL backend | ✅ Có | GitHub Variables → `VITE_API_URL` |
| Regenerate Azure deploy token | ✅ Có | GitHub Secrets → `AZURE_STATIC_WEB_APPS_API_TOKEN` |
| Download lại Publish Profile | ✅ Có | GitHub Secrets → `AZURE_WEBAPP_PUBLISH_PROFILE` |
| Đổi Supabase project | ✅ Có | Secrets → `VITE_SUPABASE_ANON_KEY`, Variables → `VITE_SUPABASE_URL` |

### Cách cập nhật Secrets/Variables

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Tab **Secrets** hoặc **Variables**
3. Tìm secret/variable cần sửa → click **Update** → paste giá trị mới → **Update secret**

> **Lưu ý:** Sau khi cập nhật secret/variable, bạn cần **trigger lại workflow** (push commit mới hoặc Run workflow thủ công) để giá trị mới có hiệu lực.

---

## Quy trình đầy đủ từ A-Z

### Ví dụ 1: Sửa bug giao diện frontend (đơn giản nhất)

```
1. Sửa file trong client/src/...
2. Test local: cd client && pnpm build
3. git add . && git commit -m "fix: button alignment" && git push origin main
4. GitHub Actions tự deploy frontend (~2 phút)
5. Mở web production → Ctrl+Shift+R (hard refresh) → kiểm tra
```

### Ví dụ 2: Thêm API endpoint mới (backend only)

```
1. Thêm endpoint trong src/ReliefConnect.API/Controllers/...
2. Test local: cd src && dotnet build ReliefConnect.slnx -c Release
3. git add . && git commit -m "feat: add donation stats API" && git push origin main
4. GitHub Actions tự build + test + deploy backend (~4 phút)
5. Test API: Invoke-RestMethod "https://reliefconnect-api.azurewebsites.net/api/new-endpoint"
```

### Ví dụ 3: Thay đổi database schema (phức tạp nhất)

```
1. Thêm property vào Entity class trong src/ReliefConnect.Domain/...
2. Tạo migration:
   cd src/ReliefConnect.Infrastructure
   dotnet ef migrations add AddNewColumn --startup-project ../ReliefConnect.API
3. Xuất SQL:
   dotnet ef migrations script --startup-project ../ReliefConnect.API --idempotent -o migration.sql
4. Chạy SQL trong Supabase SQL Editor → nhấn Run
5. git add . && git commit -m "feat: add new column" && git push origin main
6. GitHub Actions deploy backend mới (đã biết schema mới)
7. Kiểm tra app hoạt động bình thường
```

### Ví dụ 4: Thêm service cần API key mới (ví dụ: Stripe)

```
1. Code xong tính năng mới trong src/ và client/
2. Thêm App Setting mới trên Azure:
   az webapp config appsettings set --name reliefconnect-api --resource-group reliefconnect-rg `
     --settings "Stripe__SecretKey=sk_live_xxxxx"
3. Nếu frontend cần biến mới:
   - Thêm vào client/.env.production: VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxx
   - Thêm GitHub Variable: VITE_STRIPE_PUBLIC_KEY = pk_live_xxxxx
4. git add . && git commit -m "feat: add stripe payment" && git push origin main
5. Cả 2 workflow chạy song song → deploy xong trong ~5 phút
```

---

## Kiểm tra sau khi deploy

### Kiểm tra nhanh (30 giây)

```powershell
# Backend health
Invoke-RestMethod "https://reliefconnect-api.azurewebsites.net/health"
# Mong đợi: { status: "healthy" }

# Frontend — mở trình duyệt
Start-Process "https://hotrocuutro.site"
# Nhấn Ctrl+Shift+R để hard refresh (xoá cache cũ)
```

### Kiểm tra chi tiết

1. **F12 → Console**: Không có lỗi đỏ
2. **F12 → Network**: Các request `/api/...` trả về 200
3. **Thử tính năng vừa sửa**: Đảm bảo hoạt động đúng
4. **Thử tính năng khác**: Đảm bảo không bị ảnh hưởng

---

## Rollback — Quay về phiên bản cũ

### Cách 1 — Revert commit (khuyến nghị)

```powershell
# Xem lịch sử commit
git log --oneline -10

# Revert commit gần nhất
git revert HEAD --no-edit
git push origin main
# CI/CD tự deploy lại phiên bản trước
```

### Cách 2 — Deploy thủ công từ commit cũ

```powershell
# Checkout commit cũ
git log --oneline -10
# Chọn commit hash muốn quay về, ví dụ: abc1234

# Tạo branch tạm từ commit cũ
git checkout abc1234
# Build và deploy thủ công (xem Cách 2 ở trên)
# Sau khi xong, quay lại main
git checkout main
```

### Cách 3 — Redeploy từ GitHub Actions

1. Tab **Actions** → chọn workflow run **thành công gần nhất**
2. Click **Re-run all jobs** → deploy lại bản cũ

---

## Xử lý sự cố

### Workflow fail — "Test failed"

```
Nguyên nhân: Unit test không pass
Giải pháp:
  1. Xem log lỗi trong GitHub Actions → click bước "Run unit tests" bị đỏ
  2. Sửa test hoặc code trên local
  3. Chạy: dotnet test src/ReliefConnect.Tests -c Release
  4. Push lại khi test pass
```

### Workflow fail — "Publish profile is invalid"

```
Nguyên nhân: Publish profile hết hạn hoặc bị sai
Giải pháp:
  1. Azure Portal → App Service → Overview → Get publish profile (download lại)
  2. Mở file .PublishSettings bằng Notepad → copy toàn bộ nội dung XML
  3. GitHub → Settings → Secrets → AZURE_WEBAPP_PUBLISH_PROFILE → Update
  4. Run workflow lại
```

### Deploy thành công nhưng web không thay đổi

```
Nguyên nhân: Cache trình duyệt
Giải pháp:
  1. Nhấn Ctrl+Shift+R (hard refresh)
  2. Hoặc F12 → Network → check "Disable cache" → refresh
  3. Nếu vẫn không đổi → kiểm tra đúng URL production
```

### Backend trả về 500 Internal Server Error

```
Giải pháp:
  1. Xem logs: az webapp log tail --name reliefconnect-api --resource-group reliefconnect-rg
  2. Tìm dòng "Exception" hoặc "Error" trong log
  3. Thường do: thiếu App Setting, schema DB chưa cập nhật, hoặc code lỗi
```

---

## Checklist nhanh

### Trước khi push code

```
□ Build local thành công (backend + frontend)
□ Unit test pass
□ Không có file nhạy cảm trong staged files
□ Commit message mô tả rõ thay đổi
```

### Sau khi push code

```
□ GitHub Actions workflow chạy thành công (✅ xanh)
□ Health check backend OK
□ Frontend load không lỗi (F12 Console sạch)
□ Tính năng mới hoạt động đúng
□ Các tính năng cũ không bị ảnh hưởng
```

### Khi thay đổi phức tạp (database/config)

```
□ Migration SQL đã chạy trên Supabase TRƯỚC khi deploy
□ App Settings mới đã thêm trên Azure
□ GitHub Secrets/Variables đã cập nhật (nếu cần)
□ File .env.production đã cập nhật (nếu cần)
```
