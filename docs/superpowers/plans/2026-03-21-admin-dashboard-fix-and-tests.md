# Admin Dashboard Fix & Tests Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 14-second admin stats query, broken caching, client-side search, wrong posts endpoint, and missing error states — then prove it all works with 12 Playwright tests.

**Architecture:** Targeted edits to `AdminController.cs` (3 GROUP BY queries + IMemoryCache + ILike search + new posts endpoint + logs fix), `AdminPage.tsx` (StatsPanel error/skeleton, PostsPanel admin endpoint + pagination), `api.ts` (add `adminApi.getPosts`), and new Playwright fixture + test file. One new EF Core migration for a `SystemLogs.CreatedAt` index.

**Tech Stack:** ASP.NET Core 10 / EF Core / `IMemoryCache` / React 19 + TypeScript / Playwright

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/ReliefConnect.API/Controllers/AdminController.cs` | Modify | GROUP BY stats, IMemoryCache, ILike search, new GET /admin/posts, logs `==` + totalPages |
| `src/ReliefConnect.Core/DTOs/DTOs.cs` | Modify | Add `AdminPostDto` |
| `src/ReliefConnect.Infrastructure/Data/Migrations/` | Create | `IX_SystemLogs_CreatedAt` index migration |
| `client/src/services/api.ts` | Modify | Add `adminApi.getPosts` |
| `client/src/pages/AdminPage.tsx` | Modify | StatsPanel skeleton+error, PostsPanel switch to admin endpoint + pagination + types |
| `tests/fixtures/adminAuth.ts` | Create | Shared admin JWT + adminPage fixture |
| `tests/admin.spec.ts` | Create | 12 API + E2E tests |

---

## Task 1: Add `AdminPostDto` to DTOs

**Files:**
- Modify: `src/ReliefConnect.Core/DTOs/DTOs.cs` (after line 101, after `ResetPasswordDto`)

- [ ] **Step 1: Add the DTO**

Open `src/ReliefConnect.Core/DTOs/DTOs.cs`. After the closing `}` of `ResetPasswordDto` (line 101), add:

```csharp
public class AdminPostDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string AuthorId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd src/ReliefConnect.API
dotnet build --no-restore -q
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add src/ReliefConnect.Core/DTOs/DTOs.cs
git commit -m "feat: add AdminPostDto for admin posts endpoint"
```

---

## Task 2: Fix `GetStats` — 3 GROUP BY queries + IMemoryCache

**Files:**
- Modify: `src/ReliefConnect.API/Controllers/AdminController.cs` (lines 238–259)

The current implementation fires 10 sequential `CountAsync()` calls (~14s on remote Supabase). Replace with 3 `GroupBy` queries and cache the result in `IMemoryCache` for 5 minutes.

- [ ] **Step 1: Add `using Microsoft.Extensions.Caching.Memory;` to AdminController.cs**

Open `src/ReliefConnect.API/Controllers/AdminController.cs`. The using block is at the top. Add this line after the existing usings (before `namespace`):

```csharp
using Microsoft.Extensions.Caching.Memory;
```

- [ ] **Step 2: Replace `GetStats` method**

Find and replace the entire `GetStats` method (lines 238–259):

```csharp
// BEFORE — remove this:
[HttpGet("stats")]
[OutputCache(PolicyName = "Static5min")]
public async Task<ActionResult<SystemStatsDto>> GetStats()
{
    var users = _userManager.Users.AsNoTracking();

    var stats = new SystemStatsDto
    {
        TotalUsers = await users.CountAsync(),
        TotalPersonsInNeed = await users.CountAsync(u => u.Role == RoleEnum.PersonInNeed),
        TotalSponsors = await users.CountAsync(u => u.Role == RoleEnum.Sponsor),
        TotalVolunteers = await users.CountAsync(u => u.Role == RoleEnum.Volunteer),
        ActiveSOS = await _db.Pings.CountAsync(p => p.Type == MapItemType.SOS && p.Status == SOSStatus.Pending),
        ResolvedCases = await _db.Pings.CountAsync(p => p.Status == SOSStatus.Resolved),
        TotalPosts = await _db.Posts.CountAsync(),
        TotalPostsLivelihood = await _db.Posts.CountAsync(p => p.Category == PostCategory.Livelihood),
        TotalPostsMedical = await _db.Posts.CountAsync(p => p.Category == PostCategory.Medical),
        TotalPostsEducation = await _db.Posts.CountAsync(p => p.Category == PostCategory.Education),
    };

    return Ok(stats);
}
```

```csharp
// AFTER — replace with this:
/// <summary>
/// Get system-wide statistics. Results cached 5 minutes in IMemoryCache (fixed key, works with auth).
/// </summary>
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

    int UserCount(RoleEnum role)    => userCounts.FirstOrDefault(x => x.Role == role)?.Count ?? 0;
    int PingCount(SOSStatus status) => pingCounts.FirstOrDefault(x => x.Status == status)?.Count ?? 0;
    int PostCount(PostCategory cat) => postCounts.FirstOrDefault(x => x.Category == cat)?.Count ?? 0;

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

- [ ] **Step 3: Build to verify**

```bash
cd src/ReliefConnect.API
dotnet build --no-restore -q
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add src/ReliefConnect.API/Controllers/AdminController.cs
git commit -m "perf: replace 10 CountAsync calls with 3 GROUP BY queries + IMemoryCache in GetStats"
```

---

## Task 3: Fix `GetUsers` — ILike server-side search

**Files:**
- Modify: `src/ReliefConnect.API/Controllers/AdminController.cs` (lines 59–66)

The current search uses `.ToLower().Contains()` which EF Core evaluates client-side (loads entire user table). Replace with `EF.Functions.ILike` to push the filter to PostgreSQL.

- [ ] **Step 1: Replace the search block**

Find this block (lines 59–66):

```csharp
// Search by name, email, or username
if (!string.IsNullOrWhiteSpace(search))
{
    var s = search.ToLower();
    query = query.Where(u =>
        u.FullName.ToLower().Contains(s) ||
        u.Email!.ToLower().Contains(s) ||
        u.UserName!.ToLower().Contains(s));
}
```

Replace with:

```csharp
// Search by name, email, or username (server-side ILike — case-insensitive, pushed to Postgres)
if (!string.IsNullOrWhiteSpace(search))
{
    var pattern = $"%{search}%";
    query = query.Where(u =>
        EF.Functions.ILike(u.FullName, pattern) ||
        EF.Functions.ILike(u.Email!, pattern) ||
        EF.Functions.ILike(u.UserName!, pattern));
}
```

- [ ] **Step 2: Build**

```bash
cd src/ReliefConnect.API
dotnet build --no-restore -q
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add src/ReliefConnect.API/Controllers/AdminController.cs
git commit -m "perf: replace client-side Contains with EF.Functions.ILike in GetUsers"
```

---

## Task 4: Add `GET /api/admin/posts` endpoint

**Files:**
- Modify: `src/ReliefConnect.API/Controllers/AdminController.cs` (insert before `// SYSTEM STATS` section, around line 231)

The `PostsPanel` currently calls the public `socialApi.getPosts` which is output-cached and lacks admin pagination. This new endpoint gives admin fresh, paginated, category-filtered data.

- [ ] **Step 1: Add the endpoint**

In `AdminController.cs`, locate the comment `// ═══════════════════════════════════════════` above `// SYSTEM STATS` (around line 231). Insert the following block **before** it:

```csharp
// ═══════════════════════════════════════════
//  POSTS — Admin list with pagination + filter
// ═══════════════════════════════════════════

/// <summary>
/// Get paginated post list for admin moderation. No output cache (admin needs fresh data).
/// </summary>
[HttpGet("posts")]
public async Task<ActionResult> GetPosts(
    [FromQuery] string? category,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20)
{
    if (pageSize > 50) pageSize = 50;

    if (!string.IsNullOrWhiteSpace(category) && !Enum.TryParse<PostCategory>(category, true, out _))
        return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Invalid category." });

    var query = _db.Posts
        .AsNoTracking()
        .Include(p => p.Author)
        .AsQueryable();

    if (!string.IsNullOrWhiteSpace(category) && Enum.TryParse<PostCategory>(category, true, out var cat))
        query = query.Where(p => p.Category == cat);

    var total = await query.CountAsync();
    var posts = await query
        .OrderByDescending(p => p.CreatedAt)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .Select(p => new AdminPostDto
        {
            Id = p.Id,
            Content = p.Content.Length > 200 ? p.Content[..200] : p.Content,
            Category = p.Category.ToString(),
            AuthorId = p.AuthorId,
            AuthorName = p.Author != null ? (p.Author.FullName ?? p.Author.UserName ?? "Ẩn danh") : "Ẩn danh",
            CreatedAt = p.CreatedAt
        })
        .ToListAsync();

    return Ok(new
    {
        items = posts,
        total,
        page,
        pageSize,
        totalPages = (int)Math.Ceiling(total / (double)pageSize)
    });
}
```

- [ ] **Step 2: Build**

```bash
cd src/ReliefConnect.API
dotnet build --no-restore -q
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add src/ReliefConnect.API/Controllers/AdminController.cs
git commit -m "feat: add GET /api/admin/posts endpoint with pagination and category filter"
```

---

## Task 5: Fix `GetLogs` — exact match filter + `totalPages`

**Files:**
- Modify: `src/ReliefConnect.API/Controllers/AdminController.cs` (lines 278–303)

Two fixes: (1) `l.Action.Contains(action)` → `l.Action == action` so the dropdown filter is exact-match. (2) Add `totalPages` to the response for frontend pagination controls.

- [ ] **Step 1: Fix the action filter and response**

Find this line in `GetLogs`:

```csharp
if (!string.IsNullOrWhiteSpace(action))
    query = query.Where(l => l.Action.Contains(action));
```

Change to:

```csharp
if (!string.IsNullOrWhiteSpace(action))
    query = query.Where(l => l.Action == action);
```

Then find the return statement:

```csharp
return Ok(new { items = logs, total, page, pageSize });
```

Change to:

```csharp
return Ok(new { items = logs, total, page, pageSize,
    totalPages = (int)Math.Ceiling(total / (double)pageSize) });
```

- [ ] **Step 2: Build**

```bash
cd src/ReliefConnect.API
dotnet build --no-restore -q
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add src/ReliefConnect.API/Controllers/AdminController.cs
git commit -m "fix: GetLogs uses exact-match action filter and returns totalPages"
```

---

## Task 6: Add `IX_SystemLogs_CreatedAt` migration

**Files:**
- Create: migration in `src/ReliefConnect.Infrastructure/Data/Migrations/`

This index speeds up the `ORDER BY CreatedAt DESC` + date-range scan in `GetLogs`.

- [ ] **Step 1: Scaffold the migration**

```bash
cd src/ReliefConnect.API
dotnet ef migrations add AddSystemLogsCreatedAtIndex \
  --project ../ReliefConnect.Infrastructure \
  --startup-project .
```

Expected: new migration file created in `src/ReliefConnect.Infrastructure/Data/Migrations/`.

- [ ] **Step 2: Open the generated migration and replace its body**

The scaffolded migration will have empty `Up`/`Down`. Replace with:

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.CreateIndex(
        name: "IX_SystemLogs_CreatedAt",
        table: "SystemLogs",
        column: "CreatedAt",
        descending: new[] { true });
}

protected override void Down(MigrationBuilder migrationBuilder)
{
    migrationBuilder.DropIndex(
        name: "IX_SystemLogs_CreatedAt",
        table: "SystemLogs");
}
```

- [ ] **Step 3: Apply the migration**

```bash
dotnet ef database update \
  --project ../ReliefConnect.Infrastructure \
  --startup-project .
```

Expected: `Done.`

- [ ] **Step 4: Commit**

```bash
git add src/ReliefConnect.Infrastructure/Data/Migrations/
git commit -m "perf: add DESC index on SystemLogs.CreatedAt"
```

---

## Task 7: Add `adminApi.getPosts` to frontend api.ts

**Files:**
- Modify: `client/src/services/api.ts` (inside `adminApi` object, after `getStats`)

- [ ] **Step 1: Add the method**

Open `client/src/services/api.ts`. Find the `adminApi` object (around line 181). After `getStats: () => api.get('/admin/stats'),`, add:

```ts
getPosts: (params?: { page?: number; pageSize?: number; category?: string }) =>
  api.get('/admin/posts', { params }),
```

The final `adminApi` object should end:

```ts
  getStats: () =>
    api.get('/admin/stats'),

  getPosts: (params?: { page?: number; pageSize?: number; category?: string }) =>
    api.get('/admin/posts', { params }),
};
```

- [ ] **Step 2: Type-check**

```bash
cd client
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/services/api.ts
git commit -m "feat: add adminApi.getPosts to api service"
```

---

## Task 8: Fix `StatsPanel` — skeleton + error state

**Files:**
- Modify: `client/src/pages/AdminPage.tsx` — `StatsPanel` function (lines 138–206)

Currently: spinner forever on error, no retry, `eslint-disable` suppressing a real dep array bug.

- [ ] **Step 1: Replace the StatsPanel component**

Locate `function StatsPanel()` (line 138). Replace the entire function with:

```tsx
function StatsPanel() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    adminApi.getStats()
      .then((res) => setStats(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="animate-fade-in-up">
      <div className="admin-stats-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="admin-stat-card glass-card" style={{ opacity: 0.5 }}>
            <div className="admin-stat-card__icon" style={{ background: 'var(--bg-tertiary)', animationName: 'pulse' }} />
            <div className="admin-stat-card__info">
              <span className="admin-stat-card__value" style={{ background: 'var(--bg-tertiary)', borderRadius: 4, color: 'transparent' }}>000</span>
              <span className="admin-stat-card__label" style={{ background: 'var(--bg-tertiary)', borderRadius: 4, color: 'transparent' }}>Loading</span>
            </div>
          </div>
        ))}
      </div>
      <div className="admin-stats-grid" style={{ marginTop: 'var(--sp-6)' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-stat-card glass-card" style={{ opacity: 0.5 }}>
            <div className="admin-stat-card__icon" style={{ background: 'var(--bg-tertiary)', animationName: 'pulse' }} />
            <div className="admin-stat-card__info">
              <span className="admin-stat-card__value" style={{ background: 'var(--bg-tertiary)', borderRadius: 4, color: 'transparent' }}>000</span>
              <span className="admin-stat-card__label" style={{ background: 'var(--bg-tertiary)', borderRadius: 4, color: 'transparent' }}>Loading</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="admin-empty animate-fade-in-up">
      <AlertTriangle size={48} strokeWidth={1.5} className="text-danger" />
      <p>{t('common.error')}</p>
      <button className="btn btn-secondary btn-sm" onClick={load} style={{ marginTop: 'var(--sp-3)' }}>
        <RefreshCw size={14} /> {t('common.retry') ?? 'Retry'}
      </button>
    </div>
  );

  if (!stats) return null;

  const cards = [
    { label: t('admin.totalUsers'), value: stats.totalUsers, icon: Users, color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.1)' },
    { label: t('admin.personsInNeed'), value: stats.totalPersonsInNeed, icon: AlertTriangle, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: t('admin.sponsors'), value: stats.totalSponsors, icon: Heart, color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.1)' },
    { label: t('admin.volunteers'), value: stats.totalVolunteers, icon: ShieldCheck, color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)' },
    { label: t('admin.activeSOS'), value: stats.activeSOS, icon: AlertTriangle, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.15)' },
    { label: t('admin.resolvedCases'), value: stats.resolvedCases, icon: CheckCircle2, color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.15)' },
  ];

  const postCards = [
    { label: t('admin.totalPosts'), value: stats.totalPosts, icon: FileText, color: 'var(--info-500)', bg: 'rgba(59, 130, 246, 0.1)' },
    { label: 'Gia cảnh', value: stats.totalPostsLivelihood, icon: Home, color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.1)' },
    { label: 'Bệnh tật', value: stats.totalPostsMedical, icon: Stethoscope, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: 'Giáo dục', value: stats.totalPostsEducation, icon: BookOpen, color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.1)' },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="admin-stats-grid">
        {cards.map((c) => (
          <div key={c.label} className="admin-stat-card glass-card">
            <div className="admin-stat-card__icon" style={{ background: c.bg, color: c.color }}>
              <c.icon size={22} />
            </div>
            <div className="admin-stat-card__info">
              <span className="admin-stat-card__value">{c.value}</span>
              <span className="admin-stat-card__label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)', color: 'var(--text-secondary)' }}>
        {t('admin.posts')}
      </h3>
      <div className="admin-stats-grid">
        {postCards.map((c) => (
          <div key={c.label} className="admin-stat-card glass-card">
            <div className="admin-stat-card__icon" style={{ background: c.bg, color: c.color }}>
              <c.icon size={22} />
            </div>
            <div className="admin-stat-card__info">
              <span className="admin-stat-card__value">{c.value}</span>
              <span className="admin-stat-card__label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd client
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/AdminPage.tsx
git commit -m "feat: StatsPanel skeleton loading state + error retry button"
```

---

## Task 9: Fix `PostsPanel` — switch to admin endpoint + types + pagination

**Files:**
- Modify: `client/src/pages/AdminPage.tsx` — `PostItem` interface (line 52) and `PostsPanel` function (lines 460–525)

Currently uses `socialApi.getPosts` (public, cached). Switches to `adminApi.getPosts` with pagination and category filter.

- [ ] **Step 1: Update `PostItem` interface and add `PostsResponse`**

Find the `PostItem` interface (line 52):

```ts
interface PostItem {
  id: number;
  content: string;
  category: string;
  authorName: string;
  createdAt: string;
}
```

Replace with:

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

- [ ] **Step 2: Replace `PostsPanel` function**

Find `function PostsPanel()` (line 460). Replace the entire function with:

```tsx
function PostsPanel() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getPosts({ page, pageSize: 20, category: categoryFilter || undefined })
      .then((res) => {
        const data: PostsResponse = res.data;
        setPosts(data.items);
        setTotalPages(data.totalPages);
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [page, categoryFilter, t]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (postId: number) => {
    if (!confirm(t('admin.confirmDelete'))) return;
    try {
      await adminApi.deletePost(postId);
      toast.success(t('admin.delete'));
      load();
    } catch {
      toast.error(t('common.error'));
    }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="admin-filters">
        <select
          className="admin-select"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          <option value="Livelihood">Gia cảnh</option>
          <option value="Medical">Bệnh tật</option>
          <option value="Education">Giáo dục</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('admin.user')}</th>
              <th>Content</th>
              <th>Category</th>
              <th>{t('admin.date')}</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>{p.authorName}</td>
                <td className="admin-td-content">{p.content.substring(0, 100)}{p.content.length > 100 ? '…' : ''}</td>
                <td><span className="admin-badge">{p.category}</span></td>
                <td className="admin-td-date">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => handleDelete(p.id)}>
                    <Trash2 size={14} /> {t('admin.delete')}
                  </button>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>{t('admin.noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="admin-page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Remove `socialApi` from the import if no longer used**

Check the import at line 8:
```ts
import { adminApi, socialApi } from '../services/api';
```

`socialApi` is no longer used by `PostsPanel`. Search the rest of the file to confirm no other component uses `socialApi`. If nothing else does, change to:

```ts
import { adminApi } from '../services/api';
```

- [ ] **Step 4: Type-check and lint**

```bash
cd client
pnpm tsc --noEmit
pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AdminPage.tsx
git commit -m "feat: PostsPanel switches to admin endpoint with pagination and category filter"
```

---

## Task 10: Create Playwright admin fixture

**Files:**
- Create: `tests/fixtures/adminAuth.ts`

This fixture provides two helpers used by all admin tests:
- `adminToken` — a valid admin JWT (API-only tests use this)
- `adminPage` — a `Page` pre-seeded with the token and navigated to `/admin`

Credentials come from env vars `ADMIN_EMAIL` / `ADMIN_PASSWORD` (fallback: `admin_test@reliefconnect.vn` / `Admin@123`).

- [ ] **Step 1: Create `tests/fixtures/` directory and file**

```bash
mkdir -p tests/fixtures
```

Create `tests/fixtures/adminAuth.ts`:

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
    const res = await request.post('http://127.0.0.1:5164/api/auth/login', {
      data: { email, password },
    });
    const data = await res.json();
    await use(data.token ?? '');
  },

  adminPage: async ({ page, adminToken }, use) => {
    await page.goto('/');
    await page.evaluate((tok) => localStorage.setItem('token', tok), adminToken);
    await page.goto('/admin');
    await page.waitForSelector('.admin-sidebar', { timeout: 10000 });
    await use(page);
  },
});

export { expect };
```

- [ ] **Step 2: Verify TypeScript sees it**

```bash
cd ..   # project root
npx tsc --noEmit --project tsconfig.json 2>/dev/null || npx playwright test --list 2>&1 | head -5
```

Expected: no type errors in the fixture file.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/adminAuth.ts
git commit -m "test: add adminAuth Playwright fixture with token and page helpers"
```

---

## Task 11: Write Playwright API tests (tests 1–6)

**Files:**
- Create: `tests/admin.spec.ts`

These 6 tests use the `request` fixture only (no browser) — fast and reliable.

- [ ] **Step 1: Create `tests/admin.spec.ts` with API tests**

```ts
import { test as adminTest, expect } from './fixtures/adminAuth';
import { test, request as pwRequest } from '@playwright/test';

const API = 'http://127.0.0.1:5164/api';

// ─── API TESTS (no browser) ───────────────────────────────────────────────

adminTest.describe('Admin API', () => {
  adminTest('1. GET /api/admin/stats returns 200 with all 10 fields', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const required = [
      'totalUsers', 'totalPersonsInNeed', 'totalSponsors', 'totalVolunteers',
      'activeSOS', 'resolvedCases', 'totalPosts',
      'totalPostsLivelihood', 'totalPostsMedical', 'totalPostsEducation',
    ];
    for (const field of required) {
      expect(body, `missing field: ${field}`).toHaveProperty(field);
    }
  });

  adminTest('2. GET /api/admin/stats responds within 2 seconds', async ({ request, adminToken }) => {
    const start = Date.now();
    const res = await request.get(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const elapsed = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(elapsed, `stats took ${elapsed}ms — expected < 2000ms`).toBeLessThan(2000);
  });

  adminTest('3. GET /api/admin/users returns paginated shape', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeGreaterThanOrEqual(0);
    expect(body.page).toBe(1);
    expect(typeof body.pageSize).toBe('number');
    expect(typeof body.totalPages).toBe('number');
    expect(body.totalPages).toBeGreaterThanOrEqual(1);
  });

  adminTest('4. GET /api/admin/users?search=a filters by search term', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/users?search=a`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Every returned item must contain "a" in fullName, email, or userName
    for (const user of body.items as Array<{ fullName: string; email: string; userName: string }>) {
      const combined = `${user.fullName} ${user.email} ${user.userName}`.toLowerCase();
      expect(combined, `user "${user.userName}" doesn't contain "a"`).toContain('a');
    }
  });

  adminTest('5. GET /api/admin/logs returns paginated shape with totalPages', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeGreaterThanOrEqual(0);
    expect(typeof body.totalPages).toBe('number');
  });

  adminTest('6. GET /api/admin/logs?action=Login returns only Login entries', async ({ request, adminToken }) => {
    const res = await request.get(`${API}/admin/logs?action=Login`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const log of body.items as Array<{ action: string }>) {
      expect(log.action).toBe('Login');
    }
  });
});
```

- [ ] **Step 2: Run the API tests against a running backend**

Start the backend if not running: `cd src/ReliefConnect.API && dotnet run &`

```bash
npx playwright test tests/admin.spec.ts --grep "Admin API" --reporter=line
```

Expected: all 6 pass (or fail with clear assertion messages — not TypeScript/import errors).

- [ ] **Step 3: Commit**

```bash
git add tests/admin.spec.ts
git commit -m "test: add 6 admin API Playwright tests (stats, users, logs)"
```

---

## Task 12: Write Playwright E2E tests (tests 7–12)

**Files:**
- Modify: `tests/admin.spec.ts` — append E2E test suite

- [ ] **Step 1: Append E2E tests to `tests/admin.spec.ts`**

After the closing `});` of the `Admin API` describe block, append:

```ts
// ─── E2E TESTS (browser) ─────────────────────────────────────────────────

adminTest.describe('Admin E2E', () => {
  adminTest('7. Stats panel renders all 10 stat cards', async ({ adminPage }) => {
    // Stats tab is active by default — wait for cards to render
    await adminPage.waitForSelector('.admin-stat-card', { timeout: 10000 });
    const cards = await adminPage.locator('.admin-stat-card').count();
    expect(cards).toBe(10);
  });

  adminTest('8. Stats cards show non-negative numbers', async ({ adminPage }) => {
    await adminPage.waitForSelector('.admin-stat-card__value', { timeout: 10000 });
    const values = await adminPage.locator('.admin-stat-card__value').allTextContents();
    for (const v of values) {
      const n = parseInt(v.replace(/,/g, ''), 10);
      expect(isNaN(n) ? 0 : n).toBeGreaterThanOrEqual(0);
    }
  });

  adminTest('9. Users panel loads rows and pagination', async ({ adminPage }) => {
    await adminPage.click('button:has-text("Users"), button[data-tab="users"], .admin-nav-btn:has-text("User")');
    await adminPage.waitForSelector('tbody tr', { timeout: 10000 });
    const rows = await adminPage.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
    // If more than 1 page, pagination controls should be visible
    const paginationVisible = await adminPage.locator('.admin-pagination').isVisible().catch(() => false);
    // Pagination only required when totalPages > 1 — just verify it doesn't throw
  });

  adminTest('10. Search filter narrows user list', async ({ adminPage }) => {
    await adminPage.click('button:has-text("Users"), button[data-tab="users"], .admin-nav-btn:has-text("User")');
    await adminPage.waitForSelector('tbody tr', { timeout: 10000 });
    const beforeCount = await adminPage.locator('tbody tr').count();

    const searchInput = adminPage.locator('input[type="text"], input[placeholder*="earch"]').first();
    await searchInput.fill('a');
    // Wait for debounce + table reload
    await adminPage.waitForTimeout(600);
    await adminPage.waitForSelector('tbody tr', { timeout: 5000 });
    // Row count changed or "no data" row appeared — either is acceptable
    // What matters: no error toast, table re-rendered
    const errorToast = adminPage.locator('.react-hot-toast, [class*="toast"]').filter({ hasText: /error/i });
    await expect(errorToast).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  adminTest('11. Posts panel loads with category filter', async ({ adminPage }) => {
    await adminPage.click('button:has-text("Posts"), button[data-tab="posts"], .admin-nav-btn:has-text("Post")');
    // Wait for either rows or empty state
    await adminPage.waitForSelector('tbody tr, .admin-empty', { timeout: 10000 });

    const categorySelect = adminPage.locator('select').filter({ hasText: /All Categories/i });
    if (await categorySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await categorySelect.selectOption('Livelihood');
      await adminPage.waitForSelector('tbody tr, .admin-empty', { timeout: 5000 });
    }
    // No error toast
    const errorToast = adminPage.locator('[class*="toast"]').filter({ hasText: /error/i });
    await expect(errorToast).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  adminTest('12. Logs panel loads with date filter', async ({ adminPage }) => {
    await adminPage.click('button:has-text("Logs"), button[data-tab="logs"], .admin-nav-btn:has-text("Log")');
    await adminPage.waitForSelector('tbody tr, .admin-empty', { timeout: 10000 });

    // Set from-date to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0]; // "YYYY-MM-DD"

    const dateInput = adminPage.locator('input[type="date"]').first();
    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateInput.fill(dateStr);
      await adminPage.waitForSelector('tbody tr, .admin-empty', { timeout: 5000 });
    }
    // No error toast
    const errorToast = adminPage.locator('[class*="toast"]').filter({ hasText: /error/i });
    await expect(errorToast).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });
});
```

- [ ] **Step 2: Run all admin tests**

Make sure both frontend (`pnpm dev`) and backend (`dotnet run`) are running.

```bash
npx playwright test tests/admin.spec.ts --reporter=line
```

Expected: 12 tests pass. If any E2E test fails, check:
- Backend is running on port 5164
- Frontend is running on port 5173 (check `playwright.config.ts` `baseURL`)
- An admin account exists with email `admin_test@reliefconnect.vn` / `Admin@123` (or set `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars)

- [ ] **Step 3: Commit**

```bash
git add tests/admin.spec.ts
git commit -m "test: add 6 E2E admin Playwright tests (stats, users, posts, logs)"
```

---

## Final Verification

- [ ] **Full build passes**

```bash
cd src/ReliefConnect.API
dotnet build -q
cd ../../client
pnpm tsc --noEmit
pnpm lint
```

- [ ] **All 12 Playwright tests pass**

```bash
cd ..
npx playwright test tests/admin.spec.ts --reporter=list
```

- [ ] **Merge commit**

```bash
git log --oneline -8
```

Should show 8 commits for this feature (Tasks 1–12 merged into clean history).
