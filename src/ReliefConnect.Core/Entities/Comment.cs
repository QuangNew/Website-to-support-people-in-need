namespace ReliefConnect.Core.Entities;

/// <summary>
/// Comment on a social post (REQ-SOC-02).
/// Supports soft-delete: hidden comments are invisible to normal users for 30 days before permanent deletion.
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

    /// <summary>Admin who hid the comment.</summary>
    public string? HiddenByAdminId { get; set; }

    // Foreign keys
    public int PostId { get; set; }
    public Post Post { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;
}
