# Track 1 - Database And Environment Alignment

**Date:** 2026-04-18
**Purpose:** Reduce false failures caused by local environment mismatch and clarify what is actually wrong with database alignment.

## Track 1 Scope For This Pass

This pass stays inside environment and schema alignment only.

It does **not** attempt to fix:

- role workflows
- comment moderation UX
- chatbot behavior
- admin feature rendering
- token lifecycle logic

## Completed In This Pass

### 1. Local Dev CORS Alignment Fix

The backend now allows Vite dev origins on both `localhost` and `127.0.0.1`.

### Files Changed

- `src/ReliefConnect.API/Program.cs`
- `src/ReliefConnect.API/appsettings.json`
- `src/ReliefConnect.API/appsettings.Development.json`

### Validation

A real preflight request from `http://127.0.0.1:5173` to `http://127.0.0.1:5164/api/map/pings` returned:

- status `204`
- `Access-Control-Allow-Origin: http://127.0.0.1:5173`
- `Access-Control-Allow-Credentials: true`

### Outcome

This removes one class of false local failures from the investigation baseline.

## Confirmed Schema Alignment Facts

### EF Reports Pending Migrations

- `20260417185856_AddPingContactSnapshotFields`
- `20260418063104_AddVerificationHistory`

### Runtime Evidence

- Local runtime successfully executed queries that select:
  - `Pings.ConditionImageUrl`
  - `Pings.ContactName`
  - `Pings.ContactPhone`

### Direct Database Verification

Using a temporary `.NET 10` probe against the configured database, the following physical schema objects were confirmed to exist:

- `Pings.ConditionImageUrl`
- `Pings.ContactName`
- `Pings.ContactPhone`
- `VerificationHistories` table
- `IX_VerificationHistories_UserId_Status`
- `IX_VerificationHistories_UserId_SubmittedAt`

The current `__EFMigrationsHistory` entries stop at:

- `20260416132449_AddSOSCategory`

The latest recorded EF product version in the history table is:

- `10.0.4`

### Interpretation

For the currently configured database, the problem is now confirmed more precisely:

1. the physical schema already contains the objects from both pending migrations
2. `__EFMigrationsHistory` is missing the corresponding migration rows

This is confirmed **migration history drift** for the active database.

At the same time, earlier runtime logs still showed a missing `ConditionImageUrl` error in another environment or an earlier database state, so this conclusion must not be blindly generalized to every deployment target.

## What Is Still Unresolved In Track 1

### 1. Other Environments Still Need Separate Verification

We now know the active configured database has the physical schema but missing history rows.

We do **not** yet know whether every other target environment matches this state.

### 2. Migration History Has Not Been Backfilled Yet

No database mutation has been applied in this pass.

A guarded SQL file has been prepared instead:

- `docs/plans/2026-04-18-track-1-migration-history-backfill.sql`

### 3. Tooling Note

Quick PowerShell inline probes using `Add-Type` were unreliable in this environment because the host compiler resolved older runtime assemblies than the application dependencies. A dedicated `.NET 10` helper process was used instead.

## Safe Next Actions For Track 1

The next Track 1 pass should do one of these, in order of preference:

1. Use a direct SQL surface against the actual Supabase database.
   - preferred: Supabase SQL editor or a compatible SQL client
2. Use a dedicated `.NET 10` helper process to inspect when direct SQL tooling is unavailable:
   - `information_schema.columns`
   - `information_schema.tables`
   - `__EFMigrationsHistory`
3. For the currently configured database, use the prepared guarded SQL to backfill history only after confirming it is the intended target.
4. For any other environment, re-run the same verification before deciding whether to:
   - apply missing schema changes
   - backfill migration history
   - or both

## Important Safety Rule

Do **not** blindly mark the two pending migrations as applied in `__EFMigrationsHistory` until the physical schema is verified for that exact target database.

If the table or columns are still missing in the real target environment, backfilling migration history first would make the situation worse.

## Recommended Next Entry Point

For the currently configured database, the next safe action is to review and optionally apply the guarded backfill SQL.

Once physical schema and migration history are reconciled, move to Track 2 for admin/auth stabilization.