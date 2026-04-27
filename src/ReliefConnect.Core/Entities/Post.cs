using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Social network post (REQ-SOC-01).
/// Supports text content, images, and categorization.
/// Supports soft-delete: deleted posts are kept for 7 days for restore capability.
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

    /// <summary>Whether this post is pinned by admin to the top of feeds.</summary>
    public bool IsPinned { get; set; }

    /// <summary>Whether this post has been soft-deleted. Restorable within 7 days.</summary>
    public bool IsDeleted { get; set; }

    /// <summary>When the post was soft-deleted. Null if not deleted.</summary>
    public DateTime? DeletedAt { get; set; }

    /// <summary>Admin who deleted the post (null if author self-deleted).</summary>
    public string? DeletedByAdminId { get; set; }

    public string? DeletedReason { get; set; }

    public bool IsApproved { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovedByAdminId { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectedByAdminId { get; set; }
    public string? RejectionReason { get; set; }

    // Foreign keys
    public string AuthorId { get; set; } = string.Empty;
    public ApplicationUser Author { get; set; } = null!;

    // Navigation
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
}
