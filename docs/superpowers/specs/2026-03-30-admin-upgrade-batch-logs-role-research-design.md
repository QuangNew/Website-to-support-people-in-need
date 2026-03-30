# Admin Upgrade, Batch Log Hierarchy & Role Research

> Date: 2026-03-30
> Status: Design Approved
> Approach: Bottom-Up (Entity sync -> Controller split -> Features -> Frontend -> Role research)

## Problem Statement

The MiniMax session applied 4 database migrations adding tables and columns (HelpOffers, Reports, SystemAnnouncements, ApplicationUser suspension fields, Ping assignment fields, Post.IsPinned, SystemLog batch hierarchy fields), but **the C# entity classes, controllers, and frontend were never updated to match**. The admin system remains a monolithic controller with basic features.

This design covers:
1. Syncing all C# entities with the existing database schema
2. Splitting AdminController into 3 focused controllers with new features
3. Implementing parent-child batch log hierarchy
4. Upgrading frontend with 7-tab admin page, expandable logs, new panels
5. Enforcing query optimization across all new code
6. Researching role gaps for Volunteer/Sponsor/PersonInNeed and updating dev.md

## Architecture Decision

**Approach A: Entity-First Bottom-Up** selected over Feature-Slice Vertical and Parallel Backend+Frontend alternatives. Rationale: clean dependency chain (entities -> controllers -> frontend), no broken intermediate states, commit per phase.

---

## Phase 1: Entity Sync (No New Migration)

The database already has all required columns/tables. We sync C# entities to match.

### 1.1 Update Existing Entities

**`src/ReliefConnect.Core/Entities/SystemLog.cs`**
```csharp
// ADD to existing entity:
public Guid? BatchId { get; set; }
public int? ParentLogId { get; set; }
public SystemLog? ParentLog { get; set; }
public ICollection<SystemLog> ChildLogs { get; set; } = [];
```

**`src/ReliefConnect.Core/Entities/ApplicationUser.cs`**
```csharp
// ADD to existing entity:
public bool IsSuspended { get; set; }
public DateTime? SuspendedUntil { get; set; }
public string? BanReason { get; set; }
public string? LastTokenJti { get; set; }
```

**`src/ReliefConnect.Core/Entities/Ping.cs`**
```csharp
// ADD to existing entity:
public string? AssignedVolunteerId { get; set; }
public ApplicationUser? AssignedVolunteer { get; set; }
public string? CompletionNotes { get; set; }
```

**`src/ReliefConnect.Core/Entities/Post.cs`**
```csharp
// ADD to existing entity:
public bool IsPinned { get; set; }
```

### 1.2 Create New Entities

**`src/ReliefConnect.Core/Entities/Report.cs`**
```csharp
public class Report
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public Post Post { get; set; } = null!;
    public string ReporterId { get; set; } = string.Empty;
    public ApplicationUser Reporter { get; set; } = null!;
    public string Reason { get; set; } = string.Empty;
    public ReportStatus Status { get; set; } = ReportStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```
> Note: DB does NOT have ReviewedByAdminId, AdminNotes, ReviewedAt columns.
> Review/dismiss actions update Status only. Admin notes deferred to future migration.

**`src/ReliefConnect.Core/Entities/HelpOffer.cs`**
```csharp
public class HelpOffer
{
    public int Id { get; set; }
    public string SponsorId { get; set; } = string.Empty;
    public ApplicationUser Sponsor { get; set; } = null!;
    public string TargetUserId { get; set; } = string.Empty;
    public ApplicationUser TargetUser { get; set; } = null!;
    public int? PingId { get; set; }
    public Ping? Ping { get; set; }
    public int? PostId { get; set; }
    public Post? Post { get; set; }
    public string Message { get; set; } = string.Empty; // NOT NULL in DB
    public HelpOfferStatus Status { get; set; } = HelpOfferStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

**`src/ReliefConnect.Core/Entities/SystemAnnouncement.cs`**
```csharp
public class SystemAnnouncement
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string AdminId { get; set; } = string.Empty;
    public ApplicationUser Admin { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
}
```
> Note: DB does NOT have IsActive column. Active/expired state derived from ExpiresAt at query time.

### 1.3 New Enums

**`src/ReliefConnect.Core/Enums/ReportStatus.cs`**
```csharp
public enum ReportStatus { Pending, Reviewed, Dismissed }
```

**`src/ReliefConnect.Core/Enums/HelpOfferStatus.cs`**
```csharp
public enum HelpOfferStatus { Pending, Accepted, Declined }
```

### 1.4 Update AppDbContext

Add DbSets:
```csharp
public DbSet<Report> Reports => Set<Report>();
public DbSet<HelpOffer> HelpOffers => Set<HelpOffer>();
public DbSet<SystemAnnouncement> SystemAnnouncements => Set<SystemAnnouncement>();
```

Fluent configuration:
- `SystemLog`: Self-referencing FK on `ParentLogId`, index on `BatchId`, index on `ParentLogId`
- `Report`: FK to Post, FK to Reporter (User), FK to ReviewedByAdmin, index on Status, index on PostId
- `HelpOffer`: FK to Sponsor, FK to TargetUser, optional FK to Ping, optional FK to Post, index on SponsorId, index on Status
- `SystemAnnouncement`: FK to Admin, index on ExpiresAt, index on AdminId
- `Ping`: FK to AssignedVolunteer (optional), index on AssignedVolunteerId
- `ApplicationUser`: index on IsSuspended

---

## Phase 2: Controller Split + Batch Log Hierarchy

### 2.1 AdminController (`api/admin`) - User Management

**Existing endpoints (moved/kept):**
- `GET /users` - Paginated user list with search/filter
- `PUT /users/{id}/role` - Approve role
- `GET /verifications` - Verification queue (cached 20s)
- `POST /verifications/{id}/reject` - Reject verification
- `POST /batch` - Batch operations (ENHANCED)

**New endpoints:**
- `GET /users/{id}` - User detail (profile + stats: post count, ping count, report count, offer count)
- `POST /users/{id}/suspend` - Suspend user with `SuspendUserDto { DurationHours: int, Reason: string }`
- `POST /users/{id}/unsuspend` - Unsuspend user (clear IsSuspended + SuspendedUntil)
- `POST /users/{id}/ban` - Permanent ban with `BanUserDto { Reason: string }`. Sets IsSuspended=true, SuspendedUntil=null (permanent), BanReason. Blacklists JWT via ITokenBlacklistService.
- `POST /users/{id}/force-logout` - Blacklist user's current JWT via ITokenBlacklistService
- `POST /users/{id}/reset-verification` - Reset VerificationStatus to Pending

### 2.2 AdminModerationController (`api/admin/moderation`) - Content Moderation

**Moved from AdminController:**
- `GET /posts` - Admin post list with pagination
- `DELETE /posts/{id}` - Delete post

**New endpoints:**
- `POST /posts/{id}/pin` - Toggle IsPinned on post
- `DELETE /comments/{id}` - Delete a comment (moderation)
- `GET /reports` - Paginated reports queue, Pending first, with reporter name + post content preview
- `POST /reports/{id}/review` - Mark report as Reviewed (status change only, no admin notes column in DB)
- `POST /reports/{id}/dismiss` - Dismiss report

### 2.3 AdminSystemController (`api/admin/system`) - System Operations

**Moved from AdminController:**
- `GET /stats` - System stats (ENHANCED with report/announcement/offer counts)
- `GET /logs` - System logs with HasChildren flag (OPTIMIZED: pre-fetch via GroupBy)

**New endpoints:**
- `GET /logs/{id}/children` - Get child logs for expandable row
- `GET /announcements` - Paginated announcements list
- `POST /announcements` - Create announcement with `CreateAnnouncementDto { Title, Content, ExpiresAt? }`
- `PUT /announcements/{id}` - Update announcement
- `DELETE /announcements/{id}` - Delete announcement
- `GET /export/users` - CSV export with `Take(10_000)` safety cap, CsvSafe() sanitization
- `GET /export/logs` - CSV export with `Take(10_000)` safety cap

### 2.4 Batch Log Parent-Child Hierarchy

**Current behavior:** Single flat log entry: `"approvals=2 rejections=1 deletions=0 applied=3"`

**New behavior:**
1. Generate `batchId = Guid.NewGuid()`
2. Create parent SystemLog:
   - `Action = "BatchActions"`
   - `Details = "3 operations: 2 role approvals, 1 rejection"`
   - `BatchId = batchId`
   - `ParentLogId = null`
3. For each operation result, create child SystemLog:
   - `Action = specific type ("RoleApproved", "VerificationRejected", "PostDeleted")`
   - `Details = specific description ("user1@email.com: Guest -> Volunteer")`
   - `BatchId = batchId`
   - `ParentLogId = parent.Id`
4. All inserts via single `AddRange` + `SaveChangesAsync` (one DB round-trip)

**GetLogs enhancement:**
- Only return top-level logs (`WHERE ParentLogId IS NULL`)
- Add `HasChildren` flag using pre-fetched GroupBy dictionary (NOT correlated subquery):
  ```csharp
  var childCounts = await _db.SystemLogs
      .Where(l => l.ParentLogId != null)
      .GroupBy(l => l.ParentLogId)
      .Select(g => new { ParentId = g.Key, Count = g.Count() })
      .ToDictionaryAsync(x => x.ParentId!.Value, x => x.Count);
  ```

### 2.5 Shared LogAction Helper

Extract to `ControllerExtensions.cs`:
```csharp
public static class ControllerExtensions
{
    public static async Task LogAdminAction(this ControllerBase controller, AppDbContext db,
        string action, string? details = null, Guid? batchId = null, int? parentLogId = null)
    {
        var adminId = controller.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var adminName = controller.User.FindFirstValue(ClaimTypes.Name);
        db.SystemLogs.Add(new SystemLog
        {
            Action = action,
            Details = details,
            UserId = adminId,
            UserName = adminName,
            BatchId = batchId,
            ParentLogId = parentLogId,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }
}
```

### 2.6 New DTOs

```csharp
public class SuspendUserDto
{
    [Required, Range(1, 8760)] // 1 hour to 1 year
    public int DurationHours { get; set; }
    [Required, MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public class BanUserDto
{
    [Required, MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public class CreateAnnouncementDto
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    [Required, MaxLength(5000)]
    public string Content { get; set; } = string.Empty;
    public DateTime? ExpiresAt { get; set; }
}

- `UpdateAnnouncementDto`: Title?, Content?, ExpiresAt?
- Active/expired determined at query time: `ExpiresAt == null || ExpiresAt > DateTime.UtcNow`

// ReviewReportDto removed — DB has no admin notes column, review is status-change only

public class ReportPostDto
{
    [Required]
    public int PostId { get; set; }
    [Required, MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}
```

---

## Phase 3: Query Optimization Rules

Every query in the new controllers MUST follow these rules:

| Rule | Implementation |
|------|---------------|
| Read-only queries use `AsNoTracking()` | All GET endpoints |
| Always use `.Select()` projection | Never return full entity, always project to DTO/anonymous |
| Filter before projection | `.Where().Select()` not `.Include().Where()` |
| Batch related queries | Single UNION ALL or GroupBy instead of N queries |
| Pre-fetch child counts | GroupBy dictionary, not `Any()` correlated subquery |
| Cap pageSize | `pageSize = Math.Min(pageSize, 100)` on all paginated endpoints |
| CSV export safety | `Take(10_000)` cap, CsvSafe() sanitization |
| Server-side aggregation | `CountAsync()` not `.ToListAsync().Count()` |
| Index-aware queries | Order by indexed columns (CreatedAt DESC, Status) |

**CsvSafe helper:**
```csharp
private static string CsvSafe(string? value)
{
    if (string.IsNullOrEmpty(value)) return "";
    // Prevent formula injection in Excel
    if (value.Length > 0 && "=+-@\t\r".Contains(value[0]))
        return "'" + value;
    // Escape quotes and wrap in quotes if contains comma
    if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    return value;
}
```

---

## Phase 4: Frontend Updates

### 4.1 TypeScript Interfaces (`client/src/types/admin.ts`)

Create proper typed interfaces for all admin API responses:
- `AdminUser` (existing, add `isSuspended`, `suspendedUntil`, `banReason`)
- `SystemStats` (existing, add `totalReports`, `totalAnnouncements`, `totalHelpOffers`)
- `LogEntry` (existing, add `batchId`, `parentLogId`, `hasChildren`)
- `PostItem` (existing, add `isPinned`)
- `Report` (new: id, postId, postContentPreview, reporterName, reason, status, createdAt)
- `Announcement` (new: id, title, content, adminName, createdAt, expiresAt, isExpired computed)
- `PaginatedResponse<T>` (generic: items, total, page, pageSize, totalPages)

### 4.2 API Route Restructure (`client/src/services/api.ts`)

All `adminApi` methods updated to match 3-controller route structure:
- User management: `api/admin/*`
- Content moderation: `api/admin/moderation/*`
- System operations: `api/admin/system/*`

### 4.3 Admin Page Tab Expansion

Current: `stats | verifications | users | posts | logs` (5 tabs)
New: `stats | verifications | users | posts | reports | logs | announcements` (7 tabs)

### 4.4 Panel Enhancements

**StatsPanel:**
- Add report count, announcement count, help offer count cards
- Add "recent activity" mini-timeline (last 5 log entries)

**UsersPanel:**
- Add action dropdown per user row: Suspend / Unsuspend / Ban / Force Logout / Reset Verification
- Action dropdown only visible for non-admin users (can't suspend another admin)

**PostsPanel:**
- Add pin/unpin toggle button
- Pin badge/icon on pinned posts

**LogsPanel:**
- Batch log rows (Action === "BatchActions") show expand/collapse chevron
- On expand: fetch child logs via `getLogChildren(id)`, render indented sub-rows
- Smooth CSS transition on expand
- Subtle left-border on child rows for visual hierarchy
- "BatchActions" added to action filter dropdown

**ReportsPanel (NEW):**
- Paginated table: reporter name, post content preview (truncated), reason, status badge, dates
- Pending reports shown first
- Action buttons: Review and Dismiss (both change status only)
- Status badges: Pending (yellow), Reviewed (green), Dismissed (gray)

**AnnouncementsPanel (NEW):**
- Create form: title + content textarea + optional expiry date picker
- List with edit/delete buttons
- Active/expired status indicators (computed from ExpiresAt)
- Inline edit mode (click to edit)

### 4.5 UI/UX Styling

- Follow existing design system (glass-card, admin-badge, btn-sm patterns)
- Use existing `animate-fade-in-up` animation
- New badge variants: `admin-badge--report-pending`, `admin-badge--report-reviewed`, `admin-badge--report-dismissed`, `admin-badge--pinned`
- Expandable log rows: CSS `max-height` transition, background `var(--bg-subtle)` on expanded
- Responsive: admin panel stack on mobile, table -> card view under 768px
- Action dropdowns: use existing button styling, positioned with CSS `position: relative`

---

## Phase 5: Role Gap Research & dev.md Update

### 5.1 VolunteerController Gaps

Current state: Basic task listing + accept task. Missing:
- `POST /volunteer/tasks/{id}/complete` - Complete task with notes (uses CompletionNotes field)
- `GET /volunteer/tasks/active` - Active tasks assigned to current volunteer (uses AssignedVolunteerId)
- `GET /volunteer/tasks/history` - Completed task history
- `GET /volunteer/stats` - Personal stats (tasks completed, avg response time)
- Task accept should set `Ping.AssignedVolunteerId` to current user
- Proper Include -> Where -> Select optimization

### 5.2 SponsorController Gaps

Current state: Search cases + offer help (only creates notification, no HelpOffer entity). Missing:
- `POST /sponsor/offer-help` - Should create HelpOffer entity + notification
- `GET /sponsor/offers` - Offer history for current sponsor
- `GET /sponsor/impact` - Impact dashboard (offers made, accepted, pending) using server-side CountAsync
- Search optimization: avoid loading full entities

### 5.3 PersonInNeedController (Does Not Exist)

Needs new controller at `api/personinneed`:
- `GET /my-pings` - User's own SOS timeline
- `GET /my-offers` - Help offers received
- `POST /my-offers/{id}/accept` - Accept help offer
- `POST /my-offers/{id}/decline` - Decline help offer
- `POST /report-post` - Report a post (creates Report entity)

### 5.4 NotificationController (Does Not Exist)

Needs new controller at `api/notifications`:
- `GET /` - Paginated notifications for current user
- `GET /unread-count` - Unread count (cached 30s in IMemoryCache)
- `POST /{id}/read` - Mark single notification as read
- `POST /mark-all-read` - Mark all as read
- `DELETE /{id}` - Delete notification

### 5.5 dev.md Updates

Update dev.md to reflect:
- All 6 migrations are now APPLIED
- Entity sync status (completed after this session)
- Controller split status (completed after this session)
- Frontend route fix status (completed after this session)
- Remaining role controller features as pending tasks
- New critical bugs resolved (API route mismatch, N+1 HasChildren)
- New pending tasks for notification triggers, real-time SignalR, etc.

---

## Files Changed Summary

### Backend - Modified:
- `src/ReliefConnect.Core/Entities/SystemLog.cs`
- `src/ReliefConnect.Core/Entities/ApplicationUser.cs`
- `src/ReliefConnect.Core/Entities/Ping.cs`
- `src/ReliefConnect.Core/Entities/Post.cs`
- `src/ReliefConnect.Core/DTOs/DTOs.cs` (add new DTOs)
- `src/ReliefConnect.Infrastructure/Data/AppDbContext.cs`
- `src/ReliefConnect.API/Controllers/AdminController.cs` (slim down to user management only)

### Backend - New:
- `src/ReliefConnect.Core/Entities/Report.cs`
- `src/ReliefConnect.Core/Entities/HelpOffer.cs`
- `src/ReliefConnect.Core/Entities/SystemAnnouncement.cs`
- `src/ReliefConnect.Core/Enums/ReportStatus.cs`
- `src/ReliefConnect.Core/Enums/HelpOfferStatus.cs`
- `src/ReliefConnect.API/Controllers/AdminModerationController.cs`
- `src/ReliefConnect.API/Controllers/AdminSystemController.cs`
- `src/ReliefConnect.API/Extensions/ControllerExtensions.cs`

### Frontend - Modified:
- `client/src/services/api.ts`
- `client/src/pages/AdminPage.tsx`

### Frontend - New:
- `client/src/types/admin.ts`

### Docs - Modified:
- `dev.md`

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|-----------|
| Entity sync mismatch with DB columns | LOW | Verify column names match exactly using Supabase schema inspection |
| Frontend route changes break existing features | MEDIUM | Update all api.ts calls atomically, test each tab |
| Batch log insert may fail mid-batch | LOW | Wrap parent+children in single AddRange+SaveChanges |
| CSV injection | MEDIUM | CsvSafe() helper sanitizes all cell values |
| pageSize attack | LOW | Math.Min(pageSize, 100) on all endpoints |
| N+1 query in HasChildren | LOW | Pre-fetch via GroupBy (design specifies this) |
