# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReliefConnect is a full-stack web application connecting relief aid to people in need. Built with:
- **Backend**: ASP.NET Core 10.0 (C#) with Clean Architecture
- **Frontend**: React 19 + TypeScript + Vite
- **Database**: PostgreSQL with PostGIS (via Supabase)
- **Real-time**: SignalR for SOS alerts
- **Package Manager**: pnpm (v10.32.1)

## Development Commands

### Quick Start
```bash
# Start both frontend and backend (opens 2 PowerShell windows)
./run-all.ps1

# Install dependencies first time
./run-all.ps1 -Install
```

### Backend (ASP.NET Core)
```bash
cd src/ReliefConnect.API

# Run development server (http://localhost:5164)
dotnet run

# Build
dotnet build

# Restore packages
dotnet restore

# Run tests
cd ../ReliefConnect.Tests
dotnet test

# Database migrations
dotnet ef migrations add <MigrationName> --project ../ReliefConnect.Infrastructure --startup-project .
dotnet ef database update --project ../ReliefConnect.Infrastructure --startup-project .
```

### Frontend (React + Vite)
```bash
cd client

# Run development server (http://localhost:5173)
pnpm dev

# Build for production
pnpm build

# Lint
pnpm lint

# Preview production build
pnpm preview
```

### E2E Testing (Playwright)
```bash
# Run all E2E tests
npx playwright test

# Run tests in UI mode
npx playwright test --ui

# Run specific test file
npx playwright test tests/map.spec.ts

# Show test report
npx playwright show-report
```

## Architecture

### Backend: Clean Architecture (3 Layers)

**ReliefConnect.Core** (Domain Layer)
- Entities: `ApplicationUser`, `Ping` (SOS requests), `Post`, `Supply`, `Zone`
- Interfaces: Repository and service contracts
- DTOs: Data transfer objects
- Enums: `UserRole`, `PingStatus`, etc.

**ReliefConnect.Infrastructure** (Data Layer)
- `AppDbContext`: EF Core DbContext with PostgreSQL + PostGIS
- Repositories: `PingRepository`, `PostRepository`
- Services: `GeminiService` (AI chatbot), `SmtpEmailService`
- Migrations: EF Core database migrations

**ReliefConnect.API** (Presentation Layer)
- Controllers: `AuthController`, `AdminController`, `MapController`, `PostController`, `ChatbotController`, `SupplyController`, `ZoneController`
- Hubs: `SOSAlertHub` (SignalR for real-time SOS notifications)
- Middleware: Global exception handler
- Authentication: JWT Bearer tokens with ASP.NET Core Identity
- Authorization Policies: `RequireAdmin`, `RequireVolunteer`, `RequirePersonInNeed`, `RequireSponsor`, `RequireVerified`

### Frontend: React Component Architecture

**Pages** (`client/src/pages/`)
- `LandingPage`, `LoginPage`, `RegisterPage`, `DashboardPage`, `MapPage`, `SocialPage`, `ChatbotPage`, `AdminPage`, `ProfilePage`

**Components** (`client/src/components/`)
- `auth/`: Authentication forms
- `layout/`: Layout components (Header, Sidebar, etc.)
- `map/`: Leaflet map components with marker clustering
- `panels/`: Side panels (PingDetailPanel, FilterBar, etc.)
- `ui/`: Reusable UI components

**State Management**
- Zustand stores (`client/src/stores/`)
- React Query for server state (`@tanstack/react-query`)
- Context API (`client/src/contexts/`)

**Services**
- `api.ts`: Axios-based API client with interceptors

**Internationalization**
- i18n setup in `client/src/i18n/`

## Key Technical Details

### Authentication Flow
- JWT tokens issued by `AuthController`
- Tokens stored in localStorage on frontend
- Axios interceptor adds `Authorization: Bearer <token>` header
- SignalR connections accept token via query string (`?access_token=...`)

### Real-time Features
- SignalR hub at `/hubs/sos-alerts`
- Frontend connects via `@microsoft/signalr`
- Broadcasts new SOS requests to connected clients

### Map Integration
- Leaflet with marker clustering (`leaflet.markercluster`)
- PostGIS for geospatial queries in PostgreSQL
- Coordinates stored as `Point` geometry type

## Performance Optimizations

**Implemented (Updated 2026-03-17):**
- ✅ AsNoTracking() on all read-only queries (20-30% faster)
- ✅ Fixed N+1 queries in PostRepository pagination (3 queries → 1)
- ✅ Spatial index on Ping coordinates with PostGIS ST_DWithin
- ✅ Descending index on Post.CreatedAt for cursor pagination
- ✅ All foreign key indexes (Post.AuthorId, Comment.PostId, Comment.UserId, Reaction.UserId)
- ✅ Hangfire background jobs for email sending
- ✅ Output caching on admin stats (5 minutes)
- ✅ GeminiService HTTP timeout (10 seconds)
- ✅ Marker clustering on frontend (Leaflet.markercluster)
- ✅ React Query gcTime and optimized refetch behavior
- ✅ Vendor chunk splitting in Vite (react-vendor, map-vendor)
- ✅ API client timeout (10 seconds)
- ✅ Optimized marker filtering with Set lookup

**Performance Results:**
- Backend response time: <1s (previously 4s+)
- Frontend build time: 453ms
- 75-80% improvement in API response times

**Not Yet Implemented:**
- Response compression (Brotli + Gzip)
- Redis caching for distributed scenarios
- Database connection pooling tuning

### Development Port Management
- Backend auto-kills zombie processes on port 5164 (Windows only)
- Frontend supports multiple ports (5173-5175) for Vite auto-increment

## Database Setup

**Manual Steps Required:**
1. Enable PostGIS extension on Supabase: `CREATE EXTENSION IF NOT EXISTS postgis;`
2. Run `migration.sql` in Supabase SQL Editor (creates 16 tables with spatial indexes)
3. Verify spatial index on Ping coordinates: `CREATE INDEX idx_ping_coordinates ON "Pings" USING GIST (ST_MakePoint("Longitude", "Latitude"));`

## Configuration

### Backend (`src/ReliefConnect.API/appsettings.json`)
- `ConnectionStrings:DefaultConnection`: PostgreSQL connection string
- `Jwt:Key`, `Jwt:Issuer`, `Jwt:Audience`: JWT configuration (use 256-bit key minimum)
- `Frontend:Urls`: CORS allowed origins
- `Smtp:*`: Email service configuration
- `Gemini:ApiKey`: Google Gemini API key for chatbot

**Security Note:** Never commit `appsettings.Development.json` with real credentials. Use environment variables or `dotnet user-secrets` for sensitive data.

### Frontend (`client/vite.config.ts`)
- Default Vite configuration with React plugin

## Testing
- **Unit Tests**: `src/ReliefConnect.Tests` - Run with `dotnet test`
- **E2E Tests**: Playwright suite with 22 tests covering auth, map, SOS, social, chatbot flows
- **Test Status**: 12 UI tests passing (as of 2026-03-17)

## Security Improvements (Updated 2026-03-17)

**Fixed Vulnerabilities:**
1. ✅ **Token Blacklist** - Implemented logout endpoint that invalidates JWT tokens
2. ✅ **JWT Secret Validation** - Rejects keys shorter than 256 bits on startup
3. ✅ **Rate Limiting** - 5 login attempts per 15 minutes on auth endpoints
4. ✅ **API Key Security** - Gemini API key moved from query string to header
5. ✅ **XSS Prevention** - HtmlSanitizer for posts and comments
6. ✅ **Timing Attack Prevention** - Using CryptographicOperations.FixedTimeEquals()

**Security Score:** 8.5/10 (improved from 7.5/10)

**Remaining Concerns:**
- JWT in localStorage (vulnerable to XSS) - consider httpOnly cookies
- No token rotation mechanism
- See `docs/SECURITY_AUDIT_REPORT.md` for full details

## Performance Optimizations

### Adding a New Entity
1. Create entity in `ReliefConnect.Core/Entities/`
2. Add DbSet to `AppDbContext` in Infrastructure
3. Create migration: `dotnet ef migrations add AddEntity`
4. Update database: `dotnet ef database update`

### Adding a New API Endpoint
1. Create/update controller in `ReliefConnect.API/Controllers/`
2. Add repository interface in `ReliefConnect.Core/Interfaces/`
3. Implement repository in `ReliefConnect.Infrastructure/Repositories/`
4. Register in DI container in `Program.cs`

### Adding a New Frontend Page
1. Create page component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Create necessary components in `client/src/components/`
4. Add API calls in `client/src/services/api.ts`
