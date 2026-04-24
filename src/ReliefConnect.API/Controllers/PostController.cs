using System.Security.Claims;
using Ganss.Xss;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/social")]
public class PostController : ControllerBase
{
    private readonly IPostRepository _postRepo;
    private readonly AppDbContext _db;
    private readonly HtmlSanitizer _sanitizer;
    private readonly ILogger<PostController> _logger;
    private readonly IContentModerationService _moderation;
    private readonly INotificationService _notifications;
    private readonly ISpamGuardService _spamGuard;

    public PostController(IPostRepository postRepo, AppDbContext db, HtmlSanitizer sanitizer, ILogger<PostController> logger, IContentModerationService moderation, INotificationService notifications, ISpamGuardService spamGuard)
    {
        _postRepo = postRepo;
        _db = db;
        _sanitizer = sanitizer;
        _logger = logger;
        _moderation = moderation;
        _notifications = notifications;
        _spamGuard = spamGuard;
    }

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    // GET /api/social/posts?cursor=&limit=10&category=&role=&sort=
    [HttpGet("posts")]
    public async Task<IActionResult> GetPosts(
        [FromQuery] string? cursor,
        [FromQuery] int limit = 10,
        [FromQuery] string? category = null,
        [FromQuery] string? role = null,
        [FromQuery] string? sort = null)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        PostCategory? cat = !string.IsNullOrEmpty(category) && Enum.TryParse<PostCategory>(category, true, out var parsed)
            ? parsed
            : null;

        RoleEnum? roleFilter = !string.IsNullOrEmpty(role) && Enum.TryParse<RoleEnum>(role, true, out var parsedRole)
            ? parsedRole
            : null;

        var userId = GetUserId();
        var (posts, nextCursor) = await _postRepo.GetPostsWithCountsAsync(cursor, limit, category: cat, roleFilter: roleFilter, sort: sort);
        var items = posts.Select(p => MapWithCountsToDto(p, userId));

        return Ok(new PaginatedResponse<PostResponseDto>
        {
            Items = items,
            NextCursor = nextCursor
        });
    }

    // GET /api/social/posts/{id}
    [HttpGet("posts/{id}")]
    public async Task<IActionResult> GetPost(int id)
    {
        var post = await _postRepo.GetPostWithDetailsAsync(id);
        if (post == null) return NotFound();

        var userId = GetUserId();
        return Ok(MapToDto(post, userId));
    }

    // POST /api/social/upload-image
    [Authorize]
    [HttpPost("upload-image")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded" });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };

        if (!allowedTypes.Contains(file.ContentType))
            return BadRequest(new { message = "Only JPG, PNG, WEBP allowed" });

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension))
            return BadRequest(new { message = "Invalid file extension" });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "File too large (max 5MB)" });

        _logger.LogWarning("Local file upload used — files stored in wwwroot/uploads are ephemeral on Azure. Configure Supabase Storage for production.");

        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(uploadsDir, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var imageUrl = $"/uploads/{fileName}";
        return Ok(new { imageUrl });
    }

    // POST /api/social/posts
    [Authorize]
    [HttpPost("posts")]
    public async Task<IActionResult> CreatePost([FromBody] CreatePostDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        // ── Spam Guard ──
        var spamCheck = await _spamGuard.CheckPostAsync(userId);
        if (spamCheck.Verdict == SpamVerdict.Suspend)
        {
            await _spamGuard.SuspendForSpamAsync(userId, "Đăng bài quá nhiều (>5 bài/giờ)");
            return StatusCode(429, new { message = "Tài khoản của bạn đã bị tạm khóa do đăng bài quá nhiều.", suspended = true });
        }

        if (!Enum.TryParse<PostCategory>(dto.Category, true, out var category))
            return BadRequest(new { message = "Danh mục không hợp lệ. Chọn: Livelihood, Medical, Education" });

        int? tagId = category switch
        {
            PostCategory.Livelihood => 1,
            PostCategory.Medical => 2,
            PostCategory.Education => 3,
            _ => null
        };

        var post = new Post
        {
            Content = _sanitizer.Sanitize(dto.Content),
            Category = category,
            CategoryId = tagId,
            ImageUrl = dto.ImageUrl,
            AuthorId = userId,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _postRepo.AddAsync(post);
        var full = await _postRepo.GetPostWithDetailsAsync(created.Id);
        var response = MapToDto(full!, userId);

        // Attach spam warning if approaching limit
        if (spamCheck.Verdict == SpamVerdict.Warning)
            return CreatedAtAction(nameof(GetPost), new { id = created.Id }, new { post = response, spamWarning = spamCheck.WarningMessage });

        return CreatedAtAction(nameof(GetPost), new { id = created.Id }, response);
    }

    [Authorize]
    [HttpPost("posts/{postId}/reports")]
    public async Task<IActionResult> ReportPost(int postId, [FromBody] ReportPostDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var reason = dto.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            return BadRequest(new { message = "Vui lòng nhập lý do báo cáo." });

        var post = await _db.Posts
            .AsNoTracking()
            .Where(p => p.Id == postId && !p.IsDeleted)
            .Select(p => new { p.AuthorId })
            .FirstOrDefaultAsync();

        if (post == null)
            return NotFound(new { message = "Bài viết không tồn tại." });

        if (post.AuthorId == userId)
            return BadRequest(new { message = "Bạn không thể báo cáo bài viết của chính mình." });

        var hasPendingReport = await _db.Reports
            .AsNoTracking()
            .AnyAsync(r => r.PostId == postId && r.ReporterId == userId && r.Status == ReportStatus.Pending);

        if (hasPendingReport)
            return Conflict(new { message = "Bạn đã báo cáo bài viết này và đang chờ xử lý." });

        _db.Reports.Add(new Report
        {
            PostId = postId,
            ReporterId = userId,
            Reason = reason,
            Status = ReportStatus.Pending,
            CreatedAt = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync();

        try
        {
            await _notifications.SendToRoleAsync((int)RoleEnum.Admin, $"Có báo cáo mới cho bài viết #{postId}.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send admin report notification for post {PostId}", postId);
        }

        return Ok(new { message = "Đã gửi báo cáo để quản trị viên xem xét." });
    }

    // POST /api/social/posts/{postId}/reactions
    [Authorize]
    [HttpPost("posts/{postId}/reactions")]
    public async Task<IActionResult> AddReaction(int postId, [FromBody] AddReactionDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        // Lightweight existence check — no full entity load
        var postExists = await _db.Posts.AnyAsync(p => p.Id == postId);
        if (!postExists) return NotFound();

        if (!Enum.TryParse<ReactionType>(dto.Type, true, out var reactionType))
            return BadRequest(new { message = "Loại reaction không hợp lệ. Chọn: Like, Love, Pray" });

        bool wasToggledOff = false;

        // Retry once on duplicate-key race condition (double-click)
        for (int attempt = 0; attempt < 2; attempt++)
        {
            var existing = await _db.Reactions
                .AsTracking()
                .FirstOrDefaultAsync(r => r.PostId == postId && r.UserId == userId);

            if (existing != null)
            {
                if (existing.Type == reactionType)
                {
                    _db.Reactions.Remove(existing);
                    wasToggledOff = true;
                }
                else
                {
                    existing.Type = reactionType;
                }
            }
            else
            {
                _db.Reactions.Add(new Reaction
                {
                    PostId = postId,
                    UserId = userId,
                    Type = reactionType,
                    CreatedAt = DateTime.UtcNow
                });
            }

            try
            {
                await _db.SaveChangesAsync();
                break; // success
            }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pg && pg.SqlState == "23505")
            {
                if (attempt == 1) throw; // second attempt failed, give up
                // Detach tracked entries so the retry starts clean
                foreach (var entry in _db.ChangeTracker.Entries().ToList())
                    entry.State = Microsoft.EntityFrameworkCore.EntityState.Detached;
            }
        }

        // Single aggregation query for all counts
        var reactionData = await _db.Reactions
            .AsNoTracking()
            .Where(r => r.PostId == postId)
            .GroupBy(r => r.Type)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync();

        var userReaction = wasToggledOff ? (ReactionType?)null : reactionType;

        return Ok(new
        {
            likeCount = reactionData.FirstOrDefault(c => c.Type == ReactionType.Like)?.Count ?? 0,
            loveCount = reactionData.FirstOrDefault(c => c.Type == ReactionType.Love)?.Count ?? 0,
            prayCount = reactionData.FirstOrDefault(c => c.Type == ReactionType.Pray)?.Count ?? 0,
            userReaction = userReaction?.ToString()
        });
    }

    // GET /api/social/posts/{postId}/comments?cursor=&limit=10
    [HttpGet("posts/{postId}/comments")]
    public async Task<IActionResult> GetComments(int postId, [FromQuery] string? cursor, [FromQuery] int limit = 20)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        var query = _db.Comments
            .AsNoTracking()
            .Include(c => c.User)
            .Where(c => c.PostId == postId && !c.IsHidden)
            .OrderByDescending(c => c.CreatedAt)
            .AsQueryable();

        if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var cursorId))
        {
            query = query.Where(c => c.Id < cursorId);
        }

        var comments = await query.Take(limit + 1).ToListAsync();
        string? nextCursor = null;
        if (comments.Count > limit)
        {
            nextCursor = comments[limit].Id.ToString();
            comments = comments.Take(limit).ToList();
        }

        var items = comments.Select(c => new CommentResponseDto
        {
            Id = c.Id,
            Content = c.Content,
            CreatedAt = c.CreatedAt,
            UserId = c.UserId,
            UserName = c.User?.FullName ?? c.User?.UserName ?? "Ẩn danh",
            UserAvatar = c.User?.AvatarUrl
        });

        return Ok(new PaginatedResponse<CommentResponseDto>
        {
            Items = items,
            NextCursor = nextCursor
        });
    }

    // POST /api/social/posts/{postId}/comments
    [Authorize]
    [HttpPost("posts/{postId}/comments")]
    public async Task<IActionResult> AddComment(int postId, [FromBody] CreateCommentDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        // Check if user is banned
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return Unauthorized();
        if (user.IsSuspended)
            return StatusCode(403, new { message = "Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng." });

        // ── Spam Guard ──
        var spamCheck = await _spamGuard.CheckCommentAsync(userId);
        if (spamCheck.Verdict == SpamVerdict.Suspend)
        {
            await _spamGuard.SuspendForSpamAsync(userId, "Bình luận quá nhiều (>10 comment/phút)");
            return StatusCode(429, new { message = "Tài khoản của bạn đã bị tạm khóa do bình luận quá nhiều.", suspended = true });
        }

        var postExists = await _db.Posts.AnyAsync(p => p.Id == postId);
        if (!postExists) return NotFound();

        var sanitizedContent = _sanitizer.Sanitize(dto.Content);

        // ── Content Moderation Check ──
        var violationReason = _moderation.CheckContent(dto.Content);
        if (violationReason != null)
        {
            // Record violation
            user.ViolationCount++;
            var violation = new ContentViolation
            {
                UserId = userId,
                Content = dto.Content,
                Reason = violationReason,
                StrikeNumber = user.ViolationCount,
                IsAutoDetected = true,
                CreatedAt = DateTime.UtcNow
            };

            // Create warning notification
            string warningMessage;
            if (user.ViolationCount >= 3)
            {
                // 3rd strike → permanent ban
                user.IsSuspended = true;
                user.SuspendedUntil = null; // permanent
                user.BanReason = $"Vi phạm tiêu chuẩn cộng đồng lần thứ 3 (tự động). Lý do: {violationReason}";
                warningMessage = $"⛔ Tài khoản của bạn đã bị KHÓA VĨNH VIỄN do vi phạm tiêu chuẩn cộng đồng lần thứ 3. Lý do: {violationReason}";
                _logger.LogWarning("User {UserId} permanently banned: 3rd content violation ({Reason})", userId, violationReason);
            }
            else
            {
                warningMessage = $"⚠️ Cảnh cáo lần {user.ViolationCount}/3: Bình luận của bạn vi phạm tiêu chuẩn cộng đồng ({violationReason}). Vi phạm thêm {3 - user.ViolationCount} lần nữa sẽ bị khóa tài khoản.";
                _logger.LogInformation("Content violation #{Count} for user {UserId}: {Reason}", user.ViolationCount, userId, violationReason);
            }

            // Persist state changes in smaller steps to avoid Supabase pooler issues
            // with batched INSERT ... RETURNING commands.
            await _db.SaveChangesAsync();

            _db.ContentViolations.Add(violation);
            await _db.SaveChangesAsync();

            await _notifications.SendAsync(userId, warningMessage);

            return StatusCode(422, new
            {
                message = warningMessage,
                violationCount = user.ViolationCount,
                isBanned = user.IsSuspended
            });
        }

        var comment = new Comment
        {
            Content = sanitizedContent,
            PostId = postId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Comments.Add(comment);
        await _db.SaveChangesAsync();

        var commentDto = new CommentResponseDto
        {
            Id = comment.Id,
            Content = comment.Content,
            CreatedAt = comment.CreatedAt,
            UserId = userId,
            UserName = user.FullName ?? user.UserName ?? "Ẩn danh",
            UserAvatar = user.AvatarUrl
        };

        // Attach spam warning if approaching limit
        if (spamCheck.Verdict == SpamVerdict.Warning)
            return CreatedAtAction(nameof(GetComments), new { postId }, new { comment = commentDto, spamWarning = spamCheck.WarningMessage });

        return CreatedAtAction(nameof(GetComments), new { postId }, commentDto);
    }

    // GET /api/social/users/{userId}/wall?cursor=&limit=10
    [HttpGet("users/{userId}/wall")]
    public async Task<IActionResult> GetUserWall(string userId, [FromQuery] string? cursor, [FromQuery] int limit = 10)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        var currentUserId = GetUserId();
        var (posts, nextCursor) = await _postRepo.GetPostsWithCountsAsync(cursor, limit, userId: userId);
        var items = posts.Select(p => MapWithCountsToDto(p, currentUserId));

        return Ok(new PaginatedResponse<PostResponseDto>
        {
            Items = items,
            NextCursor = nextCursor
        });
    }

    // DELETE /api/social/posts/{id}
    [Authorize]
    [HttpDelete("posts/{id}")]
    public async Task<IActionResult> DeletePost(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var post = await _db.Posts
            .AsTracking()
            .Where(p => p.Id == id && !p.IsDeleted)
            .FirstOrDefaultAsync();

        if (post == null) return NotFound();

        if (post.AuthorId != userId)
        {
            var userRole = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => u.Role)
                .FirstOrDefaultAsync();
            if (userRole != RoleEnum.Admin)
                return Forbid();
        }

        // Soft-delete: mark as deleted instead of removing
        post.IsDeleted = true;
        post.DeletedAt = DateTime.UtcNow;
        post.DeletedByAdminId = post.AuthorId != userId ? userId : null;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Maps a <see cref="PostWithCounts"/> (from <see cref="IPostRepository.GetPostsWithCountsAsync"/>) to the
    /// response DTO using pre-computed counts — no in-memory collection iteration required.
    /// Used by list endpoints (GetPosts, GetUserWall).
    /// </summary>
    private static PostResponseDto MapWithCountsToDto(PostWithCounts pwc, string? currentUserId = null) => new()
    {
        Id           = pwc.Post.Id,
        Content      = pwc.Post.Content,
        ImageUrl     = pwc.Post.ImageUrl,
        Category     = pwc.Post.Category.ToString(),
        CreatedAt    = pwc.Post.CreatedAt,
        AuthorId     = pwc.Post.AuthorId,
        AuthorName   = pwc.Post.Author?.FullName ?? pwc.Post.Author?.UserName ?? "Ẩn danh",
        AuthorAvatar = pwc.Post.Author?.AvatarUrl,
        AuthorRole   = pwc.Post.Author?.Role.ToString() ?? "Guest",
        LikeCount    = pwc.LikeCount,
        LoveCount    = pwc.LoveCount,
        PrayCount    = pwc.PrayCount,
        CommentCount = pwc.CommentCount,
        UserReaction = pwc.UserReaction?.ToString()
    };

    /// <summary>
    /// Maps a fully-loaded <see cref="Post"/> entity (with Reactions/Comments Included) to the response DTO.
    /// Used by single-post operations: GetPost, CreatePost.
    /// </summary>
    private static PostResponseDto MapToDto(Post p, string? currentUserId)
    {
        return new PostResponseDto
        {
            Id = p.Id,
            Content = p.Content,
            ImageUrl = p.ImageUrl,
            Category = p.Category.ToString(),
            CreatedAt = p.CreatedAt,
            AuthorId = p.AuthorId,
            AuthorName = p.Author?.FullName ?? p.Author?.UserName ?? "Ẩn danh",
            AuthorAvatar = p.Author?.AvatarUrl,
            AuthorRole = p.Author?.Role.ToString() ?? "Guest",
            LikeCount = p.Reactions?.Count(r => r.Type == ReactionType.Like) ?? 0,
            LoveCount = p.Reactions?.Count(r => r.Type == ReactionType.Love) ?? 0,
            PrayCount = p.Reactions?.Count(r => r.Type == ReactionType.Pray) ?? 0,
            CommentCount = p.Comments?.Count ?? 0,
            UserReaction = currentUserId != null
                ? p.Reactions?.FirstOrDefault(r => r.UserId == currentUserId)?.Type.ToString()
                : null
        };
    }
}
