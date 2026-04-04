using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Infrastructure.Data;
using ReliefConnect.API.Extensions;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Admin system endpoints: stats, logs, announcements, CSV exports, SOS management.
/// All endpoints require the "RequireAdmin" policy.
/// </summary>
[ApiController]
[Route("api/admin/system")]
[Authorize(Policy = "RequireAdmin")]
public class AdminSystemController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<AdminSystemController> _logger;
    private readonly IMemoryCache _cache;

    public AdminSystemController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        ILogger<AdminSystemController> logger,
        IMemoryCache cache)
    {
        _db = db;
        _userManager = userManager;
        _logger = logger;
        _cache = cache;
    }

    // ═══════════════════════════════════════════
    //  SYSTEM STATS
    // ═══════════════════════════════════════════

    // Projection type for the single-query stats approach
    private sealed class StatsRow
    {
        public string Bucket { get; set; } = "";
        public string Key    { get; set; } = "";
        public int    Count  { get; set; }
    }

    /// <summary>
    /// Get system-wide statistics including pending verifications and reports.
    /// Uses a single UNION ALL SQL query (1 DB round-trip).
    /// Results cached 60 seconds in IMemoryCache.
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<SystemStatsDto>> GetStats(
        [FromServices] IMemoryCache cache)
    {
        if (cache.TryGetValue("admin:stats", out SystemStatsDto? cached) && cached != null)
            return Ok(cached);

        const int sosType            = 0; // MapItemType.SOS
        const int pendingVerification = 1; // VerificationStatus.Pending
        const int pendingReport       = 0; // ReportStatus.Pending

        var rows = await _db.Database
            .SqlQuery<StatsRow>($"""
                SELECT 'role'::text AS "Bucket", "Role"::text AS "Key", COUNT(*)::int AS "Count"
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
                UNION ALL
                SELECT 'verification', "VerificationStatus"::text, COUNT(*)::int
                FROM "AspNetUsers"
                WHERE "VerificationStatus" = {pendingVerification}
                GROUP BY "VerificationStatus"
                UNION ALL
                SELECT 'report', "Status"::text, COUNT(*)::int
                FROM "Reports"
                WHERE "Status" = {pendingReport}
                GROUP BY "Status"
                """)
            .ToListAsync();

        int RoleBucket(RoleEnum r)     => rows.Where(x => x.Bucket == "role"         && x.Key == ((int)r).ToString()).Sum(x => x.Count);
        int PingBucket(SOSStatus s)    => rows.Where(x => x.Bucket == "ping"         && x.Key == ((int)s).ToString()).Sum(x => x.Count);
        int PostBucket(PostCategory c) => rows.Where(x => x.Bucket == "post"         && x.Key == ((int)c).ToString()).Sum(x => x.Count);

        var stats = new SystemStatsDto
        {
            TotalUsers            = rows.Where(x => x.Bucket == "role").Sum(x => x.Count),
            TotalPersonsInNeed    = RoleBucket(RoleEnum.PersonInNeed),
            TotalSponsors         = RoleBucket(RoleEnum.Sponsor),
            TotalVolunteers       = RoleBucket(RoleEnum.Volunteer),
            ActiveSOS             = PingBucket(SOSStatus.Pending),
            ResolvedCases         = PingBucket(SOSStatus.Resolved),
            TotalPosts            = rows.Where(x => x.Bucket == "post").Sum(x => x.Count),
            TotalPostsLivelihood  = PostBucket(PostCategory.Livelihood),
            TotalPostsMedical     = PostBucket(PostCategory.Medical),
            TotalPostsEducation   = PostBucket(PostCategory.Education),
            PendingVerifications  = rows.Where(x => x.Bucket == "verification").Sum(x => x.Count),
            PendingReports        = rows.Where(x => x.Bucket == "report").Sum(x => x.Count),
        };

        cache.Set("admin:stats", stats, TimeSpan.FromSeconds(60));
        return Ok(stats);
    }

    // ═══════════════════════════════════════════
    //  SYSTEM LOGS — Parent/standalone only
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get system logs. Only parent/standalone entries (ParentLogId IS NULL).
    /// Includes HasChildren computed from a grouped child query.
    /// </summary>
    [HttpGet("logs")]
    public async Task<ActionResult> GetLogs(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] string? action,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (pageSize > 100) pageSize = 100;

        var query = _db.SystemLogs
            .AsNoTracking()
            .Where(l => l.ParentLogId == null); // Only parent/standalone logs

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
            .Select(l => new { l.Id, l.Action, l.Details, l.UserId, l.UserName, l.CreatedAt, l.BatchId })
            .ToListAsync();

        // Fetch child counts in a single query
        var logIds = logs.Select(l => l.Id).ToList();
        var childCountMap = await _db.SystemLogs
            .Where(l => l.ParentLogId != null && logIds.Contains(l.ParentLogId!.Value))
            .GroupBy(l => l.ParentLogId)
            .Select(g => new { ParentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.ParentId!.Value, g => g.Count);

        var dtos = logs.Select(l => new SystemLogDto
        {
            Id          = l.Id,
            Action      = l.Action,
            Details     = l.Details,
            UserId      = l.UserId,
            UserName    = l.UserName,
            CreatedAt   = l.CreatedAt,
            BatchId     = l.BatchId,
            HasChildren = childCountMap.ContainsKey(l.Id)
        }).ToList();

        return Ok(new
        {
            items = dtos,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    /// <summary>
    /// Get child log entries for a specific parent log.
    /// </summary>
    [HttpGet("logs/{logId}/children")]
    public async Task<ActionResult> GetLogChildren(int logId)
    {
        var children = await _db.SystemLogs
            .AsNoTracking()
            .Where(l => l.ParentLogId == logId)
            .OrderBy(l => l.CreatedAt)
            .Select(l => new SystemLogDto
            {
                Id          = l.Id,
                Action      = l.Action,
                Details     = l.Details,
                UserId      = l.UserId,
                UserName    = l.UserName,
                CreatedAt   = l.CreatedAt,
                BatchId     = l.BatchId,
                HasChildren = false
            })
            .ToListAsync();

        return Ok(children);
    }

    // ═══════════════════════════════════════════
    //  ANNOUNCEMENTS
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get paginated system announcements with admin name and expiry status.
    /// </summary>
    [HttpGet("announcements")]
    public async Task<ActionResult> GetAnnouncements(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (pageSize > 100) pageSize = 100;

        var now = DateTime.UtcNow;
        var total = await _db.SystemAnnouncements.CountAsync();
        var announcements = await _db.SystemAnnouncements
            .AsNoTracking()
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AnnouncementDto
            {
                Id        = a.Id,
                Title     = a.Title,
                Content   = a.Content,
                AdminId   = a.AdminId,
                AdminName = a.AdminId != null
                    ? _db.Users.Where(u => u.Id == a.AdminId).Select(u => u.FullName ?? u.UserName ?? "Admin").FirstOrDefault() ?? "Admin"
                    : "Admin",
                CreatedAt = a.CreatedAt,
                ExpiresAt = a.ExpiresAt,
                IsExpired = a.ExpiresAt != null && a.ExpiresAt < now
            })
            .ToListAsync();

        return Ok(new
        {
            items = announcements,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    /// <summary>
    /// Create a new system announcement.
    /// </summary>
    [HttpPost("announcements")]
    public async Task<ActionResult> CreateAnnouncement([FromBody] CreateAnnouncementDto dto)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        DateTime? expiresAt = null;
        if (!string.IsNullOrWhiteSpace(dto.ExpiresAt) && DateTime.TryParse(dto.ExpiresAt, out var parsed))
            expiresAt = parsed.ToUniversalTime();

        var announcement = new SystemAnnouncement
        {
            Title     = dto.Title,
            Content   = dto.Content,
            AdminId   = adminId!,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt
        };

        _db.SystemAnnouncements.Add(announcement);
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "AnnouncementCreated", $"Created announcement '{dto.Title}' (id={announcement.Id})");
        _logger.LogInformation("Admin created announcement #{Id}: {Title}", announcement.Id, dto.Title);

        return Ok(new { id = announcement.Id, message = "Đã tạo thông báo hệ thống." });
    }

    /// <summary>
    /// Update an existing announcement.
    /// </summary>
    [HttpPut("announcements/{id}")]
    public async Task<ActionResult> UpdateAnnouncement(int id, [FromBody] UpdateAnnouncementDto dto)
    {
        var announcement = await _db.SystemAnnouncements.FirstOrDefaultAsync(a => a.Id == id);
        if (announcement == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Thông báo không tồn tại." });

        if (dto.Title != null)   announcement.Title   = dto.Title;
        if (dto.Content != null) announcement.Content = dto.Content;

        if (dto.ExpiresAt != null)
        {
            if (DateTime.TryParse(dto.ExpiresAt, out var parsed))
                announcement.ExpiresAt = parsed.ToUniversalTime();
        }

        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "AnnouncementUpdated", $"Updated announcement #{id}");
        _logger.LogInformation("Admin updated announcement #{Id}", id);

        return Ok(new { message = "Đã cập nhật thông báo." });
    }

    /// <summary>
    /// Delete an announcement.
    /// </summary>
    [HttpDelete("announcements/{id}")]
    public async Task<ActionResult> DeleteAnnouncement(int id)
    {
        var announcement = await _db.SystemAnnouncements.FirstOrDefaultAsync(a => a.Id == id);
        if (announcement == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Thông báo không tồn tại." });

        _db.SystemAnnouncements.Remove(announcement);
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "AnnouncementDeleted", $"Deleted announcement #{id}");
        _logger.LogInformation("Admin deleted announcement #{Id}", id);

        return Ok(new { message = "Đã xóa thông báo." });
    }

    // ═══════════════════════════════════════════
    //  CSV EXPORTS
    // ═══════════════════════════════════════════

    /// <summary>
    /// Export all users as CSV (max 10,000 rows).
    /// </summary>
    [HttpGet("export/users")]
    public async Task<IActionResult> ExportUsers()
    {
        var users = await _userManager.Users
            .AsNoTracking()
            .OrderByDescending(u => u.CreatedAt)
            .Take(10_000)
            .Select(u => new
            {
                u.Id,
                u.UserName,
                u.Email,
                u.FullName,
                Role = u.Role.ToString(),
                VerificationStatus = u.VerificationStatus.ToString(),
                u.EmailConfirmed,
                u.IsSuspended,
                u.SuspendedUntil,
                u.BanReason,
                u.CreatedAt
            })
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Id,UserName,Email,FullName,Role,VerificationStatus,EmailConfirmed,IsSuspended,SuspendedUntil,BanReason,CreatedAt");

        foreach (var u in users)
        {
            sb.AppendLine(string.Join(",",
                ControllerExtensions.CsvSafe(u.Id),
                ControllerExtensions.CsvSafe(u.UserName),
                ControllerExtensions.CsvSafe(u.Email),
                ControllerExtensions.CsvSafe(u.FullName),
                ControllerExtensions.CsvSafe(u.Role),
                ControllerExtensions.CsvSafe(u.VerificationStatus),
                u.EmailConfirmed.ToString(),
                u.IsSuspended.ToString(),
                ControllerExtensions.CsvSafe(u.SuspendedUntil?.ToString("o")),
                ControllerExtensions.CsvSafe(u.BanReason),
                ControllerExtensions.CsvSafe(u.CreatedAt.ToString("o"))
            ));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"users_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
    }

    /// <summary>
    /// Export system logs as CSV (max 10,000 rows).
    /// </summary>
    [HttpGet("export/logs")]
    public async Task<IActionResult> ExportLogs()
    {
        var logs = await _db.SystemLogs
            .AsNoTracking()
            .OrderByDescending(l => l.CreatedAt)
            .Take(10_000)
            .Select(l => new
            {
                l.Id,
                l.Action,
                l.Details,
                l.UserId,
                l.UserName,
                l.CreatedAt,
                BatchId = l.BatchId.HasValue ? l.BatchId.Value.ToString() : string.Empty,
                l.ParentLogId
            })
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Id,Action,Details,UserId,UserName,CreatedAt,BatchId,ParentLogId");

        foreach (var l in logs)
        {
            sb.AppendLine(string.Join(",",
                l.Id.ToString(),
                ControllerExtensions.CsvSafe(l.Action),
                ControllerExtensions.CsvSafe(l.Details),
                ControllerExtensions.CsvSafe(l.UserId),
                ControllerExtensions.CsvSafe(l.UserName),
                ControllerExtensions.CsvSafe(l.CreatedAt.ToString("o")),
                ControllerExtensions.CsvSafe(l.BatchId),
                l.ParentLogId.HasValue ? l.ParentLogId.Value.ToString() : string.Empty
            ));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"logs_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
    }

    // ═══════════════════════════════════════════
    //  SOS — Force resolve
    // ═══════════════════════════════════════════

    /// <summary>
    /// Force-resolve a SOS ping (set status to Resolved).
    /// </summary>
    [HttpPost("sos/{pingId}/force-resolve")]
    public async Task<ActionResult> ForceResolvePing(int pingId)
    {
        var ping = await _db.Pings.FirstOrDefaultAsync(p => p.Id == pingId);
        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "SOS ping không tồn tại." });

        ping.Status = SOSStatus.Resolved;
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "SOSForceResolved", $"Force-resolved SOS ping #{pingId}");
        _logger.LogInformation("Admin force-resolved SOS ping #{PingId}", pingId);

        return Ok(new { message = $"Đã đánh dấu SOS #{pingId} là đã giải quyết." });
    }
}
