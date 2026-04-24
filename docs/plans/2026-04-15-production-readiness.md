# Production Readiness Plan — Azure Deployment (No Docker)

**Date:** 2026-04-15  
**Goal:** Make ReliefConnect production-ready for Azure App Service (backend) + Azure Static Web Apps (frontend)

## Architecture: Azure App Service + Static Web Apps

- **Backend**: Azure App Service (Linux, B1 plan) → ASP.NET Core 10.0
- **Frontend**: Azure Static Web Apps (Free/Standard) → React + Vite SPA
- **Database**: Supabase PostgreSQL (keep existing)
- **File Storage**: Supabase Storage (primary, remove local wwwroot/uploads fallback)

## Blockers & Fixes

### 1. Secrets Management (CRITICAL)
**Problem:** All secrets hardcoded in `appsettings.json` committed to git  
**Fix:**
- Strip all secrets from `appsettings.json` — use placeholder values only
- Create `appsettings.Production.json` with env-var overrides pattern
- Backend reads from environment variables (Azure App Settings)
- Add `.gitignore` entries for Development.json

**Files:** `appsettings.json`, `appsettings.Production.json`

### 2. Hangfire → PostgreSQL Storage (HIGH)
**Problem:** `UseMemoryStorage()` loses all scheduled jobs on restart  
**Fix:**
- Add `Hangfire.PostgreSql` NuGet package
- Configure `UsePostgreSqlStorage()` with existing connection string
- Remove `Hangfire.MemoryStorage` package

**Files:** `Program.cs`, `ReliefConnect.API.csproj`

### 3. TokenBlacklist → Database (HIGH)
**Problem:** `ConcurrentDictionary` in-memory blacklist loses state on restart  
**Fix:**
- Create `BlacklistedToken` entity with `Jti` + `Expiry` columns
- Add DbSet to `AppDbContext`
- Rewrite `TokenBlacklistService` to use database
- Change DI from `Singleton` to `Scoped`
- Add EF migration

**Files:** `BlacklistedToken.cs`, `AppDbContext.cs`, `TokenBlacklistService.cs`, `Program.cs`

### 4. Remove Local File Upload Fallback (MEDIUM)
**Problem:** `wwwroot/uploads` is ephemeral on Azure App Service  
**Fix:**
- PostController `upload-image` should return error if storage is unavailable (Supabase not configured)
- Keep the endpoint for backward compatibility but log a warning
- Frontend already tries Supabase first — ensure env vars are always set in production

**Files:** `PostController.cs` (minor — add warning log)

### 5. Production CORS Configuration (MEDIUM)
**Problem:** CORS only allows localhost origins  
**Fix:**
- `appsettings.Production.json` includes production domain URLs
- Keep localhost defaults for development

**Files:** `appsettings.Production.json`

### 6. Serilog Azure-Ready Config (LOW)
**Problem:** File logging to relative path won't work on Azure  
**Fix:**
- In production config: remove file sink, keep console (Azure captures stdout)
- Azure App Service automatically captures console output to Log Stream

**Files:** `appsettings.Production.json`

### 7. Azure Deploy Configs (LOW)
**Files:** `staticwebapp.config.json` (frontend SPA routing), `client/.env.production`

## Implementation Order

1. Secrets sanitization + production config
2. Hangfire PostgreSQL 
3. TokenBlacklist to DB + migration
4. File upload warning
5. Azure deploy configs
6. Build & test

## Risk Assessment
- **Highest Risk:** Hangfire storage migration (d=1: all BackgroundJob.Enqueue callers)
- **Medium Risk:** TokenBlacklist DB migration (d=1: AuthController, JWT event handler in Program.cs)
- **Low Risk:** Config changes, deploy files
