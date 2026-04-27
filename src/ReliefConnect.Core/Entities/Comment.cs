namespace ReliefConnect.Core.Entities;

/// <summary>
/// Comment on a social post (REQ-SOC-02).
/// Supports admin moderation with configurable hide duration and optional private notification.
/// </summary>
public class Comment
{
    public int Id { get; set; }

    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Whether this comment has been hidden (soft-deleted) by an admin.</summary>
    public bool IsHidden { get; set; }

    /// <summary>When the comment was hidden. Null if not hidden. Used for 30-day cleanup.</summary>
    public DateTime? HiddenAt { get; set; }

    /// <summary>When the comment should be permanently deleted. Null means hidden indefinitely.</summary>
    public DateTime? HiddenUntil { get; set; }

    /// <summary>Admin who hid the comment.</summary>
    public string? HiddenByAdminId { get; set; }

    /// <summary>Moderation reason shown to admins and optionally to the comment author.</summary>
    public string? HiddenReason { get; set; }

    /// <summary>Whether the author received a private notification about the hide action.</summary>
    public bool UserWasNotified { get; set; }

    // Foreign keys
    public int PostId { get; set; }
    public Post Post { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    public int? ParentCommentId { get; set; }
    public Comment? ParentComment { get; set; }
    public ICollection<Comment> Replies { get; set; } = new List<Comment>();
}
