using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Admin-only endpoints: user management, verification queue, content moderation, stats, logs.
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

    /// <summary>
    /// Get paginated user list with optional search/filter.
    /// </summary>
    [HttpGet("users")]
    public async Task<ActionResult> GetUsers(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] string? verificationStatus,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _userManager.Users.AsNoTracking().AsQueryable();

        // Search by name, email, or username
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.FullName, pattern) ||
                EF.Functions.ILike(u.Email!, pattern) ||
                EF.Functions.ILike(u.UserName!, pattern));
        }

        // Filter by role
        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<RoleEnum>(role, true, out var roleEnum))
        {
            query = query.Where(u => u.Role == roleEnum);
        }

        // Filter by verification status
        if (!string.IsNullOrWhiteSpace(verificationStatus) && Enum.TryParse<VerificationStatus>(verificationStatus, true, out var vs))
        {
            query = query.Where(u => u.VerificationStatus == vs);
        }

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
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items = users,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    // ═══════════════════════════════════════════
    //  USERS — Approve / change role
    // ═══════════════════════════════════════════

    /// <summary>
    /// Approve a user's role verification request or directly set their role.
    /// </summary>
    [HttpPut("users/{userId}/role")]
    public async Task<ActionResult> ApproveRole(string userId, [FromBody] ApproveRoleDto dto)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        if (!Enum.TryParse<RoleEnum>(dto.Role, true, out var newRole))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vai trò không hợp lệ." });

        var oldRole = user.Role;
        user.Role = newRole;
        user.VerificationStatus = VerificationStatus.Approved;
        user.RequestedRole = null;
        user.VerificationReason = null;
        await _userManager.UpdateAsync(user);

        // Invalidate both stats and verifications caches immediately
        _cache.Remove("admin:stats");
        _cache.Remove("admin:verifications");

        // Audit log
        await LogAction("RoleApproved", $"User {user.UserName}: {oldRole} → {newRole}");

        _logger.LogInformation("Admin approved role: {Username} → {Role}", user.UserName, newRole);

        return Ok(new { message = $"Đã cập nhật vai trò {user.UserName} thành {newRole}." });
    }

    // ═══════════════════════════════════════════
    //  VERIFICATION QUEUE
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get all pending verification requests. Cached 20 seconds.
    /// Cache is invalidated immediately when a request is approved or rejected.
    /// </summary>
    [HttpGet("verifications")]
    public async Task<ActionResult> GetPendingVerifications([FromServices] IMemoryCache cache)
    {
        const string cacheKey = "admin:verifications";
        if (cache.TryGetValue(cacheKey, out List<AdminUserDto>? cachedList) && cachedList != null)
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
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        cache.Set(cacheKey, pending, TimeSpan.FromSeconds(20));
        return Ok(pending);
    }

    /// <summary>
    /// Reject a verification request.
    /// </summary>
    [HttpPost("verifications/{userId}/reject")]
    public async Task<ActionResult> RejectVerification(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        if (user.VerificationStatus != VerificationStatus.Pending)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Người dùng không có yêu cầu đang chờ duyệt." });

        user.VerificationStatus = VerificationStatus.Rejected;
        await _userManager.UpdateAsync(user);

        _cache.Remove("admin:verifications"); // Invalidate cache immediately
        await LogAction("VerificationRejected", $"Rejected verification for {user.UserName}");
        _logger.LogInformation("Admin rejected verification: {Username}", user.UserName);

        return Ok(new { message = $"Đã từ chối yêu cầu xác minh của {user.UserName}." });
    }

    // ═══════════════════════════════════════════
    //  CONTENT MODERATION — Delete post
    // ═══════════════════════════════════════════

    /// <summary>
    /// Delete a post (content moderation).
    /// </summary>
    [HttpDelete("posts/{postId}")]
    public async Task<ActionResult> DeletePost(int postId)
    {
        // Get author name for audit log with lightweight projection
        var postInfo = await _db.Posts
            .AsNoTracking()
            .Where(p => p.Id == postId)
            .Select(p => new { AuthorName = p.Author != null ? p.Author.UserName : "unknown" })
            .FirstOrDefaultAsync();

        if (postInfo == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bài viết không tồn tại." });

        // Single-query delete (no FindAsync + Remove)
        await _db.Posts.Where(p => p.Id == postId).ExecuteDeleteAsync();

        await LogAction("PostDeleted", $"Deleted post #{postId} by {postInfo.AuthorName}");
        _logger.LogInformation("Admin deleted post #{PostId} by {Author}", postId, postInfo.AuthorName);

        return Ok(new { message = "Đã xóa bài viết." });
    }

    // ═══════════════════════════════════════════
    //  POSTS — Admin list with pagination + filter
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get paginated post list for admin moderation. No output cache (admin needs fresh data).
    /// </summary>
    [HttpGet("posts")]
    public async Task<ActionResult> GetAdminPosts(
        [FromQuery] string? category,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (pageSize > 50) pageSize = 50;

        if (!string.IsNullOrWhiteSpace(category) && !Enum.TryParse<PostCategory>(category, true, out _))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Invalid category." });

        var query = _db.Posts
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(category) && Enum.TryParse<PostCategory>(category, true, out var cat))
            query = query.Where(p => p.Category == cat);

        var total = await query.CountAsync();
        var rawPosts = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Content,
                p.Category,
                p.AuthorId,
                AuthorName = p.Author != null ? (p.Author.FullName ?? p.Author.UserName ?? "Ẩn danh") : "Ẩn danh",
                p.CreatedAt
            })
            .ToListAsync();

        var posts = rawPosts.Select(p => new AdminPostDto
        {
            Id = p.Id,
            Content = p.Content.Length > 200 ? p.Content[..200] : p.Content,
            Category = p.Category.ToString(),
            AuthorId = p.AuthorId,
            AuthorName = p.AuthorName,
            CreatedAt = p.CreatedAt
        }).ToList();

        return Ok(new
        {
            items = posts,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    // ═══════════════════════════════════════════
    //  BATCH OPERATIONS
    // ═══════════════════════════════════════════

    /// <summary>
    /// Execute multiple admin operations in a single DB transaction.
    /// Processes: role approvals, role rejections, post deletions.
    /// Returns per-operation results so the frontend can handle partial failures.
    /// </summary>
    [HttpPost("batch")]
    public async Task<ActionResult<AdminBatchResultDto>> BatchActions([FromBody] AdminBatchDto dto)
    {
        var results = new List<BatchResultItem>();

        // Validate totals — cap to 100 ops per batch as a safety limit
        var total = dto.RoleApprovals.Count + dto.RoleRejections.Count + dto.PostDeletions.Count;
        if (total == 0)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Batch rỗng." });
        if (total > 100)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Tối đa 100 operations mỗi batch." });

        // ── All operations inside a single transaction ──
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // 1. Role approvals
            foreach (var op in dto.RoleApprovals)
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
                _logger.LogInformation("[Batch] ApproveRole: {Username} {Old}→{New}", user.UserName, oldRole, newRole);
            }

            // 2. Role rejections
            foreach (var userId in dto.RoleRejections)
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

            // 3. Post deletions — single ExecuteDelete per ID avoids N+1 loads
            foreach (var postId in dto.PostDeletions)
            {
                var deleted = await _db.Posts.Where(p => p.Id == postId).ExecuteDeleteAsync();
                if (deleted == 0)
                    results.Add(new BatchResultItem { OpType = "deletePost", Key = postId.ToString(), Success = false, Error = "Post not found" });
                else
                    results.Add(new BatchResultItem { OpType = "deletePost", Key = postId.ToString(), Success = true });
            }

            await tx.CommitAsync();
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "[Batch] Transaction rolled back");
            return StatusCode(500, new ApiErrorResponse { StatusCode = 500, Message = "Batch thất bại, mọi thay đổi đã được hoàn tác." });
        }

        // Invalidate caches after batch
        _cache.Remove("admin:stats");
        _cache.Remove("admin:verifications");

        // Audit log (single entry for the whole batch)
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var adminName = User.FindFirstValue(ClaimTypes.Name);
        _db.SystemLogs.Add(new SystemLog
        {
            Action = "BatchActions",
            Details = $"approvals={dto.RoleApprovals.Count} rejections={dto.RoleRejections.Count} deletions={dto.PostDeletions.Count} applied={results.Count(r => r.Success)}",
            UserId = adminId,
            UserName = adminName,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var applied = results.Count(r => r.Success);
        var failed  = results.Count(r => !r.Success);

        return Ok(new AdminBatchResultDto { Applied = applied, Failed = failed, Results = results });
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
    /// Get system-wide statistics.
    /// Uses a single UNION ALL SQL query (1 DB round-trip) instead of 3 sequential queries.
    /// Results cached 60 seconds in IMemoryCache.
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<SystemStatsDto>> GetStats(
        [FromServices] IMemoryCache cache)
    {
        if (cache.TryGetValue("admin:stats", out SystemStatsDto? cached) && cached != null)
            return Ok(cached);

        // Single round-trip: 3 GROUP BY aggregations via UNION ALL
        // MapItemType.SOS = 0, enums stored as integers in PostgreSQL
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

        // Parse integer enum keys back to enum values
        int RoleBucket(RoleEnum r)      => rows.Where(x => x.Bucket == "role" && x.Key == ((int)r).ToString()).Sum(x => x.Count);
        int PingBucket(SOSStatus s)     => rows.Where(x => x.Bucket == "ping" && x.Key == ((int)s).ToString()).Sum(x => x.Count);
        int PostBucket(PostCategory c)  => rows.Where(x => x.Bucket == "post" && x.Key == ((int)c).ToString()).Sum(x => x.Count);

        var stats = new SystemStatsDto
        {
            TotalUsers           = rows.Where(x => x.Bucket == "role").Sum(x => x.Count),
            TotalPersonsInNeed   = RoleBucket(RoleEnum.PersonInNeed),
            TotalSponsors        = RoleBucket(RoleEnum.Sponsor),
            TotalVolunteers      = RoleBucket(RoleEnum.Volunteer),
            ActiveSOS            = PingBucket(SOSStatus.Pending),
            ResolvedCases        = PingBucket(SOSStatus.Resolved),
            TotalPosts           = rows.Where(x => x.Bucket == "post").Sum(x => x.Count),
            TotalPostsLivelihood = PostBucket(PostCategory.Livelihood),
            TotalPostsMedical    = PostBucket(PostCategory.Medical),
            TotalPostsEducation  = PostBucket(PostCategory.Education),
        };

        cache.Set("admin:stats", stats, TimeSpan.FromSeconds(60));
        return Ok(stats);
    }

    // ═══════════════════════════════════════════
    //  SYSTEM LOGS
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get system logs with optional date range and action filter.
    /// </summary>
    [HttpGet("logs")]
    public async Task<ActionResult> GetLogs(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] string? action,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.SystemLogs.AsNoTracking().AsQueryable();

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
                l.CreatedAt
            })
            .ToListAsync();

        return Ok(new { items = logs, total, page, pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    // ═══════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═══════════════════════════════════════════

    private async Task LogAction(string action, string? details = null)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var adminName = User.FindFirstValue(ClaimTypes.Name);

        _db.SystemLogs.Add(new SystemLog
        {
            Action = action,
            Details = details,
            UserId = adminId,
            UserName = adminName,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
    }
}
