using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.Infrastructure.Repositories;

public class PostRepository : IPostRepository
{
    private readonly AppDbContext _context;

    public PostRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Post?> GetByIdAsync(int id)
    {
        return await _context.Posts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<IEnumerable<Post>> GetAllAsync(int? limit = null)
    {
        var query = _context.Posts
            .AsNoTracking()
            .Include(p => p.Author)
            .OrderByDescending(p => p.CreatedAt);

        if (limit.HasValue)
            return await query.Take(limit.Value).ToListAsync();

        return await query.ToListAsync();
    }

    public async Task<Post> AddAsync(Post entity)
    {
        _context.Posts.Add(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    public async Task UpdateAsync(Post entity)
    {
        _context.Posts.Update(entity);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        await _context.Posts.Where(p => p.Id == id).ExecuteDeleteAsync();
    }

    public async Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsAsync(string? cursor, int limit = 10)
    {
        var query = _context.Posts
            .AsNoTracking()
            .Include(p => p.Author)
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .AsQueryable();

        if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var cursorId))
        {
            var cursorPost = await _context.Posts.AsNoTracking()
                .Where(p => p.Id == cursorId)
                .Select(p => new { p.Id, p.CreatedAt })
                .FirstOrDefaultAsync();

            if (cursorPost != null)
                query = query.Where(p => p.CreatedAt < cursorPost.CreatedAt ||
                                        (p.CreatedAt == cursorPost.CreatedAt && p.Id < cursorId));
        }

        var posts = await query.Take(limit + 1).ToListAsync();
        string? nextCursor = null;
        if (posts.Count > limit)
        {
            nextCursor = posts[limit].Id.ToString();
            posts = posts.Take(limit).ToList();
        }

        return (posts, nextCursor);
    }

    public async Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsByCategoryAsync(PostCategory category, string? cursor, int limit = 10)
    {
        var query = _context.Posts
            .AsNoTracking()
            .Include(p => p.Author)
            .Where(p => p.Category == category)
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .AsQueryable();

        if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var cursorId))
        {
            var cursorPost = await _context.Posts.AsNoTracking()
                .Where(p => p.Id == cursorId)
                .Select(p => new { p.Id, p.CreatedAt })
                .FirstOrDefaultAsync();

            if (cursorPost != null)
                query = query.Where(p => p.CreatedAt < cursorPost.CreatedAt ||
                                        (p.CreatedAt == cursorPost.CreatedAt && p.Id < cursorId));
        }

        var posts = await query.Take(limit + 1).ToListAsync();
        string? nextCursor = null;
        if (posts.Count > limit)
        {
            nextCursor = posts[limit].Id.ToString();
            posts = posts.Take(limit).ToList();
        }

        return (posts, nextCursor);
    }

    public async Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsByUserAsync(string userId, string? cursor, int limit = 10)
    {
        var query = _context.Posts
            .AsNoTracking()
            .Include(p => p.Author)
            .Where(p => p.AuthorId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .AsQueryable();

        if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var cursorId))
        {
            var cursorPost = await _context.Posts.AsNoTracking()
                .Where(p => p.Id == cursorId)
                .Select(p => new { p.Id, p.CreatedAt })
                .FirstOrDefaultAsync();

            if (cursorPost != null)
                query = query.Where(p => p.CreatedAt < cursorPost.CreatedAt ||
                                        (p.CreatedAt == cursorPost.CreatedAt && p.Id < cursorId));
        }

        var posts = await query.Take(limit + 1).ToListAsync();
        string? nextCursor = null;
        if (posts.Count > limit)
        {
            nextCursor = posts[limit].Id.ToString();
            posts = posts.Take(limit).ToList();
        }

        return (posts, nextCursor);
    }

    public async Task<Post?> GetPostWithDetailsAsync(int postId)
    {
        return await _context.Posts
            .AsNoTracking()
            .Include(p => p.Author)
            .Include(p => p.Comments).ThenInclude(c => c.User).OrderByDescending(c => c.CreatedAt)
            .Include(p => p.Reactions)
            .Include(p => p.Tag)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == postId);
    }

    /// <summary>
    /// Gets posts with pre-aggregated reaction and comment counts in a single query.
    /// Eliminates N+1 problem where MapToDto was counting reactions in-memory.
    /// </summary>
    public async Task<(IEnumerable<PostWithCounts> Posts, string? NextCursor)> GetPostsWithCountsAsync(
        string? cursor, int limit = 10, PostCategory? category = null, string? userId = null)
    {
        // Get post IDs first (with cursor pagination)
        var postQuery = _context.Posts
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .AsQueryable();

        if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var cursorId))
        {
            var cursorPost = await _context.Posts.AsNoTracking()
                .Where(p => p.Id == cursorId)
                .Select(p => new { p.Id, p.CreatedAt })
                .FirstOrDefaultAsync();

            if (cursorPost != null)
                postQuery = postQuery.Where(p => p.CreatedAt < cursorPost.CreatedAt ||
                                                (p.CreatedAt == cursorPost.CreatedAt && p.Id < cursorId));
        }

        if (category.HasValue)
            postQuery = postQuery.Where(p => p.Category == category.Value);

        if (!string.IsNullOrEmpty(userId))
            postQuery = postQuery.Where(p => p.AuthorId == userId);

        var postIds = await postQuery.Take(limit + 1).Select(p => p.Id).ToListAsync();

        string? nextCursor = null;
        if (postIds.Count > limit)
        {
            nextCursor = postIds[limit].ToString();
            postIds = postIds.Take(limit).ToList();
        }

        if (!postIds.Any())
            return (Enumerable.Empty<PostWithCounts>(), (string?)null);

        // Single query to get all posts with author and pre-aggregated counts
        var postsWithCounts = await _context.Posts
            .AsNoTracking()
            .Where(p => postIds.Contains(p.Id))
            .Include(p => p.Author)
            .Include(p => p.Comments)
            .Include(p => p.Reactions)
            .AsSplitQuery()
            .ToListAsync();

        // Build lookup dictionaries for O(1) access
        var reactionCounts = await _context.Reactions
            .AsNoTracking()
            .Where(r => postIds.Contains(r.PostId))
            .GroupBy(r => new { r.PostId, r.Type })
            .Select(g => new { g.Key.PostId, g.Key.Type, Count = g.Count() })
            .ToListAsync();

        var userReactions = userId != null
            ? await _context.Reactions
                .AsNoTracking()
                .Where(r => postIds.Contains(r.PostId) && r.UserId == userId)
                .ToDictionaryAsync(r => r.PostId, r => r.Type)
            : new Dictionary<int, ReactionType>();

        // Build result with pre-computed counts
        var result = postsWithCounts.Select(p =>
        {
            var countsForPost = reactionCounts.Where(r => r.PostId == p.Id).ToList();
            return new PostWithCounts
            {
                Post = p,
                LikeCount = countsForPost.FirstOrDefault(r => r.Type == ReactionType.Like)?.Count ?? 0,
                LoveCount = countsForPost.FirstOrDefault(r => r.Type == ReactionType.Love)?.Count ?? 0,
                PrayCount = countsForPost.FirstOrDefault(r => r.Type == ReactionType.Pray)?.Count ?? 0,
                CommentCount = p.Comments?.Count ?? 0,
                UserReaction = userReactions.TryGetValue(p.Id, out var ur) ? ur : (ReactionType?)null
            };
        })
        .OrderByDescending(p => p.Post.CreatedAt)
        .ThenByDescending(p => p.Post.Id)
        .ToList();

        return (result, nextCursor);
    }
}
