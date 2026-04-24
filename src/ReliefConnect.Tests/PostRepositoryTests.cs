using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Infrastructure.Data;
using ReliefConnect.Infrastructure.Repositories;

namespace ReliefConnect.Tests;

public class PostRepositoryTests
{
    [Fact]
    public async Task GetPostsWithCountsAsync_excludes_hidden_comments_from_comment_count()
    {
        await using var context = CreateContext();
        var user = CreateUser("user-1", "author1@example.com");
        var post = CreatePost(1, user.Id, DateTime.UtcNow.AddHours(-2));

        context.Users.Add(user);
        context.Posts.Add(post);
        context.Comments.AddRange(
            CreateComment(1, post.Id, user.Id, DateTime.UtcNow.AddHours(-1), isHidden: false),
            CreateComment(2, post.Id, user.Id, DateTime.UtcNow.AddMinutes(-30), isHidden: true));
        await context.SaveChangesAsync();

        var repository = new PostRepository(context);
        var (posts, _) = await repository.GetPostsWithCountsAsync(null, limit: 10);

        var loadedPost = Assert.Single(posts);
        Assert.Equal(1, loadedPost.CommentCount);
    }

    [Fact]
    public async Task GetPostsWithCountsAsync_sorts_recent_comment_using_only_visible_comments()
    {
        await using var context = CreateContext();
        var user = CreateUser("user-2", "author2@example.com");
        var olderPost = CreatePost(1, user.Id, DateTime.UtcNow.AddHours(-4));
        var newerVisiblePost = CreatePost(2, user.Id, DateTime.UtcNow.AddHours(-3));

        context.Users.Add(user);
        context.Posts.AddRange(olderPost, newerVisiblePost);
        context.Comments.AddRange(
            CreateComment(1, olderPost.Id, user.Id, DateTime.UtcNow.AddHours(-2), isHidden: false),
            CreateComment(2, olderPost.Id, user.Id, DateTime.UtcNow.AddMinutes(-5), isHidden: true),
            CreateComment(3, newerVisiblePost.Id, user.Id, DateTime.UtcNow.AddMinutes(-30), isHidden: false));
        await context.SaveChangesAsync();

        var repository = new PostRepository(context);
        var (posts, _) = await repository.GetPostsWithCountsAsync(null, limit: 10, sort: "recentComment");

        var orderedIds = posts.Select(p => p.Post.Id).ToList();
        Assert.Equal(new[] { newerVisiblePost.Id, olderPost.Id }, orderedIds);
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        var context = new AppDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    private static ApplicationUser CreateUser(string id, string email)
        => new()
        {
            Id = id,
            UserName = email.Split('@')[0],
            Email = email,
            FullName = "Test Author",
            Role = RoleEnum.Guest,
            VerificationStatus = VerificationStatus.None,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };

    private static Post CreatePost(int id, string authorId, DateTime createdAt)
        => new()
        {
            Id = id,
            AuthorId = authorId,
            Content = $"Post {id}",
            Category = PostCategory.Livelihood,
            CreatedAt = createdAt
        };

    private static Comment CreateComment(int id, int postId, string userId, DateTime createdAt, bool isHidden)
        => new()
        {
            Id = id,
            PostId = postId,
            UserId = userId,
            Content = $"Comment {id}",
            CreatedAt = createdAt,
            IsHidden = isHidden,
            HiddenAt = isHidden ? createdAt : null,
            HiddenUntil = isHidden ? createdAt.AddDays(30) : null
        };
}