# Admin Upgrade, Batch Log Hierarchy & Role Research — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync C# entities with the existing Supabase database schema, split the monolithic AdminController into 3 focused controllers with batch log hierarchy, optimize all queries, upgrade the frontend admin page to 7 tabs, and document role gaps in dev.md.

**Architecture:** Bottom-up approach: Entity sync (no migration needed — DB already has all columns) → Controller split with parent-child batch logs → Query optimization → Frontend 7-tab admin page with expandable logs → Role gap research documented in dev.md.

**Tech Stack:** ASP.NET Core 10.0, EF Core (PostgreSQL/Supabase), React 19 + TypeScript + Vite, Zustand, Axios

**Spec:** `docs/superpowers/specs/2026-03-30-admin-upgrade-batch-logs-role-research-design.md`

---

## File Structure

### Backend — Modified:
| File | Responsibility |
|------|---------------|
| `src/ReliefConnect.Core/Entities/SystemLog.cs` | Add BatchId, ParentLogId, navigation properties |
| `src/ReliefConnect.Core/Entities/ApplicationUser.cs` | Add IsSuspended, SuspendedUntil, BanReason, LastTokenJti |
| `src/ReliefConnect.Core/Entities/Ping.cs` | Add AssignedVolunteerId, AssignedVolunteer, CompletionNotes |
| `src/ReliefConnect.Core/Entities/Post.cs` | Add IsPinned |
| `src/ReliefConnect.Core/DTOs/DTOs.cs` | Add new admin DTOs (SuspendUserDto, BanUserDto, CreateAnnouncementDto, etc.) |
| `src/ReliefConnect.Infrastructure/Data/AppDbContext.cs` | Add DbSets + fluent config for new entities |
| `src/ReliefConnect.API/Controllers/AdminController.cs` | Slim down to user management only + batch |

### Backend — New:
| File | Responsibility |
|------|---------------|
| `src/ReliefConnect.Core/Entities/Report.cs` | Report entity matching DB schema |
| `src/ReliefConnect.Core/Entities/HelpOffer.cs` | HelpOffer entity matching DB schema |
| `src/ReliefConnect.Core/Entities/SystemAnnouncement.cs` | SystemAnnouncement entity matching DB schema |
| `src/ReliefConnect.Core/Enums/ReportStatus.cs` | Pending, Reviewed, Dismissed |
| `src/ReliefConnect.Core/Enums/HelpOfferStatus.cs` | Pending, Accepted, Declined |
| `src/ReliefConnect.API/Extensions/ControllerExtensions.cs` | Shared LogAdminAction helper |
| `src/ReliefConnect.API/Controllers/AdminModerationController.cs` | Content moderation endpoints |
| `src/ReliefConnect.API/Controllers/AdminSystemController.cs` | System ops: stats, logs, announcements, CSV export |

### Frontend — Modified:
| File | Responsibility |
|------|---------------|
| `client/src/services/api.ts` | Update adminApi routes to 3-controller structure + new endpoints |
| `client/src/pages/AdminPage.tsx` | 7-tab layout, expandable logs, new panels |

### Frontend — New:
| File | Responsibility |
|------|---------------|
| `client/src/types/admin.ts` | TypeScript interfaces for all admin API types |

### Docs — Modified:
| File | Responsibility |
|------|---------------|
| `dev.md` | Updated migration status, role gap research, task status |

---

## Task 1: New Enums (ReportStatus, HelpOfferStatus)

**Files:**
- Create: `src/ReliefConnect.Core/Enums/ReportStatus.cs`
- Create: `src/ReliefConnect.Core/Enums/HelpOfferStatus.cs`

- [ ] **Step 1: Create ReportStatus enum**

```csharp
// src/ReliefConnect.Core/Enums/ReportStatus.cs
namespace ReliefConnect.Core.Enums;

/// <summary>
/// Status lifecycle for post reports.
/// Maps to integer column in Reports table.
/// </summary>
public enum ReportStatus
{
    Pending = 0,
    Reviewed = 1,
    Dismissed = 2
}
```

- [ ] **Step 2: Create HelpOfferStatus enum**

```csharp
// src/ReliefConnect.Core/Enums/HelpOfferStatus.cs
namespace ReliefConnect.Core.Enums;

/// <summary>
/// Status lifecycle for sponsor help offers.
/// Maps to integer column in HelpOffers table.
/// </summary>
public enum HelpOfferStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2
}
```

- [ ] **Step 3: Verify build**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.Core" && dotnet build`
Expected: Build succeeded.

- [ ] **Step 4: Commit**

```bash
git add src/ReliefConnect.Core/Enums/ReportStatus.cs src/ReliefConnect.Core/Enums/HelpOfferStatus.cs
git commit -m "feat: add ReportStatus and HelpOfferStatus enums

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: New Entities (Report, HelpOffer, SystemAnnouncement)

**Files:**
- Create: `src/ReliefConnect.Core/Entities/Report.cs`
- Create: `src/ReliefConnect.Core/Entities/HelpOffer.cs`
- Create: `src/ReliefConnect.Core/Entities/SystemAnnouncement.cs`

- [ ] **Step 1: Create Report entity**

```csharp
// src/ReliefConnect.Core/Entities/Report.cs
using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Post report for content moderation.
/// Maps to existing "Reports" table in Supabase.
/// DB columns: Id, PostId, ReporterId, Reason, Status (int), CreatedAt
/// Note: DB does NOT have ReviewedByAdminId, AdminNotes, ReviewedAt columns.
/// </summary>
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

- [ ] **Step 2: Create HelpOffer entity**

```csharp
// src/ReliefConnect.Core/Entities/HelpOffer.cs
using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Sponsor's offer to help a person in need.
/// Maps to existing "HelpOffers" table in Supabase.
/// DB columns: Id, SponsorId, TargetUserId, PingId?, PostId?, Message (NOT NULL), Status (int), CreatedAt
/// </summary>
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

    /// <summary>NOT NULL in database — always provide a message.</summary>
    public string Message { get; set; } = string.Empty;

    public HelpOfferStatus Status { get; set; } = HelpOfferStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 3: Create SystemAnnouncement entity**

```csharp
// src/ReliefConnect.Core/Entities/SystemAnnouncement.cs
namespace ReliefConnect.Core.Entities;

/// <summary>
/// System-wide admin announcement.
/// Maps to existing "SystemAnnouncements" table in Supabase.
/// DB columns: Id, Title, Content, AdminId, CreatedAt, ExpiresAt?
/// Note: DB does NOT have IsActive column. Active/expired computed from ExpiresAt at query time.
/// </summary>
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

- [ ] **Step 4: Verify build**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.Core" && dotnet build`
Expected: Build succeeded.

- [ ] **Step 5: Commit**

```bash
git add src/ReliefConnect.Core/Entities/Report.cs src/ReliefConnect.Core/Entities/HelpOffer.cs src/ReliefConnect.Core/Entities/SystemAnnouncement.cs
git commit -m "feat: add Report, HelpOffer, SystemAnnouncement entities matching DB schema

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Update Existing Entities (SystemLog, ApplicationUser, Ping, Post)

**Files:**
- Modify: `src/ReliefConnect.Core/Entities/SystemLog.cs`
- Modify: `src/ReliefConnect.Core/Entities/ApplicationUser.cs`
- Modify: `src/ReliefConnect.Core/Entities/Ping.cs`
- Modify: `src/ReliefConnect.Core/Entities/Post.cs`

- [ ] **Step 1: Update SystemLog — add batch hierarchy fields**

Add these properties to `src/ReliefConnect.Core/Entities/SystemLog.cs` after the `CreatedAt` property:

```csharp
// Add after CreatedAt property (line 19):

/// <summary>Groups related log entries from a single batch operation.</summary>
public Guid? BatchId { get; set; }

/// <summary>Points to the parent (summary) log entry. Null for parent/standalone logs.</summary>
public int? ParentLogId { get; set; }

// Navigation properties for parent-child hierarchy
public SystemLog? ParentLog { get; set; }
public ICollection<SystemLog> ChildLogs { get; set; } = [];
```

The full file should become:
```csharp
namespace ReliefConnect.Core.Entities;

/// <summary>
/// System log entry for audit trail (SRS Section 8).
/// Tracks critical actions: Login, Posting, Deleting Posts.
/// Supports parent-child hierarchy for batch operations via BatchId + ParentLogId.
/// </summary>
public class SystemLog
{
    public int Id { get; set; }

    public string Action { get; set; } = string.Empty;

    public string? Details { get; set; }

    public string? UserId { get; set; }

    public string? UserName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Groups related log entries from a single batch operation.</summary>
    public Guid? BatchId { get; set; }

    /// <summary>Points to the parent (summary) log entry. Null for parent/standalone logs.</summary>
    public int? ParentLogId { get; set; }

    // Navigation properties for parent-child hierarchy
    public SystemLog? ParentLog { get; set; }
    public ICollection<SystemLog> ChildLogs { get; set; } = [];
}
```

- [ ] **Step 2: Update ApplicationUser — add suspension/ban fields**

Add these properties to `src/ReliefConnect.Core/Entities/ApplicationUser.cs` after the `CreatedAt` property (line 41), before navigation properties:

```csharp
// Add after CreatedAt (line 41), before navigation properties:

/// <summary>Whether user is currently suspended or banned.</summary>
public bool IsSuspended { get; set; }

/// <summary>When temporary suspension expires. Null = permanent ban.</summary>
public DateTime? SuspendedUntil { get; set; }

/// <summary>Admin-provided reason for ban.</summary>
public string? BanReason { get; set; }

/// <summary>JTI of user's most recent JWT token (for force-logout).</summary>
public string? LastTokenJti { get; set; }
```

- [ ] **Step 3: Update Ping — add volunteer assignment fields**

Add these properties to `src/ReliefConnect.Core/Entities/Ping.cs` after the `PingFlag` navigation property (line 37):

```csharp
// Add after PingFlag navigation property:

/// <summary>Volunteer assigned to this task.</summary>
public string? AssignedVolunteerId { get; set; }
public ApplicationUser? AssignedVolunteer { get; set; }

/// <summary>Notes from volunteer upon task completion.</summary>
public string? CompletionNotes { get; set; }
```

- [ ] **Step 4: Update Post — add IsPinned field**

Add this property to `src/ReliefConnect.Core/Entities/Post.cs` after the `CreatedAt` property (line 22):

```csharp
// Add after CreatedAt:

/// <summary>Whether this post is pinned by admin to the top of feeds.</summary>
public bool IsPinned { get; set; }
```

- [ ] **Step 5: Verify build**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.Core" && dotnet build`
Expected: Build succeeded.

- [ ] **Step 6: Commit**

```bash
git add src/ReliefConnect.Core/Entities/SystemLog.cs src/ReliefConnect.Core/Entities/ApplicationUser.cs src/ReliefConnect.Core/Entities/Ping.cs src/ReliefConnect.Core/Entities/Post.cs
git commit -m "feat: sync existing entities with database schema (batch log, suspension, assignment, pin)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Update AppDbContext (DbSets + Fluent Configuration)

**Files:**
- Modify: `src/ReliefConnect.Infrastructure/Data/AppDbContext.cs`

- [ ] **Step 1: Add new DbSets**

Add after the existing `SystemLogs` DbSet (line 26):

```csharp
public DbSet<Report> Reports => Set<Report>();
public DbSet<HelpOffer> HelpOffers => Set<HelpOffer>();
public DbSet<SystemAnnouncement> SystemAnnouncements => Set<SystemAnnouncement>();
```

- [ ] **Step 2: Add SystemLog self-referencing FK config**

Add inside `OnModelCreating`, after the existing SystemLog configuration block (after line 235):

```csharp
// ═══════ SYSTEM LOG (Batch Hierarchy) ═══════
// Extend existing SystemLog config with self-referencing FK
builder.Entity<SystemLog>(entity =>
{
    // Self-referencing parent-child for batch log hierarchy
    entity.HasOne(l => l.ParentLog)
          .WithMany(l => l.ChildLogs)
          .HasForeignKey(l => l.ParentLogId)
          .OnDelete(DeleteBehavior.Cascade);

    entity.HasIndex(l => l.BatchId);
    entity.HasIndex(l => l.ParentLogId);
});
```

Wait — the existing SystemLog config is at lines 226-235. We need to EXTEND it. The existing block configures `HasKey`, `Action`, `Details`, `UserName`, `CreatedAt` index, and `Action` index. We should add the self-referencing FK to the same builder call or add a new one. EF Core allows multiple `builder.Entity<T>()` calls — they're merged. So add a new block after line 235.

- [ ] **Step 3: Add Report entity configuration**

Add after the SystemLog extension:

```csharp
// ═══════ REPORT ═══════
builder.Entity<Report>(entity =>
{
    entity.HasKey(r => r.Id);
    entity.Property(r => r.Reason).HasMaxLength(500).IsRequired();
    entity.Property(r => r.Status).HasConversion<int>();

    entity.HasIndex(r => r.Status);
    entity.HasIndex(r => r.PostId);
    entity.HasIndex(r => r.ReporterId);

    entity.HasOne(r => r.Post)
          .WithMany()
          .HasForeignKey(r => r.PostId)
          .OnDelete(DeleteBehavior.Cascade);

    entity.HasOne(r => r.Reporter)
          .WithMany()
          .HasForeignKey(r => r.ReporterId)
          .OnDelete(DeleteBehavior.NoAction);
});
```

- [ ] **Step 4: Add HelpOffer entity configuration**

```csharp
// ═══════ HELP OFFER ═══════
builder.Entity<HelpOffer>(entity =>
{
    entity.HasKey(h => h.Id);
    entity.Property(h => h.Message).HasMaxLength(1000).IsRequired();
    entity.Property(h => h.Status).HasConversion<int>();

    entity.HasIndex(h => h.SponsorId);
    entity.HasIndex(h => h.TargetUserId);
    entity.HasIndex(h => h.Status);

    entity.HasOne(h => h.Sponsor)
          .WithMany()
          .HasForeignKey(h => h.SponsorId)
          .OnDelete(DeleteBehavior.NoAction);

    entity.HasOne(h => h.TargetUser)
          .WithMany()
          .HasForeignKey(h => h.TargetUserId)
          .OnDelete(DeleteBehavior.NoAction);

    entity.HasOne(h => h.Ping)
          .WithMany()
          .HasForeignKey(h => h.PingId)
          .OnDelete(DeleteBehavior.SetNull);

    entity.HasOne(h => h.Post)
          .WithMany()
          .HasForeignKey(h => h.PostId)
          .OnDelete(DeleteBehavior.SetNull);
});
```

- [ ] **Step 5: Add SystemAnnouncement entity configuration**

```csharp
// ═══════ SYSTEM ANNOUNCEMENT ═══════
builder.Entity<SystemAnnouncement>(entity =>
{
    entity.HasKey(a => a.Id);
    entity.Property(a => a.Title).HasMaxLength(200).IsRequired();
    entity.Property(a => a.Content).HasMaxLength(5000).IsRequired();

    entity.HasIndex(a => a.ExpiresAt);
    entity.HasIndex(a => a.AdminId);

    entity.HasOne(a => a.Admin)
          .WithMany()
          .HasForeignKey(a => a.AdminId)
          .OnDelete(DeleteBehavior.NoAction);
});
```

- [ ] **Step 6: Add Ping.AssignedVolunteer FK config**

Extend the existing Ping entity configuration block. Add inside the existing `builder.Entity<Ping>()` call (around line 69-78), or add a new block:

```csharp
// Extend Ping with AssignedVolunteer FK (add new block — EF merges them)
builder.Entity<Ping>(entity =>
{
    entity.HasOne(p => p.AssignedVolunteer)
          .WithMany()
          .HasForeignKey(p => p.AssignedVolunteerId)
          .OnDelete(DeleteBehavior.SetNull);

    entity.HasIndex(p => p.AssignedVolunteerId);
});
```

- [ ] **Step 7: Add ApplicationUser.IsSuspended index**

```csharp
// Extend ApplicationUser with suspension index
builder.Entity<ApplicationUser>(entity =>
{
    entity.HasIndex(u => u.IsSuspended);
});
```

- [ ] **Step 8: Add using statements**

Ensure `AppDbContext.cs` has: `using ReliefConnect.Core.Entities;` (already exists) and `using ReliefConnect.Core.Enums;` if needed for enum conversions. The existing file already has these.

- [ ] **Step 9: Verify build**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.Infrastructure" && dotnet build`
Expected: Build succeeded.

- [ ] **Step 10: Commit**

```bash
git add src/ReliefConnect.Infrastructure/Data/AppDbContext.cs
git commit -m "feat: add DbSets and fluent config for Report, HelpOffer, SystemAnnouncement + batch log hierarchy

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: New DTOs

**Files:**
- Modify: `src/ReliefConnect.Core/DTOs/DTOs.cs`

- [ ] **Step 1: Add new admin DTOs**

Add at the end of the ADMIN DTOs section in `DTOs.cs` (after `SystemStatsDto` around line 326), before the ZONE DTOs section:

```csharp
// ═══════════════════════════════════════════
//  ADMIN DTOs — New (Controller Split)
// ═══════════════════════════════════════════

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

public class UpdateAnnouncementDto
{
    [MaxLength(200)]
    public string? Title { get; set; }

    [MaxLength(5000)]
    public string? Content { get; set; }

    public DateTime? ExpiresAt { get; set; }
}

public class ReportPostDto
{
    [Required]
    public int PostId { get; set; }

    [Required, MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public class CompleteTaskDto
{
    [MaxLength(2000)]
    public string? Notes { get; set; }
}
```

- [ ] **Step 2: Update AdminUserDto — add suspension fields**

Modify the existing `AdminUserDto` class to add suspension fields:

```csharp
public class AdminUserDto
{
    public string Id { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public string? RequestedRole { get; set; }
    public string? VerificationReason { get; set; }
    public bool EmailVerified { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    // New suspension fields
    public bool IsSuspended { get; set; }
    public DateTime? SuspendedUntil { get; set; }
    public string? BanReason { get; set; }
}
```

- [ ] **Step 3: Update SystemStatsDto — add report/announcement/offer counts**

Modify existing `SystemStatsDto`:

```csharp
public class SystemStatsDto
{
    public int TotalUsers { get; set; }
    public int TotalPersonsInNeed { get; set; }
    public int TotalSponsors { get; set; }
    public int TotalVolunteers { get; set; }
    public int ActiveSOS { get; set; }
    public int ResolvedCases { get; set; }
    public int TotalPosts { get; set; }
    public int TotalPostsLivelihood { get; set; }
    public int TotalPostsMedical { get; set; }
    public int TotalPostsEducation { get; set; }
    // New stats
    public int TotalReports { get; set; }
    public int PendingReports { get; set; }
    public int TotalAnnouncements { get; set; }
    public int TotalHelpOffers { get; set; }
}
```

- [ ] **Step 4: Update AdminPostDto — add IsPinned**

```csharp
public class AdminPostDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string AuthorId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsPinned { get; set; }
}
```

- [ ] **Step 5: Verify build**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.Core" && dotnet build`
Expected: Build succeeded.

- [ ] **Step 6: Commit**

```bash
git add src/ReliefConnect.Core/DTOs/DTOs.cs
git commit -m "feat: add new admin DTOs and update existing DTOs with suspension/pin/stats fields

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Shared ControllerExtensions.LogAdminAction

**Files:**
- Create: `src/ReliefConnect.API/Extensions/ControllerExtensions.cs`

- [ ] **Step 1: Create the extension method**

```csharp
// src/ReliefConnect.API/Extensions/ControllerExtensions.cs
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using ReliefConnect.Core.Entities;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Extensions;

/// <summary>
/// Shared helpers for admin controllers.
/// Extracts duplicated LogAction logic into a single reusable extension.
/// </summary>
public static class ControllerExtensions
{
    /// <summary>
    /// Creates a system audit log entry. Used by all 3 admin controllers.
    /// </summary>
    public static async Task LogAdminAction(
        this ControllerBase controller,
        AppDbContext db,
        string action,
        string? details = null,
        Guid? batchId = null,
        int? parentLogId = null)
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

    /// <summary>
    /// Sanitizes a cell value for CSV export to prevent formula injection in Excel.
    /// Cells starting with =, +, -, @, tab, or carriage return are prefixed with '.
    /// </summary>
    public static string CsvSafe(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Length > 0 && "=+-@\t\r".Contains(value[0]))
            return "'" + value;
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        return value;
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.API" && dotnet build`
Expected: Build succeeded.

- [ ] **Step 3: Commit**

```bash
git add src/ReliefConnect.API/Extensions/ControllerExtensions.cs
git commit -m "feat: add shared ControllerExtensions with LogAdminAction and CsvSafe helpers

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Refactor AdminController (User Management + Enhanced Batch)

**Files:**
- Modify: `src/ReliefConnect.API/Controllers/AdminController.cs`

This is the biggest task. We rewrite AdminController to:
1. Keep: GetUsers, ApproveRole, GetPendingVerifications, RejectVerification
2. Remove: DeletePost, GetAdminPosts, GetStats, GetLogs (moved to other controllers)
3. Add: GetUserDetail, SuspendUser, UnsuspendUser, BanUser, ForceLogout, ResetVerification
4. Enhance: BatchActions with parent-child log hierarchy
5. Replace: private LogAction with shared ControllerExtensions.LogAdminAction

- [ ] **Step 1: Rewrite AdminController.cs**

Replace the entire content of `src/ReliefConnect.API/Controllers/AdminController.cs` with:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ReliefConnect.API.Extensions;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Admin user management endpoints.
/// Handles: user list, role approval, verification queue, suspend/ban/force-logout, batch operations.
/// All endpoints require the "RequireAdmin" policy.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "RequireAdmin")]
public class AdminController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _db;
    private readonly ILogger<AdminController> _logger;
    private readonly ITokenBlacklistService _tokenBlacklist;
    private readonly IMemoryCache _cache;

    public AdminController(
        UserManager<ApplicationUser> userManager,
        AppDbContext db,
        ILogger<AdminController> logger,
        ITokenBlacklistService tokenBlacklist,
        IMemoryCache cache)
    {
        _userManager = userManager;
        _db = db;
        _logger = logger;
        _tokenBlacklist = tokenBlacklist;
        _cache = cache;
    }

    // ═══════════════════════════════════════════
    //  USERS — List, search, filter
    // ═══════════════════════════════════════════

    [HttpGet("users")]
    public async Task<ActionResult> GetUsers(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] string? verificationStatus,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);

        var query = _userManager.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.FullName, pattern) ||
                EF.Functions.ILike(u.Email!, pattern) ||
                EF.Functions.ILike(u.UserName!, pattern));
        }

        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<RoleEnum>(role, true, out var roleEnum))
            query = query.Where(u => u.Role == roleEnum);

        if (!string.IsNullOrWhiteSpace(verificationStatus) && Enum.TryParse<VerificationStatus>(verificationStatus, true, out var vs))
            query = query.Where(u => u.VerificationStatus == vs);

        var total = await query.CountAsync();
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new AdminUserDto
            {
                Id = u.Id,
                UserName = u.UserName!,
                Email = u.Email!,
                FullName = u.FullName,
                Role = u.Role.ToString(),
                VerificationStatus = u.VerificationStatus.ToString(),
                RequestedRole = u.RequestedRole,
                VerificationReason = u.VerificationReason,
                EmailVerified = u.EmailConfirmed,
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt,
                IsSuspended = u.IsSuspended,
                SuspendedUntil = u.SuspendedUntil,
                BanReason = u.BanReason
            })
            .ToListAsync();

        return Ok(new { items = users, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    // ═══════════════════════════════════════════
    //  USERS — Detail
    // ═══════════════════════════════════════════

    [HttpGet("users/{userId}")]
    public async Task<ActionResult> GetUserDetail(string userId)
    {
        var user = await _userManager.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                u.Id,
                UserName = u.UserName!,
                Email = u.Email!,
                u.FullName,
                Role = u.Role.ToString(),
                VerificationStatus = u.VerificationStatus.ToString(),
                u.RequestedRole,
                u.VerificationReason,
                EmailVerified = u.EmailConfirmed,
                u.AvatarUrl,
                u.CreatedAt,
                u.IsSuspended,
                u.SuspendedUntil,
                u.BanReason
            })
            .FirstOrDefaultAsync();

        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Nguoi dung khong ton tai." });

        // Server-side aggregation for user stats
        var postCount = await _db.Posts.CountAsync(p => p.AuthorId == userId);
        var pingCount = await _db.Pings.CountAsync(p => p.UserId == userId);
        var reportCount = await _db.Reports.CountAsync(r => r.ReporterId == userId);
        var offerCount = await _db.HelpOffers.CountAsync(h => h.SponsorId == userId || h.TargetUserId == userId);

        return Ok(new { user, stats = new { postCount, pingCount, reportCount, offerCount } });
    }

    // ═══════════════════════════════════════════
    //  USERS — Approve / change role
    // ═══════════════════════════════════════════

    [HttpPut("users/{userId}/role")]
    public async Task<ActionResult> ApproveRole(string userId, [FromBody] ApproveRoleDto dto)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Nguoi dung khong ton tai." });

        if (!Enum.TryParse<RoleEnum>(dto.Role, true, out var newRole))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vai tro khong hop le." });

        var oldRole = user.Role;
        user.Role = newRole;
        user.VerificationStatus = VerificationStatus.Approved;
        user.RequestedRole = null;
        user.VerificationReason = null;
        await _userManager.UpdateAsync(user);

        _cache.Remove("admin:stats");
        _cache.Remove("admin:verifications");

        await this.LogAdminAction(_db, "RoleApproved", $"User {user.UserName}: {oldRole} -> {newRole}");
        _logger.LogInformation("Admin approved role: {Username} -> {Role}", user.UserName, newRole);

        return Ok(new { message = $"Da cap nhat vai tro {user.UserName} thanh {newRole}." });
    }

    // ═══════════════════════════════════════════
    //  VERIFICATION QUEUE
    // ═══════════════════════════════════════════

    [HttpGet("verifications")]
    public async Task<ActionResult> GetPendingVerifications()
    {
        const string cacheKey = "admin:verifications";
        if (_cache.TryGetValue(cacheKey, out List<AdminUserDto>? cachedList) && cachedList != null)
            return Ok(cachedList);

        var pending = await _userManager.Users
            .AsNoTracking()
            .Where(u => u.VerificationStatus == VerificationStatus.Pending)
            .OrderBy(u => u.CreatedAt)
            .Select(u => new AdminUserDto
            {
                Id = u.Id,
                UserName = u.UserName!,
                Email = u.Email!,
                FullName = u.FullName,
                Role = u.Role.ToString(),
                VerificationStatus = u.VerificationStatus.ToString(),
                RequestedRole = u.RequestedRole,
                VerificationReason = u.VerificationReason,
                EmailVerified = u.EmailConfirmed,
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt,
                IsSuspended = u.IsSuspended,
                SuspendedUntil = u.SuspendedUntil,
                BanReason = u.BanReason
            })
            .ToListAsync();

        _cache.Set(cacheKey, pending, TimeSpan.FromSeconds(20));
        return Ok(pending);
    }

    [HttpPost("verifications/{userId}/reject")]
    public async Task<ActionResult> RejectVerification(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Nguoi dung khong ton tai." });

        if (user.VerificationStatus != VerificationStatus.Pending)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Nguoi dung khong co yeu cau dang cho duyet." });

        user.VerificationStatus = VerificationStatus.Rejected;
        await _userManager.UpdateAsync(user);

        _cache.Remove("admin:verifications");
        await this.LogAdminAction(_db, "VerificationRejected", $"Rejected verification for {user.UserName}");
        _logger.LogInformation("Admin rejected verification: {Username}", user.UserName);

        return Ok(new { message = $"Da tu choi yeu cau xac minh cua {user.UserName}." });
    }

    // ═══════════════════════════════════════════
    //  USERS — Suspend / Unsuspend / Ban / Force-Logout
    // ═══════════════════════════════════════════

    [HttpPost("users/{userId}/suspend")]
    public async Task<ActionResult> SuspendUser(string userId, [FromBody] SuspendUserDto dto)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Nguoi dung khong ton tai." });
        if (user.Role == RoleEnum.Admin)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Khong the tam ngung admin khac." });

        user.IsSuspended = true;
        user.SuspendedUntil = DateTime.UtcNow.AddHours(dto.DurationHours);
        user.BanReason = dto.Reason;
        await _userManager.UpdateAsync(user);

        _cache.Remove("admin:stats");
        await this.LogAdminAction(_db, "UserSuspended", $"Suspended {user.UserName} for {dto.DurationHours}h: {dto.Reason}");
        _logger.LogInformation("Admin suspended {Username} for {Hours}h", user.UserName, dto.DurationHours);

        return Ok(new { message = $"Da tam ngung {user.UserName} trong {dto.DurationHours} gio." });
    }

    [HttpPost("users/{userId}/unsuspend")]
    public async Task<ActionResult> UnsuspendUser(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Nguoi dung khong ton tai." });

        user.IsSuspended = false;
        user.SuspendedUntil = null;
        user.BanReason = null;
        await _userManager.UpdateAsync(user);

        _cache.Remove("admin:stats");
        await this.LogAdminAction(_db, "UserUnsuspended", $"Unsuspended {user.UserName}");
        _logger.LogInformation("Admin unsuspended {Username}", user.UserName);

        return Ok(new { message = $"Da bo tam ngung {user.UserName}." });
    }

    [HttpPost("users/{userId}/ban")]
    public async Task<ActionResult> BanUser(string userId, [FromBody] BanUserDto dto)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Nguoi dung khong ton tai." });
        if (user.Role == RoleEnum.Admin)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Khong the cam admin khac." });

        user.IsSuspended = true;
        user.SuspendedUntil = null; // null = permanent
        user.BanReason = dto.Reason;
        await _userManager.UpdateAsync(user);

        // Force-invalidate current JWT
        if (!string.IsNullOrEmpty(user.LastTokenJti))
            _tokenBlacklist.Blacklist(user.LastTokenJti, TimeSpan.FromDays(30));

        _cache.Remove("admin:stats");
        await this.LogAdminAction(_db, "UserBanned", $"Banned {user.UserName}: {dto.Reason}");
        _logger.LogInformation("Admin banned {Username}: {Reason}", user.UserName, dto.Reason);

        return Ok(new { message = $"Da cam {user.UserName} vinh vien." });
    }

    [HttpPost("users/{userId}/force-logout")]
    public async Task<ActionResult> ForceLogout(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Nguoi dung khong ton tai." });

        if (!string.IsNullOrEmpty(user.LastTokenJti))
            _tokenBlacklist.Blacklist(user.LastTokenJti, TimeSpan.FromHours(24));

        await this.LogAdminAction(_db, "ForceLogout", $"Force-logged out {user.UserName}");
        _logger.LogInformation("Admin force-logged out {Username}", user.UserName);

        return Ok(new { message = $"Da buoc dang xuat {user.UserName}." });
    }

    [HttpPost("users/{userId}/reset-verification")]
    public async Task<ActionResult> ResetVerification(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Nguoi dung khong ton tai." });

        user.VerificationStatus = VerificationStatus.Pending;
        await _userManager.UpdateAsync(user);

        _cache.Remove("admin:verifications");
        await this.LogAdminAction(_db, "VerificationReset", $"Reset verification for {user.UserName}");

        return Ok(new { message = $"Da dat lai xac minh cho {user.UserName}." });
    }

    // ═══════════════════════════════════════════
    //  BATCH OPERATIONS (with parent-child log hierarchy)
    // ═══════════════════════════════════════════

    [HttpPost("batch")]
    public async Task<ActionResult<AdminBatchResultDto>> BatchActions([FromBody] AdminBatchDto dto)
    {
        var total = dto.RoleApprovals.Count + dto.RoleRejections.Count + dto.PostDeletions.Count;
        if (total == 0)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Batch rong." });
        if (total > 100)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Toi da 100 operations moi batch." });

        var results = new List<BatchResultItem>();
        var batchId = Guid.NewGuid();

        // 1. Role approvals
        foreach (var op in dto.RoleApprovals)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(op.UserId);
                if (user == null)
                {
                    results.Add(new BatchResultItem { OpType = "approveRole", Key = op.UserId, Success = false, Error = "User not found" });
                    continue;
                }
                if (!Enum.TryParse<RoleEnum>(op.Role, true, out var newRole))
                {
                    results.Add(new BatchResultItem { OpType = "approveRole", Key = op.UserId, Success = false, Error = $"Invalid role: {op.Role}" });
                    continue;
                }
                var oldRole = user.Role;
                user.Role = newRole;
                user.VerificationStatus = VerificationStatus.Approved;
                user.RequestedRole = null;
                user.VerificationReason = null;
                await _userManager.UpdateAsync(user);
                results.Add(new BatchResultItem { OpType = "approveRole", Key = op.UserId, Success = true });
                _logger.LogInformation("[Batch] ApproveRole: {Username} {Old}->{New}", user.UserName, oldRole, newRole);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Batch] ApproveRole failed for {UserId}", op.UserId);
                results.Add(new BatchResultItem { OpType = "approveRole", Key = op.UserId, Success = false, Error = ex.Message });
            }
        }

        // 2. Role rejections
        foreach (var userId in dto.RoleRejections)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                {
                    results.Add(new BatchResultItem { OpType = "rejectVerification", Key = userId, Success = false, Error = "User not found" });
                    continue;
                }
                user.VerificationStatus = VerificationStatus.Rejected;
                await _userManager.UpdateAsync(user);
                results.Add(new BatchResultItem { OpType = "rejectVerification", Key = userId, Success = true });
                _logger.LogInformation("[Batch] RejectVerification: {Username}", user.UserName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Batch] RejectVerification failed for {UserId}", userId);
                results.Add(new BatchResultItem { OpType = "rejectVerification", Key = userId, Success = false, Error = ex.Message });
            }
        }

        // 3. Post deletions
        foreach (var postId in dto.PostDeletions)
        {
            try
            {
                var rowsAffected = await _db.Posts.Where(p => p.Id == postId).ExecuteDeleteAsync();
                if (rowsAffected == 0)
                    results.Add(new BatchResultItem { OpType = "deletePost", Key = postId.ToString(), Success = false, Error = "Post not found" });
                else
                    results.Add(new BatchResultItem { OpType = "deletePost", Key = postId.ToString(), Success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Batch] DeletePost failed for {PostId}", postId);
                results.Add(new BatchResultItem { OpType = "deletePost", Key = postId.ToString(), Success = false, Error = ex.Message });
            }
        }

        // 4. Create parent-child batch log hierarchy
        var applied = results.Count(r => r.Success);
        var failed = results.Count(r => !r.Success);
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var adminName = User.FindFirstValue(ClaimTypes.Name);

        try
        {
            // Parent log (summary)
            var parentLog = new SystemLog
            {
                Action = "BatchActions",
                Details = $"{applied} operations: {dto.RoleApprovals.Count} role approvals, {dto.RoleRejections.Count} rejections, {dto.PostDeletions.Count} deletions ({failed} failed)",
                UserId = adminId,
                UserName = adminName,
                BatchId = batchId,
                ParentLogId = null,
                CreatedAt = DateTime.UtcNow
            };
            _db.SystemLogs.Add(parentLog);
            await _db.SaveChangesAsync(); // Save parent first to get its Id

            // Child logs (one per successful operation)
            var childLogs = new List<SystemLog>();
            foreach (var r in results.Where(r => r.Success))
            {
                var childAction = r.OpType switch
                {
                    "approveRole" => "RoleApproved",
                    "rejectVerification" => "VerificationRejected",
                    "deletePost" => "PostDeleted",
                    _ => r.OpType
                };
                childLogs.Add(new SystemLog
                {
                    Action = childAction,
                    Details = $"{r.OpType}: {r.Key}",
                    UserId = adminId,
                    UserName = adminName,
                    BatchId = batchId,
                    ParentLogId = parentLog.Id,
                    CreatedAt = DateTime.UtcNow
                });
            }

            if (childLogs.Count > 0)
            {
                _db.SystemLogs.AddRange(childLogs);
                await _db.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Batch] Failed to write audit log hierarchy");
        }

        _cache.Remove("admin:stats");
        _cache.Remove("admin:verifications");

        return Ok(new AdminBatchResultDto { Applied = applied, Failed = failed, Results = results });
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.API" && dotnet build`
Expected: Build succeeded.

- [ ] **Step 3: Commit**

```bash
git add src/ReliefConnect.API/Controllers/AdminController.cs
git commit -m "feat: refactor AdminController - user management + parent-child batch log hierarchy

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Create AdminModerationController

**Files:**
- Create: `src/ReliefConnect.API/Controllers/AdminModerationController.cs`

- [ ] **Step 1: Create the controller**

```csharp
// src/ReliefConnect.API/Controllers/AdminModerationController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.API.Extensions;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Admin content moderation endpoints.
/// Handles: posts (list, delete, pin), comments (delete), reports queue.
/// </summary>
[ApiController]
[Route("api/admin/moderation")]
[Authorize(Policy = "RequireAdmin")]
public class AdminModerationController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<AdminModerationController> _logger;

    public AdminModerationController(AppDbContext db, ILogger<AdminModerationController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ═══════════════════════════════════════════
    //  POSTS
    // ═══════════════════════════════════════════

    [HttpGet("posts")]
    public async Task<ActionResult> GetAdminPosts(
        [FromQuery] string? category,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);

        var query = _db.Posts.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(category) && Enum.TryParse<PostCategory>(category, true, out var cat))
            query = query.Where(p => p.Category == cat);

        var total = await query.CountAsync();
        var posts = await query
            .OrderByDescending(p => p.IsPinned) // Pinned posts first
            .ThenByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new AdminPostDto
            {
                Id = p.Id,
                Content = p.Content.Length > 200 ? p.Content.Substring(0, 200) : p.Content,
                Category = p.Category.ToString(),
                AuthorId = p.AuthorId,
                AuthorName = p.Author != null ? (p.Author.FullName ?? p.Author.UserName ?? "An danh") : "An danh",
                CreatedAt = p.CreatedAt,
                IsPinned = p.IsPinned
            })
            .ToListAsync();

        return Ok(new { items = posts, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpDelete("posts/{postId}")]
    public async Task<ActionResult> DeletePost(int postId)
    {
        var postInfo = await _db.Posts
            .AsNoTracking()
            .Where(p => p.Id == postId)
            .Select(p => new { AuthorName = p.Author != null ? p.Author.UserName : "unknown" })
            .FirstOrDefaultAsync();

        if (postInfo == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bai viet khong ton tai." });

        await _db.Posts.Where(p => p.Id == postId).ExecuteDeleteAsync();

        await this.LogAdminAction(_db, "PostDeleted", $"Deleted post #{postId} by {postInfo.AuthorName}");
        _logger.LogInformation("Admin deleted post #{PostId} by {Author}", postId, postInfo.AuthorName);

        return Ok(new { message = "Da xoa bai viet." });
    }

    [HttpPost("posts/{postId}/pin")]
    public async Task<ActionResult> TogglePinPost(int postId)
    {
        var post = await _db.Posts.FindAsync(postId);
        if (post == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bai viet khong ton tai." });

        post.IsPinned = !post.IsPinned;
        await _db.SaveChangesAsync();

        var action = post.IsPinned ? "PostPinned" : "PostUnpinned";
        await this.LogAdminAction(_db, action, $"Post #{postId} {action.ToLower()}");
        _logger.LogInformation("Admin {Action} post #{PostId}", action, postId);

        return Ok(new { message = post.IsPinned ? "Da ghim bai viet." : "Da bo ghim bai viet.", isPinned = post.IsPinned });
    }

    [HttpDelete("comments/{commentId}")]
    public async Task<ActionResult> DeleteComment(int commentId)
    {
        var commentInfo = await _db.Comments
            .AsNoTracking()
            .Where(c => c.Id == commentId)
            .Select(c => new { c.PostId, UserName = c.User != null ? c.User.UserName : "unknown" })
            .FirstOrDefaultAsync();

        if (commentInfo == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Binh luan khong ton tai." });

        await _db.Comments.Where(c => c.Id == commentId).ExecuteDeleteAsync();

        await this.LogAdminAction(_db, "CommentDeleted", $"Deleted comment #{commentId} on post #{commentInfo.PostId} by {commentInfo.UserName}");

        return Ok(new { message = "Da xoa binh luan." });
    }

    // ═══════════════════════════════════════════
    //  REPORTS
    // ═══════════════════════════════════════════

    [HttpGet("reports")]
    public async Task<ActionResult> GetReports(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);

        var query = _db.Reports.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReportStatus>(status, true, out var rs))
            query = query.Where(r => r.Status == rs);

        var total = await query.CountAsync();
        var reports = await query
            .OrderBy(r => r.Status) // Pending first (0), then Reviewed (1), then Dismissed (2)
            .ThenByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.Id,
                r.PostId,
                PostContentPreview = r.Post != null
                    ? (r.Post.Content.Length > 100 ? r.Post.Content.Substring(0, 100) : r.Post.Content)
                    : "[deleted]",
                ReporterName = r.Reporter != null ? (r.Reporter.FullName ?? r.Reporter.UserName ?? "An danh") : "An danh",
                r.Reason,
                Status = r.Status.ToString(),
                r.CreatedAt
            })
            .ToListAsync();

        return Ok(new { items = reports, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpPost("reports/{reportId}/review")]
    public async Task<ActionResult> ReviewReport(int reportId)
    {
        var report = await _db.Reports.FindAsync(reportId);
        if (report == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bao cao khong ton tai." });
        if (report.Status != ReportStatus.Pending)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Bao cao da duoc xu ly." });

        report.Status = ReportStatus.Reviewed;
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "ReportReviewed", $"Reviewed report #{reportId} for post #{report.PostId}");

        return Ok(new { message = "Da danh dau bao cao la da xem xet." });
    }

    [HttpPost("reports/{reportId}/dismiss")]
    public async Task<ActionResult> DismissReport(int reportId)
    {
        var report = await _db.Reports.FindAsync(reportId);
        if (report == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bao cao khong ton tai." });
        if (report.Status != ReportStatus.Pending)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Bao cao da duoc xu ly." });

        report.Status = ReportStatus.Dismissed;
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "ReportDismissed", $"Dismissed report #{reportId} for post #{report.PostId}");

        return Ok(new { message = "Da bo qua bao cao." });
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.API" && dotnet build`
Expected: Build succeeded.

- [ ] **Step 3: Commit**

```bash
git add src/ReliefConnect.API/Controllers/AdminModerationController.cs
git commit -m "feat: add AdminModerationController - posts, pin/unpin, comments, reports queue

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Create AdminSystemController

**Files:**
- Create: `src/ReliefConnect.API/Controllers/AdminSystemController.cs`

- [ ] **Step 1: Create the controller**

```csharp
// src/ReliefConnect.API/Controllers/AdminSystemController.cs
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ReliefConnect.API.Extensions;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Admin system operation endpoints.
/// Handles: stats, logs (with batch hierarchy), announcements CRUD, CSV export.
/// </summary>
[ApiController]
[Route("api/admin/system")]
[Authorize(Policy = "RequireAdmin")]
public class AdminSystemController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<AdminSystemController> _logger;
    private readonly IMemoryCache _cache;

    public AdminSystemController(AppDbContext db, ILogger<AdminSystemController> logger, IMemoryCache cache)
    {
        _db = db;
        _logger = logger;
        _cache = cache;
    }

    // Projection type for single-query stats
    private sealed class StatsRow
    {
        public string Bucket { get; set; } = "";
        public string Key { get; set; } = "";
        public int Count { get; set; }
    }

    // ═══════════════════════════════════════════
    //  STATS
    // ═══════════════════════════════════════════

    [HttpGet("stats")]
    public async Task<ActionResult<SystemStatsDto>> GetStats()
    {
        if (_cache.TryGetValue("admin:stats", out SystemStatsDto? cached) && cached != null)
            return Ok(cached);

        // Single round-trip: GROUP BY aggregations via UNION ALL
        const int sosType = 0; // MapItemType.SOS
        var rows = await _db.Database
            .SqlQuery<StatsRow>($"""
                SELECT 'role'::text  AS "Bucket", "Role"::text  AS "Key", COUNT(*)::int AS "Count"
                FROM "AspNetUsers"
                GROUP BY "Role"
                UNION ALL
                SELECT 'ping', "Status"::text, COUNT(*)::int
                FROM "Pings"
                WHERE "Type" = {sosType}
                GROUP BY "Status"
                UNION ALL
                SELECT 'post', "Category"::text, COUNT(*)::int
                FROM "Posts"
                GROUP BY "Category"
                """)
            .ToListAsync();

        int RoleBucket(RoleEnum r) => rows.Where(x => x.Bucket == "role" && x.Key == ((int)r).ToString()).Sum(x => x.Count);
        int PingBucket(SOSStatus s) => rows.Where(x => x.Bucket == "ping" && x.Key == ((int)s).ToString()).Sum(x => x.Count);
        int PostBucket(PostCategory c) => rows.Where(x => x.Bucket == "post" && x.Key == ((int)c).ToString()).Sum(x => x.Count);

        // Additional counts for new stats (server-side aggregation)
        var totalReports = await _db.Reports.CountAsync();
        var pendingReports = await _db.Reports.CountAsync(r => r.Status == ReportStatus.Pending);
        var totalAnnouncements = await _db.SystemAnnouncements.CountAsync(a => a.ExpiresAt == null || a.ExpiresAt > DateTime.UtcNow);
        var totalHelpOffers = await _db.HelpOffers.CountAsync();

        var stats = new SystemStatsDto
        {
            TotalUsers = rows.Where(x => x.Bucket == "role").Sum(x => x.Count),
            TotalPersonsInNeed = RoleBucket(RoleEnum.PersonInNeed),
            TotalSponsors = RoleBucket(RoleEnum.Sponsor),
            TotalVolunteers = RoleBucket(RoleEnum.Volunteer),
            ActiveSOS = PingBucket(SOSStatus.Pending),
            ResolvedCases = PingBucket(SOSStatus.Resolved),
            TotalPosts = rows.Where(x => x.Bucket == "post").Sum(x => x.Count),
            TotalPostsLivelihood = PostBucket(PostCategory.Livelihood),
            TotalPostsMedical = PostBucket(PostCategory.Medical),
            TotalPostsEducation = PostBucket(PostCategory.Education),
            TotalReports = totalReports,
            PendingReports = pendingReports,
            TotalAnnouncements = totalAnnouncements,
            TotalHelpOffers = totalHelpOffers
        };

        _cache.Set("admin:stats", stats, TimeSpan.FromSeconds(60));
        return Ok(stats);
    }

    // ═══════════════════════════════════════════
    //  LOGS (with batch hierarchy)
    // ═══════════════════════════════════════════

    [HttpGet("logs")]
    public async Task<ActionResult> GetLogs(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] string? action,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        pageSize = Math.Min(pageSize, 100);

        // Only top-level logs (not children)
        var query = _db.SystemLogs.AsNoTracking()
            .Where(l => l.ParentLogId == null);

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(l => l.Action == action);

        if (DateTime.TryParse(from, out var fromDate))
            query = query.Where(l => l.CreatedAt >= fromDate);

        if (DateTime.TryParse(to, out var toDate))
            query = query.Where(l => l.CreatedAt <= toDate);

        var total = await query.CountAsync();
        var logs = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                l.Id,
                l.Action,
                l.Details,
                l.UserId,
                l.UserName,
                l.BatchId,
                l.CreatedAt
            })
            .ToListAsync();

        // Pre-fetch child counts via GroupBy (avoids N+1 subquery)
        var logIds = logs.Select(l => l.Id).ToList();
        var childCounts = await _db.SystemLogs
            .Where(l => l.ParentLogId != null && logIds.Contains(l.ParentLogId.Value))
            .GroupBy(l => l.ParentLogId)
            .Select(g => new { ParentId = g.Key!.Value, Count = g.Count() })
            .ToDictionaryAsync(x => x.ParentId, x => x.Count);

        var result = logs.Select(l => new
        {
            l.Id,
            l.Action,
            l.Details,
            l.UserId,
            l.UserName,
            l.BatchId,
            l.CreatedAt,
            HasChildren = childCounts.ContainsKey(l.Id)
        });

        return Ok(new { items = result, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpGet("logs/{logId}/children")]
    public async Task<ActionResult> GetLogChildren(int logId)
    {
        var children = await _db.SystemLogs
            .AsNoTracking()
            .Where(l => l.ParentLogId == logId)
            .OrderBy(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Action,
                l.Details,
                l.UserId,
                l.UserName,
                l.CreatedAt
            })
            .ToListAsync();

        return Ok(children);
    }

    // ═══════════════════════════════════════════
    //  ANNOUNCEMENTS
    // ═══════════════════════════════════════════

    [HttpGet("announcements")]
    public async Task<ActionResult> GetAnnouncements(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);

        var total = await _db.SystemAnnouncements.CountAsync();
        var announcements = await _db.SystemAnnouncements
            .AsNoTracking()
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.Content,
                AdminName = a.Admin != null ? (a.Admin.FullName ?? a.Admin.UserName ?? "Admin") : "Admin",
                a.CreatedAt,
                a.ExpiresAt,
                IsExpired = a.ExpiresAt != null && a.ExpiresAt <= DateTime.UtcNow
            })
            .ToListAsync();

        return Ok(new { items = announcements, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    [HttpPost("announcements")]
    public async Task<ActionResult> CreateAnnouncement([FromBody] CreateAnnouncementDto dto)
    {
        var adminId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "";

        var announcement = new SystemAnnouncement
        {
            Title = dto.Title,
            Content = dto.Content,
            AdminId = adminId,
            ExpiresAt = dto.ExpiresAt,
            CreatedAt = DateTime.UtcNow
        };

        _db.SystemAnnouncements.Add(announcement);
        await _db.SaveChangesAsync();

        _cache.Remove("admin:stats");
        await this.LogAdminAction(_db, "AnnouncementCreated", $"Created announcement: {dto.Title}");

        return CreatedAtAction(null, new { announcement.Id, message = "Da tao thong bao." });
    }

    [HttpPut("announcements/{id}")]
    public async Task<ActionResult> UpdateAnnouncement(int id, [FromBody] UpdateAnnouncementDto dto)
    {
        var announcement = await _db.SystemAnnouncements.FindAsync(id);
        if (announcement == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Thong bao khong ton tai." });

        if (dto.Title != null) announcement.Title = dto.Title;
        if (dto.Content != null) announcement.Content = dto.Content;
        if (dto.ExpiresAt.HasValue) announcement.ExpiresAt = dto.ExpiresAt;

        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "AnnouncementUpdated", $"Updated announcement #{id}: {announcement.Title}");

        return Ok(new { message = "Da cap nhat thong bao." });
    }

    [HttpDelete("announcements/{id}")]
    public async Task<ActionResult> DeleteAnnouncement(int id)
    {
        var announcement = await _db.SystemAnnouncements
            .AsNoTracking()
            .Where(a => a.Id == id)
            .Select(a => new { a.Title })
            .FirstOrDefaultAsync();

        if (announcement == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Thong bao khong ton tai." });

        await _db.SystemAnnouncements.Where(a => a.Id == id).ExecuteDeleteAsync();

        _cache.Remove("admin:stats");
        await this.LogAdminAction(_db, "AnnouncementDeleted", $"Deleted announcement: {announcement.Title}");

        return Ok(new { message = "Da xoa thong bao." });
    }

    // ═══════════════════════════════════════════
    //  CSV EXPORT
    // ═══════════════════════════════════════════

    [HttpGet("export/users")]
    public async Task<ActionResult> ExportUsersCsv()
    {
        var users = await _db.Users
            .AsNoTracking()
            .OrderByDescending(u => u.CreatedAt)
            .Take(10_000) // Safety cap
            .Select(u => new
            {
                u.Id,
                u.UserName,
                u.Email,
                u.FullName,
                Role = u.Role.ToString(),
                VerificationStatus = u.VerificationStatus.ToString(),
                u.IsSuspended,
                u.CreatedAt
            })
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Id,UserName,Email,FullName,Role,VerificationStatus,IsSuspended,CreatedAt");
        foreach (var u in users)
        {
            sb.AppendLine($"{ControllerExtensions.CsvSafe(u.Id)},{ControllerExtensions.CsvSafe(u.UserName)},{ControllerExtensions.CsvSafe(u.Email)},{ControllerExtensions.CsvSafe(u.FullName)},{u.Role},{u.VerificationStatus},{u.IsSuspended},{u.CreatedAt:O}");
        }

        await this.LogAdminAction(_db, "ExportUsers", $"Exported {users.Count} users to CSV");

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"users-{DateTime.UtcNow:yyyy-MM-dd}.csv");
    }

    [HttpGet("export/logs")]
    public async Task<ActionResult> ExportLogsCsv()
    {
        var logs = await _db.SystemLogs
            .AsNoTracking()
            .OrderByDescending(l => l.CreatedAt)
            .Take(10_000) // Safety cap
            .Select(l => new { l.Id, l.Action, l.Details, l.UserName, l.CreatedAt })
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Id,Action,Details,UserName,CreatedAt");
        foreach (var l in logs)
        {
            sb.AppendLine($"{l.Id},{ControllerExtensions.CsvSafe(l.Action)},{ControllerExtensions.CsvSafe(l.Details)},{ControllerExtensions.CsvSafe(l.UserName)},{l.CreatedAt:O}");
        }

        await this.LogAdminAction(_db, "ExportLogs", $"Exported {logs.Count} logs to CSV");

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"logs-{DateTime.UtcNow:yyyy-MM-dd}.csv");
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.API" && dotnet build`
Expected: Build succeeded.

- [ ] **Step 3: Commit**

```bash
git add src/ReliefConnect.API/Controllers/AdminSystemController.cs
git commit -m "feat: add AdminSystemController - stats, logs with hierarchy, announcements, CSV export

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Frontend TypeScript Types

**Files:**
- Create: `client/src/types/admin.ts`

- [ ] **Step 1: Create typed interfaces**

```typescript
// client/src/types/admin.ts

export interface AdminUser {
  id: string;
  userName: string;
  email: string;
  fullName: string;
  role: string;
  verificationStatus: string;
  requestedRole?: string;
  verificationReason?: string;
  emailVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
  isSuspended: boolean;
  suspendedUntil?: string | null;
  banReason?: string | null;
}

export interface SystemStats {
  totalUsers: number;
  totalPersonsInNeed: number;
  totalSponsors: number;
  totalVolunteers: number;
  activeSOS: number;
  resolvedCases: number;
  totalPosts: number;
  totalPostsLivelihood: number;
  totalPostsMedical: number;
  totalPostsEducation: number;
  totalReports: number;
  pendingReports: number;
  totalAnnouncements: number;
  totalHelpOffers: number;
}

export interface LogEntry {
  id: number;
  action: string;
  details?: string;
  userId?: string;
  userName?: string;
  batchId?: string | null;
  createdAt: string;
  hasChildren: boolean;
}

export interface LogChild {
  id: number;
  action: string;
  details?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
}

export interface PostItem {
  id: number;
  content: string;
  category: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  isPinned: boolean;
}

export interface Report {
  id: number;
  postId: number;
  postContentPreview: string;
  reporterName: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  adminName: string;
  createdAt: string;
  expiresAt?: string | null;
  isExpired: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/types/admin.ts
git commit -m "feat: add TypeScript interfaces for admin API types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Update api.ts (Route Restructure + New Endpoints)

**Files:**
- Modify: `client/src/services/api.ts`

- [ ] **Step 1: Replace the adminApi section**

Replace the entire `// ADMIN API` section (lines 182-215) in `client/src/services/api.ts` with:

```typescript
// ═══════════════════════════════════════════
//  ADMIN API — 3-controller structure
// ═══════════════════════════════════════════
export const adminApi = {
  // ── AdminController (api/admin) — User Management ──
  getUsers: (params?: { search?: string; role?: string; verificationStatus?: string; page?: number; pageSize?: number }) =>
    api.get('/admin/users', { params }),

  getUserDetail: (userId: string) =>
    api.get(`/admin/users/${userId}`),

  approveRole: (userId: string, data: { role: string }) =>
    api.put(`/admin/users/${userId}/role`, data),

  getVerifications: () =>
    api.get('/admin/verifications'),

  rejectVerification: (userId: string) =>
    api.post(`/admin/verifications/${userId}/reject`),

  suspendUser: (userId: string, data: { durationHours: number; reason: string }) =>
    api.post(`/admin/users/${userId}/suspend`, data),

  unsuspendUser: (userId: string) =>
    api.post(`/admin/users/${userId}/unsuspend`),

  banUser: (userId: string, data: { reason: string }) =>
    api.post(`/admin/users/${userId}/ban`, data),

  forceLogout: (userId: string) =>
    api.post(`/admin/users/${userId}/force-logout`),

  resetVerification: (userId: string) =>
    api.post(`/admin/users/${userId}/reset-verification`),

  batchActions: (data: {
    roleApprovals: { userId: string; role: string }[];
    roleRejections: string[];
    postDeletions: number[];
  }) => api.post('/admin/batch', data),

  // ── AdminModerationController (api/admin/moderation) — Content ──
  getPosts: (params?: { page?: number; pageSize?: number; category?: string }) =>
    api.get('/admin/moderation/posts', { params }),

  deletePost: (postId: number) =>
    api.delete(`/admin/moderation/posts/${postId}`),

  togglePinPost: (postId: number) =>
    api.post(`/admin/moderation/posts/${postId}/pin`),

  deleteComment: (commentId: number) =>
    api.delete(`/admin/moderation/comments/${commentId}`),

  getReports: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get('/admin/moderation/reports', { params }),

  reviewReport: (reportId: number) =>
    api.post(`/admin/moderation/reports/${reportId}/review`),

  dismissReport: (reportId: number) =>
    api.post(`/admin/moderation/reports/${reportId}/dismiss`),

  // ── AdminSystemController (api/admin/system) — System Ops ──
  getStats: () =>
    api.get('/admin/system/stats'),

  getLogs: (params?: { from?: string; to?: string; action?: string; page?: number; pageSize?: number }) =>
    api.get('/admin/system/logs', { params }),

  getLogChildren: (logId: number) =>
    api.get(`/admin/system/logs/${logId}/children`),

  getAnnouncements: (params?: { page?: number; pageSize?: number }) =>
    api.get('/admin/system/announcements', { params }),

  createAnnouncement: (data: { title: string; content: string; expiresAt?: string }) =>
    api.post('/admin/system/announcements', data),

  updateAnnouncement: (id: number, data: { title?: string; content?: string; expiresAt?: string }) =>
    api.put(`/admin/system/announcements/${id}`, data),

  deleteAnnouncement: (id: number) =>
    api.delete(`/admin/system/announcements/${id}`),

  exportUsersCsv: () =>
    api.get('/admin/system/export/users', { responseType: 'blob' }),

  exportLogsCsv: () =>
    api.get('/admin/system/export/logs', { responseType: 'blob' }),
};
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/client" && pnpm build`
Expected: Build succeeded (or only unrelated warnings).

- [ ] **Step 3: Commit**

```bash
git add client/src/services/api.ts
git commit -m "feat: restructure adminApi routes to match 3-controller split + add new endpoints

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Update AdminPage.tsx (7 Tabs + Expandable Logs + New Panels)

**Files:**
- Modify: `client/src/pages/AdminPage.tsx`

This is the largest frontend task. We need to:
1. Update types to import from `types/admin.ts`
2. Add 2 new tabs: `reports` and `announcements` (total 7 tabs)
3. Update existing panels to use new API routes and features (IsPinned, suspension badges)
4. Enhance LogsPanel with expandable batch rows
5. Create new ReportsPanel and AnnouncementsPanel
6. Add user action dropdown to UsersPanel (suspend/ban/force-logout)

- [ ] **Step 1: Replace the entire AdminPage.tsx**

Replace the entire content of `client/src/pages/AdminPage.tsx`. The file is large, so here is the complete replacement:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, FileText, Activity, BarChart3, ShieldCheck, ArrowLeft,
  Search, CheckCircle2, XCircle, Trash2, RefreshCw, AlertTriangle,
  Heart, BookOpen, Stethoscope, Home, Flag, Megaphone, Pin,
  ChevronDown, ChevronRight, Ban, LogOut, MoreVertical, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../stores/authStore';
import { useBatchStore } from '../stores/batchStore';
import type {
  AdminUser, SystemStats, LogEntry, LogChild, PostItem, Report, Announcement
} from '../types/admin';

// ─── Debounce utility ───
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// ─── Auto-refresh hook ───
function useAutoRefresh(refresh: () => void, intervalMs: number) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const tick = () => refreshRef.current();
    const timer = setInterval(tick, intervalMs);
    const onFocus = () => { if (!document.hidden) refreshRef.current(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [intervalMs]);
}

type Tab = 'stats' | 'users' | 'verifications' | 'posts' | 'reports' | 'logs' | 'announcements';

// ═══════════════════════════════════════════
//  ADMIN PAGE
// ═══════════════════════════════════════════

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  useEffect(() => {
    if (user && user.role !== 'Admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'stats', label: t('admin.stats'), icon: BarChart3 },
    { key: 'verifications', label: t('admin.verifications'), icon: ShieldCheck },
    { key: 'users', label: t('admin.users'), icon: Users },
    { key: 'posts', label: t('admin.posts'), icon: FileText },
    { key: 'reports', label: 'Reports', icon: Flag },
    { key: 'logs', label: t('admin.logs'), icon: Activity },
    { key: 'announcements', label: 'Announcements', icon: Megaphone },
  ];

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__header">
          <Heart size={24} className="text-primary" />
          <span className="admin-sidebar__brand">ReliefConnect</span>
        </div>

        <nav className="admin-sidebar__nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`admin-nav-btn ${activeTab === tab.key ? 'admin-nav-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <button className="admin-nav-btn admin-nav-btn--back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
          <span>{t('admin.backToMap')}</span>
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <h1>{t('admin.title')}</h1>
          <span className="admin-header__user">{user?.fullName}</span>
        </header>

        <div className="admin-content">
          {activeTab === 'stats' && <StatsPanel />}
          {activeTab === 'verifications' && <VerificationsPanel />}
          {activeTab === 'users' && <UsersPanel />}
          {activeTab === 'posts' && <PostsPanel />}
          {activeTab === 'reports' && <ReportsPanel />}
          {activeTab === 'logs' && <LogsPanel />}
          {activeTab === 'announcements' && <AnnouncementsPanel />}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════
//  STATS PANEL (enhanced with report/announcement/offer counts)
// ═══════════════════════════════════════════

function StatsPanel() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    adminApi.getStats()
      .then((res) => { setStats(res.data); setLastUpdated(new Date()); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const silentRefresh = useCallback(() => {
    adminApi.getStats()
      .then((res) => { setStats(res.data); setLastUpdated(new Date()); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(silentRefresh, 60_000);

  if (loading) return (
    <div className="animate-fade-in-up">
      <div className="admin-stats-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="admin-stat-card glass-card" style={{ opacity: 0.5 }}>
            <div className="admin-stat-card__icon" style={{ background: 'var(--bg-tertiary)' }} />
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
        <RefreshCw size={14} /> Retry
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
    { label: t('admin.postsLivelihood'), value: stats.totalPostsLivelihood, icon: Home, color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.1)' },
    { label: t('admin.postsMedical'), value: stats.totalPostsMedical, icon: Stethoscope, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: t('admin.postsEducation'), value: stats.totalPostsEducation, icon: BookOpen, color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.1)' },
  ];

  const systemCards = [
    { label: 'Reports', value: stats.totalReports, icon: Flag, color: 'var(--warning-500)', bg: 'rgba(245, 158, 11, 0.1)' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: Flag, color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: 'Announcements', value: stats.totalAnnouncements, icon: Megaphone, color: 'var(--info-500)', bg: 'rgba(59, 130, 246, 0.1)' },
    { label: 'Help Offers', value: stats.totalHelpOffers, icon: Heart, color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)' },
  ];

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        {lastUpdated && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {t('admin.lastUpdated')} {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={load} title={t('admin.refresh')}>
          <RefreshCw size={13} />
        </button>
      </div>
      <div className="admin-stats-grid">
        {cards.map((c) => (
          <div key={c.label} className="admin-stat-card glass-card">
            <div className="admin-stat-card__icon" style={{ background: c.bg, color: c.color }}><c.icon size={22} /></div>
            <div className="admin-stat-card__info">
              <span className="admin-stat-card__value">{c.value}</span>
              <span className="admin-stat-card__label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)', color: 'var(--text-secondary)' }}>{t('admin.posts')}</h3>
      <div className="admin-stats-grid">
        {postCards.map((c) => (
          <div key={c.label} className="admin-stat-card glass-card">
            <div className="admin-stat-card__icon" style={{ background: c.bg, color: c.color }}><c.icon size={22} /></div>
            <div className="admin-stat-card__info">
              <span className="admin-stat-card__value">{c.value}</span>
              <span className="admin-stat-card__label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)', color: 'var(--text-secondary)' }}>System</h3>
      <div className="admin-stats-grid">
        {systemCards.map((c) => (
          <div key={c.label} className="admin-stat-card glass-card">
            <div className="admin-stat-card__icon" style={{ background: c.bg, color: c.color }}><c.icon size={22} /></div>
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

// ═══════════════════════════════════════════
//  VERIFICATIONS PANEL (unchanged logic, uses new types)
// ═══════════════════════════════════════════

function VerificationsPanel() {
  const { t } = useLanguage();
  const { ops, enqueue } = useBatchStore();
  const [serverItems, setServerItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getVerifications()
      .then((res) => { setServerItems(res.data); setLastUpdated(new Date()); })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  const silentRefresh = useCallback(() => {
    adminApi.getVerifications()
      .then((res) => { setServerItems(res.data); setLastUpdated(new Date()); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener('batch-flush-done', silentRefresh);
    return () => window.removeEventListener('batch-flush-done', silentRefresh);
  }, [silentRefresh]);
  useAutoRefresh(silentRefresh, 60_000);

  const queuedUserIds = new Set(
    ops.filter((o) => o.type === 'approveRole' || o.type === 'rejectVerification').map((o) => o.userId!)
  );
  const visibleItems = serverItems.filter((u) => !queuedUserIds.has(u.id));

  const handleApprove = (user: AdminUser) => {
    const role = user.requestedRole || 'PersonInNeed';
    enqueue({ type: 'approveRole', userId: user.id, role, rollbackLabel: `Duyet ${user.fullName} -> ${role}` });
    toast(`Queued: approve ${user.fullName}`, { duration: 2000 });
  };

  const handleReject = (user: AdminUser) => {
    enqueue({ type: 'rejectVerification', userId: user.id, rollbackLabel: `Tu choi ${user.fullName}` });
    toast(`Queued: reject ${user.fullName}`, { duration: 2000 });
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  if (visibleItems.length === 0) {
    return (
      <div className="admin-empty animate-fade-in-up">
        <ShieldCheck size={48} strokeWidth={1.5} />
        <p>{ops.length > 0 ? t('admin.queuedAll') : t('admin.noPending')}</p>
        {lastUpdated && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
            {t('admin.lastUpdated')} {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {visibleItems.length} {t('admin.pendingRequests')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {lastUpdated && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {t('admin.lastUpdated')} {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={load} title={t('admin.refresh')}><RefreshCw size={13} /></button>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.user')}</th>
              <th>Email</th>
              <th>{t('admin.requestedRole')}</th>
              <th>{t('admin.reason')}</th>
              <th>{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className="admin-user-cell">
                    <div className="admin-avatar" style={{ background: 'var(--bg-subtle)' }}>
                      {v.avatarUrl ? <img src={v.avatarUrl} alt="" /> : <span>{v.fullName.charAt(0)}</span>}
                    </div>
                    <div>
                      <div className="admin-user-name">{v.fullName}</div>
                      <div className="admin-user-sub">@{v.userName}</div>
                    </div>
                  </div>
                </td>
                <td>{v.email}</td>
                <td><span className="admin-badge admin-badge--info">{v.requestedRole}</span></td>
                <td className="admin-td-reason">{v.verificationReason || '-'}</td>
                <td>
                  <div className="admin-action-btns">
                    <button className="btn btn-sm btn-primary" onClick={() => handleApprove(v)}>
                      <CheckCircle2 size={14} /> {t('admin.approve')}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleReject(v)}>
                      <XCircle size={14} /> {t('admin.reject')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  USERS PANEL (with action dropdown)
// ═══════════════════════════════════════════

function UsersPanel() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionMenuUserId, setActionMenuUserId] = useState<string | null>(null);

  const debouncedSetSearch = useCallback(
    debounce((value: string) => { setDebouncedSearch(value); setPage(1); }, 300),
    []
  );

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getUsers({ search: debouncedSearch || undefined, role: roleFilter || undefined, page, pageSize: 15 })
      .then((res) => { setUsers(res.data.items); setTotalPages(res.data.totalPages); })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [debouncedSearch, roleFilter, page, t]);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await adminApi.approveRole(userId, { role });
      toast.success(t('admin.approved'));
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t('common.error'));
    }
  };

  const handleSuspend = async (userId: string) => {
    const reason = prompt('Reason for suspension:');
    if (!reason) return;
    const hours = Number(prompt('Duration (hours, 1-8760):'));
    if (!hours || hours < 1 || hours > 8760) return;
    try {
      await adminApi.suspendUser(userId, { durationHours: hours, reason });
      toast.success('User suspended');
      load();
    } catch { toast.error('Failed to suspend'); }
    setActionMenuUserId(null);
  };

  const handleUnsuspend = async (userId: string) => {
    try {
      await adminApi.unsuspendUser(userId);
      toast.success('User unsuspended');
      load();
    } catch { toast.error('Failed to unsuspend'); }
    setActionMenuUserId(null);
  };

  const handleBan = async (userId: string) => {
    const reason = prompt('Reason for permanent ban:');
    if (!reason) return;
    try {
      await adminApi.banUser(userId, { reason });
      toast.success('User banned');
      load();
    } catch { toast.error('Failed to ban'); }
    setActionMenuUserId(null);
  };

  const handleForceLogout = async (userId: string) => {
    try {
      await adminApi.forceLogout(userId);
      toast.success('User logged out');
    } catch { toast.error('Failed to force logout'); }
    setActionMenuUserId(null);
  };

  return (
    <div className="animate-fade-in-up">
      <div className="admin-filters">
        <div className="admin-search">
          <Search size={16} />
          <input
            type="text"
            placeholder={t('admin.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); debouncedSetSearch(e.target.value); }}
          />
        </div>
        <select className="admin-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">{t('admin.allRoles')}</option>
          <option value="Guest">Guest</option>
          <option value="PersonInNeed">PersonInNeed</option>
          <option value="Sponsor">Sponsor</option>
          <option value="Volunteer">Volunteer</option>
          <option value="Admin">Admin</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
      </div>

      {loading ? (
        <div className="admin-loading"><span className="spinner" /></div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.user')}</th>
                  <th>Email</th>
                  <th>{t('profile.role')}</th>
                  <th>{t('profile.status')}</th>
                  <th>{t('admin.date')}</th>
                  <th>{t('admin.action')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-avatar" style={{ background: 'var(--bg-subtle)' }}>
                          {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : <span>{u.fullName.charAt(0)}</span>}
                        </div>
                        <div>
                          <div className="admin-user-name">
                            {u.fullName}
                            {u.isSuspended && <span className="admin-badge admin-badge--danger" style={{ marginLeft: 'var(--sp-1)', fontSize: 'var(--text-xs)' }}>
                              {u.suspendedUntil ? 'Suspended' : 'Banned'}
                            </span>}
                          </div>
                          <div className="admin-user-sub">@{u.userName}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select className="admin-select admin-select--sm" value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                        <option value="Guest">Guest</option>
                        <option value="PersonInNeed">PersonInNeed</option>
                        <option value="Sponsor">Sponsor</option>
                        <option value="Volunteer">Volunteer</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge--${u.verificationStatus.toLowerCase()}`}>
                        {u.verificationStatus}
                      </span>
                    </td>
                    <td className="admin-td-date">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      {u.role !== 'Admin' && (
                        <div style={{ position: 'relative' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setActionMenuUserId(actionMenuUserId === u.id ? null : u.id)}>
                            <MoreVertical size={16} />
                          </button>
                          {actionMenuUserId === u.id && (
                            <div style={{
                              position: 'absolute', right: 0, top: '100%', zIndex: 10,
                              background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
                              padding: 'var(--sp-1)', minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}>
                              {u.isSuspended ? (
                                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handleUnsuspend(u.id)}>
                                  <CheckCircle2 size={14} /> Unsuspend
                                </button>
                              ) : (
                                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handleSuspend(u.id)}>
                                  <Ban size={14} /> Suspend
                                </button>
                              )}
                              <button className="btn btn-ghost btn-sm btn-danger-text" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handleBan(u.id)}>
                                <Ban size={14} /> Ban Permanently
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handleForceLogout(u.id)}>
                                <LogOut size={14} /> Force Logout
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>{t('admin.noData')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
              <span className="admin-page-info">{page} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  POSTS PANEL (with pin/unpin)
// ═══════════════════════════════════════════

function PostsPanel() {
  const { t } = useLanguage();
  const { ops, enqueue } = useBatchStore();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getPosts({ page, pageSize: 20, category: categoryFilter || undefined })
      .then((res) => { setPosts(res.data.items); setTotalPages(res.data.totalPages); })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [page, categoryFilter, t]);

  const silentRefresh = useCallback(() => {
    adminApi.getPosts({ page, pageSize: 20, category: categoryFilter || undefined })
      .then((res) => { setPosts(res.data.items); setTotalPages(res.data.totalPages); })
      .catch(() => {});
  }, [page, categoryFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener('batch-flush-done', silentRefresh);
    return () => window.removeEventListener('batch-flush-done', silentRefresh);
  }, [silentRefresh]);

  const queuedPostIds = new Set(ops.filter((o) => o.type === 'deletePost').map((o) => o.postId!));
  const visiblePosts = posts.filter((p) => !queuedPostIds.has(p.id));

  const handleDelete = (post: PostItem) => {
    enqueue({ type: 'deletePost', postId: post.id, rollbackLabel: `Xoa bai #${post.id} cua ${post.authorName}` });
    toast(`Queued: delete post #${post.id}`, { duration: 2000 });
  };

  const handleTogglePin = async (postId: number) => {
    try {
      const res = await adminApi.togglePinPost(postId);
      toast.success(res.data.message);
      load();
    } catch { toast.error('Failed to toggle pin'); }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="admin-filters">
        <select className="admin-select" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">{t('admin.allCategories')}</option>
          <option value="Livelihood">{t('admin.postsLivelihood')}</option>
          <option value="Medical">{t('admin.postsMedical')}</option>
          <option value="Education">{t('admin.postsEducation')}</option>
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
            {visiblePosts.map((p) => (
              <tr key={p.id}>
                <td>
                  #{p.id}
                  {p.isPinned && <Pin size={12} style={{ marginLeft: 4, color: 'var(--primary-400)' }} />}
                </td>
                <td>{p.authorName}</td>
                <td className="admin-td-content">{p.content.substring(0, 100)}{p.content.length > 100 ? '...' : ''}</td>
                <td><span className="admin-badge">{p.category}</span></td>
                <td className="admin-td-date">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="admin-action-btns">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleTogglePin(p.id)} title={p.isPinned ? 'Unpin' : 'Pin'}>
                      <Pin size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => handleDelete(p)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visiblePosts.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>
                {ops.length > 0 ? t('admin.queuedAllDelete') : t('admin.noData')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="admin-page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  REPORTS PANEL (NEW)
// ═══════════════════════════════════════════

function ReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getReports({ page, pageSize: 20, status: statusFilter || undefined })
      .then((res) => { setReports(res.data.items); setTotalPages(res.data.totalPages); })
      .catch(() => toast.error('Failed to load reports'))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (reportId: number) => {
    try {
      await adminApi.reviewReport(reportId);
      toast.success('Report marked as reviewed');
      load();
    } catch { toast.error('Failed to review report'); }
  };

  const handleDismiss = async (reportId: number) => {
    try {
      await adminApi.dismissReport(reportId);
      toast.success('Report dismissed');
      load();
    } catch { toast.error('Failed to dismiss report'); }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="admin-filters">
        <select className="admin-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Reviewed">Reviewed</option>
          <option value="Dismissed">Dismissed</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Post Preview</th>
              <th>Reporter</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td className="admin-td-content">{r.postContentPreview}</td>
                <td>{r.reporterName}</td>
                <td className="admin-td-reason">{r.reason}</td>
                <td>
                  <span className={`admin-badge admin-badge--${r.status === 'Pending' ? 'warning' : r.status === 'Reviewed' ? 'success' : 'muted'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="admin-td-date">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  {r.status === 'Pending' && (
                    <div className="admin-action-btns">
                      <button className="btn btn-sm btn-primary" onClick={() => handleReview(r.id)}>
                        <CheckCircle2 size={14} /> Review
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDismiss(r.id)}>
                        <XCircle size={14} /> Dismiss
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>No reports</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="admin-page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  LOGS PANEL (with expandable batch rows)
// ═══════════════════════════════════════════

function LogsPanel() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const pageSize = 30;

  // Expanded rows state: map of logId -> children
  const [expandedRows, setExpandedRows] = useState<Record<number, LogChild[]>>({});
  const [expandingId, setExpandingId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getLogs({ page, pageSize, action: actionFilter || undefined, from: fromDate || undefined, to: toDate || undefined })
      .then((res) => { setLogs(res.data.items); setTotal(res.data.total); })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [page, actionFilter, fromDate, toDate, t]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  const toggleExpand = async (logId: number) => {
    if (expandedRows[logId]) {
      // Collapse
      setExpandedRows((prev) => {
        const next = { ...prev };
        delete next[logId];
        return next;
      });
      return;
    }

    // Expand: fetch children
    setExpandingId(logId);
    try {
      const res = await adminApi.getLogChildren(logId);
      setExpandedRows((prev) => ({ ...prev, [logId]: res.data }));
    } catch {
      toast.error('Failed to load child logs');
    } finally {
      setExpandingId(null);
    }
  };

  const handleExportLogs = async () => {
    try {
      const res = await adminApi.exportLogsCsv();
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Logs exported');
    } catch { toast.error('Export failed'); }
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="admin-filters">
        <input type="date" className="admin-select" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
        <input type="date" className="admin-select" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
        <select className="admin-select" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
          <option value="">{t('admin.allActions')}</option>
          <option value="Login">Login</option>
          <option value="Register">Register</option>
          <option value="CreatePost">CreatePost</option>
          <option value="DeletePost">DeletePost</option>
          <option value="ApproveRole">ApproveRole</option>
          <option value="RejectVerification">RejectVerification</option>
          <option value="BatchActions">BatchActions</option>
          <option value="UserSuspended">UserSuspended</option>
          <option value="UserBanned">UserBanned</option>
          <option value="PostPinned">PostPinned</option>
          <option value="ReportReviewed">ReportReviewed</option>
          <option value="AnnouncementCreated">AnnouncementCreated</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={16} /></button>
        <button className="btn btn-ghost btn-sm" onClick={handleExportLogs} title="Export CSV"><Download size={16} /></button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>ID</th>
              <th>{t('admin.action')}</th>
              <th>{t('admin.details')}</th>
              <th>{t('admin.user')}</th>
              <th>{t('admin.date')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <>
                <tr key={l.id}>
                  <td>
                    {l.hasChildren && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 2, minWidth: 'auto' }}
                        onClick={() => toggleExpand(l.id)}
                        disabled={expandingId === l.id}
                      >
                        {expandedRows[l.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </td>
                  <td>#{l.id}</td>
                  <td><span className="admin-badge admin-badge--action">{l.action}</span></td>
                  <td className="admin-td-content">{l.details || '-'}</td>
                  <td>{l.userName || '-'}</td>
                  <td className="admin-td-date">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
                {expandedRows[l.id]?.map((child) => (
                  <tr key={`child-${child.id}`} style={{ background: 'var(--bg-subtle)', borderLeft: '3px solid var(--primary-400)' }}>
                    <td></td>
                    <td style={{ paddingLeft: 'var(--sp-4)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>#{child.id}</td>
                    <td><span className="admin-badge admin-badge--action" style={{ opacity: 0.8 }}>{child.action}</span></td>
                    <td className="admin-td-content" style={{ fontSize: 'var(--text-xs)' }}>{child.details || '-'}</td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>{child.userName || '-'}</td>
                    <td className="admin-td-date" style={{ fontSize: 'var(--text-xs)' }}>{new Date(child.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>{t('admin.noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="admin-page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  ANNOUNCEMENTS PANEL (NEW)
// ═══════════════════════════════════════════

function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editExpiry, setEditExpiry] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getAnnouncements({ page, pageSize: 20 })
      .then((res) => { setAnnouncements(res.data.items); setTotalPages(res.data.totalPages); })
      .catch(() => toast.error('Failed to load announcements'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) { toast.error('Title and content required'); return; }
    setSubmitting(true);
    try {
      await adminApi.createAnnouncement({
        title: formTitle,
        content: formContent,
        expiresAt: formExpiry || undefined,
      });
      toast.success('Announcement created');
      setFormTitle(''); setFormContent(''); setFormExpiry(''); setShowForm(false);
      load();
    } catch { toast.error('Failed to create'); }
    finally { setSubmitting(false); }
  };

  const handleUpdate = async (id: number) => {
    try {
      await adminApi.updateAnnouncement(id, {
        title: editTitle || undefined,
        content: editContent || undefined,
        expiresAt: editExpiry || undefined,
      });
      toast.success('Announcement updated');
      setEditingId(null);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await adminApi.deleteAnnouncement(id);
      toast.success('Announcement deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditContent(a.content);
    setEditExpiry(a.expiresAt ?? '');
  };

  if (loading) return <div className="admin-loading"><span className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ color: 'var(--text-primary)' }}>System Announcements</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Announcement'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <input
            type="text" placeholder="Title" value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="admin-select" style={{ width: '100%', marginBottom: 'var(--sp-2)' }}
          />
          <textarea
            placeholder="Content" value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            className="admin-select" style={{ width: '100%', minHeight: 80, marginBottom: 'var(--sp-2)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Expires:</label>
            <input type="datetime-local" value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)} className="admin-select" />
            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {announcements.map((a) => (
          <div key={a.id} className="glass-card" style={{ padding: 'var(--sp-4)' }}>
            {editingId === a.id ? (
              <div>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="admin-select" style={{ width: '100%', marginBottom: 'var(--sp-2)' }} />
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                  className="admin-select" style={{ width: '100%', minHeight: 60, marginBottom: 'var(--sp-2)' }} />
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <input type="datetime-local" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} className="admin-select" />
                  <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(a.id)}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{a.title}</h4>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      by {a.adminName} - {new Date(a.createdAt).toLocaleDateString()}
                      {a.expiresAt && (
                        <span className={`admin-badge ${a.isExpired ? 'admin-badge--muted' : 'admin-badge--success'}`} style={{ marginLeft: 'var(--sp-2)' }}>
                          {a.isExpired ? 'Expired' : 'Active'}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="admin-action-btns">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(a)}>Edit</button>
                    <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => handleDelete(a.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p style={{ marginTop: 'var(--sp-2)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{a.content}</p>
              </div>
            )}
          </div>
        ))}
        {announcements.length === 0 && (
          <div className="admin-empty">
            <Megaphone size={48} strokeWidth={1.5} />
            <p>No announcements yet</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination" style={{ marginTop: 'var(--sp-4)' }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="admin-page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/client" && pnpm build`
Expected: Build succeeded.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/AdminPage.tsx
git commit -m "feat: upgrade AdminPage to 7-tab layout with expandable batch logs, reports, announcements

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Update dev.md (Role Gap Research + Status Updates)

**Files:**
- Modify: `dev.md`

- [ ] **Step 1: Replace dev.md with updated content**

The key changes:
1. All 6 migrations marked as APPLIED
2. Critical bugs section updated (route mismatch FIXED, N+1 FIXED)
3. "Recently Completed" section updated to reflect what actually exists now
4. Role gap research documented with specific missing features
5. Clean up stale/incorrect entries

Replace the entire content of `dev.md` — the new content should accurately reflect the post-implementation state. The agent implementing this task should read the current `dev.md`, then update:

- Migration status table: all 6 → **Applied**
- Critical Bugs #1 (API route mismatch): mark as **FIXED** — routes now match 3-controller split
- Critical Bugs #3 (N+1 HasChildren): mark as **FIXED** — pre-fetch GroupBy dictionary
- Critical Bugs #2 (sync JWT validation): leave as **OPEN** — not addressed in this session
- "Recently Completed" section: update to list what was ACTUALLY implemented (not MiniMax claims)
- Add "Role Gap Research" section documenting VolunteerController, SponsorController, PersonInNeedController, NotificationController gaps
- Remove stale "Pending Fixes" items that were addressed

- [ ] **Step 2: Commit**

```bash
git add dev.md
git commit -m "docs: update dev.md with role gap research, migration status, and implementation status

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Full Build + Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Build backend**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.API" && dotnet build`
Expected: Build succeeded, 0 errors.

- [ ] **Step 2: Build frontend**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/client" && pnpm build`
Expected: Build succeeded.

- [ ] **Step 3: Run existing tests**

Run: `cd "c:/Dev Language/Works/3. PBL/PBL3/Website-to-support-people-in-need/src/ReliefConnect.Tests" && dotnet test`
Expected: All existing tests pass (new functionality doesn't break existing tests).

- [ ] **Step 4: Final commit if any remaining changes**

```bash
git status
# If clean, nothing to commit. Otherwise stage and commit any remaining files.
```

---

## Execution Order Summary

| Task | Phase | Description |
|------|-------|-------------|
| 1 | Phase 1: Entity Sync | New enums (ReportStatus, HelpOfferStatus) |
| 2 | Phase 1: Entity Sync | New entities (Report, HelpOffer, SystemAnnouncement) |
| 3 | Phase 1: Entity Sync | Update existing entities (SystemLog, ApplicationUser, Ping, Post) |
| 4 | Phase 1: Entity Sync | Update AppDbContext (DbSets + fluent config) |
| 5 | Phase 1: Entity Sync | New DTOs + update existing DTOs |
| 6 | Phase 2: Controllers | Shared ControllerExtensions helper |
| 7 | Phase 2: Controllers | Refactor AdminController (user management + batch hierarchy) |
| 8 | Phase 2: Controllers | Create AdminModerationController |
| 9 | Phase 2: Controllers | Create AdminSystemController |
| 10 | Phase 4: Frontend | TypeScript types |
| 11 | Phase 4: Frontend | Update api.ts routes |
| 12 | Phase 4: Frontend | Update AdminPage.tsx (7 tabs + expandable logs + new panels) |
| 13 | Phase 5: Research | Update dev.md with role gap research |
| 14 | Verification | Full build + smoke test |

**Dependencies:** Tasks 1-5 are sequential (each builds on prior). Tasks 6-9 depend on 1-5 being complete. Tasks 10-12 depend on 6-9 being complete. Task 13 is independent. Task 14 runs last.
