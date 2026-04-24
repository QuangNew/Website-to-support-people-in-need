namespace ReliefConnect.Core.Entities;

/// <summary>
/// System log entry for audit trail (SRS Section 8).
/// Tracks critical actions: Login, Posting, Deleting Posts.
/// Supports parent-child hierarchy for batch operations via BatchId + ParentLogId.
/// </summary>
public class SystemLog
{
    public int Id { get; set; }

    public string Action { get; set; } = string.Empty;

    public string? Details { get; set; }

    public string? UserId { get; set; }

    public string? UserName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Groups related log entries from a single batch operation.</summary>
    public Guid? BatchId { get; set; }

    /// <summary>Points to the parent (summary) log entry. Null for parent/standalone logs.</summary>
    public int? ParentLogId { get; set; }

    // Navigation properties for parent-child hierarchy
    public SystemLog? ParentLog { get; set; }
    public ICollection<SystemLog> ChildLogs { get; set; } = [];
}
