using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Interfaces;

public interface IPostRepository : IRepository<Post>
{
    Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsAsync(string? cursor, int limit = 10);
    Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsByCategoryAsync(PostCategory category, string? cursor, int limit = 10);
    Task<(IEnumerable<Post> Posts, string? NextCursor)> GetPostsByUserAsync(string userId, string? cursor, int limit = 10);
    Task<Post?> GetPostWithDetailsAsync(int postId);
}
