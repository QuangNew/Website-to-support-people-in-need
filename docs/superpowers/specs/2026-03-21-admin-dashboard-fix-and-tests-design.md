# Admin Dashboard — Fix, Performance & Playwright Tests
**Date:** 2026-03-21
**Status:** Approved (v2 — post spec-review)
**Scope:** Backend performance fixes, frontend hardening, new admin posts endpoint, Playwright test suite

---

## Problem Statement

1. `GET /api/admin/stats` takes **~14 seconds** due to 10 sequential `COUNT` queries fired one after another against Supabase (remote PostgreSQL).
2. `[OutputCache(PolicyName = "Static5min")]` is ineffective for authenticated requests — ASP.NET Core skips output caching when an `Authorization` header is present unless a fixed cache key is explicitly set.
3. `UsersPanel` search runs `ToLower().Contains()` evaluated client-side by EF, causing full-table loads.
4. `PostsPanel` calls the public `socialApi.getPosts` endpoint, subject to the `Posts2min` output cache and lacking admin-specific pagination/filtering.
5. `StatsPanel` shows a spinner forever on fetch failure — no error state, no retry.
6. No Playwright tests exist for the admin dashboard (API or E2E).

---

## Architecture

No new projects or major structural changes. All fixes are targeted edits within existing files:

```
src/ReliefConnect.API/
  Controllers/AdminController.cs     ← single-query stats, new admin posts endpoint, ILike search
  Program.cs                         ← fix OutputCache: use IMemoryCache with fixed key for stats

src/ReliefConnect.Infrastructure/
  Data/Migrations/                   ← new migration: index on SystemLogs(Action, CreatedAt)

client/src/
  pages/AdminPage.tsx                ← StatsPanel skeleton/error, PostsPanel switch, PostItem type
  services/api.ts                    ← add adminApi.getPosts

tests/
  admin.spec.ts                      ← new: 12 tests (API + E2E)
  fixtures/adminAuth.ts              ← new: shared admin JWT + page fixture
```

---

## Backend Changes

### 1. `GetStats` — 3 GROUP BY queries (10 round-trips → 3)

**Why not `Task.WhenAll`:** EF Core's `DbContext` is not thread-safe. Concurrent `CountAsync()` calls on the same `_db` or `_userManager.Users` instance throw `InvalidOperationException: A second operation was started on this context instance`. This rules out `Task.WhenAll` with a shared context.

**Solution: 3 sequential `GroupBy` projections** — one per logical entity group. Each `ToListAsync()` fires a single `GROUP BY` SQL query, collapsing 10 round-trips into 3. No raw SQL, no thread-safety risk.

**Implementation — 3 GROUP BY round-trips:**

```csharp
[HttpGet("stats")]
public async Task<ActionResult<SystemStatsDto>> GetStats(
    [FromServices] IMemoryCache cache)
{
    if (cache.TryGetValue("admin:stats", out SystemStatsDto? cached) && cached != null)
        return Ok(cached);

    // Round-trip 1: user role breakdown
    var userCounts = await _userManager.Users
        .AsNoTracking()
        .GroupBy(u => u.Role)
        .Select(g => new { Role = g.Key, Count = g.Count() })
        .ToListAsync();

    // Round-trip 2: ping status breakdown (SOS pings only)
    var pingCounts = await _db.Pings
        .AsNoTracking()
        .Where(p => p.Type == MapItemType.SOS)
        .GroupBy(p => p.Status)
        .Select(g => new { Status = g.Key, Count = g.Count() })
        .ToListAsync();

    // Round-trip 3: post category breakdown
    var postCounts = await _db.Posts
        .AsNoTracking()
        .GroupBy(p => p.Category)
        .Select(g => new { Category = g.Key, Count = g.Count() })
        .ToListAsync();

    // Local helpers — typed to match the anonymous projections above (no dynamic)
    int UserCount(RoleEnum role)       => userCounts.FirstOrDefault(x => x.Role == role)?.Count ?? 0;
    int PingCount(SOSStatus status)    => pingCounts.FirstOrDefault(x => x.Status == status)?.Count ?? 0;
    int PostCount(PostCategory cat)    => postCounts.FirstOrDefault(x => x.Category == cat)?.Count ?? 0;

    var stats = new SystemStatsDto
    {
        TotalUsers           = userCounts.Sum(x => x.Count),
        TotalPersonsInNeed   = UserCount(RoleEnum.PersonInNeed),
        TotalSponsors        = UserCount(RoleEnum.Sponsor),
        TotalVolunteers      = UserCount(RoleEnum.Volunteer),
        ActiveSOS            = PingCount(SOSStatus.Pending),
        ResolvedCases        = PingCount(SOSStatus.Resolved),
        TotalPosts           = postCounts.Sum(x => x.Count),
        TotalPostsLivelihood = PostCount(PostCategory.Livelihood),
        TotalPostsMedical    = PostCount(PostCategory.Medical),
        TotalPostsEducation  = PostCount(PostCategory.Education),
    };

    cache.Set("admin:stats", stats, TimeSpan.FromMinutes(5));
    return Ok(stats);
}
```

**Expected result:** 10 sequential round-trips (~14s) → 3 round-trips (~450ms on remote Supabase). No thread-safety risk. No raw SQL.

Remove `[OutputCache(PolicyName = "Static5min")]` from this endpoint — caching is handled by `IMemoryCache` directly inside the action (cache read/write is included in the implementation above).

`Program.cs` — no changes needed for OutputCache policies (leave `Static5min` for other uses, e.g. map data). Remove the `[OutputCache]` attribute from `GetStats` only.

### 2. Users Panel — Postgres ILike Search

**File:** `AdminController.cs` — `GetUsers()`

Replace client-evaluated `.ToLower().Contains()` with `EF.Functions.ILike`:

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

- Protected by `RequireAdmin` (controller-level)
- No output cache (admin needs fresh data for moderation)
- `category` param: optional, validated against `PostCategory` enum — returns 400 if invalid value provided
- Response shape:

```json
{
  "items": [
    {
      "id": 1,
      "content": "First 200 chars...",
      "category": "Livelihood",
      "authorId": "abc123",
      "authorName": "Nguyen Van A",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

A new `AdminPostDto` is added to `DTOs.cs` with exactly these fields (not reusing `PostResponseDto` which carries reaction counts, comment counts, and image URLs not needed here). The `content` field is truncated to 200 chars **in the EF `.Select()` projection** on the server:

```csharp
Content = p.Content.Length > 200 ? p.Content[..200] : p.Content,
```

### 5. GetLogs — Fix Filter Semantics

**File:** `AdminController.cs` — `GetLogs()`

Change `l.Action.Contains(action)` → `l.Action == action` for exact-match filtering. This aligns with the dropdown UI in `LogsPanel` (which sends exact values like `"Login"`, `"Register"`) and makes test assertions unambiguous.

Also add `totalPages` to the response for consistency with all other paginated endpoints:

```csharp
return Ok(new { items = logs, total, page, pageSize,
    totalPages = (int)Math.Ceiling(total / (double)pageSize) });
```

### 6. SystemLogs Index Migration

New EF Core migration:

```csharp
migrationBuilder.CreateIndex(
    name: "IX_SystemLogs_CreatedAt",
    table: "SystemLogs",
    column: "CreatedAt",
    descending: new[] { true });
```

Note: Index is on `CreatedAt DESC` only (not `Action`) because `Action` is filtered with `==` which can use a B-tree index, but the primary query bottleneck is the `ORDER BY CreatedAt DESC` + date-range scan. A composite index `(Action, CreatedAt DESC)` would be ideal once `Action` is indexed — adding it as a separate follow-up is acceptable; this migration targets the critical path.

---

## Frontend Changes

### 7. StatsPanel — Skeleton + Error State

**File:** `AdminPage.tsx` — `StatsPanel` component

State shape:
```ts
const [stats, setStats] = useState<Stats | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(false);
```

Render logic order (important — check `error` before `!stats`):
```tsx
if (loading) return <SkeletonStatsGrid />;    // pulsing placeholder cards
if (error)   return <ErrorRetry onRetry={load} />;
if (!stats)  return null;
return <StatsCards stats={stats} />;
```

`SkeletonStatsGrid`: renders 10 `admin-stat-card glass-card` divs with a pulsing `animate-pulse` style — same grid layout as real cards, no layout shift.

`ErrorRetry`: renders an error message + `<RefreshCw>` retry button that calls `load()`.

Remove `// eslint-disable-next-line react-hooks/exhaustive-deps` and add `t` to the `useEffect` dep array.

### 8. PostsPanel — Switch to Admin Endpoint + TypeScript Types

**File:** `AdminPage.tsx`

Update `PostItem` interface:
```ts
interface PostItem {
  id: number;
  content: string;
  category: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface PostsResponse {
  items: PostItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

`PostsPanel` changes:
- Call `adminApi.getPosts({ page, pageSize: 20, category: categoryFilter || undefined })`
- Add `categoryFilter` state (empty string = all)
- Add category dropdown and pagination controls (matching `UsersPanel` pattern)

**File:** `client/src/services/api.ts`

```ts
getPosts: (params?: { page?: number; pageSize?: number; category?: string }) =>
  api.get('/admin/posts', { params }),
```

---

## Playwright Tests

### Fixture: `tests/fixtures/adminAuth.ts`

Uses Playwright's `test.extend` pattern:

```ts
import { test as base, expect, Page } from '@playwright/test';

type AdminFixtures = {
  adminToken: string;
  adminPage: Page;
};

export const test = base.extend<AdminFixtures>({
  adminToken: async ({ request }, use) => {
    const email = process.env.ADMIN_EMAIL ?? 'admin_test@reliefconnect.vn';
    const password = process.env.ADMIN_PASSWORD ?? 'Admin@123';
    const res = await request.post('http://127.0.0.1:5164/api/auth/login',
      { data: { email, password } });
    const data = await res.json();
    await use(data.token ?? '');
  },

  adminPage: async ({ page, adminToken }, use) => {
    await page.goto('/');
    await page.evaluate((tok) => localStorage.setItem('token', tok), adminToken);
    await page.goto('/admin');
    await page.waitForSelector('.admin-sidebar', { timeout: 10000 });
    await use(page);
    // No token refresh — tests are short-lived relative to JWT expiry (60 min default)
  },
});

export { expect };
```

Credentials are read from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars. If absent, defaults to `admin_test@reliefconnect.vn` / `Admin@123`. If login returns a non-200, `adminToken` is empty string and all tests using it will fail fast with a clear auth error.

### Tests: `tests/admin.spec.ts`

**API tests (request fixture — no browser):**

| # | Test | Assertion |
|---|---|---|
| 1 | `GET /api/admin/stats` returns 200 | status 200; response has all 10 fields: `totalUsers`, `totalPersonsInNeed`, `totalSponsors`, `totalVolunteers`, `activeSOS`, `resolvedCases`, `totalPosts`, `totalPostsLivelihood`, `totalPostsMedical`, `totalPostsEducation` |
| 2 | `GET /api/admin/stats` responds fast | wall-clock duration recorded before/after request < 2000ms |
| 3 | `GET /api/admin/users` returns paginated shape | `items` is array, `total` ≥ 0, `page` === 1, `pageSize` present, `totalPages` ≥ 1 |
| 4 | `GET /api/admin/users?search=a` filters correctly | every returned `item.fullName + item.email + item.userName` (concatenated, lowercased) contains `"a"` — not just count ≤ total |
| 5 | `GET /api/admin/logs` returns paginated shape | `items` is array, `total` ≥ 0, `totalPages` present |
| 6 | `GET /api/admin/logs?action=Login` returns only Login entries | every returned `item.action === "Login"` (exact match, since backend now uses `==`) |

**E2E tests (browser via `adminPage` fixture):**

| # | Test | Steps & Assertions |
|---|---|---|
| 7 | Stats panel renders all 10 stat cards | click Stats tab → count of `.admin-stat-card` elements === 10 across both grids |
| 8 | Stats cards show non-negative numbers | all `.admin-stat-card__value` text content parses to integer ≥ 0 |
| 9 | Users panel loads rows + pagination | click Users tab → `tbody tr` count ≥ 1; if `totalPages > 1`, pagination buttons visible |
| 10 | Search filter narrows user list | type `"a"` in search → `tbody tr` count changes; wait for debounce/reload |
| 11 | Posts panel loads with category filter | click Posts tab → at least 1 row OR empty-state message; select "Livelihood" from category dropdown → table reloads |
| 12 | Logs panel loads with date filter | click Logs tab → at least 1 row OR empty-state; set from-date to yesterday → table reloads without error |

> **Approve/Reject and Delete flows** are intentionally excluded from E2E — they mutate live data. They should be run against a seeded test database in a separate CI job.

---

## Error Handling

- `GetStats` — if any of the 3 `ToListAsync()` calls throws, the exception propagates to the global middleware handler → 500. `IMemoryCache` is not written on failure. Retry on next request will attempt fresh DB queries.
- `PostsPanel` / `StatsPanel` — `.catch()` sets `error = true`, shows retry button.
- New admin posts endpoint — returns 400 `{ message: "Invalid category" }` if `category` query param is provided but doesn't parse as `PostCategory`.
- `GetLogs` with invalid `action` — no error, returns empty list (no matching exact values).

---

## Files Touched

| File | Change |
|---|---|
| `src/ReliefConnect.API/Controllers/AdminController.cs` | GROUP BY stats, IMemoryCache, ILike search, new posts endpoint, logs `==` fix + `totalPages` |
| `src/ReliefConnect.Infrastructure/Data/Migrations/` | New migration: `IX_SystemLogs_CreatedAt` |
| `client/src/pages/AdminPage.tsx` | StatsPanel skeleton/error, PostsPanel switch + pagination + types |
| `client/src/services/api.ts` | `adminApi.getPosts` |
| `src/ReliefConnect.Core/DTOs/DTOs.cs` | New `AdminPostDto` |
| `tests/admin.spec.ts` | New: 12 tests |
| `tests/fixtures/adminAuth.ts` | New: shared fixture |

**Total new/modified files: 7**
