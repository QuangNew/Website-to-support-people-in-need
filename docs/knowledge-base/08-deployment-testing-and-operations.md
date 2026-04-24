# ReliefConnect Knowledge Base: Deployment, Testing, and Operations

> Last synchronized: 2026-04-16
> Scope: performance notes, reliability notes, local setup, deployment model, configuration, and testing coverage.
> Retrieval note: this file is intended for maintainers, deployers, and evaluators who need operational guidance in one place.

## 1. Implemented Performance Optimizations

The project documentation and codebase record several implemented optimizations:

- `AsNoTracking()` on read-only queries,
- output caching policies,
- response compression with Brotli and Gzip,
- cursor-based post pagination,
- spatial query support in the ping repository,
- marker clustering on the frontend,
- React Query tuning,
- vendor chunk splitting in Vite,
- Gemini timeout handling.

## 2. Reliability Notes

The project is built to keep core flows simple and recoverable. Health check support exists at `/health`. Background services handle recurring cleanup and alert logic. However, some infrastructure reliability still depends on external service compatibility, especially around Supabase connection modes and Hangfire support.

## 3. Local Development Startup

The main local commands are:

```powershell
./run-all.ps1 -Install
./run-all.ps1
```

Manual startup is also supported:

```powershell
cd src/ReliefConnect.API
dotnet run

cd client
pnpm dev
```

## 4. Local Ports

The common local ports are:

- backend API: `http://localhost:5164`,
- frontend Vite app: `http://localhost:5173` with fallback to nearby ports,
- SignalR hub: `/hubs/sos-alerts`,
- Swagger UI in development,
- Hangfire dashboard when Hangfire is enabled.

## 5. Database Setup

The application expects Supabase PostgreSQL with PostGIS enabled. The repository documentation notes that `dotnet ef database update` can fail against pooled Supabase connections, so migration scripts are often applied manually through the Supabase SQL Editor.

## 6. Required Configuration Areas

The main backend configuration groups are:

- `ConnectionStrings:DefaultConnection`,
- `Jwt:*`,
- `Frontend:Urls`,
- `Smtp:*`,
- `Google:ClientId`,
- `Gemini:*`.

The frontend optionally uses environment variables such as:

- `VITE_API_URL`,
- `VITE_GOOGLE_CLIENT_ID`,
- `VITE_SUPABASE_URL`,
- `VITE_SUPABASE_ANON_KEY`.

## 7. Azure Deployment Model

The documented production architecture uses:

- Azure Static Web Apps for the React frontend,
- Azure App Service for the ASP.NET Core backend,
- Supabase PostgreSQL for database and storage.

This keeps the frontend static, the backend server-hosted, and the database external.

## 8. Automated Test Coverage Areas

The repository includes Playwright end-to-end suites for:

- authentication,
- map behavior,
- chatbot flows,
- social behavior,
- admin behavior,
- SOS and profile flows.

## 9. Confirmed Test Behaviors

Current tests verify several user-visible facts:

- the map loads and renders tiles,
- the SOS button is visible,
- the filter bar is present,
- the sidebar is present,
- login supports email or username,
- chatbot conversation creation requires authentication,
- chatbot message sending works with a valid token,
- the chat panel appears from the UI.

## 10. Validation Philosophy

The repository combines API-level tests, UI interaction tests, and operational documentation. Some functionality is fully implemented, while some other functionality is clearly documented as a gap or future task.