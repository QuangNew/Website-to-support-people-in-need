# Optimization, Security & Vercel Deployment Plan
**Date**: 2026-04-14  
**Scope**: System-wide audit → fix → deploy

---

## Phase 1: Backend Optimization & Bug Fixes

### 1A. Fix PingFlagMonitor Connection Pooling (RECURRING ERROR)
- **File**: `BackgroundServices/PingFlagMonitorService.cs`
- **Issue**: `ObjectDisposedException` on `ManualResetEventSlim` in every error log
- **Root cause**: Npgsql connection pool recycling mid-batch
- **Fix**: Use Npgsql connection resiliency — add `EnableRetryOnFailure` flag already present, but add individual INSERT batching with smaller batch sizes

### 1B. Fix N+1 Query in AdminModerationController
- **File**: `Controllers/AdminModerationController.cs` line ~205
- **Issue**: `_db.Users.Where(u => u.Id == p.DeletedByAdminId)...FirstOrDefault()` inside LINQ projection → N+1
- **Fix**: Pre-fetch admin names via dictionary, use in projection

### 1C. Increase CommandTimeout from 15s → 30s
- **File**: `Program.cs` line 47
- **Issue**: Complex queries timing out prematurely
- **Fix**: `npgsqlOptions.CommandTimeout(30);`

### 1D. Add Referrer-Policy security header
- **File**: `Program.cs` line ~227
- **Fix**: Add `Referrer-Policy: strict-origin-when-cross-origin`

### 1E. Fix Google OAuth error message leaking internal details
- **File**: `AuthController.cs` line ~342
- **Fix**: Replace `ex.Message` with generic message

### 1F. Rate Limiting IP detection behind proxy
- **File**: `Middleware/RateLimitingMiddleware.cs` line 21
- **Fix**: Use `X-Forwarded-For` with validation fallback

---

## Phase 2: Frontend Optimization & SEO

### 2A. API Base URL for deployment
- **File**: `client/src/services/api.ts` line 4
- **Fix**: Change fallback from `http://localhost:5164/api` to `/api`

### 2B. SEO meta tags
- **File**: `client/index.html`
- **Fix**: Add OG tags, Twitter card, preconnect hints

### 2C. Map debounce optimization
- **File**: `client/src/components/map/MapView.tsx` line 236
- **Fix**: Reduce from 500ms to 300ms

---

## Phase 3: Vercel Deployment Config

### 3A. Create vercel.json
- SPA routing rewrites
- Build config for client subdirectory

---

## Implementation Order
1. Backend fixes (Phase 1) — parallel edits
2. Frontend fixes (Phase 2) — parallel edits
3. Vercel config (Phase 3)
4. Build verification (both frontend + backend)
