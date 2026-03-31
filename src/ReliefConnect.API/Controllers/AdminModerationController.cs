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

        var query = _db.Posts.AsNoTracking().AsQueryable();

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
    //  POSTS — Delete
    // ═══════════════════════════════════════════

    /// <summary>
    /// Delete a post (content moderation).
    /// </summary>
    [HttpDelete("posts/{postId}")]
    public async Task<ActionResult> DeletePost(int postId)
    {
        var postInfo = await _db.Posts
            .AsNoTracking()
            .Where(p => p.Id == postId)
            .Select(p => new { AuthorName = p.Author != null ? p.Author.UserName : "unknown" })
            .FirstOrDefaultAsync();

        if (postInfo == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bài viết không tồn tại." });

        await _db.Posts.Where(p => p.Id == postId).ExecuteDeleteAsync();

        await this.LogAdminAction(_db, "PostDeleted", $"Deleted post #{postId} by {postInfo.AuthorName}");
        _logger.LogInformation("Admin deleted post #{PostId} by {Author}", postId, postInfo.AuthorName);

        return Ok(new { message = "Đã xóa bài viết." });
    }

    // ═══════════════════════════════════════════
    //  COMMENTS — Delete
    // ═══════════════════════════════════════════

    /// <summary>
    /// Delete a specific comment from a post.
    /// </summary>
    [HttpDelete("posts/{postId}/comments/{commentId}")]
    public async Task<ActionResult> DeleteComment(int postId, int commentId)
    {
        var commentInfo = await _db.Comments
            .AsNoTracking()
            .Where(c => c.Id == commentId && c.PostId == postId)
            .Select(c => new { c.Id, UserName = c.User != null ? c.User.UserName : "unknown" })
            .FirstOrDefaultAsync();

        if (commentInfo == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Bình luận không tồn tại." });

        await _db.Comments.Where(c => c.Id == commentId).ExecuteDeleteAsync();

        await this.LogAdminAction(_db, "CommentDeleted", $"Deleted comment #{commentId} on post #{postId} by {commentInfo.UserName}");
        _logger.LogInformation("Admin deleted comment #{CommentId} on post #{PostId}", commentId, postId);

        return Ok(new { message = "Đã xóa bình luận." });
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
