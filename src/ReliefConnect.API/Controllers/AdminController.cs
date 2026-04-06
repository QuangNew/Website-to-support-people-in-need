using System.Security.Claims;
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
/// Admin endpoints: user management and batch operations.
/// Stats, logs, posts, announcements, reports are in AdminSystemController and AdminModerationController.
/// All endpoints require the "RequireAdmin" policy.
/// </summary>
[ApiController]
[Route("api/admin")]
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

    private sealed class CountRow { public string Type { get; set; } = ""; public int Count { get; set; } }

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
        if (pageSize > 100) pageSize = 100;

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
                PhoneNumber = u.PhoneNumber,
                Address = u.Address,
                CreatedAt = u.CreatedAt,
                IsSuspended = u.IsSuspended,
                SuspendedUntil = u.SuspendedUntil,
                BanReason = u.BanReason
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
    //  USERS — Detail
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get detailed user info including post, comment, and ping counts.
    /// </summary>
    [HttpGet("users/{userId}")]
    public async Task<ActionResult<AdminUserDetailDto>> GetUserDetail(string userId)
    {
        var user = await _userManager.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .FirstOrDefaultAsync();

        if (user == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        var countRows = await _db.Database
            .SqlQuery<CountRow>($"""
                SELECT 'post'::text AS "Type", COUNT(*)::int AS "Count" FROM "Posts" WHERE "AuthorId" = {userId}
                UNION ALL
                SELECT 'comment', COUNT(*)::int FROM "Comments" WHERE "UserId" = {userId}
                UNION ALL
                SELECT 'ping', COUNT(*)::int FROM "Pings" WHERE "UserId" = {userId}
                """)
            .ToListAsync();
        var postCount    = countRows.FirstOrDefault(r => r.Type == "post")?.Count ?? 0;
        var commentCount = countRows.FirstOrDefault(r => r.Type == "comment")?.Count ?? 0;
        var pingCount    = countRows.FirstOrDefault(r => r.Type == "ping")?.Count ?? 0;

        var dto = new AdminUserDetailDto
        {
            Id                 = user.Id,
            UserName           = user.UserName!,
            Email              = user.Email!,
            FullName           = user.FullName,
            Role               = user.Role.ToString(),
            VerificationStatus = user.VerificationStatus.ToString(),
            RequestedRole      = user.RequestedRole,
            VerificationReason = user.VerificationReason,
            EmailVerified      = user.EmailConfirmed,
            AvatarUrl          = user.AvatarUrl,
            PhoneNumber        = user.PhoneNumber,
            Address            = user.Address,
            CreatedAt          = user.CreatedAt,
            IsSuspended        = user.IsSuspended,
            SuspendedUntil     = user.SuspendedUntil,
            BanReason          = user.BanReason,
            PostCount          = postCount,
            CommentCount       = commentCount,
            PingCount          = pingCount
        };

        return Ok(dto);
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

        // Invalidate caches immediately
        _cache.Remove("admin:stats");
        _cache.Remove("admin:verifications");

        await this.LogAdminAction(_db, "RoleApproved", $"User {user.UserName}: {oldRole} → {newRole}");
        _logger.LogInformation("Admin approved role: {Username} → {Role}", user.UserName, newRole);

        return Ok(new { message = $"Đã cập nhật vai trò {user.UserName} thành {newRole}." });
    }

    // ═══════════════════════════════════════════
    //  VERIFICATION QUEUE
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get all pending verification requests. Cached 20 seconds.
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
                PhoneNumber = u.PhoneNumber,
                Address = u.Address,
                CreatedAt = u.CreatedAt,
                IsSuspended = u.IsSuspended,
                SuspendedUntil = u.SuspendedUntil,
                BanReason = u.BanReason
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

        _cache.Remove("admin:verifications");
        await this.LogAdminAction(_db, "VerificationRejected", $"Rejected verification for {user.UserName}");
        _logger.LogInformation("Admin rejected verification: {Username}", user.UserName);

        return Ok(new { message = $"Đã từ chối yêu cầu xác minh của {user.UserName}." });
    }

    // ═══════════════════════════════════════════
    //  USERS — Suspend / Unsuspend / Ban
    // ═══════════════════════════════════════════

    /// <summary>
    /// Temporarily suspend a user.
    /// </summary>
    [HttpPost("users/{userId}/suspend")]
    public async Task<ActionResult> SuspendUser(string userId, [FromBody] SuspendUserDto dto)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        user.IsSuspended = true;
        user.SuspendedUntil = dto.Until;
        user.BanReason = dto.Reason;
        await _userManager.UpdateAsync(user);

        var until = dto.Until.HasValue ? dto.Until.Value.ToString("o") : "permanent";
        await this.LogAdminAction(_db, "UserSuspended", $"Suspended {user.UserName} until {until}: {dto.Reason}");
        _logger.LogInformation("Admin suspended user: {Username} until {Until}", user.UserName, until);

        return Ok(new { message = $"Đã tạm khóa tài khoản {user.UserName}." });
    }

    /// <summary>
    /// Lift suspension from a user.
    /// </summary>
    [HttpPost("users/{userId}/unsuspend")]
    public async Task<ActionResult> UnsuspendUser(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        user.IsSuspended = false;
        user.SuspendedUntil = null;
        user.BanReason = null;
        await _userManager.UpdateAsync(user);

        await this.LogAdminAction(_db, "UserUnsuspended", $"Lifted suspension for {user.UserName}");
        _logger.LogInformation("Admin unsuspended user: {Username}", user.UserName);

        return Ok(new { message = $"Đã mở khóa tài khoản {user.UserName}." });
    }

    /// <summary>
    /// Permanently ban a user and immediately invalidate their current token.
    /// </summary>
    [HttpPost("users/{userId}/ban")]
    public async Task<ActionResult> BanUser(string userId, [FromBody] BanUserDto dto)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        user.IsSuspended = true;
        user.SuspendedUntil = null; // null = permanent
        user.BanReason = dto.Reason;
        await _userManager.UpdateAsync(user);

        // Immediately invalidate the user's current session token
        if (!string.IsNullOrEmpty(user.LastTokenJti))
        {
            _tokenBlacklist.BlacklistToken(user.LastTokenJti, DateTime.UtcNow.AddDays(30));
        }

        await this.LogAdminAction(_db, "UserBanned", $"Permanently banned {user.UserName}: {dto.Reason}");
        _logger.LogInformation("Admin permanently banned user: {Username}", user.UserName);

        return Ok(new { message = $"Đã cấm vĩnh viễn tài khoản {user.UserName}." });
    }

    /// <summary>
    /// Force logout a user by blacklisting their current JWT token.
    /// </summary>
    [HttpPost("users/{userId}/force-logout")]
    public async Task<ActionResult> ForceLogout(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        if (!string.IsNullOrEmpty(user.LastTokenJti))
        {
            _tokenBlacklist.BlacklistToken(user.LastTokenJti, DateTime.UtcNow.AddDays(30));
        }

        await this.LogAdminAction(_db, "UserForceLogout", $"Force-logged out {user.UserName}");
        _logger.LogInformation("Admin force-logged out user: {Username}", user.UserName);

        return Ok(new { message = $"Đã buộc đăng xuất tài khoản {user.UserName}." });
    }

    /// <summary>
    /// Reset a user's verification status back to None, clearing requested role.
    /// </summary>
    [HttpPost("users/{userId}/reset-verification")]
    public async Task<ActionResult> ResetVerification(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        user.VerificationStatus = VerificationStatus.None;
        user.RequestedRole = null;
        user.VerificationReason = null;
        await _userManager.UpdateAsync(user);

        _cache.Remove("admin:verifications");
        await this.LogAdminAction(_db, "VerificationReset", $"Reset verification for {user.UserName}");
        _logger.LogInformation("Admin reset verification for user: {Username}", user.UserName);

        return Ok(new { message = $"Đã đặt lại trạng thái xác minh cho {user.UserName}." });
    }

    // ═══════════════════════════════════════════
    //  BATCH OPERATIONS
    // ═══════════════════════════════════════════

    /// <summary>
    /// Execute multiple admin operations in a single request with parent-child batch log hierarchy.
    /// Processes: role approvals, role rejections, post deletions.
    /// Returns per-operation results so the frontend can handle partial failures.
    /// </summary>
    [HttpPost("batch")]
    public async Task<ActionResult<AdminBatchResultDto>> BatchActions([FromBody] AdminBatchDto dto)
    {
        // Validate totals — cap to 100 ops per batch as a safety limit
        var total = dto.RoleApprovals.Count + dto.RoleRejections.Count + dto.PostDeletions.Count;
        if (total == 0)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Batch rỗng." });
        if (total > 100)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Tối đa 100 operations mỗi batch." });

        var batchId = Guid.NewGuid();
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var adminName = User.FindFirstValue(ClaimTypes.Name);
        var results = new List<BatchResultItem>();
        var childLogs = new List<SystemLog>();

        // Create parent/summary log entry first via raw SQL to get generated ID back
        int parentLogId;
        try
        {
            var parentDetails = $"approvals={dto.RoleApprovals.Count} rejections={dto.RoleRejections.Count} deletions={dto.PostDeletions.Count}";
            var parentIds = await _db.Database
                .SqlQuery<int>($"""
                    INSERT INTO "SystemLogs" ("Action", "CreatedAt", "Details", "UserId", "UserName", "BatchId")
                    VALUES ('BatchActions', {DateTime.UtcNow}, {parentDetails}, {adminId ?? ""}, {adminName ?? ""}, {batchId})
                    RETURNING "Id"
                    """)
                .ToListAsync();
            parentLogId = parentIds.FirstOrDefault();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Batch] Failed to create parent log entry");
            parentLogId = 0;
        }

        // Batch-load all users referenced by approvals and rejections in one query
        var approvalUserIds  = dto.RoleApprovals.Select(op => op.UserId).ToList();
        var rejectionUserIds = dto.RoleRejections.ToList();
        var allUserIds       = approvalUserIds.Concat(rejectionUserIds).Distinct().ToList();
        var users            = await _userManager.Users.Where(u => allUserIds.Contains(u.Id)).ToListAsync();
        var userMap          = users.ToDictionary(u => u.Id);

        // 1. Role approvals
        foreach (var op in dto.RoleApprovals)
        {
            try
            {
                if (!userMap.TryGetValue(op.UserId, out var user))
                {
                    results.Add(new BatchResultItem { OpType = "approveRole", Key = op.UserId, Success = false, Error = "User not found" });
                    CollectChildLog(childLogs, "approveRole", op.UserId, false, "User not found", batchId, parentLogId, adminId, adminName);
                    continue;
                }
                if (!Enum.TryParse<RoleEnum>(op.Role, true, out var newRole))
                {
                    results.Add(new BatchResultItem { OpType = "approveRole", Key = op.UserId, Success = false, Error = $"Invalid role: {op.Role}" });
                    CollectChildLog(childLogs, "approveRole", op.UserId, false, $"Invalid role: {op.Role}", batchId, parentLogId, adminId, adminName);
                    continue;
                }
                var oldRole = user.Role;
                user.Role = newRole;
                user.VerificationStatus = VerificationStatus.Approved;
                user.RequestedRole = null;
                user.VerificationReason = null;
                await _userManager.UpdateAsync(user);
                results.Add(new BatchResultItem { OpType = "approveRole", Key = op.UserId, Success = true });
                CollectChildLog(childLogs, "approveRole", op.UserId, true, $"{user.UserName}: {oldRole}→{newRole}", batchId, parentLogId, adminId, adminName);
                _logger.LogInformation("[Batch] ApproveRole: {Username} {Old}→{New}", user.UserName, oldRole, newRole);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Batch] ApproveRole failed for {UserId}", op.UserId);
                results.Add(new BatchResultItem { OpType = "approveRole", Key = op.UserId, Success = false, Error = ex.Message });
                CollectChildLog(childLogs, "approveRole", op.UserId, false, ex.Message, batchId, parentLogId, adminId, adminName);
            }
        }

        // 2. Role rejections
        foreach (var userId in dto.RoleRejections)
        {
            try
            {
                if (!userMap.TryGetValue(userId, out var user))
                {
                    results.Add(new BatchResultItem { OpType = "rejectVerification", Key = userId, Success = false, Error = "User not found" });
                    CollectChildLog(childLogs, "rejectVerification", userId, false, "User not found", batchId, parentLogId, adminId, adminName);
                    continue;
                }
                user.VerificationStatus = VerificationStatus.Rejected;
                await _userManager.UpdateAsync(user);
                results.Add(new BatchResultItem { OpType = "rejectVerification", Key = userId, Success = true });
                CollectChildLog(childLogs, "rejectVerification", userId, true, $"Rejected: {user.UserName}", batchId, parentLogId, adminId, adminName);
                _logger.LogInformation("[Batch] RejectVerification: {Username}", user.UserName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Batch] RejectVerification failed for {UserId}", userId);
                results.Add(new BatchResultItem { OpType = "rejectVerification", Key = userId, Success = false, Error = ex.Message });
                CollectChildLog(childLogs, "rejectVerification", userId, false, ex.Message, batchId, parentLogId, adminId, adminName);
            }
        }

        // 3. Post deletions via ExecuteDeleteAsync
        foreach (var postId in dto.PostDeletions)
        {
            try
            {
                var rowsAffected = await _db.Posts.Where(p => p.Id == postId).ExecuteDeleteAsync();
                if (rowsAffected == 0)
                {
                    results.Add(new BatchResultItem { OpType = "deletePost", Key = postId.ToString(), Success = false, Error = "Post not found" });
                    CollectChildLog(childLogs, "deletePost", postId.ToString(), false, "Post not found", batchId, parentLogId, adminId, adminName);
                }
                else
                {
                    results.Add(new BatchResultItem { OpType = "deletePost", Key = postId.ToString(), Success = true });
                    CollectChildLog(childLogs, "deletePost", postId.ToString(), true, $"Deleted post #{postId}", batchId, parentLogId, adminId, adminName);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Batch] DeletePost failed for {PostId}", postId);
                results.Add(new BatchResultItem { OpType = "deletePost", Key = postId.ToString(), Success = false, Error = ex.Message });
                CollectChildLog(childLogs, "deletePost", postId.ToString(), false, ex.Message, batchId, parentLogId, adminId, adminName);
            }
        }

        // Flush all child logs in a single SaveChangesAsync
        await FlushChildLogs(childLogs);

        // Update parent log with final summary
        var applied = results.Count(r => r.Success);
        var failed  = results.Count(r => !r.Success);
        if (parentLogId > 0)
        {
            try
            {
                var finalDetails = $"approvals={dto.RoleApprovals.Count} rejections={dto.RoleRejections.Count} deletions={dto.PostDeletions.Count} applied={applied} failed={failed}";
                await _db.Database.ExecuteSqlRawAsync(
                    @"UPDATE ""SystemLogs"" SET ""Details"" = {0} WHERE ""Id"" = {1}",
                    finalDetails, parentLogId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Batch] Failed to update parent log summary");
            }
        }

        // Invalidate caches
        _cache.Remove("admin:stats");
        _cache.Remove("admin:verifications");

        return Ok(new AdminBatchResultDto { Applied = applied, Failed = failed, Results = results });
    }

    // ═══════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═══════════════════════════════════════════

    private void CollectChildLog(
        ICollection<SystemLog> logs,
        string opType, string key, bool success, string? detail,
        Guid batchId, int parentLogId,
        string? adminId, string? adminName)
    {
        var details = $"[{opType}] key={key} success={success}" + (detail != null ? $" | {detail}" : "");
        logs.Add(new SystemLog
        {
            Action      = opType,
            Details     = details,
            UserId      = adminId,
            UserName    = adminName,
            CreatedAt   = DateTime.UtcNow,
            BatchId     = batchId,
            ParentLogId = parentLogId > 0 ? (int?)parentLogId : null
        });
    }

    private async Task FlushChildLogs(ICollection<SystemLog> logs)
    {
        if (logs.Count == 0) return;
        try
        {
            _db.SystemLogs.AddRange(logs);
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Batch] Failed to flush {Count} child log(s)", logs.Count);
        }
    }

    private async Task WriteChildLog(string opType, string key, bool success, string? detail, Guid batchId, int parentLogId)
    {
        try
        {
            var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var adminName = User.FindFirstValue(ClaimTypes.Name);
            var details = $"[{opType}] key={key} success={success}" + (detail != null ? $" | {detail}" : "");
            var parentIdParam = parentLogId > 0 ? (int?)parentLogId : null;

            _db.SystemLogs.Add(new SystemLog
            {
                Action = opType,
                Details = details,
                UserId = adminId,
                UserName = adminName,
                CreatedAt = DateTime.UtcNow,
                BatchId = batchId,
                ParentLogId = parentIdParam
            });
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Batch] Failed to write child log for {OpType}/{Key}", opType, key);
        }
    }
}
