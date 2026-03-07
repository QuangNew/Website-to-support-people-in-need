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
        return await _context.Posts.FindAsync(id);
    }

    public async Task<IEnumerable<Post>> GetAllAsync()
    {
        return await _context.Posts
            .Include(p => p.Author)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
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
        var entity = await _context.Posts.FindAsync(id);
        if (entity != null)
        {
            _context.Posts.Remove(entity);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsAsync(string? cursor, int limit = 10)
    {
        var query = _context.Posts
            .Include(p => p.Author)
            .Include(p => p.Comments)
            .Include(p => p.Reactions)
            .OrderByDescending(p => p.CreatedAt)
            .AsQueryable();

        if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var cursorId))
        {
            var cursorPost = await _context.Posts.FindAsync(cursorId);
            if (cursorPost != null)
                query = query.Where(p => p.CreatedAt < cursorPost.CreatedAt || (p.CreatedAt == cursorPost.CreatedAt && p.Id < cursorId));
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
            .Include(p => p.Author)
            .Include(p => p.Comments)
            .Include(p => p.Reactions)
            .Where(p => p.Category == category)
            .OrderByDescending(p => p.CreatedAt)
            .AsQueryable();

        if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var cursorId))
        {
            var cursorPost = await _context.Posts.FindAsync(cursorId);
            if (cursorPost != null)
                query = query.Where(p => p.CreatedAt < cursorPost.CreatedAt || (p.CreatedAt == cursorPost.CreatedAt && p.Id < cursorId));
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
            .Include(p => p.Author)
            .Include(p => p.Comments)
            .Include(p => p.Reactions)
            .Where(p => p.AuthorId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .AsQueryable();

        if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var cursorId))
        {
            var cursorPost = await _context.Posts.FindAsync(cursorId);
            if (cursorPost != null)
                query = query.Where(p => p.CreatedAt < cursorPost.CreatedAt || (p.CreatedAt == cursorPost.CreatedAt && p.Id < cursorId));
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
            .Include(p => p.Author)
            .Include(p => p.Comments).ThenInclude(c => c.User)
            .Include(p => p.Reactions)
            .Include(p => p.Tag)
            .FirstOrDefaultAsync(p => p.Id == postId);
    }
}
