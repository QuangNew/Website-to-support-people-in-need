using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Enums;
using ReliefConnect.Infrastructure.Data;
using ReliefConnect.API.Extensions;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Admin content moderation endpoints: posts, reports, comments.
/// All endpoints require the "RequireAdmin" policy.
/// </summary>
[ApiController]
[Route("api/admin/moderation")]
[Authorize(Policy = "RequireAdmin")]
public class AdminModerationController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<AdminModerationController> _logger;
    private readonly IMemoryCache _cache;

    public AdminModerationController(
        AppDbContext db,
        ILogger<AdminModerationController> logger,
        IMemoryCache cache)
    {
        _db = db;
        _logger = logger;
        _cache = cache;
    }

    // ═══════════════════════════════════════════
    //  POSTS — Paginated list for moderation
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get paginated post list for admin moderation with comment and reaction counts.
    /// </summary>
    [HttpGet("posts")]
    public async Task<ActionResult> GetPosts(
        [FromQuery] string? category,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (pageSize > 100) pageSize = 100;

        if (!string.IsNullOrWhiteSpace(category) && !Enum.TryParse<PostCategory>(category, true, out _))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Invalid category." });

        var query = _db.Posts.AsNoTracking().Where(p => !p.IsDeleted).AsQueryable();

        if (!string.IsNullOrWhiteSpace(category) && Enum.TryParse<PostCategory>(category, true, out var cat))
            query = query.Where(p => p.Category == cat);

        var total = await query.CountAsync();
        var posts = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new AdminPostDto
            {
                Id           = p.Id,
                Content      = p.Content.Length > 200 ? p.Content.Substring(0, 200) : p.Content,
                Category     = p.Category.ToString(),
                AuthorId     = p.AuthorId,
                AuthorName   = p.Author != null ? (p.Author.FullName ?? p.Author.UserName ?? "Ẩn danh") : "Ẩn danh",
                CreatedAt    = p.CreatedAt,
                IsPinned     = p.IsPinned,
                CommentCount  = p.Comments.Count,
                ReactionCount = p.Reactions.Count
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

    // ═══════════════════════════════════════════
    //  POSTS — Pin / Unpin
    // ═══════════════════════════════════════════

    /// <summary>
    /// Toggle the pinned status of a post.
    /// </summary>
    [HttpPost("posts/{postId}/pin")]
    public async Task<ActionResult> TogglePinPost(int postId)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId);
        if (post == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bài viết không tồn tại." });

        post.IsPinned = !post.IsPinned;
        await _db.SaveChangesAsync();

        var action = post.IsPinned ? "PostPinned" : "PostUnpinned";
        await this.LogAdminAction(_db, action, $"Post #{postId} IsPinned={post.IsPinned}");
        _logger.LogInformation("Admin {Action} post #{PostId}", action, postId);

        return Ok(new { message = post.IsPinned ? "Đã ghim bài viết." : "Đã bỏ ghim bài viết.", isPinned = post.IsPinned });
    }

    // ═══════════════════════════════════════════
    //  POSTS — Delete (soft-delete, restorable 7 days)
    // ═══════════════════════════════════════════

    /// <summary>
    /// Soft-delete a post (content moderation). Restorable within 7 days.
    /// </summary>
    [HttpDelete("posts/{postId}")]
    public async Task<ActionResult> DeletePost(int postId)
    {
        var post = await _db.Posts
            .Where(p => p.Id == postId && !p.IsDeleted)
            .Include(p => p.Author)
            .FirstOrDefaultAsync();

        if (post == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bài viết không tồn tại." });

        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var authorName = post.Author?.UserName ?? "unknown";

        post.IsDeleted = true;
        post.DeletedAt = DateTime.UtcNow;
        post.DeletedByAdminId = adminId;
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "PostDeleted", $"Soft-deleted post #{postId} by {authorName} (restorable 7 days)");
        _logger.LogInformation("Admin soft-deleted post #{PostId} by {Author}", postId, authorName);

        return Ok(new { message = "Đã xóa bài viết. Có thể khôi phục trong 7 ngày." });
    }

    // ═══════════════════════════════════════════
    //  POSTS — Restore
    // ═══════════════════════════════════════════

    /// <summary>
    /// Restore a soft-deleted post (within 7-day window).
    /// </summary>
    [HttpPost("posts/{postId}/restore")]
    public async Task<ActionResult> RestorePost(int postId)
    {
        var post = await _db.Posts
            .Where(p => p.Id == postId && p.IsDeleted)
            .FirstOrDefaultAsync();

        if (post == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bài viết đã xóa không tồn tại." });

        if (post.DeletedAt.HasValue && post.DeletedAt.Value < DateTime.UtcNow.AddDays(-7))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Đã quá hạn khôi phục (7 ngày)." });

        post.IsDeleted = false;
        post.DeletedAt = null;
        post.DeletedByAdminId = null;
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "PostRestored", $"Restored post #{postId}");
        _logger.LogInformation("Admin restored post #{PostId}", postId);

        return Ok(new { message = "Đã khôi phục bài viết." });
    }

    /// <summary>
    /// Get list of soft-deleted posts that can be restored (within 7-day window).
    /// </summary>
    [HttpGet("posts/deleted")]
    public async Task<ActionResult> GetDeletedPosts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (pageSize > 100) pageSize = 100;
        var cutoff = DateTime.UtcNow.AddDays(-7);
        var now = DateTime.UtcNow;

        var query = _db.Posts
            .AsNoTracking()
            .Where(p => p.IsDeleted && p.DeletedAt != null && p.DeletedAt > cutoff);

        var total = await query.CountAsync();

        // Fetch posts first (without the N+1 admin subquery)
        var rawPosts = await query
            .OrderByDescending(p => p.DeletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Content,
                Category = p.Category.ToString(),
                p.AuthorId,
                AuthorName = p.Author != null ? (p.Author.FullName ?? p.Author.UserName ?? "Ẩn danh") : "Ẩn danh",
                p.CreatedAt,
                p.DeletedAt,
                p.DeletedByAdminId
            })
            .ToListAsync();

        // Pre-fetch admin names in a single query (eliminates N+1)
        var adminIds = rawPosts
            .Where(p => p.DeletedByAdminId != null)
            .Select(p => p.DeletedByAdminId!)
            .Distinct()
            .ToList();

        var adminNames = adminIds.Count > 0
            ? await _db.Users
                .AsNoTracking()
                .Where(u => adminIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName ?? u.UserName ?? "Admin")
            : new Dictionary<string, string>();

        var posts = rawPosts.Select(p => new DeletedPostDto
        {
            Id           = p.Id,
            Content      = p.Content.Length > 200 ? p.Content.Substring(0, 200) : p.Content,
            Category     = p.Category,
            AuthorId     = p.AuthorId,
            AuthorName   = p.AuthorName,
            CreatedAt    = p.CreatedAt,
            DeletedAt    = p.DeletedAt,
            DeletedByAdminName = p.DeletedByAdminId != null
                ? adminNames.GetValueOrDefault(p.DeletedByAdminId, "Admin")
                : null,
            DaysRemaining = p.DeletedAt.HasValue ? Math.Max(0, 7 - (int)(now - p.DeletedAt.Value).TotalDays) : 0
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
    //  COMMENTS — Hide (soft-delete, visible 30 days for admin)
    // ═══════════════════════════════════════════

    /// <summary>
    /// Hide a specific comment from a post (soft-delete). Hidden for 30 days before permanent deletion.
    /// </summary>
    [HttpDelete("posts/{postId}/comments/{commentId}")]
    public async Task<ActionResult> DeleteComment(int postId, int commentId)
    {
        var comment = await _db.Comments
            .Where(c => c.Id == commentId && c.PostId == postId && !c.IsHidden)
            .Include(c => c.User)
            .FirstOrDefaultAsync();

        if (comment == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bình luận không tồn tại." });

        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userName = comment.User?.UserName ?? "unknown";

        comment.IsHidden = true;
        comment.HiddenAt = DateTime.UtcNow;
        comment.HiddenByAdminId = adminId;
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "CommentHidden", $"Hidden comment #{commentId} on post #{postId} by {userName} (auto-delete in 30 days)");
        _logger.LogInformation("Admin hidden comment #{CommentId} on post #{PostId}", commentId, postId);

        return Ok(new { message = "Đã ẩn bình luận. Sẽ tự động xóa sau 30 ngày." });
    }

    /// <summary>
    /// Restore a hidden comment.
    /// </summary>
    [HttpPost("posts/{postId}/comments/{commentId}/restore")]
    public async Task<ActionResult> RestoreComment(int postId, int commentId)
    {
        var comment = await _db.Comments
            .Where(c => c.Id == commentId && c.PostId == postId && c.IsHidden)
            .FirstOrDefaultAsync();

        if (comment == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bình luận ẩn không tồn tại." });

        comment.IsHidden = false;
        comment.HiddenAt = null;
        comment.HiddenByAdminId = null;
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "CommentRestored", $"Restored comment #{commentId} on post #{postId}");
        _logger.LogInformation("Admin restored comment #{CommentId} on post #{PostId}", commentId, postId);

        return Ok(new { message = "Đã khôi phục bình luận." });
    }

    /// <summary>
    /// Get list of hidden comments for admin review.
    /// </summary>
    [HttpGet("comments/hidden")]
    public async Task<ActionResult> GetHiddenComments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (pageSize > 100) pageSize = 100;
        var now = DateTime.UtcNow;

        var query = _db.Comments
            .AsNoTracking()
            .Where(c => c.IsHidden);

        var total = await query.CountAsync();
        var comments = await query
            .OrderByDescending(c => c.HiddenAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new HiddenCommentDto
            {
                Id        = c.Id,
                Content   = c.Content,
                PostId    = c.PostId,
                UserId    = c.UserId,
                UserName  = c.User != null ? (c.User.FullName ?? c.User.UserName ?? "Ẩn danh") : "Ẩn danh",
                CreatedAt = c.CreatedAt,
                HiddenAt  = c.HiddenAt,
                HiddenByAdminName = c.HiddenByAdminId != null
                    ? _db.Users.Where(u => u.Id == c.HiddenByAdminId).Select(u => u.FullName ?? u.UserName).FirstOrDefault() ?? "Admin"
                    : null,
                DaysRemaining = c.HiddenAt.HasValue ? Math.Max(0, 30 - (int)(now - c.HiddenAt.Value).TotalDays) : 30
            })
            .ToListAsync();

        return Ok(new
        {
            items = comments,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    // ═══════════════════════════════════════════
    //  REPORTS — Paginated list
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get paginated reports with post content preview and reporter info.
    /// </summary>
    [HttpGet("reports")]
    public async Task<ActionResult> GetReports(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (pageSize > 100) pageSize = 100;

        // Default filter to Pending reports
        var statusFilter = ReportStatus.Pending;
        if (!string.IsNullOrWhiteSpace(status))
            Enum.TryParse<ReportStatus>(status, true, out statusFilter);

        var query = _db.Reports
            .AsNoTracking()
            .Where(r => r.Status == statusFilter);

        var total = await query.CountAsync();
        var reports = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ReportDto
            {
                Id                  = r.Id,
                PostId              = r.PostId,
                PostContentPreview  = r.Post != null
                    ? (r.Post.Content.Length > 100 ? r.Post.Content.Substring(0, 100) : r.Post.Content)
                    : string.Empty,
                ReporterId   = r.ReporterId,
                ReporterName = r.Reporter != null ? (r.Reporter.FullName ?? r.Reporter.UserName ?? "Ẩn danh") : "Ẩn danh",
                Reason       = r.Reason,
                Status       = r.Status.ToString(),
                CreatedAt    = r.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items = reports,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    // ═══════════════════════════════════════════
    //  REPORTS — Review / Dismiss
    // ═══════════════════════════════════════════

    /// <summary>
    /// Mark a report as reviewed.
    /// </summary>
    [HttpPost("reports/{reportId}/review")]
    public async Task<ActionResult> ReviewReport(int reportId)
    {
        var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == reportId);
        if (report == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Báo cáo không tồn tại." });

        report.Status = ReportStatus.Reviewed;
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "ReportReviewed", $"Reviewed report #{reportId} for post #{report.PostId}");
        _logger.LogInformation("Admin reviewed report #{ReportId}", reportId);

        return Ok(new { message = "Đã đánh dấu báo cáo là đã xem xét." });
    }

    /// <summary>
    /// Dismiss a report.
    /// </summary>
    [HttpPost("reports/{reportId}/dismiss")]
    public async Task<ActionResult> DismissReport(int reportId)
    {
        var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == reportId);
        if (report == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Báo cáo không tồn tại." });

        report.Status = ReportStatus.Dismissed;
        await _db.SaveChangesAsync();

        await this.LogAdminAction(_db, "ReportDismissed", $"Dismissed report #{reportId} for post #{report.PostId}");
        _logger.LogInformation("Admin dismissed report #{ReportId}", reportId);

        return Ok(new { message = "Đã bác bỏ báo cáo." });
    }
}
