<p align="center">
  <img src="Icon/ReliefConnect.svg" alt="ReliefConnect Logo" width="120" />
</p>

<h1 align="center">ReliefConnect</h1>

<p align="center">
  <strong>A relief connection platform — supporting people in need</strong>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?logo=react" />
  <img alt=".NET" src="https://img.shields.io/badge/.NET-10-512bd4?logo=dotnet" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-PostGIS-336791?logo=postgresql" />
  <img alt="Azure" src="https://img.shields.io/badge/Azure-Deployed-0078d4?logo=microsoftazure" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## Introduction

**ReliefConnect** is a web application that connects people in need with organizations and individuals who want to help. The platform operates on a **real-time interactive map**, allowing users to send SOS signals, post supply information, and coordinate relief efforts during natural disasters, epidemics, or difficult circumstances.

### System Roles

| Role | Description |
|------|-------------|
| **Person in Need** | Send SOS requests, update status, receive direct support |
| **Sponsor** | Confirm support, donate via PayOS, track history |
| **Volunteer** | Accept tasks, coordinate transportation, update progress |
| **Admin** | Manage users, moderate content, view system statistics |

---

## Key Features

### 🗺️ Interactive Map (Map-centric UI)
- Leaflet + OpenStreetMap as the primary interface
- Real-time display of **SOS pings**, supply points, and support stations
- **Danger zones** displayed as polygons on the map
- Spatial indexing with **PostGIS GIST index** for optimized `ST_DWithin` queries
- Smart caching: only fetch API when viewport expands, merge results with existing cache

### 🔍 Smart Routing
- Integrated **OSRM (Open Source Routing Machine)** API for driving directions
- Custom-built **Route Deviation Analysis** algorithm:
  - **Haversine Distance**: calculates distance between 2 points on a sphere
  - **Average Nearest Distance**: measures average deviation between 2 routes by sampling N points
  - **Node Overlap Ratio**: compares road segment overlap between primary and alternative routes
  - **Composite Scoring**: combines deviation, overlap, distance penalty, duration penalty for ranking
- **Fallback Alternative Generation**: when OSRM returns few alternatives, the system generates waypoints by perpendicular offset from the primary route midpoints, then queries OSRM via new waypoints
- Only displays alternatives when **genuinely different** (< 70% overlap OR > 0.5km deviation)

### 💬 Real-time Messaging
- **SignalR WebSocket** for direct messaging and SOS alerts
- Read receipts (blue ticks) with offline sync
- Local-first caching: messages stored in Zustand store, synced on reconnect
- Notification bell with real-time push via `NotificationHub`

### 🤖 AI-Powered Features
- **Gemini AI Chatbot** for relief information assistance
- **Content Moderation** with Gemini + regex pattern matching
- API key pool rotation for load balancing Gemini requests

### 🔐 Authentication & Authorization
- **JWT + HttpOnly Cookie** dual auth mechanism
- **Google OAuth 2.0** quick login
- **Authorization Bearer header** as primary auth (bypasses third-party cookie blocking)
- Token blacklisting for secure logout
- Email verification with 6-digit code
- KYC verification workflow (Guest → PersonInNeed / Sponsor / Volunteer)
- Role-based access control with custom `[Authorize]` policies

### 💰 Donation System
- Integrated **PayOS** for QR code payments
- Automatic webhook transaction confirmation
- Donation history with leaderboard

### 🛡️ Admin Dashboard
- Overview statistics (users, SOS, posts, verifications)
- User management, KYC approval/rejection
- Content moderation: hide comments, delete posts, handle reports
- System logs with audit trail
- CSV export for reports
- Soft-delete with restore capability

### 🌍 Multilingual & Accessibility
- i18n: Vietnamese + English
- Dark/Light mode
- Responsive: desktop + mobile
- Glassmorphism UI design

---

## System Architecture

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
| Technology | Version | Purpose |
|-----------|---------|---------|
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
| Technology | Version | Purpose |
|-----------|---------|---------|
| ASP.NET Core | 10.0 | Web API framework |
| Entity Framework Core | 10.0 | ORM |
| PostgreSQL + PostGIS | — | Database + spatial |
| Supabase | — | Hosting DB + Storage |
| SignalR | 10.0 | Real-time WebSocket hubs |
| Hangfire | 1.8 | Background job processing |
| Serilog | — | Structured logging |
| Google.Apis.Auth | — | OAuth token validation |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Azure Static Web Apps | Frontend hosting |
| Azure App Service (B1) | Backend hosting |
| Cloudflare | DNS + CDN + SSL |
| GitHub Actions | CI/CD pipeline |
| PayOS | Payment gateway |
| Gemini AI | Chatbot + Content moderation |

---

## Notable Algorithms

### 1. Spatial Query Optimization (PostGIS)
Uses **GIST spatial index** on the `Pings` table for radius-based queries:
```sql
CREATE INDEX ix_pings_location ON "Pings" USING GIST ("Location");
-- Query: ST_DWithin(location, point, radius_meters)
```
Enables SOS searches within a radius at **O(log n)** instead of O(n) full scan.

### 2. Route Deviation Scoring
Custom-built scoring system to evaluate route distinctiveness:

```
Score = (1 - overlapPenalty) × 0.7
      + normalizedDeviation × 0.45
      - distancePenalty × 0.2
      - durationPenalty × 0.2
```

- **overlapPenalty**: ratio of shared road nodes (0.0 = completely different, 1.0 = identical)
- **normalizedDeviation**: average spatial deviation / max deviation threshold
- **distancePenalty / durationPenalty**: penalizes alternatives that are longer / slower

### 3. Viewport-based Ping Caching
Caches pings by previously fetched region, expanding 50% buffer:
- Zoom in → viewport inside cache → **no API call**
- Pan/zoom out → viewport exceeds cache → fetch new region → **merge** with existing cache
- Prevents pings outside viewport from being deleted on zoom-in

### 4. Fallback Route Generation
When OSRM returns only 1 route:
1. Sample N anchor points on the primary route (28%, 50%, 72%)
2. Compute perpendicular vector at each anchor
3. Offset perpendicular 0.3–4.5km to create new waypoints
4. Query OSRM: `origin → waypoint → destination`
5. Dedup + scoring + filter → select best alternative

### 5. Cross-origin Auth Strategy
Solves third-party cookie blocking:
- Primary: `Authorization: Bearer <JWT>` header (always works)
- Fallback: `auth_token` HttpOnly cookie (SameSite=None)
- SignalR: `access_token` query string for WebSocket
- Token persistence: `sessionStorage` (survives refresh, clears on tab close)

---

## Project Structure

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

## Installation & Local Development

### Requirements
- **Node.js** ≥ 22 + **pnpm** ≥ 10
- **.NET SDK** 10.0
- **PostgreSQL** 15+ with PostGIS extension

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

### Environment Variables
Create `client/.env.local`:
```env
VITE_API_URL=https://localhost:5001/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Configure backend in `appsettings.Development.json` or user-secrets.

---

## Deployment

Deployment is triggered when creating a **new tag** on the `main` branch:

```bash
git tag v1.0.0
git push origin v1.0.0
```

| Workflow | Trigger | Target |
|----------|---------|--------|
| `deploy-frontend.yml` | Tag `v*` | Azure Static Web Apps |
| `deploy-backend.yml` | Tag `v*` | Azure App Service |

Frontend workflow automatically creates a **GitHub Release** with release notes.

See `docs/Configure_deploy.md` for detailed configuration.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/feature-name`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feature/feature-name`
5. Create a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.