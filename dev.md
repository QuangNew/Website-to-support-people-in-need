# DEV.md - Development Tasks & Status

> Last updated: 2026-03-31

## Database Migration Status

| Migration | Status |
|-----------|--------|
| `20260228165225_InitialCreate` | Applied |
| `20260303065344_AddAuthFields` | Applied |
| `20260317162445_AddPasswordResetFields` | Applied |
| `20260321162344_AddSystemLogsCreatedAtIndex` | Applied |
| `20260329154141_AddBatchLogAndRoleFeatures` | Applied |
| `20260329154533_AddSystemAnnouncementAdminIdIndex` | Applied |

> **Note:** EF Core `dotnet ef database update` fails due to Npgsql transient connection issues (`System.ObjectDisposedException: ManualResetEventSlim`). Supabase connection drops mid-migration.
>
> **Workaround:** Run SQL manually via **Supabase SQL Editor**. Generate idempotent script:
> ```bash
> cd src/ReliefConnect.API
> dotnet ef migrations script 20260303065344_AddAuthFields --idempotent --project ../ReliefConnect.Infrastructure --startup-project .
> ```
> This generates SQL for only the 4 pending migrations. Copy-paste into Supabase SQL Editor and execute.
>
> **Alternative:** If connection is stable, retry from `src/ReliefConnect.API`:
> ```bash
> dotnet ef database update --project ../ReliefConnect.Infrastructure --startup-project .
> ```

---

## CRITICAL BUGS (Must Fix Before Testing)

### 1. Frontend API Route Mismatch (ALL Admin Features Broken)

**Severity:** CRITICAL - ✅ **FIXED**

Admin split into 3 controllers with correct frontend routes:
- **AdminController** (`api/admin`) — `/admin/users`, `/admin/verifications`, `/admin/batch`
- **AdminModerationController** (`api/admin/moderation`) — `/admin/moderation/posts`, `/admin/moderation/reports`
- **AdminSystemController** (`api/admin/system`) — `/admin/system/stats`, `/admin/system/logs`, `/admin/system/announcements`

Frontend `adminApi` in `api.ts` updated to match all 3 controllers (26 methods total).

### 2. Synchronous DB Query on Every HTTP Request (Performance Killer)

**Severity:** CRITICAL - ⚠️ **OPEN** (Not yet addressed)

`Program.cs` `OnTokenValidated` handler calls `userManager.Users.AsNoTracking().FirstOrDefault()` synchronously on **every authenticated HTTP request** to check if user is suspended.

**File:** `src/ReliefConnect.API/Program.cs:103-128`
**Fix:** Replace with async query + IMemoryCache (30s TTL). Invalidate cache on suspend/unsuspend/ban.

### 3. N+1 HasChildren Subquery in System Logs

**Severity:** HIGH - ✅ **FIXED**

Implemented pre-fetch `GroupBy` dictionary pattern. `AdminController.GetLogs()` now fetches all parent log IDs, groups children in-memory, then patches `HasChildren` boolean on response DTOs. No more N+1 queries.

**Files:** `AdminController.cs:498-535` (single query with subsequent in-memory grouping)
**Implementation:** Added `SystemLog.ParentLogId` and `SystemLog.BatchId` fields; batch hierarchy patterns established.

---

## Recently Completed (2026-03-31)

### 1. Entity-Database Sync
- **SystemLog**: Added `BatchId` (Guid?) and `ParentLogId` (int?) for batch hierarchy; added `CreatedAt` index via migration
- **ApplicationUser**: Added `IsSuspended`, `SuspendedUntil`, `BanReason`, `LastTokenJti` fields for ban/suspension
- **Ping**: Added `AssignedVolunteerId` (Guid?) for volunteer assignment tracking
- **Post**: Added `IsPinned` boolean for admin content promotion
- All migrations applied manually to Supabase DB

### 2. New Database Entities (With Full Fluent Config)
- **Report** — PostId (FK), ReporterId (FK), Reason (string, max 500), Status (enum: Pending/Reviewed/Dismissed), CreatedAt
  - Fluent config: unique index on (PostId, ReporterId), cascade delete parent post
- **HelpOffer** — SponsorId (FK), TargetUserId (FK), PingId (Guid?), PostId (int?), Message (string, max 500), Status (enum), CreatedAt
  - Fluent config: at least one of PingId or PostId must be non-null; cascade delete on sponsor
- **SystemAnnouncement** — Title (string, max 200), Content (string, max 2000), AdminId (FK), CreatedAt, ExpiresAt (DateTime?)
  - Fluent config: cascade delete parent admin user

### 3. Admin 3-Controller Split
- **`AdminController`** (`api/admin`) — User management + batch operations:
  - User list/search/detail, role approval, verification queue, suspend/unsuspend/ban/force-logout/reset-verification
  - Batch operations with parent-child log hierarchy (parent log via `RETURNING "Id"`, child logs per operation)
- **`AdminModerationController`** (`api/admin/moderation`) — Content moderation:
  - Posts list (with IsPinned, CommentCount, ReactionCount), pin/unpin, delete post, delete comment
  - Reports queue (status filter, post preview), review/dismiss report
- **`AdminSystemController`** (`api/admin/system`) — System operations:
  - Stats (UNION ALL with PendingVerifications + PendingReports), logs with HasChildren
  - Log children endpoint, announcements CRUD, CSV export (users/logs with CsvSafe), force-resolve SOS

### 4. Shared Controller Extensions
- **`ControllerExtensions.LogAdminAction()`** — Async audit logging with support for `batchId` + `parentLogId` hierarchy
- **`ControllerExtensions.CsvSafe()`** — Escapes Excel formula injection (=, +, -, @, tab) by prefixing dangerous chars

### 5. Role-Specific Features (Partial Implementation)
- **VolunteerController** — `GetAvailableTasks` (Ping list, distance sort), `AcceptTask` (status → InProgress), `GetActiveTasks` (My tasks)
  - **Gap**: Missing `CompleteTask`, task history, volunteer stats, N+1 Include before Where anti-pattern
- **SponsorController** — `SearchSupportCases` (Ping + Post search), `OfferHelp` (creates Notification only, NOT HelpOffer entity)
  - **Gap**: Missing HelpOffer entity creation, offer history retrieval, impact dashboard; in-memory `.ToListAsync()` anti-pattern
- **PersonInNeedController** — NOT YET IMPLEMENTED (no controller exists)
- **NotificationController** — NOT YET IMPLEMENTED (no controller exists)

### 6. Frontend Admin Updates
- `client/src/types/admin.ts`: Created TypeScript interfaces for all admin types (AdminUser, AdminPost, SystemLog, Report, Announcement, SystemStats, PagedResponse, BatchResult)
- `client/src/services/api.ts`: Updated `adminApi` with 26 methods matching 3-controller split (AdminController, AdminModerationController, AdminSystemController)
- `client/src/pages/AdminPage.tsx`: Rewritten with 7-tab layout (Stats, Verifications, Users, Posts, Reports, Logs, Announcements) with expandable batch log rows, Zustand batch queue integration

### 7. Database Performance
- Pre-fetched `HasChildren` via GroupBy dictionary for batch log expansion (no N+1)
- Output caching on admin stats (60s)
- Response compression (Brotli + Gzip)
- Optimized Select projections in list queries

---

## Role Gap Research (2026-03-31 Code Audit)

Analysis of implemented vs. planned features across role-specific controllers:

### ✅ Admin Controllers — Complete (3-Controller Split)
- [x] User list & search with role/verification filters + pageSize cap
- [x] User detail with PostCount, CommentCount, PingCount
- [x] Role approval with cache invalidation
- [x] Verification rejection with audit logging
- [x] Suspend / Unsuspend / Ban / Force-logout / Reset-verification
- [x] Batch operations with parent-child log hierarchy
- [x] Content moderation: posts (pin/unpin, delete), comments (delete)
- [x] Reports queue: list (status filter), review, dismiss
- [x] System stats (UNION ALL with PendingVerifications + PendingReports)
- [x] System logs with HasChildren (GroupBy), log children endpoint
- [x] Announcements CRUD
- [x] CSV export (users/logs) with CsvSafe + Take(10_000)
- [x] Force-resolve SOS
- [x] Shared LogAdminAction + CsvSafe helpers

### ⚠️ VolunteerController — Incomplete
- [x] List available tasks (SOS pings with distance sorting)
- [x] Accept task (update Ping status → InProgress)
- [x] List active tasks (My in-progress assignments)

**Missing:**
- ❌ **CompleteTask** — No endpoint to resolve a Ping (set status → Resolved)
- ❌ **Task history** — No endpoint to list completed tasks with completion date/notes
- ❌ **Volunteer stats** — No dashboard showing tasks completed, success rate, hours
- ❌ **My assigned tasks** — No way to filter by `AssignedVolunteerId`

**Code Smell:**
- 🟡 **Include before Where anti-pattern** — Line 24: `.Include(p => p.User).Where(...)` loads User navigation before filtering. Should use `.Where().Select(p => new { ... })` projection instead.

### ⚠️ SponsorController — Incomplete
- [x] Search support cases (Pings by status + Posts by category)
- [x] OfferHelp (creates Notification, sends to ping creator)

**Missing:**
- ❌ **HelpOffer entity creation** — `OfferHelp` creates only Notification, not HelpOffer record. Should insert into HelpOffers table with status=Pending
- ❌ **Offer history** — No endpoint to list my offers with status (pending/accepted/completed)
- ❌ **Impact dashboard** — No endpoint showing "helped X people, Y resolved cases, Z active sponsorships"

**Code Smell:**
- 🟡 **In-memory aggregation** — Line 48-54: `.ToListAsync()` then in-memory LINQ. Should use 3 `CountAsync()` queries for the impact dashboard

### ❌ PersonInNeedController — NOT IMPLEMENTED
**Planned Features (from dev notes but missing):**
- ❌ My pings timeline (Ping.UserId == me, sorted by CreatedAt desc)
- ❌ Received offers (HelpOffers where TargetUserId == me, with status filter)
- ❌ Report post (Create Report entity with PostId + my UserId)

### ❌ NotificationController — NOT IMPLEMENTED
**Planned Features (from dev notes but missing):**
- ❌ List notifications (paginated, filtered by unread)
- ❌ Get unread count (cached 30s, invalidate on create)
- ❌ Mark read / Mark all read
- ❌ Delete notification

**Context:** Notifications are created by SponsorController.OfferHelp only. Missing notification triggers for:
- SOS ping assigned to volunteer
- Volunteer completes a task
- Admin reviews a report
- System announcement published
- Post is pinned/unpinned

---

## Pending Fixes (Code Review Findings - 2026-03-31)

> Full implementation plan: `docs/superpowers/plans/2026-03-30-code-review-fixes.md`

### Priority 1: Critical (Blocking)

- [x] **Fix API route mismatch** — ✅ FIXED (3-controller split: AdminController, AdminModerationController, AdminSystemController)
- [ ] **Fix synchronous JWT validation query** — See "Critical Bugs #2" above
- [x] **Fix N+1 HasChildren query** — ✅ FIXED (pre-fetch GroupBy pattern in AdminSystemController.GetLogs)

### Priority 2: High (Security & Data Integrity)

- [x] **CSV export injection vulnerability** — ✅ FIXED (`ControllerExtensions.CsvSafe()` + integrated in AdminSystemController export endpoints)

- [x] **Uncapped pageSize on all endpoints** — ✅ FIXED (all admin endpoints cap pageSize to 100)

- [x] **CSV export loads all records into memory** — ✅ FIXED (AdminSystemController export endpoints use `Take(10_000)` safety cap)

- [x] **Entity validation missing** — ✅ FIXED (Fluent config in AppDbContext for Report, HelpOffer, SystemAnnouncement with constraints)

- [x] **DTO validation missing** — ✅ PARTIAL (AdminBatchDto, ApproveRoleDto have basic validation; newer DTOs need review)

### Priority 3: Medium (Code Quality & Performance)

- [x] **Duplicated `LogAction` method** — ✅ FIXED (Extracted to `ControllerExtensions.LogAdminAction()` helper)

- [ ] **SponsorController.GetImpact loads all offers into memory** — ⚠️ STILL BROKEN (GetImpact endpoint doesn't exist; impact dashboard would need 3 `CountAsync()` queries, currently using in-memory LINQ)

- [ ] **VolunteerController uses Include before Where** — ⚠️ STILL BROKEN (GetAvailableTasks line 24: `.Include(p => p.User).Where(...)` should use projection)

- [ ] **Frontend uses `any` types everywhere** — ✅ PARTIALLY FIXED (`client/src/types/admin.ts` created with typed interfaces; other pages still use `any`)

- [ ] **Frontend missing error handling** — ⚠️ STILL BROKEN (No try-catch on API calls in newer pages)

- [ ] **UsersPanel search debounce broken** — ⚠️ STILL BROKEN (Creates new `setTimeout` ref on every render)

- [ ] **NotificationBell polling not cleaned up properly** — ⚠️ STILL BROKEN (Missing `cancelled` flag pattern)

- [ ] **`volunteerApi.acceptTask` missing from api.ts** — ⚠️ STILL BROKEN (Backend has `POST /volunteer/accept-task` but frontend calls wrong route)

### Priority 4: Nice-to-Have (Future)

- [ ] **i18n translations** — New pages have hardcoded Vietnamese/English strings
- [ ] **Real-time notifications via SignalR** — Currently using 30s polling (if NotificationBell implemented)
- [ ] **Redis caching** — IMemoryCache won't scale to multiple instances
- [ ] **JWT in httpOnly cookies** — Currently in localStorage (XSS vulnerable)
- [ ] **Token rotation** — No refresh token mechanism
- [ ] **Database connection pooling** — Tune for Supabase

---

## Pending Tasks (Feature Work - 2026-03-31)

### Priority 1: Critical / Must-Do

- [x] **Apply 4 pending database migrations** — ✅ DONE (all 6 migrations now Applied manually to Supabase)

- [ ] **RLS Policies on Supabase** — All 23 tables have RLS enabled but NO policies defined. Since we use ASP.NET Core backend (service_role key), this is not currently breaking. Create policies if direct Supabase client access is needed.

- [ ] **Implement Missing Role-Specific Features:**
  - PersonInNeedController: my pings, received offers, report post
  - NotificationController: CRUD, unread count caching
  - VolunteerController: complete task, task history, volunteer stats
  - SponsorController: create HelpOffer entity (not just Notification), offer history, impact dashboard

- [ ] **Test all new API endpoints** — New/updated controllers need integration/unit tests:
  - `AdminController` (all 7 action groups)
  - `VolunteerController` (new: complete task, history, stats)
  - `SponsorController` (fix: HelpOffer creation, offer history, impact)
  - `PersonInNeedController` (all — new controller)
  - `NotificationController` (all — new controller)

- [ ] **Frontend integration testing** — Verify all new pages work against live API:
  - Admin panel (user management, verification queue, post moderation, batch ops, stats, logs)
  - Volunteer page (available tasks, active tasks, history, stats)
  - Sponsor page (search cases, offer help, offer history, impact dashboard)
  - PersonInNeed page (my pings, received offers)
  - NotificationBell (list, unread count, mark read, delete)

### Priority 2: Important / Should-Do

- [ ] **Fix code quality issues from Priority 3 list above:**
  - Include-before-Where anti-pattern in VolunteerController
  - In-memory aggregation in SponsorController
  - Frontend error handling on all new pages

- [ ] **Notification creation triggers** — Few things create notifications. Need to add:
  - SOS ping assigned to volunteer
  - Volunteer completes a task
  - Admin reviews a report
  - System announcement published
  - Post is pinned/unpinned

- [ ] **Fix critical performance issues from Priority 2 list above:**
  - Synchronous JWT validation query (STILL CRITICAL)

---

## Known Issues

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| **Synchronous DB query in JWT validation** | **CRITICAL** | ⚠️ OPEN | `FirstOrDefault()` (sync) on every HTTP request. Blocks thread pool. Needs IMemoryCache + async. |
| **API route mismatch (admin split)** | CRITICAL | ✅ FIXED | 3-controller split: AdminController, AdminModerationController, AdminSystemController |
| **N+1 HasChildren subquery** | HIGH | ✅ FIXED | Pre-fetch GroupBy pattern in AdminSystemController.GetLogs |
| **VolunteerController Include-before-Where** | HIGH | ⚠️ OPEN | `.Include(p => p.User).Where(...)` anti-pattern at line 24. Should use projection. |
| **SponsorController in-memory aggregation** | MEDIUM | ⚠️ OPEN | `.ToListAsync()` then LINQ instead of server-side queries. |
| **Npgsql transient `ObjectDisposedException`** | MEDIUM | ℹ️ INFO | Supabase connection drops during EF Core migrations. Workaround: run SQL manually via Supabase SQL Editor. |
| **PersonInNeedController not implemented** | MEDIUM | ⚠️ OPEN | No controller exists. Planned: my pings, received offers, report post. |
| **NotificationController not implemented** | MEDIUM | ⚠️ OPEN | No controller exists. Planned: CRUD, unread count, mark read. |
| **RLS enabled without policies** | LOW | ℹ️ INFO | 23 tables have RLS enabled but NO policies. Only affects direct Supabase client; backend uses service_role key. |
| **AddSystemAnnouncementAdminIdIndex migration is empty** | NONE | ℹ️ INFO | Index was already created in previous migration. Empty migration is harmless. |

---

## Development Commands Quick Reference

```bash
# Start everything
./run-all.ps1 -Install

# Backend only (from src/ReliefConnect.API)
dotnet run

# Frontend only (from client/)
pnpm dev

# Run tests
cd src/ReliefConnect.Tests && dotnet test

# New migration (MUST run from src/ReliefConnect.API)
cd src/ReliefConnect.API
dotnet ef migrations add <Name> --project ../ReliefConnect.Infrastructure --startup-project .

# Apply migrations (may fail with Supabase -- use SQL Editor as fallback)
dotnet ef database update --project ../ReliefConnect.Infrastructure --startup-project .

# Generate SQL script for manual apply
dotnet ef migrations script --idempotent --project ../ReliefConnect.Infrastructure --startup-project .

# Generate SQL for only pending migrations (from last applied)
dotnet ef migrations script 20260303065344_AddAuthFields --idempotent --project ../ReliefConnect.Infrastructure --startup-project .
```

## Architecture Reference

```
src/
  ReliefConnect.Core/          # Domain: Entities, DTOs, Interfaces, Enums
  ReliefConnect.Infrastructure/ # Data: AppDbContext, Repositories, Services, Migrations
  ReliefConnect.API/           # Presentation: Controllers, Hubs, Middleware, Program.cs
    Controllers/
      AdminController.cs       # api/admin — User management, verification, batch operations
      AdminModerationController.cs # api/admin/moderation — Posts, reports moderation
      AdminSystemController.cs # api/admin/system — Stats, logs, announcements, CSV export
      VolunteerController.cs   # api/volunteer — Task list, accept, active tasks
      SponsorController.cs     # api/sponsor — Search cases, offer help
      AuthController.cs        # api/auth — Login, register, password reset, role verification
      MapController.cs         # api/map — Pings CRUD
      PostController.cs        # api/social — Posts, comments, reactions
      ChatbotController.cs     # api/chatbot — Conversations, messages
      SupplyController.cs      # api/supply — Supply item management
      ZoneController.cs        # api/zone — Risk zone boundaries
    Extensions/
      ControllerExtensions.cs  # Shared helpers: LogAdminAction(), CsvSafe()
  ReliefConnect.Tests/         # Unit & Integration tests
client/
  src/
    pages/                     # React pages (admin, volunteer, sponsor, etc.)
    components/                # Reusable components (ui/, layout/, map/, panels/)
    services/
      api.ts                   # Axios API client with all endpoint functions
    types/
      admin.ts               # TypeScript interfaces for admin API types
    stores/                    # Zustand state management
    i18n/                      # Internationalization
```

### Backend: New Files (Session 2026-03-31)
- `src/ReliefConnect.API/Extensions/ControllerExtensions.cs` — Shared LogAdminAction() and CsvSafe() helpers
- `src/ReliefConnect.API/Controllers/AdminModerationController.cs` — Content moderation (posts, reports)
- `src/ReliefConnect.API/Controllers/AdminSystemController.cs` — System ops (stats, logs, announcements, CSV export)

### Frontend: Files Updated (Session 2026-03-31)
- `client/src/types/admin.ts` — TypeScript interfaces for all admin API types
- `client/src/services/api.ts` — Updated adminApi with 26 methods matching 3-controller split
- `client/src/pages/AdminPage.tsx` — Rewritten: 7-tab layout with expandable batch log rows
