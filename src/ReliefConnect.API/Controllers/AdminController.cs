using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
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

    public AdminController(
        UserManager<ApplicationUser> userManager,
        AppDbContext db,
        ILogger<AdminController> logger)
    {
        _userManager = userManager;
        _db = db;
        _logger = logger;
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
        var query = _userManager.Users.AsQueryable();

        // Search by name, email, or username
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(u =>
                u.FullName.ToLower().Contains(s) ||
                u.Email!.ToLower().Contains(s) ||
                u.UserName!.ToLower().Contains(s));
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

        // Audit log
        await LogAction("RoleApproved", $"User {user.UserName}: {oldRole} → {newRole}");

        _logger.LogInformation("Admin approved role: {Username} → {Role}", user.UserName, newRole);

        return Ok(new { message = $"Đã cập nhật vai trò {user.UserName} thành {newRole}." });
    }

    // ═══════════════════════════════════════════
    //  VERIFICATION QUEUE
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get all pending verification requests.
    /// </summary>
    [HttpGet("verifications")]
    public async Task<ActionResult> GetPendingVerifications()
    {
        var pending = await _userManager.Users
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
        var post = await _db.Posts
            .Include(p => p.Author)
            .FirstOrDefaultAsync(p => p.Id == postId);

        if (post == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bài viết không tồn tại." });

        var authorName = post.Author?.UserName ?? "unknown";
        _db.Posts.Remove(post);
        await _db.SaveChangesAsync();

        await LogAction("PostDeleted", $"Deleted post #{postId} by {authorName}");
        _logger.LogInformation("Admin deleted post #{PostId} by {Author}", postId, authorName);

        return Ok(new { message = "Đã xóa bài viết." });
    }

    // ═══════════════════════════════════════════
    //  SYSTEM STATS
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get system-wide statistics for the admin dashboard.
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<SystemStatsDto>> GetStats()
    {
        var users = _userManager.Users;

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
        var query = _db.SystemLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(l => l.Action.Contains(action));

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

        return Ok(new { items = logs, total, page, pageSize });
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
