<p align="center">
  <img src="Icon/ReliefConnect.svg" alt="ReliefConnect Logo" width="120" />
</p>

<h1 align="center">ReliefConnect</h1>

<p align="center">
  <strong>Nền tảng kết nối cứu trợ — hỗ trợ những người có hoàn cảnh khó khăn</strong>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?logo=react" />
  <img alt=".NET" src="https://img.shields.io/badge/.NET-10-512bd4?logo=dotnet" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-PostGIS-336791?logo=postgresql" />
  <img alt="Azure" src="https://img.shields.io/badge/Azure-Deployed-0078d4?logo=microsoftazure" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## Giới thiệu

**ReliefConnect** là ứng dụng web hỗ trợ kết nối người cần cứu trợ với các tổ chức/cá nhân muốn giúp đỡ. Nền tảng hoạt động dựa trên **bản đồ thời gian thực**, cho phép người dùng gửi tín hiệu SOS, đăng thông tin cung cấp vật tư, và phối hợp cứu trợ trong các tình huống thiên tai, dịch bệnh hoặc hoàn cảnh khó khăn.

### Vai trò trong hệ thống

| Vai trò | Mô tả |
|---------|-------|
| **Người cần hỗ trợ** | Gửi SOS, cập nhật tình trạng, nhận hỗ trợ trực tiếp |
| **Nhà tài trợ** | Xác nhận hỗ trợ, đóng góp tài chính qua PayOS, theo dõi lịch sử |
| **Tình nguyện viên** | Nhận nhiệm vụ, phối hợp vận chuyển, cập nhật tiến trình |
| **Admin** | Quản lý người dùng, kiểm duyệt nội dung, xem thống kê hệ thống |

---

## Tính năng chính

### 🗺️ Bản đồ tương tác (Map-centric UI)
- Bản đồ Leaflet + OpenStreetMap làm giao diện chính
- Hiển thị **SOS pings**, điểm cung cấp vật tư, trạm hỗ trợ theo thời gian thực
- **Vùng nguy hiểm** (danger zones) hiển thị dưới dạng polygon trên bản đồ
- Spatial indexing với **PostGIS GIST index** cho truy vấn `ST_DWithin` tối ưu
- Caching thông minh: chỉ fetch API khi viewport mở rộng, merge kết quả với cache hiện tại

### 🔍 Tìm đường thông minh (Smart Routing)
- Tích hợp **OSRM (Open Source Routing Machine)** API cho tìm đường driving
- Thuật toán **Route Deviation Analysis** tự phát triển:
  - **Haversine Distance**: tính khoảng cách giữa 2 điểm trên mặt cầu
  - **Average Nearest Distance**: đo độ lệch trung bình giữa 2 tuyến đường bằng cách sampling N điểm
  - **Node Overlap Ratio**: so sánh tỷ lệ trùng lặp các node (đoạn đường) giữa tuyến chính và tuyến phụ
  - **Composite Scoring**: kết hợp deviation, overlap, distance penalty, duration penalty để xếp hạng
- **Fallback Alternative Generation**: khi OSRM trả về ít tuyến phụ, hệ thống tự tạo waypoint bằng cách dịch vuông góc từ midpoint của tuyến chính, sau đó query OSRM qua waypoint mới
- Chỉ hiển thị tuyến phụ khi **thực sự khác biệt** (< 70% overlap HOẶC > 0.5km deviation)

### 💬 Nhắn tin thời gian thực
- **SignalR WebSocket** cho direct messaging và SOS alerts
- Read receipts (blue ticks) với offline sync
- Local-first caching: messages được lưu trong Zustand store, sync khi reconnect
- Notification bell với real-time push qua `NotificationHub`

### 🤖 AI-Powered Features
- **Gemini AI Chatbot** hỗ trợ giải đáp thắc mắc về cứu trợ
- **Content Moderation** tự động kiểm duyệt bài viết bằng Gemini + regex patterns
- API key pool rotation cho load balancing Gemini requests

### 🔐 Authentication & Authorization
- **JWT + HttpOnly Cookie** dual auth mechanism
- **Google OAuth 2.0** đăng nhập nhanh
- **Authorization Bearer header** as primary auth (bypass third-party cookie blocking)
- Token blacklisting cho secure logout
- Email verification với 6-digit code
- KYC verification workflow (Guest → PersonInNeed / Sponsor / Volunteer)
- Role-based access control với custom `[Authorize]` policies

### 💰 Hệ thống quyên góp
- Tích hợp **PayOS** cho thanh toán QR code
- Webhook xác nhận giao dịch tự động
- Lịch sử quyên góp với leaderboard

### 🛡️ Admin Dashboard
- Thống kê tổng quan (users, SOS, posts, verifications)
- Quản lý người dùng, KYC approval/rejection
- Content moderation: hide comments, delete posts, xử lý reports
- System logs với audit trail
- CSV export cho reports
- Soft-delete với khả năng restore

### 🌍 Đa ngôn ngữ & Accessibility
- i18n: Tiếng Việt + English
- Dark/Light mode
- Responsive: desktop + mobile
- Glassmorphism UI design

---

## Kiến trúc hệ thống

```
┌─────────────────────────┐     ┌──────────────────────────┐
│      Frontend (SPA)     │     │     Backend (REST API)   │
│  React 19 + Vite 8      │◄───►│  ASP.NET Core 10         │
│  Zustand State Mgmt     │     │  Entity Framework Core   │
│  Leaflet Maps           │     │  Identity + JWT Auth     │
│  SignalR Client         │     │  SignalR Hubs            │
│  Axios + Bearer Auth    │     │  Hangfire Background     │
└─────────┬───────────────┘     └─────────┬────────────────┘
          │                               │
          │   Azure Static Web Apps       │   Azure App Service (B1)
          │   + Cloudflare CDN            │
          │                               │
          │                     ┌─────────▼────────────────┐
          │                     │   PostgreSQL + PostGIS   │
          │                     │   (Supabase)             │
          │                     └──────────────────────────┘
          │                               │
          │                     ┌─────────▼────────────────┐
          └─────────────────────│   Supabase Storage       │
                                │   (Image uploads)        │
                                └──────────────────────────┘
```

---

## Tech Stack

### Frontend
| Công nghệ | Version | Mục đích |
|-----------|---------|----------|
| React | 19.2 | UI framework |
| Vite | 8.x | Build tool |
| TypeScript | 5.9 | Type safety |
| Zustand | 5.x | State management |
| Leaflet | 1.9 | Interactive maps |
| Axios | 1.x | HTTP client |
| SignalR | 10.x | WebSocket real-time |
| React Router | 7.x | Client-side routing |
| TanStack Query | 5.x | Server state caching |

### Backend
| Công nghệ | Version | Mục đích |
|-----------|---------|----------|
| ASP.NET Core | 10.0 | Web API framework |
| Entity Framework Core | 10.0 | ORM |
| PostgreSQL + PostGIS | — | Database + spatial |
| Supabase | — | Hosting DB + Storage |
| SignalR | 10.0 | Real-time WebSocket hubs |
| Hangfire | 1.8 | Background job processing |
| Serilog | — | Structured logging |
| Google.Apis.Auth | — | OAuth token validation |

### Infrastructure
| Service | Mục đích |
|---------|----------|
| Azure Static Web Apps | Frontend hosting |
| Azure App Service (B1) | Backend hosting |
| Cloudflare | DNS + CDN + SSL |
| GitHub Actions | CI/CD pipeline |
| PayOS | Payment gateway |
| Gemini AI | Chatbot + Content moderation |

---

## Thuật toán nổi bật

### 1. Spatial Query Optimization (PostGIS)
Sử dụng **GIST spatial index** trên bảng `Pings` để tối ưu truy vấn bán kính:
```sql
CREATE INDEX ix_pings_location ON "Pings" USING GIST ("Location");
-- Query: ST_DWithin(location, point, radius_meters)
```
Cho phép tìm kiếm SOS trong bán kính với **O(log n)** thay vì O(n) full scan.

### 2. Route Deviation Scoring
Hệ thống scoring tự phát triển để đánh giá mức độ khác biệt giữa các tuyến đường:

```
Score = (1 - overlapPenalty) × 0.7
      + normalizedDeviation × 0.45
      - distancePenalty × 0.2
      - durationPenalty × 0.2
```

- **overlapPenalty**: tỷ lệ node trùng lặp (0.0 = hoàn toàn khác, 1.0 = giống hệt)
- **normalizedDeviation**: độ lệch trung bình giữa 2 tuyến / max deviation threshold
- **distancePenalty / durationPenalty**: phạt tuyến phụ đi xa hơn / lâu hơn tuyến chính

### 3. Viewport-based Ping Caching
Cache pings theo vùng đã fetch, mở rộng 50% buffer:
- Zoom in → viewport nằm trong cache → **không gọi API**
- Pan/zoom out → viewport vượt cache → fetch vùng mới → **merge** với cache cũ
- Tránh trường hợp zoom in xóa pings ngoài viewport

### 4. Fallback Route Generation
Khi OSRM chỉ trả về 1 tuyến:
1. Lấy N anchor points trên tuyến chính (28%, 50%, 72%)
2. Tính vector vuông góc tại mỗi anchor
3. Offset perpendicular 0.3–4.5km tạo waypoint mới
4. Query OSRM: `origin → waypoint → destination`
5. Dedup + scoring + filter → chọn tuyến phụ tốt nhất

### 5. Cross-origin Auth Strategy
Giải quyết vấn đề third-party cookie blocking:
- Primary: `Authorization: Bearer <JWT>` header (luôn hoạt động)
- Fallback: `auth_token` HttpOnly cookie (SameSite=None)
- SignalR: `access_token` query string cho WebSocket
- Token persist: `sessionStorage` (survive refresh, clear on tab close)

---

## Cấu trúc dự án

```
Website-to-support-people-in-need/
├── client/                          # Frontend (React SPA)
│   ├── public/                      # Static assets (icons, SWA config)
│   ├── src/
│   │   ├── components/              # UI components
│   │   │   ├── auth/                # Login, Register, OAuth
│   │   │   ├── layout/              # MapShell, Sidebar, MobileNav
│   │   │   ├── map/                 # MapView, PingDetail, SOSCreation
│   │   │   ├── panels/              # Chat, Social, Sponsor, Volunteer...
│   │   │   └── ui/                  # Modal, NotificationBell, Preview
│   │   ├── contexts/                # Theme, Language providers
│   │   ├── i18n/                    # vi.json, en.json
│   │   ├── pages/                   # Admin, Donate, Social, Wall...
│   │   ├── services/                # API client, SignalR, Supabase
│   │   ├── stores/                  # Zustand: auth, map, message, batch
│   │   └── styles/                  # CSS modules
│   └── index.html
│
├── src/                             # Backend (.NET)
│   ├── ReliefConnect.API/           # Web API layer
│   │   ├── Controllers/             # 17 controllers
│   │   ├── Hubs/                    # SignalR: DM, Notification, SOS
│   │   ├── Middleware/              # Exception handling, Rate limiting
│   │   ├── BackgroundServices/      # Token cleanup, Soft-delete, PingFlag
│   │   └── Program.cs              # App configuration
│   ├── ReliefConnect.Core/          # Domain: Entities, DTOs, Interfaces
│   └── ReliefConnect.Infrastructure/# Data: EF, Repos, Services
│
├── Icon/                            # Brand assets (SVG, ICO, PNG)
├── docs/                            # Deployment & configuration guides
└── .github/workflows/              # CI/CD pipelines
```

---

## Cài đặt & Chạy local

### Yêu cầu
- **Node.js** ≥ 22 + **pnpm** ≥ 10
- **.NET SDK** 10.0
- **PostgreSQL** 15+ với PostGIS extension

### Frontend
```bash
cd client
pnpm install
pnpm dev          # → http://localhost:5173
```

### Backend
```bash
cd src
dotnet restore
dotnet run --project ReliefConnect.API
# → https://localhost:5001
```

### Biến môi trường
Tạo `client/.env.local`:
```env
VITE_API_URL=https://localhost:5001/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Cấu hình backend trong `appsettings.Development.json` hoặc user-secrets.

---

## Deploy

Deploy được kích hoạt khi tạo **tag mới** trên nhánh `main`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

| Workflow | Trigger | Target |
|----------|---------|--------|
| `deploy-frontend.yml` | Tag `v*` | Azure Static Web Apps |
| `deploy-backend.yml` | Tag `v*` | Azure App Service |

Frontend workflow tự động tạo **GitHub Release** kèm release notes.

Chi tiết cấu hình: xem `docs/Configure_deploy.md`.

---

## Đóng góp

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m "feat: mô tả"`
4. Push: `git push origin feature/ten-tinh-nang`
5. Tạo Pull Request

---

## License

MIT License — xem [LICENSE](LICENSE) cho chi tiết.
