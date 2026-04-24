# Track 0 - Stabilization Baseline

**Date:** 2026-04-18
**Goal:** Establish one trustworthy baseline for code, runtime, and database state before any deeper repair work.

## Scope Of This Track

This track does not introduce feature changes. It only answers four questions:

1. Does the project build?
2. Does the project run locally?
3. Which failures are code defects versus environment or data defects?
4. Is the current database state aligned with EF migration history?

## Tooling Baseline

### Indexing

- `ccc index` completed successfully.
- `npx cocoindex analyze` could not be used in this environment because the `cocoindex` package resolved to `404 Not Found` from npm.

### Consequence

- Semantic index refresh is available.
- CocoIndex-based graph refresh is currently unavailable and should not be treated as a blocker for Track 0 evidence gathering.

## Build Report

### Backend

- Command used: `dotnet msbuild /t:Compile /p:UseAppHost=false`
- Result: success

### Frontend

- Command used: `pnpm build`
- Result: success

## Runtime Report

### Service Startup

- Backend starts locally and listens on `http://localhost:5164`.
- Frontend starts locally and serves on `http://127.0.0.1:5173` in the current session.
- Backend logs confirm development environment startup.

### Health And Core Endpoints

- `GET /health` returns `200` with healthy status.
- `GET /api/map/pings` returns `200`.
- Frontend root route returns `200`.
- Frontend `/admin` route serves the SPA shell with `200`.

### Admin/Auth Runtime Findings

- `POST /api/auth/login` with the fallback admin credential `admin_test@reliefconnect.vn` / `Admin@123` returns `401` in the current environment.
- Backend logs show repeated `401` responses on `GET /api/admin/system/stats` because the request is unauthenticated or does not satisfy the `Admin` role policy.
- Backend logs also show repeated `401` responses on `GET /api/auth/me` caused by an expired bearer token.

### Important Runtime Interpretation

- The admin page problem currently reproduces as an auth/runtime issue, not as a missing-icon source-code issue.
- A stale or expired token in local storage can still cause the frontend to emit unauthorized admin/auth requests before the session state is normalized.

## Environment Report

### Environment Variables

The following environment variables were not set in the current terminal session:

- `ASPNETCORE_ENVIRONMENT`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ConnectionStrings__DefaultConnection`
- `ConnectionStrings__HangfireConnection`

### Effective Runtime Mode

- The backend is running from development settings and launch settings.
- The project is relying on checked-in configuration files rather than explicit environment overrides in this session.

### Background Services

- `PingFlagMonitorService` started successfully.
- `SoftDeleteCleanupService` started successfully.
- `TokenCleanupService` is active through hosted service registration.

### Hangfire

- Hangfire is intentionally disabled when the configured connection uses a Supabase pooler host.
- This is confirmed by live startup logs and is consistent with the existing defensive logic in `Program.cs`.

## Configuration Drift Findings

### Local Frontend Origin Mismatch

- Current frontend server was started at `http://127.0.0.1:5173`.
- Current backend CORS configuration allows `http://localhost:5173`, `http://localhost:5174`, and `http://localhost:5175`.
- Backend logs explicitly recorded CORS failures for origin `http://127.0.0.1:5173`.

### Consequence

- Local debugging can produce false frontend-to-backend failures if the dev server is started on `127.0.0.1` instead of `localhost`.
- This is an environment/config mismatch, not a controller or UI implementation bug.

## Schema Drift Report

### EF Migration Status

`dotnet ef migrations list` reports these migrations as pending:

- `20260417185856_AddPingContactSnapshotFields`
- `20260418063104_AddVerificationHistory`

### What These Pending Migrations Mean

- `AddPingContactSnapshotFields` should add:
  - `Pings.ConditionImageUrl`
  - `Pings.ContactName`
  - `Pings.ContactPhone`
- `AddVerificationHistory` should add:
  - `VerificationHistories` table
  - related indexes on `UserId`, `Status`, and `SubmittedAt`

### Critical Observation

- The live `GET /api/map/pings` query succeeded while selecting `ConditionImageUrl`, `ContactName`, and `ContactPhone`.
- This means the current local database can already satisfy those columns even though EF still marks `AddPingContactSnapshotFields` as pending.

### Interpretation

This is not a simple "column missing locally" situation.

The evidence points to **migration history drift** or **manual schema application outside `__EFMigrationsHistory`**:

1. EF believes the migration is pending.
2. The local database can already read the relevant columns.

### Why This Matters

- A different environment can still fail with `column "ConditionImageUrl" does not exist`, as seen in the earlier 2026-04-18 error log.
- The project likely has inconsistent database states across environments.
- Track 1 must treat this as an environment alignment problem, not only as an application code problem.

## Issue Ledger

### T0-001 - Admin Fallback Credentials Not Valid In Current Environment

- Severity: High
- Evidence:
  - direct login request returned `401`
  - tests and historical docs still reference the fallback admin credential
- Interpretation:
  - the fallback account may not exist
  - the password may have changed
  - the environment may not be seeded as expected

### T0-002 - Admin UI Requests Are Currently Failing Due To Auth State, Not Missing Icons

- Severity: High
- Evidence:
  - repeated `401` on `/api/admin/system/stats`
  - repeated expired-token failures on `/api/auth/me`
- Interpretation:
  - current admin-screen failure is upstream auth/runtime behavior
  - icon rendering should not be debugged until admin auth is stable

### T0-003 - Local Dev CORS Mismatch Causes False Failures

- Severity: Medium
- Evidence:
  - frontend served from `127.0.0.1:5173`
  - backend only allows `localhost` dev origins
  - backend logs show explicit CORS policy failure
- Interpretation:
  - local runtime can look broken even when API logic is fine

### T0-004 - Migration History Drift Exists Or Is Very Likely

- Severity: High
- Evidence:
  - EF reports `AddPingContactSnapshotFields` pending
  - runtime query reading those columns still succeeds
- Interpretation:
  - schema and migration history are not trustworthy as a single source of truth right now

### T0-005 - Remote/Other Environment Schema Is Not Aligned With Current Code

- Severity: High
- Evidence:
  - earlier 2026-04-18 runtime log showed `ConditionImageUrl` missing in an environment serving real requests
- Interpretation:
  - at least one target environment is behind the code and/or local environment

### T0-006 - Current Session Relies On Checked-In Config Instead Of Explicit Env Overrides

- Severity: Medium
- Evidence:
  - key environment override variables are unset
- Interpretation:
  - environment behavior is currently coupled to local config files
  - this increases ambiguity when reproducing auth and connection issues

### T0-007 - CocoIndex Graph Refresh Is Not Available In This Environment

- Severity: Low
- Evidence:
  - `npx cocoindex analyze` returned npm `404`
- Interpretation:
  - investigation must rely on direct source reads, semantic index, and runtime evidence for now

## Track 0 Outcome

Track 0 is complete enough to support the next track.

### What Is Now Known Reliably

1. The project builds.
2. The project can run locally.
3. The admin problem is currently dominated by auth/runtime state, not icon source imports.
4. The current local dev session has a CORS host mismatch.
5. EF migration history is not aligned cleanly with the observed database shape.
6. At least one other environment has schema lag around `ConditionImageUrl`.

## Recommended Entry Into Track 1

Track 1 should now focus only on database and environment alignment:

1. verify actual physical schema versus `__EFMigrationsHistory`
2. determine whether pending migrations were applied manually outside EF history
3. prepare safe alignment steps for Supabase
4. standardize local frontend origin usage or expand dev CORS to include `127.0.0.1`
5. recover or seed a known valid admin account for later Track 2 auth work

Track 1 should not mix in role features, moderation UX, or chatbot work.