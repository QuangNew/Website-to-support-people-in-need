# AI Agent Instructions for Relief Connection Support Platform

## 1. Project Context & Type
- **Project Name**: Relief Connection Support Platform (Website Hỗ trợ Kết nối Cứu trợ với những người có hoàn cảnh khó khăn)
- **Project Type**: Full-Stack Web Application (Backend-Heavy with interactive Map & Social features)
- **Team Config**: See `.agents/team/team-config.md` for agent team structure
- **Core Technologies**:
  - **Backend**: ASP.NET Core 8 (.NET 8) — Clean Architecture
  - **Frontend**: React 18 + TypeScript + Vite
  - **Database**: Supabase (PostgreSQL 15+ with PostGIS extension)
  - **ORM**: Entity Framework Core 8 + NetTopologySuite (for spatial queries)
  - **Real-time**: ASP.NET Core SignalR
  - **Auth**: ASP.NET Core Identity + JWT Bearer Tokens
  - **External APIs**: OpenStreetMap + Leaflet.js (Map), Google Gemini API (Chatbot)
  - **State Management**: Zustand + React Query (TanStack Query)

## 2. Architecture: Clean Architecture (Layered)

```
src/
├── ReliefConnect.Core/              # Domain Layer (NO dependencies)
│   ├── Entities/                    # Domain models (User, Ping, Post, etc.)
│   ├── Enums/                       # RoleEnum, SOS_Status, MapItemType
│   ├── Interfaces/                  # Repository & Service interfaces
│   ├── Algorithms/                  # A* routing, Priority Engine
│   └── DTOs/                        # Data Transfer Objects
│
├── ReliefConnect.Infrastructure/    # Infrastructure Layer
│   ├── Data/                        # AppDbContext, Configurations
│   ├── Repositories/                # Repository implementations
│   ├── Services/                    # External API services (Maps, Gemini)
│   └── Migrations/                  # EF Core migrations
│
├── ReliefConnect.API/               # Presentation Layer
│   ├── Controllers/                 # REST API controllers
│   ├── Hubs/                        # SignalR hubs
│   ├── Middleware/                   # Error handling, logging
│   ├── Filters/                     # Authorization filters
│   └── Program.cs                   # Entry point, DI configuration
│
└── ReliefConnect.Tests/             # Test Layer
    ├── Unit/                        # Unit tests
    └── Integration/                 # Integration tests

client/                              # Frontend (React + TypeScript)
├── src/
│   ├── components/                  # Reusable UI components
│   ├── pages/                       # Page-level components
│   ├── hooks/                       # Custom React hooks
│   ├── services/                    # API client (Axios)
│   ├── stores/                      # Zustand state stores
│   ├── types/                       # TypeScript type definitions
│   ├── styles/                      # CSS / design tokens
│   ├── utils/                       # Helper utilities
│   └── App.tsx                      # Root component with routing
```

## 3. Domain Models (from Class Diagram)

### Users & Roles
- **User** (ASP.NET Identity extended): UserID, Username, PasswordHash, FullName, Role (RoleEnum), VerificationStatus, CreatedAt
- **RoleEnum**: Guest=0, PersonInNeed=1, Sponsor=2, Volunteer=3, Admin=9

### Map System
- **Ping** (MapItem): ItemID, Coordinates_Lat, Coordinates_Long, Type (MapItemType), Status (SOS_Status), PriorityLevel, CreatedAt, UserID (FK)
- **PingFlag**: FlagID, PingID, isBlinking, UnconfirmedTimeMinutes
- **Zone**: ZoneID, Name, EncompassBoundary (Geography/PostGIS), RiskLevel
- **SupplyItem**: SupplyID, Name, Quantity, Coordinates_Lat, Coordinates_Long
- **MapItemType** enum: SOS, Supply, Shelter
- **SOS_Status** enum: Pending=0, InProgress=1, Resolved=2, Verified_Safe=3

### Social Network
- **Post**: PostID, Content, CategoryID, CreatedAt, AuthorID (FK→User), ImageURL
- **Comment**: CommentID, Content, CreatedAt, PostID (FK→Post), UserID (FK→User)
- **Tag** (Category): TagID, CategoryName, Description

### Communication
- **Notification**: NotificationID, Message, IsRead, CreatedAt, UserID (FK→User)

## 4. Role-Based Access Control (RBAC)

| Action | Guest (Unlogin) | Guest (Login) | PersonInNeed | Sponsor | Volunteer | Admin |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| View intro & map (read-only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register / Login | ✅ | — | — | — | — | — |
| Update Profile | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit KYC verification | — | ✅ | — | — | — | — |
| Post SOS on map | — | — | ✅ | — | — | — |
| Confirm Safety | — | — | ✅ | — | — | — |
| Post support offer on map | — | — | — | ✅ | — | — |
| Search & view SOS details | — | — | — | ✅ | ✅ | ✅ |
| Track donation history | — | — | — | ✅ | — | ✅ |
| View routes to SOS | — | — | — | — | ✅ | — |
| Accept & update tasks | — | — | — | — | ✅ | — |
| Post social content | — | — | ✅ | ✅ | ✅ | ✅ |
| Interact (Like, Comment) | — | — | ✅ | ✅ | ✅ | ✅ |
| View social feed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage users & roles | — | — | — | — | — | ✅ |
| Moderate content | — | — | — | — | — | ✅ |
| Manage Priority Zones | — | — | — | — | — | ✅ |
| View system logs & stats | — | — | — | — | — | ✅ |
| Chat with AI | — | ✅ | ✅ | ✅ | ✅ | ✅ |

## 5. API Endpoints Overview

### Auth (`/api/auth`)
- `POST /register` — Register new user
- `POST /login` — Login, returns JWT
- `PUT /profile` — Update profile
- `POST /verify-role` — Submit KYC verification request
- `GET /me` — Get current user info

### Map (`/api/map`)
- `GET /pings` — Get all map items (with spatial filter: lat, long, radius)
- `GET /pings/{id}` — Get ping details
- `POST /pings` — Create SOS/Supply pin (Verified users only)
- `PUT /pings/{id}/status` — Update status (Volunteer/Admin)
- `POST /pings/{id}/confirm-safe` — PersonInNeed confirms safety
- `GET /routes?from=lat,lng&to=lat,lng` — Removed (routing handled client-side via OSRM)
- `GET /zones` — Get all Priority Zones
- `POST /zones` — Create Priority Zone (Admin)
- `GET /supplies` — Get supply items

### Social (`/api/social`)
- `GET /posts?cursor=&limit=` — Get posts (lazy loading)
- `GET /posts/{id}` — Get post details
- `POST /posts` — Create post (with image upload)
- `POST /posts/{id}/reactions` — Add reaction
- `GET /posts/{id}/comments` — Get comments
- `POST /posts/{id}/comments` — Add comment
- `GET /users/{id}/wall` — Get user's posts (My Wall)

### Chatbot (`/api/chatbot`)
- `POST /conversations` — Start new conversation
- `POST /conversations/{id}/messages` — Send message, get AI response
- `GET /conversations/{id}/messages` — Get message history

### Admin (`/api/admin`)
- `GET /users` — List all users
- `PUT /users/{id}/role` — Approve/change user role
- `DELETE /posts/{id}` — Moderate (delete) a post
- `GET /logs` — View system logs
- `GET /stats` — View system statistics

## 6. Security Requirements (OWASP)
- ✅ **Password Hashing**: BCrypt via ASP.NET Core Identity (NEVER plain text)
- ✅ **SQL Injection**: Use Entity Framework Core parameterized queries ONLY
- ✅ **API Key Protection**: Gemini API key MUST be server-side only. Map uses OpenStreetMap (no key needed)
- ✅ **HTTPS**: Mandatory for all connections
- ✅ **JWT**: Short-lived access tokens + refresh token rotation
- ✅ **CORS**: Whitelist only `client` origin
- ✅ **Input Validation**: FluentValidation on all DTOs
- ✅ **File Upload**: Validate .jpg/.png/.jpeg only, max 5MB

## 7. Performance Requirements
- Map initial load: **≤ 3 seconds** on 4G
- SOS post creation: **≤ 3 steps** in UI
- SOS list query: **≤ 2 seconds** with 50 concurrent users
- Chatbot response: **< 5 seconds**
- Social feed: **Lazy loading** with cursor-based pagination
- Spatial queries: Use **PostGIS spatial index** on Ping coordinates

## 8. Real-time Features (SignalR)
- `SOSAlertHub`: Broadcast blinking SOS alert when user in Priority Zone has unconfirmed status >15 minutes
- `LocationHub`: Track volunteer real-time position
- `NotificationHub`: Push notifications for new SOS, reactions, comments

## 9. Development Rules
1. **TDD Mandatory**: Write test first, then implement
2. **No hardcoded values**: Use `appsettings.json` + environment variables
3. **Logging**: Serilog for structured logging on all critical actions
4. **Error handling**: Global exception middleware, never expose stack traces
5. **Git commits**: Atomic, meaningful messages following Conventional Commits
6. **Vietnamese primary language**: UI defaults to Vietnamese, design for i18n with .resx
