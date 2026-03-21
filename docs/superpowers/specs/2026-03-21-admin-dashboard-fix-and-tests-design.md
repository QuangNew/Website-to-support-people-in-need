# Admin Dashboard — Fix, Performance & Playwright Tests
**Date:** 2026-03-21
**Status:** Approved
**Scope:** Backend performance fixes, frontend hardening, new admin posts endpoint, Playwright test suite

---

## Problem Statement

1. `GET /api/admin/stats` takes **~14 seconds** due to 10 sequential `COUNT` queries fired one after another against Supabase (remote PostgreSQL). `OutputCache` with policy `Static5min` is ineffective for authenticated requests because ASP.NET Core skips output caching when an `Authorization` header is present unless explicitly configured to vary by it.
2. `UsersPanel` search runs `ToLower().Contains()` as a client-side EF expression, causing full-table loads in some EF providers.
3. `PostsPanel` calls the public `socialApi.getPosts` endpoint, which is subject to the `Posts2min` output cache and lacks admin-specific filtering and pagination.
4. `StatsPanel` shows a spinner forever on fetch failure — no error state, no retry.
5. No Playwright tests exist for the admin dashboard (API or E2E).

---

## Architecture

No new projects or major structural changes. All fixes are targeted edits within existing files:

```
src/ReliefConnect.API/
  Controllers/AdminController.cs     ← parallel counts, new admin posts endpoint
  Program.cs                         ← fix OutputCache policy for authenticated requests

src/ReliefConnect.Infrastructure/
  Data/Migrations/                   ← new migration: index on SystemLogs(Action, CreatedAt)

client/src/
  pages/AdminPage.tsx                ← StatsPanel error/skeleton, PostsPanel → adminApi
  services/api.ts                    ← add adminApi.getPosts

tests/
  admin.spec.ts                      ← new: 12 tests (API + E2E)
  fixtures/adminAuth.ts              ← new: shared admin JWT fixture
```

---

## Backend Changes

### 1. `GetStats` — Parallel Task.WhenAll

**File:** `AdminController.cs` — `GetStats()`

Replace 10 sequential `await CountAsync()` calls with concurrent tasks:

```csharp
[HttpGet("stats")]
[OutputCache(PolicyName = "Static5min")]
public async Task<ActionResult<SystemStatsDto>> GetStats()
{
    var users = _userManager.Users.AsNoTracking();

    var t1  = users.CountAsync();
    var t2  = users.CountAsync(u => u.Role == RoleEnum.PersonInNeed);
    var t3  = users.CountAsync(u => u.Role == RoleEnum.Sponsor);
    var t4  = users.CountAsync(u => u.Role == RoleEnum.Volunteer);
    var t5  = _db.Pings.CountAsync(p => p.Type == MapItemType.SOS && p.Status == SOSStatus.Pending);
    var t6  = _db.Pings.CountAsync(p => p.Status == SOSStatus.Resolved);
    var t7  = _db.Posts.CountAsync();
    var t8  = _db.Posts.CountAsync(p => p.Category == PostCategory.Livelihood);
    var t9  = _db.Posts.CountAsync(p => p.Category == PostCategory.Medical);
    var t10 = _db.Posts.CountAsync(p => p.Category == PostCategory.Education);

    await Task.WhenAll(t1, t2, t3, t4, t5, t6, t7, t8, t9, t10);

    return Ok(new SystemStatsDto
    {
        TotalUsers             = t1.Result,
        TotalPersonsInNeed     = t2.Result,
        TotalSponsors          = t3.Result,
        TotalVolunteers        = t4.Result,
        ActiveSOS              = t5.Result,
        ResolvedCases          = t6.Result,
        TotalPosts             = t7.Result,
        TotalPostsLivelihood   = t8.Result,
        TotalPostsMedical      = t9.Result,
        TotalPostsEducation    = t10.Result,
    });
}
```

**Expected result:** 14s → ~150ms (single DB round-trip latency instead of 10 serial).

### 2. OutputCache — Fix for Authenticated Requests

**File:** `Program.cs` — `AddOutputCache` configuration

ASP.NET Core OutputCache skips responses when an `Authorization` header is present by default. Fix both affected policies:

```csharp
options.AddPolicy("Static5min", p => p
    .Expire(TimeSpan.FromMinutes(5))
    .SetVaryByHeader("Authorization"));

options.AddPolicy("Posts2min", p => p
    .Expire(TimeSpan.FromMinutes(2))
    .SetVaryByHeader("Authorization"));
```

### 3. Users Panel — Postgres ILike Search

**File:** `AdminController.cs` — `GetUsers()`

Replace client-evaluated `.ToLower().Contains()` with `EF.Functions.ILike` to push the filter to the DB:

```csharp
if (!string.IsNullOrWhiteSpace(search))
{
    var pattern = $"%{search}%";
    query = query.Where(u =>
        EF.Functions.ILike(u.FullName, pattern) ||
        EF.Functions.ILike(u.Email!, pattern) ||
        EF.Functions.ILike(u.UserName!, pattern));
}
```

### 4. New Admin Posts Endpoint

**File:** `AdminController.cs` — new `GetPosts` method

```
GET /api/admin/posts?page=1&pageSize=20&category=
```

- Returns posts with author name, content snippet, category, created date
- Supports `category` filter (Livelihood / Medical / Education / empty = all)
- Paginated (page + pageSize), ordered by `CreatedAt DESC`
- No output cache (admin needs fresh data for moderation)
- Protected by `RequireAdmin` policy (inherited from controller)

Response shape:
```json
{ "items": [...], "total": 42, "page": 1, "pageSize": 20, "totalPages": 3 }
```

### 5. SystemLogs Index Migration

**File:** New EF Core migration

```csharp
migrationBuilder.CreateIndex(
    name: "IX_SystemLogs_Action_CreatedAt",
    table: "SystemLogs",
    columns: new[] { "Action", "CreatedAt" },
    descending: new[] { false, true });
```

---

## Frontend Changes

### 6. StatsPanel — Skeleton + Error State

**File:** `AdminPage.tsx` — `StatsPanel` component

Current: spinner forever on failure. New states:
- **Loading:** render skeleton cards (pulsing `div` placeholders matching the stat-card grid) — no layout shift when data arrives
- **Error:** show error message + `RefreshCw` retry button that re-triggers the fetch
- **Success:** existing card grid (unchanged)

Remove the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment and add `t` to the `useEffect` dep array.

### 7. PostsPanel — Switch to Admin Endpoint

**File:** `AdminPage.tsx` — `PostsPanel` component
**File:** `client/src/services/api.ts` — `adminApi`

- Add `adminApi.getPosts(params)` → `GET /api/admin/posts`
- `PostsPanel` calls `adminApi.getPosts` instead of `socialApi.getPosts`
- Add category filter dropdown
- Add pagination controls (matching `UsersPanel` pattern)

---

## Playwright Tests

### Fixture: `tests/fixtures/adminAuth.ts`

Logs in once per worker via `POST /api/auth/login` with admin credentials. Exposes:
- `adminToken: string` — for API (`request`) tests
- `adminPage: Page` — browser navigated to `/admin` with token in `localStorage`

Credentials read from environment: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults to `admin_test@reliefconnect.vn` / `Admin@123`).

### Tests: `tests/admin.spec.ts`

**API tests (request fixture — no browser):**

| # | Test | Assertion |
|---|---|---|
| 1 | `GET /api/admin/stats` returns 200 | status 200, all 10 fields present |
| 2 | `GET /api/admin/stats` responds fast | duration < 2000ms |
| 3 | `GET /api/admin/users` returns paginated shape | `items`, `total`, `page`, `pageSize`, `totalPages` present |
| 4 | `GET /api/admin/users?search=` filters results | response count ≤ unfiltered count |
| 5 | `GET /api/admin/logs` returns paginated shape | `items`, `total` present |
| 6 | `GET /api/admin/logs?action=Login` returns only Login entries | every item has `action === "Login"` |

**E2E tests (browser):**

| # | Test | Steps |
|---|---|---|
| 7 | Stats panel renders all stat cards | navigate `/admin`, click Stats tab, expect 10 stat cards visible |
| 8 | Stats cards show non-negative numbers | all `.admin-stat-card__value` parse as integers ≥ 0 |
| 9 | Users panel loads rows + pagination | click Users tab, expect at least 1 table row, pagination controls visible |
| 10 | Search filter narrows user list | type in search box, row count changes |
| 11 | Posts panel loads with category filter | click Posts tab, select category, expect table refreshes |
| 12 | Logs panel loads with date filter | click Logs tab, set from-date, expect filtered results |

> **Approve/Reject flows** are intentionally omitted from E2E (they mutate real data). They are covered by manual QA and can be added later with a dedicated test-database fixture.

---

## Error Handling

- `GetStats` — if any individual `CountAsync` throws, `Task.WhenAll` will propagate the first exception; the global exception handler middleware returns 500. No partial-result scenario.
- Frontend `StatsPanel` — catches the error in `.catch()`, sets `error` state, shows retry UI.
- New admin posts endpoint — returns 400 if `category` value is not a valid `PostCategory` enum.

---

## Testing Strategy

| Layer | Coverage |
|---|---|
| API correctness | Tests 1, 3, 5 |
| API performance | Test 2 (regression guard: fail if stats > 2s) |
| API filter logic | Tests 4, 6 |
| Frontend rendering | Tests 7, 8, 9, 11, 12 |
| Frontend interactivity | Tests 10 (search), 12 (date filter) |

Run with:
```bash
npx playwright test tests/admin.spec.ts
```

---

## Files Touched

| File | Change |
|---|---|
| `src/ReliefConnect.API/Controllers/AdminController.cs` | Parallel stats, ILike search, new posts endpoint |
| `src/ReliefConnect.API/Program.cs` | OutputCache policy fix |
| `src/ReliefConnect.Infrastructure/Data/Migrations/` | New migration for SystemLogs index |
| `client/src/pages/AdminPage.tsx` | Skeleton/error state, PostsPanel switch |
| `client/src/services/api.ts` | `adminApi.getPosts` |
| `tests/admin.spec.ts` | New test file |
| `tests/fixtures/adminAuth.ts` | New shared fixture |

**Total new/modified files: 7**
