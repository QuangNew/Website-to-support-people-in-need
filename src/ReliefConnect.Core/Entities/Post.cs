using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Social network post (REQ-SOC-01).
/// Supports text content, images, and categorization.
/// </summary>
public class Post
{
    public int Id { get; set; }

    public string Content { get; set; } = string.Empty;

    /// <summary>Image URL (allowed: .jpg, .png, .jpeg, max 5MB)</summary>
    public string? ImageUrl { get; set; }

    public PostCategory Category { get; set; }

    /// <summary>FK to Tag (CategoryID in class diagram)</summary>
    public int? CategoryId { get; set; }
    public Tag? Tag { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Foreign keys
    public string AuthorId { get; set; } = string.Empty;
    public ApplicationUser Author { get; set; } = null!;

    // Navigation
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
}
