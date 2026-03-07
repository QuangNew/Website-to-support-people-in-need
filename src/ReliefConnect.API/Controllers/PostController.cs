using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    public PostController(IPostRepository postRepo, AppDbContext db)
    {
        _postRepo = postRepo;
        _db = db;
    }

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    // GET /api/social/posts?cursor=&limit=10&category=
    [HttpGet("posts")]
    public async Task<IActionResult> GetPosts([FromQuery] string? cursor, [FromQuery] int limit = 10, [FromQuery] string? category = null)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        (IEnumerable<Post> posts, string? nextCursor) result;

        if (!string.IsNullOrEmpty(category) && Enum.TryParse<PostCategory>(category, true, out var cat))
            result = await _postRepo.GetPostsByCategoryAsync(cat, cursor, limit);
        else
            result = await _postRepo.GetPostsAsync(cursor, limit);

        var userId = GetUserId();
        var items = result.posts.Select(p => MapToDto(p, userId));

        return Ok(new PaginatedResponse<PostResponseDto>
        {
            Items = items,
            NextCursor = result.nextCursor
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

    // POST /api/social/posts
    [Authorize]
    [HttpPost("posts")]
    public async Task<IActionResult> CreatePost([FromBody] CreatePostDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

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
            Content = dto.Content,
            Category = category,
            CategoryId = tagId,
            ImageUrl = dto.ImageUrl,
            AuthorId = userId,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _postRepo.AddAsync(post);
        var full = await _postRepo.GetPostWithDetailsAsync(created.Id);
        return CreatedAtAction(nameof(GetPost), new { id = created.Id }, MapToDto(full!, userId));
    }

    // POST /api/social/posts/{postId}/reactions
    [Authorize]
    [HttpPost("posts/{postId}/reactions")]
    public async Task<IActionResult> AddReaction(int postId, [FromBody] AddReactionDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var post = await _db.Posts.FindAsync(postId);
        if (post == null) return NotFound();

        if (!Enum.TryParse<ReactionType>(dto.Type, true, out var reactionType))
            return BadRequest(new { message = "Loại reaction không hợp lệ. Chọn: Like, Love, Pray" });

        var existing = await _db.Reactions
            .FirstOrDefaultAsync(r => r.PostId == postId && r.UserId == userId);

        if (existing != null)
        {
            if (existing.Type == reactionType)
            {
                // Toggle off — remove reaction
                _db.Reactions.Remove(existing);
            }
            else
            {
                // Change reaction type
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

        await _db.SaveChangesAsync();

        // Return updated counts
        var reactions = await _db.Reactions.Where(r => r.PostId == postId).ToListAsync();
        return Ok(new
        {
            likeCount = reactions.Count(r => r.Type == ReactionType.Like),
            loveCount = reactions.Count(r => r.Type == ReactionType.Love),
            prayCount = reactions.Count(r => r.Type == ReactionType.Pray),
            userReaction = reactions.FirstOrDefault(r => r.UserId == userId)?.Type.ToString()
        });
    }

    // GET /api/social/posts/{postId}/comments?cursor=&limit=10
    [HttpGet("posts/{postId}/comments")]
    public async Task<IActionResult> GetComments(int postId, [FromQuery] string? cursor, [FromQuery] int limit = 20)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        var query = _db.Comments
            .Include(c => c.User)
            .Where(c => c.PostId == postId)
            .OrderByDescending(c => c.CreatedAt)
            .AsQueryable();

        if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var cursorId))
        {
            var cursorComment = await _db.Comments.FindAsync(cursorId);
            if (cursorComment != null)
                query = query.Where(c => c.CreatedAt < cursorComment.CreatedAt || (c.CreatedAt == cursorComment.CreatedAt && c.Id < cursorId));
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

        var post = await _db.Posts.FindAsync(postId);
        if (post == null) return NotFound();

        var comment = new Comment
        {
            Content = dto.Content,
            PostId = postId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Comments.Add(comment);
        await _db.SaveChangesAsync();

        var user = await _db.Users.FindAsync(userId);
        return CreatedAtAction(nameof(GetComments), new { postId }, new CommentResponseDto
        {
            Id = comment.Id,
            Content = comment.Content,
            CreatedAt = comment.CreatedAt,
            UserId = userId,
            UserName = user?.FullName ?? user?.UserName ?? "Ẩn danh",
            UserAvatar = user?.AvatarUrl
        });
    }

    // GET /api/social/users/{userId}/wall?cursor=&limit=10
    [HttpGet("users/{userId}/wall")]
    public async Task<IActionResult> GetUserWall(string userId, [FromQuery] string? cursor, [FromQuery] int limit = 10)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        var (posts, nextCursor) = await _postRepo.GetPostsByUserAsync(userId, cursor, limit);
        var currentUserId = GetUserId();
        var items = posts.Select(p => MapToDto(p, currentUserId));

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

        var post = await _db.Posts.FindAsync(id);
        if (post == null) return NotFound();

        // Only author or admin can delete
        if (post.AuthorId != userId)
        {
            var user = await _db.Users.FindAsync(userId);
            if (user?.Role != RoleEnum.Admin)
                return Forbid();
        }

        _db.Posts.Remove(post);
        await _db.SaveChangesAsync();
        return NoContent();
    }

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
