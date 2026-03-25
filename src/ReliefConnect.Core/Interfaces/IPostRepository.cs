using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Interfaces;

public interface IPostRepository : IRepository<Post>
{
    Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsAsync(string? cursor, int limit = 10);
    Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsByCategoryAsync(PostCategory category, string? cursor, int limit = 10);
    Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsByUserAsync(string userId, string? cursor, int limit = 10);
    Task<Post?> GetPostWithDetailsAsync(int postId);

    /// <summary>
    /// Gets posts with pre-aggregated reaction and comment counts.
    /// More efficient than GetPostsAsync when you need counts for each post.
    /// </summary>
    Task<(IEnumerable<PostWithCounts> Posts, string? NextCursor)> GetPostsWithCountsAsync(
        string? cursor, int limit = 10, PostCategory? category = null, string? userId = null);
}

/// <summary>
/// DTO for posts with pre-computed reaction and comment counts.
/// </summary>
public class PostWithCounts
{
    public Post Post { get; set; } = null!;
    public int LikeCount { get; set; }
    public int LoveCount { get; set; }
    public int PrayCount { get; set; }
    public int CommentCount { get; set; }
    public ReactionType? UserReaction { get; set; }
}
