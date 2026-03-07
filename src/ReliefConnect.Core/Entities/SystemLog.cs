namespace ReliefConnect.Core.Entities;

/// <summary>
/// System log entry for audit trail (SRS Section 8).
/// Tracks critical actions: Login, Posting, Deleting Posts.
/// </summary>
public class SystemLog
{
    public int Id { get; set; }

    public string Action { get; set; } = string.Empty;

    public string? Details { get; set; }

    public string? UserId { get; set; }

    public string? UserName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
