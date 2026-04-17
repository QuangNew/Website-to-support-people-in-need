namespace ReliefConnect.Core.Entities;

/// <summary>
/// Tracks community guideline violations for comments/posts.
/// Used for the 3-strike warning system: 3 violations = permanent ban.
/// </summary>
public class ContentViolation
{
    public int Id { get; set; }

    /// <summary>User who committed the violation.</summary>
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    /// <summary>Comment that triggered the violation (null if post-level).</summary>
    public int? CommentId { get; set; }
    public Comment? Comment { get; set; }

    /// <summary>The violating content (preserved for audit trail).</summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>Reason the content was flagged (e.g., "Profanity", "Hate speech").</summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>Which violation number this is for the user (1, 2, or 3).</summary>
    public int StrikeNumber { get; set; }

    /// <summary>Whether the system auto-detected this (true) or admin manually flagged (false).</summary>
    public bool IsAutoDetected { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
