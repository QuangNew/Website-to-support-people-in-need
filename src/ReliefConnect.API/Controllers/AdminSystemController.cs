using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
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
    private readonly INotificationRealtimeDispatcher _notificationRealtimeDispatcher;

    private static readonly Regex LogKeyRegex = new(@"\bkey=(?<id>[^\s|]+)", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex LogTargetRegex = new(@"\btarget=(?<id>[0-9a-fA-F-]{36})\b", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex DirectMessageTargetRegex = new(@"\bUser\s+[0-9a-fA-F-]{36}\s*->\s*(?<id>[0-9a-fA-F-]{36})\b", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex UserIdRegex = new(@"\b(?<id>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public AdminSystemController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        ILogger<AdminSystemController> logger,
        IMemoryCache cache,
        INotificationRealtimeDispatcher notificationRealtimeDispatcher)
    {
        _db = db;
        _userManager = userManager;
        _logger = logger;
        _cache = cache;
        _notificationRealtimeDispatcher = notificationRealtimeDispatcher;
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

    private sealed class LogRow
    {
        public int Id { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? Details { get; set; }
        public string? UserId { get; set; }
        public string? UserName { get; set; }
        public DateTime CreatedAt { get; set; }
        public Guid? BatchId { get; set; }
    }

    private sealed class UserDisplayRow
    {
        public string Id { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? UserName { get; set; }
    }

    private static string BuildUserDisplay(string? fullName, string? userName)
    {
        if (!string.IsNullOrWhiteSpace(fullName) && !string.IsNullOrWhiteSpace(userName) &&
            !string.Equals(fullName, userName, StringComparison.OrdinalIgnoreCase))
        {
            return $"{fullName} (@{userName})";
        }

        if (!string.IsNullOrWhiteSpace(fullName))
            return fullName;

        if (!string.IsNullOrWhiteSpace(userName))
            return $"@{userName}";

        return "Unknown user";
    }

    private static string? TryExtractTargetUserId(string? details)
    {
        if (string.IsNullOrWhiteSpace(details))
            return null;

        var keyMatch = LogKeyRegex.Match(details);
        if (keyMatch.Success)
            return keyMatch.Groups["id"].Value;

        var targetMatch = LogTargetRegex.Match(details);
        if (targetMatch.Success)
            return targetMatch.Groups["id"].Value;

        var directMessageMatch = DirectMessageTargetRegex.Match(details);
        return directMessageMatch.Success ? directMessageMatch.Groups["id"].Value : null;
    }

    private static IEnumerable<string> ExtractUserIds(string? details)
    {
        if (string.IsNullOrWhiteSpace(details))
            yield break;

        foreach (Match match in UserIdRegex.Matches(details))
            yield return match.Groups["id"].Value;
    }

    private static string? EnrichLogDetails(string? details, IReadOnlyDictionary<string, string> userDisplayMap)
    {
        if (string.IsNullOrWhiteSpace(details))
            return details;

        return UserIdRegex.Replace(details, match =>
        {
            var userId = match.Groups["id"].Value;
            return userDisplayMap.TryGetValue(userId, out var display)
                ? $"{display} ({userId})"
                : match.Value;
        });
    }

    private async Task<Dictionary<string, string>> BuildUserDisplayMapAsync(IEnumerable<string?> userIds)
    {
        var ids = userIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id!)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (ids.Count == 0)
            return [];

        return await _db.Users
            .AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new UserDisplayRow
            {
                Id = u.Id,
                FullName = u.FullName,
                UserName = u.UserName,
            })
            .ToDictionaryAsync(u => u.Id, u => BuildUserDisplay(u.FullName, u.UserName), StringComparer.Ordinal);
    }

    private async Task<List<SystemLogDto>> MapLogDtosAsync(IReadOnlyCollection<LogRow> logs, IReadOnlyDictionary<int, int>? childCountMap = null)
    {
        var targetIds = logs
            .Select(l => TryExtractTargetUserId(l.Details))
            .Where(id => !string.IsNullOrWhiteSpace(id));

        var actorIds = logs
            .Select(l => l.UserId)
            .Where(id => !string.IsNullOrWhiteSpace(id));

        var detailsIds = logs.SelectMany(l => ExtractUserIds(l.Details));

        var userDisplayMap = await BuildUserDisplayMapAsync(actorIds.Concat(targetIds).Concat(detailsIds));

        return logs.Select(l =>
        {
            var targetUserId = TryExtractTargetUserId(l.Details);
            userDisplayMap.TryGetValue(l.UserId ?? string.Empty, out var actorDisplay);
            userDisplayMap.TryGetValue(targetUserId ?? string.Empty, out var targetDisplay);

            return new SystemLogDto
            {
                Id = l.Id,
                Action = l.Action,
                Details = EnrichLogDetails(l.Details, userDisplayMap),
                UserId = l.UserId,
                UserName = actorDisplay ?? l.UserName,
                TargetUserId = targetUserId,
                TargetUserName = targetDisplay,
                CreatedAt = l.CreatedAt,
                BatchId = l.BatchId,
                HasChildren = childCountMap?.ContainsKey(l.Id) == true,
            };
        }).ToList();
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
        [FromQuery] bool adminsOnly = false,
        [FromQuery] string? userId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (pageSize > 100) pageSize = 100;

        var query = _db.SystemLogs
            .AsNoTracking()
            .Where(l => l.ParentLogId == null); // Only parent/standalone logs

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(l => l.Action == action);

        if (adminsOnly)
        {
            var adminIds = _db.Users
                .AsNoTracking()
                .Where(u => u.Role == RoleEnum.Admin)
                .Select(u => u.Id);

            query = query.Where(l => l.UserId != null && adminIds.Contains(l.UserId));
        }

        if (!string.IsNullOrWhiteSpace(userId))
        {
            var keyToken = $"key={userId}";
            var targetToken = $"target={userId}";
            query = query.Where(l => l.UserId == userId ||
                                     (l.Details != null && (
                                         l.Details.Contains(keyToken) ||
                                         l.Details.Contains(targetToken) ||
                                         l.Details.Contains(userId))));
        }

        if (DateTime.TryParse(from, out var fromDate))
            query = query.Where(l => l.CreatedAt >= fromDate);

        if (DateTime.TryParse(to, out var toDate))
            query = query.Where(l => l.CreatedAt <= toDate);

        var total = await query.CountAsync();
        var logs = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new LogRow
            {
                Id = l.Id,
                Action = l.Action,
                Details = l.Details,
                UserId = l.UserId,
                UserName = l.UserName,
                CreatedAt = l.CreatedAt,
                BatchId = l.BatchId,
            })
            .ToListAsync();

        // Fetch child counts in a single query
        var logIds = logs.Select(l => l.Id).ToList();
        var childCountMap = await _db.SystemLogs
            .Where(l => l.ParentLogId != null && logIds.Contains(l.ParentLogId!.Value))
            .GroupBy(l => l.ParentLogId)
            .Select(g => new { ParentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.ParentId!.Value, g => g.Count);

        var dtos = await MapLogDtosAsync(logs, childCountMap);

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
            .Select(l => new LogRow
            {
                Id = l.Id,
                Action = l.Action,
                Details = l.Details,
                UserId = l.UserId,
                UserName = l.UserName,
                CreatedAt = l.CreatedAt,
                BatchId = l.BatchId,
            })
            .ToListAsync();

        var dtos = await MapLogDtosAsync(children);
        return Ok(dtos);
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
            .Join(
                _db.Users.AsNoTracking(),
                a => a.AdminId,
                u => u.Id,
                (a, u) => new { Announcement = a, AdminName = u.FullName ?? u.UserName ?? "Admin" }
            )
            .OrderByDescending(x => x.Announcement.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AnnouncementDto
            {
                Id        = x.Announcement.Id,
                Title     = x.Announcement.Title,
                Content   = x.Announcement.Content,
                AdminId   = x.Announcement.AdminId,
                AdminName = x.AdminName,
                CreatedAt = x.Announcement.CreatedAt,
                ExpiresAt = x.Announcement.ExpiresAt,
                IsExpired = x.Announcement.ExpiresAt != null && x.Announcement.ExpiresAt < now
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
        await _notificationRealtimeDispatcher.PublishAnnouncementsChangedAsync(announcement.Id, "created");
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
        await _notificationRealtimeDispatcher.PublishAnnouncementsChangedAsync(id, "updated");
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
        await _notificationRealtimeDispatcher.PublishAnnouncementsChangedAsync(id, "deleted");
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
