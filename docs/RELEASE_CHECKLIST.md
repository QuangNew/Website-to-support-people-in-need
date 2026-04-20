# Release Checklist — ReliefConnect

**Last Updated:** 2026-04-19

Use this checklist before every deployment to production. Each section must pass before proceeding to the next.

---

## 1. Schema & Database

- [ ] All EF Core migrations applied to Supabase: `dotnet ef database update`
- [ ] PostGIS extension enabled: `SELECT PostGIS_Version();`
- [ ] Spatial index on Pings verified: `SELECT indexname FROM pg_indexes WHERE tablename = 'Pings' AND indexdef LIKE '%GIST%';`
- [ ] Hangfire tables exist (auto-created on first run)
- [ ] BlacklistedTokens table exists
- [ ] No orphaned `/uploads/` URLs in Pings: `SELECT COUNT(*) FROM "Pings" WHERE "ConditionImageUrl" LIKE '/uploads/%';`
- [ ] Supabase storage buckets `avatars` and `post-images` are public with anon INSERT RLS

## 2. Configuration & Secrets

- [ ] `appsettings.json` contains **no real secrets** (only placeholders)
- [ ] `appsettings.Development.json` is in `.gitignore`
- [ ] Azure App Settings configured:
  - [ ] `ConnectionStrings__DefaultConnection`
  - [ ] `Jwt__Key` (≥256-bit)
  - [ ] `Google__ClientId`
  - [ ] `Smtp__User` + `Smtp__Password`
  - [ ] `Gemini__ApiKey`
  - [ ] `Frontend__Urls__0` (production frontend URL)
- [ ] Frontend `client/.env.production` has correct `VITE_API_URL` and `VITE_SUPABASE_URL`
- [ ] CORS origins in `appsettings.Production.json` include the production frontend domain

## 3. Authentication & Authorization

- [ ] JWT key validated at startup (fail-fast for <256-bit keys)
- [ ] Login flow works (standard + Google OAuth)
- [ ] Logout blacklists the JWT token
- [ ] Rate limiting active on auth endpoints (5 attempts / 15 min)
- [ ] Role policies enforce: `RequireAdmin`, `RequireVolunteer`, `RequirePersonInNeed`, `RequireSponsor`, `RequireVerified`
- [ ] Admin dashboard accessible only with Admin role

## 4. Build Verification

- [ ] Backend builds cleanly: `dotnet build` (0 errors, 0 warnings)
- [ ] Frontend builds cleanly: `cd client && pnpm build` (0 errors)
- [ ] No TypeScript errors: `pnpm exec tsc --noEmit`
- [ ] ESLint passes: `pnpm lint`

## 5. Core Flow Smoke Tests

Run with: `npx playwright test`

| # | Flow | Test File | Status |
|---|------|-----------|--------|
| 1 | Login and logout | `tests/auth.spec.ts` | |
| 2 | Admin dashboard load | `tests/admin.spec.ts` | |
| 3 | Create SOS | `tests/sos-creation.spec.ts` | |
| 4 | Volunteer accept & complete | `tests/volunteer-flow.spec.ts` | |
| 5 | Sponsor offer help | `tests/sponsor-flow.spec.ts` | |
| 6 | Hide & restore comment | `tests/comment-moderation.spec.ts` | |
| 7 | Person-in-need confirm safe | `tests/confirm-safe.spec.ts` | |

## 6. Chatbot & AI Verification

- [ ] Gemini API key pool has at least 1 active key in `ApiKeys` table
- [ ] Chat panel opens and responds to messages
- [ ] Image upload in chat works (JPEG/PNG/WebP, ≤4MB)
- [ ] Error states show user-friendly messages (timeout, rate limit, safety block)
- [ ] 24-hour image cache expiry works (expired images show placeholder)

## 7. Map & SOS Verification

- [ ] Map loads with tile layer visible
- [ ] Pings load and display as markers
- [ ] SOS creation flow works end-to-end
- [ ] Ping detail panel shows correctly (redacted for unauthenticated users)
- [ ] OSRM routing works (up to 2 alternatives)
- [ ] Marker clustering works at zoom levels

## 8. Background Services

- [ ] `TokenCleanupService` — cleans expired blacklisted tokens hourly
- [ ] `PingFlagMonitorService` — monitors SOS ping flags
- [ ] `SoftDeleteCleanupService` — hard-deletes after retention period
- [ ] Hangfire dashboard accessible (admin only): `/hangfire`
- [ ] Email sending jobs enqueue and deliver

## 9. Security Checklist

- [ ] No secrets in git history (check with `git log --all --oneline -S "password"`)
- [ ] HtmlSanitizer active on posts and comments (XSS prevention)
- [ ] Rate limiting on auth endpoints
- [ ] Image upload validation (MIME type + size) on both frontend and backend
- [ ] Response compression enabled (Brotli + Gzip)
- [ ] CORS restricted to known origins only

## 10. Deployment Steps

### Backend (Azure App Service)
```bash
cd src/ReliefConnect.API
dotnet publish -c Release -o ./publish
# Deploy ./publish to Azure App Service
```

### Frontend (Azure Static Web Apps)
```bash
cd client
pnpm build
# Deploy ./dist to Azure Static Web Apps
```

### Post-Deploy Verification
- [ ] `GET /health` returns `{ status: "healthy" }`
- [ ] Frontend loads at production URL
- [ ] Login works with production credentials
- [ ] Map loads and shows pings
- [ ] Chat panel responds to messages

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | | | |
| Reviewer | | | |
