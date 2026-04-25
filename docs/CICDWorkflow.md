# CI/CD với GitHub Actions — Hướng dẫn chi tiết

Tài liệu này giải thích cách hai workflow CI/CD hoạt động, cách kích hoạt chúng, và cách bảo vệ thông tin nhạy cảm (secrets).

---

## 1. Tổng quan hai workflow

| File | Kích hoạt khi | Triển khai đến |
|------|---------------|----------------|
| `.github/workflows/deploy-frontend.yml` | Push vào `main` có thay đổi trong `client/**` hoặc **Run workflow** thủ công | Azure Static Web Apps |
| `.github/workflows/deploy-backend.yml`  | Push vào `main` có thay đổi trong `src/**` hoặc **Run workflow** thủ công | Azure App Service      |

Cả hai workflow đều chạy **tự động** sau khi bạn `git push origin main`, và bây giờ cũng có thể **redeploy thủ công** ngay trên tab **Actions** khi muốn upload lại cùng một commit mà không cần tạo commit mới.

---

## 2. Cách áp dụng — Các bước cần làm một lần

### Bước 1 — Push code lên GitHub

Nếu repo chưa có trên GitHub:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

Nếu đã có remote, chỉ cần:

```bash
git push origin main
```

Sau lần push đầu tiên, GitHub Actions sẽ tự nhận diện thư mục `.github/workflows/` và hiển thị hai workflow trong tab **Actions** của repo.

---

### Bước 2 — Thêm Secrets vào GitHub

Workflow cần hai secrets bắt buộc. Thiếu một trong hai thì bước deploy sẽ thất bại.

#### Cách mở trang thêm Secrets

1. Vào repo trên GitHub
2. Nhấn **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

---

#### Secret 1: `AZURE_STATIC_WEB_APPS_API_TOKEN`

Dùng để triển khai frontend lên Azure Static Web Apps.

**Lấy ở đâu:**
1. Mở [Azure Portal](https://portal.azure.com)
2. Tìm resource **Static Web Apps** của bạn (tên: `reliefconnect-web` — custom domain: `hotrocuutro.site`)
3. Nhấn **Manage deployment token** (hoặc **Overview → Deployment token**)
4. Copy toàn bộ chuỗi token

**Thêm vào GitHub:**
- Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
- Value: dán chuỗi token vừa copy

---

#### Secret 2: `AZURE_WEBAPP_PUBLISH_PROFILE`

Dùng để triển khai backend lên Azure App Service.

**Lấy ở đâu:**
1. Mở [Azure Portal](https://portal.azure.com)
2. Tìm resource **App Service** tên `reliefconnect-api`
3. Nhấn **Overview** → **Get publish profile** → tải file `.PublishSettings`
4. Mở file đó bằng Notepad/VSCode, **copy toàn bộ nội dung XML**

**Thêm vào GitHub:**
- Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
- Value: dán toàn bộ nội dung XML

---

### Bước 3 (tuỳ chọn) — Thêm Variables cho frontend

Workflow frontend đọc một số biến môi trường khi build (`VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_SUPABASE_URL`). Đây là **variables** (không phải secrets) vì chúng không nhạy cảm — chỉ là URL công khai.

**Cách thêm Variables:**
1. **Settings** → **Secrets and variables** → **Actions** → tab **Variables** → **New repository variable**
2. Thêm từng biến:

| Name | Ví dụ giá trị |
|------|----------------|
| `VITE_API_URL` | `https://reliefconnect-api.azurewebsites.net/api` |
| `VITE_GOOGLE_CLIENT_ID` | `123456789-abc.apps.googleusercontent.com` |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |

Riêng `VITE_SUPABASE_ANON_KEY` là **secret** (dù nó là "anon key" nhưng tốt hơn nên bảo vệ):
- Thêm vào **Secrets** (không phải Variables) với name `VITE_SUPABASE_ANON_KEY`

> **⚠️ Lưu ý quan trọng:** Nếu bạn set GitHub Variable `VITE_API_URL`, giá trị **PHẢI kết thúc bằng `/api`** (ví dụ: `https://reliefconnect-api.azurewebsites.net/api`). Nếu thiếu `/api`, frontend sẽ gọi sai endpoint (404 trên mọi request).
>
> Nếu bạn đã có file `client/.env.production` được commit vào repo với các giá trị đúng và **KHÔNG** set GitHub Variables, workflow sẽ dùng giá trị từ `.env.production`. Tuy nhiên, nếu bạn đã set GitHub Variable (dù sai giá trị), nó sẽ **ghi đè** lên `.env.production`.

---

### Bước 4 — Upload lại bản mới mà không cần push commit mới

Nếu Azure đang chạy sai bản, hoặc bạn chỉ muốn deploy lại đúng commit hiện tại:

1. Vào tab **Actions** của repo
2. Chọn workflow **Deploy Frontend → Azure Static Web Apps** hoặc **Deploy Backend → Azure App Service**
3. Nhấn **Run workflow**
4. Chọn branch `main`
5. Nhấn **Run workflow** lần nữa

Sau khi chạy xong, mở **Summary** của run để xem:

- commit nào vừa được upload
- workflow được kích hoạt bởi `push` hay `workflow_dispatch`
- backend URL đã deploy đến đâu
- nhắc nhanh cách redeploy lại nếu cần

---

## 3. Luồng hoạt động của từng workflow

### Frontend (`deploy-frontend.yml`)

```
git push main (có thay đổi trong client/)
        │
        ▼
GitHub Actions chạy trên ubuntu-latest
        │
        ├── Checkout code
        ├── Cài Node.js 22 + pnpm 10
        ├── pnpm install --frozen-lockfile  (cài đúng phiên bản trong pnpm-lock.yaml)
        ├── pnpm build                      (Vite build → client/dist/)
        │       └── Inject VITE_* vars từ GitHub Variables/Secrets
        │
        └── Azure/static-web-apps-deploy@v1
                └── Upload client/dist/ lên Azure SWA
                    (bỏ qua bước build của SWA vì đã build sẵn)
```

**PR Preview:** Khi bạn mở một Pull Request vào `main`, workflow cũng chạy và tạo một **staging URL** riêng để preview. Khi PR đóng, staging URL bị xoá tự động.

---

### Backend (`deploy-backend.yml`)

```
git push main (có thay đổi trong src/)
        │
        ▼
GitHub Actions chạy trên ubuntu-latest
        │
        ├── Checkout code
        ├── Cài .NET 10.0.x
        ├── dotnet restore     (tải NuGet packages)
        ├── dotnet build       (Release mode)
        ├── dotnet test        (chạy unit tests — thất bại thì dừng deploy)
        ├── dotnet publish     (linux-x64, output → ./publish/)
        │
        └── azure/webapps-deploy@v3
                └── Upload ./publish/ lên App Service reliefconnect-api
```

> **Quan trọng:** Unit tests chạy **trước** khi deploy. Nếu bất kỳ test nào fail, workflow dừng lại và **không** deploy lên Azure.

---

## 4. Bảo vệ thông tin mật — Nguyên tắc và cách làm

### Phân loại thông tin trong dự án này

| Loại | Ví dụ | Lưu ở đâu |
|------|-------|-----------|
| **Không nhạy cảm** | API URL, Google Client ID (public), Supabase URL | `appsettings.json`, `.env.production`, GitHub Variables |
| **Nhạy cảm — phát triển** | JWT key, DB connection string, SMTP password, PayOS keys, Gemini API key | `appsettings.Development.json` (gitignored) |
| **Nhạy cảm — production** | Tất cả trên, publish profile, deployment token | GitHub Secrets + Azure App Settings |

---

### Cách hoạt động của GitHub Secrets

- Secrets được **mã hoá** và chỉ được giải mã trong khi workflow đang chạy
- Secrets **không hiển thị** trong logs — GitHub tự động che `***`
- Secrets **không truyền** vào các PR từ fork bên ngoài (bảo vệ khỏi tấn công)
- Chỉ người có quyền **Admin** của repo mới xem/sửa được secrets

---

### Backend — cách ẩn secrets trên Azure

Secrets cho backend **không** nằm trong code hay workflow. Chúng được cấu hình trực tiếp trên Azure App Service dưới dạng **Environment Variables** (Azure gọi là *Application Settings*):

1. Azure Portal → App Service `reliefconnect-api`
2. **Settings** → **Environment variables** → **App settings**
3. Thêm từng biến:

```
ConnectionStrings__DefaultConnection  = Host=...;Port=5432;...
Jwt__Key                              = <256-bit-minimum-secret>
Smtp__Password                        = <app-password>
Google__ClientId                      = <google-oauth-client-id>
Frontend__Urls__0                     = https://<your-swa>.azurestaticapps.net
PayOS__ClientId                       = <payos-client-id>
PayOS__ApiKey                         = <payos-api-key>
PayOS__ChecksumKey                    = <payos-checksum-key>
```

Khi app khởi động, ASP.NET Core tự đọc các biến này — không cần secrets trong file nào cả.

---

### Frontend — quy tắc với file `.env`

| File | Commit? | Dùng cho |
|------|---------|---------|
| `.env` | Không | Dev local defaults |
| `.env.local` | **Không bao giờ** | Override local (gitignored) |
| `.env.production` | Được (nếu chỉ có URLs, không có secrets) | Build production |
| `.env.*.local` | **Không bao giờ** | Gitignored |

> **Lưu ý quan trọng:** Mọi biến `VITE_*` đều bị **nhúng vào bundle JS** và hiển thị công khai trong trình duyệt. **Không bao giờ** đặt private API keys, JWT secrets, hay mật khẩu vào biến `VITE_*`.

---

### File `.gitignore` — kiểm tra đã có chưa

Repo này nên có các dòng sau trong `.gitignore`:

```gitignore
# ASP.NET Core secrets
src/**/appsettings.Development.json
src/**/appsettings.*.json
!src/**/appsettings.json
!src/**/appsettings.Production.json

# Frontend env secrets
client/.env.local
client/.env.*.local
```

---

## 5. Kiểm tra workflow sau khi setup

Sau khi thêm secrets xong:

1. **Commit và push** bất kỳ thay đổi nhỏ nào vào `main`
2. Vào tab **Actions** trên GitHub repo
3. Xem workflow đang chạy — click vào để xem từng bước
4. Nếu thành công: cột bên trái hiển thị dấu ✅ xanh
5. Mở tab **Summary** của workflow run để xem commit nào vừa được upload
6. Nếu thất bại: click vào bước bị đỏ để xem log lỗi

### Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|---------|
| `Resource not found` ở bước deploy SWA | Token sai hoặc tên resource sai | Kiểm tra lại `AZURE_STATIC_WEB_APPS_API_TOKEN` |
| `Publish profile is invalid` | XML publish profile bị cắt hoặc sai | Download lại file `.PublishSettings` từ Azure, copy toàn bộ |
| `Test failed` | Unit test bị fail | Sửa test trước khi push |
| `pnpm: command not found` | pnpm chưa được cài | Workflow đã có bước `pnpm/action-setup@v4` — kiểm tra version |
| `dotnet: Unable to find project` | Path project sai | Kiểm tra biến `API_PROJECT` trong `deploy-backend.yml` |

---

## 6. Sơ đồ tổng hợp

```
Lập trình viên
      │
      │  git push origin main
      ▼
  GitHub Repo
      │
      ├─── client/ thay đổi ──▶ deploy-frontend.yml
      │                               │
      │                          Build React (Vite)
      │                               │
      │                          Upload dist/ ──▶ Azure Static Web Apps
      │                                              (hotrocuutro.site)
      │
      └─── src/ thay đổi ──────▶ deploy-backend.yml
                                        │
                                   Build + Test .NET
                                        │
                                   Publish linux-x64 ──▶ Azure App Service
                                                           (reliefconnect-api)
```

---

## 7. Bảo mật nâng cao — Hướng dẫn chi tiết để không lộ secrets

> Phần này dành cho người **lần đầu làm CI/CD** và muốn hiểu rõ cơ chế để tránh sai lầm phổ biến.

---

### 7.1 Hiểu rõ 3 khái niệm: Secret vs Variable vs Env Var

#### Secret (Bí mật)
- Là thông tin mà nếu bị lộ, kẻ tấn công có thể dùng ngay: **mật khẩu, API key, JWT key, token**
- GitHub Secrets được **mã hoá** — kể cả admin cũng không đọc lại được sau khi lưu
- Trong workflow log, mọi secret tự động bị che: `***`
- **Ví dụ trong dự án này:** `AZURE_WEBAPP_PUBLISH_PROFILE`, `AZURE_STATIC_WEB_APPS_API_TOKEN`, `SMTP__PASSWORD`, `JWT__KEY`

#### Variable (Biến)
- Là thông tin **không nhạy cảm**, chỉ là cấu hình như URL hay tên resource
- Có thể hiển thị trong log — không bị che
- **Ví dụ trong dự án này:** `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_SUPABASE_URL`

#### Environment Variable (Biến môi trường)
- Chỉ là cách _nạp_ cấu hình vào ứng dụng khi chạy — có thể chứa secret hoặc không
- Trên Azure App Service, đây là "Application Settings" (bảo mật hơn vì chỉ App Service đọc được)
- Trên máy local, đây là file `.env` hay `appsettings.Development.json`

---

### 7.2 Checklist trước mỗi lần `git push` (bắt buộc)

Trước khi `git push`, chạy lệnh sau để xem file nào đang được staged:

```bash
git diff --name-only --cached
```

Nếu bạn thấy bất kỳ file nào trong danh sách cấm dưới đây — **dừng lại ngay**, đừng push:

| File cấm push | Lý do |
|---------------|-------|
| `appsettings.Development.json` | Chứa DB connection string, JWT key thật |
| `appsettings.*.json` (ngoại trừ `appsettings.json`) | Tương tự |
| `client/.env.local` | Chứa override biến môi trường local |
| `client/.env.*.local` | Tương tự |
| `.env` (nếu chứa secrets) | Biến môi trường thật |
| `*.pfx`, `*.p12` | Certificate |
| `*.pem` (private key) | Private key SSL |
| Bất kỳ file nào có chứa `password=`, `ApiKey=`, `secret=` | Secrets nhúng thẳng |

**Cách kiểm tra nhanh toàn bộ nội dung staged:**

```bash
git diff --cached
```

Đọc kỹ output — tìm các từ khoá nguy hiểm: `password`, `secret`, `apikey`, `token`, `connectionstring`.

---

### 7.3 Tại sao `VITE_*` không bao giờ được chứa secret

Khi Vite build frontend, nó **nhúng cứng** (inline) tất cả biến `VITE_*` vào file JavaScript:

```javascript
// Sau khi build, trong file dist/assets/index-abc123.js:
const API_KEY = "sk-xxxxxxxxxxxxxxxx";  // ← bất kỳ ai cũng đọc được bằng DevTools
```

Nghĩa là: **bất kỳ ai mở DevTools → Sources trong trình duyệt đều có thể đọc giá trị này.**

**Quy tắc:**
- ✅ `VITE_API_URL=https://reliefconnect-api.azurewebsites.net/api` — OK (URL công khai, **phải có `/api`**)
- ✅ `VITE_GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com` — OK (public OAuth client ID)
- ✅ `VITE_SUPABASE_URL=https://xxx.supabase.co` — OK (URL công khai)
- ✅ `VITE_SUPABASE_ANON_KEY=eyJ...` — Chấp nhận được (anon key có Row Level Security)
- ❌ `VITE_GEMINI_API_KEY=AIzaSy...` — **TUYỆT ĐỐI KHÔNG** (Gemini key tính tiền của bạn)
- ❌ `VITE_JWT_SECRET=mySecret` — **TUYỆT ĐỐI KHÔNG**
- ❌ `VITE_DB_PASSWORD=...` — **TUYỆT ĐỐI KHÔNG**

---

### 7.4 Phân biệt 3 cấp độ Secrets trên GitHub

| Loại | Phạm vi | Dùng khi |
|------|---------|---------|
| **Repository secret** | Chỉ trong một repo | Dự án đơn lẻ — đây là cách chúng ta dùng |
| **Environment secret** | Trong một môi trường cụ thể (staging, production) | Muốn phân tách secrets theo môi trường, yêu cầu approval trước khi deploy |
| **Organization secret** | Toàn bộ các repo trong organization | Nhiều repo dùng chung một secret (vd: shared deploy token) |

**Với dự án này:** Repository secrets là đủ. Nếu sau này muốn thêm môi trường staging riêng, bạn có thể chuyển sang Environment secrets.

---

### 7.5 Phát hiện nếu đã lỡ commit secret

#### Cách 1: Kiểm tra bằng git log

```bash
# Xem tất cả commits gần đây có thay đổi file nhạy cảm
git log --all --full-history -- "*/appsettings.Development.json"

# Xem nội dung của một commit cụ thể
git show <commit-hash>:src/ReliefConnect.API/appsettings.Development.json
```

#### Cách 2: Tìm secrets trong toàn bộ git history

```bash
# Tìm chuỗi nguy hiểm trong mọi commit
git log --all -p | grep -i "password\|apikey\|secret\|connectionstring"
```

#### Cách 3: GitHub Secret Scanning (tự động)

GitHub tự động quét mọi commit trong repo public (và cả private nếu bật) để tìm các pattern đã biết của secrets (AWS keys, Google API keys, GitHub tokens, v.v.):

1. Vào repo → **Settings** → **Code security and analysis**
2. Tìm mục **Secret scanning** → Enable
3. GitHub sẽ gửi **email cảnh báo** nếu phát hiện secret bị commit

> Đây là tính năng miễn phí — **nên bật ngay**.

---

### 7.6 Làm gì nếu đã lỡ push secret lên GitHub

> **Nguyên tắc vàng:** Một secret đã bị push lên Git (dù chỉ 1 giây) phải được coi là **đã bị lộ hoàn toàn**. Xoá commit không đủ — GitHub lưu lịch sử, và bot crawl GitHub 24/7.

**Thứ tự hành động (làm ngay, không trì hoãn):**

#### Bước 1: Rotate (thay mới) secret ngay lập tức

| Secret bị lộ | Cách rotate |
|--------------|-------------|
| **JWT Key** | Đổi sang key mới trong Azure App Settings → tất cả user bị logout (chấp nhận được) |
| **SMTP Password** | Đăng nhập Gmail/Outlook → My Account → Security → App passwords → Revoke và tạo mới |
| **Gemini API Key** | [console.cloud.google.com](https://console.cloud.google.com) → API & Services → Credentials → Delete key cũ, tạo key mới |
| **DB Connection String / Password** | Supabase dashboard → Settings → Database → Reset password |
| **Azure Publish Profile** | Azure Portal → App Service → Get publish profile (download lại = tự động invalidate cái cũ) |
| **Azure SWA Token** | Azure Portal → Static Web Apps → Manage deployment token → Regenerate |
| **Google OAuth Client Secret** | [console.cloud.google.com](https://console.cloud.google.com) → APIs → Credentials → Reset client secret |

#### Bước 2: Cập nhật secret mới vào GitHub Secrets và Azure App Settings

#### Bước 3: Xoá secret khỏi git history (tùy chọn — làm sau khi rotate)

```bash
# Dùng git filter-repo (cài: pip install git-filter-repo)
git filter-repo --path src/ReliefConnect.API/appsettings.Development.json --invert-paths

# Force push (cảnh báo: sẽ rewrite history)
git push origin --force --all
```

> Sau khi rewrite history, cần **thông báo cho tất cả collaborator** để họ re-clone repo. Vì thế bước rotate secret (Bước 1) quan trọng hơn nhiều — làm ngay không cần chờ.

---

### 7.7 Luồng làm việc local đúng cách

```
Dev máy local
    │
    ├── appsettings.json          ← commit OK (chỉ có placeholder)
    ├── appsettings.Development.json  ← GITIGNORED (chứa secrets thật)
    └── client/.env.local         ← GITIGNORED (override vars local)
```

**`appsettings.Development.json`** (không commit):
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=db.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=REAL_PASSWORD_HERE"
  },
  "Jwt": { "Key": "real-256-bit-key-here..." },
  "Gemini": { "ApiKey": "AIzaSy-REAL-KEY" },
  "Smtp": { "Password": "real-smtp-app-password" }
}
```

**`client/.env.local`** (không commit):
```bash
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Kiểm tra `.gitignore` đã có các dòng cần thiết:**
```bash
grep -n "Development\|env.local" .gitignore
```

Nếu không thấy output — thêm ngay vào `.gitignore`.

---

### 7.8 Xác nhận `.gitignore` hoạt động đúng

Sau khi tạo/sửa `.gitignore`, kiểm tra file có thực sự bị ignore chưa:

```bash
# Kiểm tra một file cụ thể
git check-ignore -v src/ReliefConnect.API/appsettings.Development.json

# Output mong muốn:
# .gitignore:5:appsettings.Development.json   src/ReliefConnect.API/appsettings.Development.json
```

Nếu không có output → file **chưa bị ignore** → thêm dòng vào `.gitignore` ngay.

> **Lưu ý:** Nếu file đã được track bởi git trước đó (đã commit rồi), `.gitignore` sẽ không có tác dụng. Phải dùng:
> ```bash
> git rm --cached src/ReliefConnect.API/appsettings.Development.json
> git commit -m "stop tracking secrets file"
> ```

---

### 7.9 Tóm tắt nhanh — Quy tắc vàng

| Quy tắc | Ghi nhớ |
|---------|---------|
| Secrets không bao giờ ở trong code | Dùng env vars / App Settings |
| `VITE_*` là public | Chỉ chứa URLs và public IDs |
| Gitignore trước, code sau | Tạo `.gitignore` trước khi tạo secrets file |
| Lộ secret → rotate ngay | Không cần hoàn hảo, cần nhanh |
| Bật Secret Scanning trên GitHub | Phát hiện sớm, miễn phí |
| Kiểm tra `git diff --cached` trước mỗi push | 10 giây, tránh hối hận |
