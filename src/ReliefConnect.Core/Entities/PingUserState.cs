namespace ReliefConnect.Core.Entities;

/// <summary>
/// Per-user SOS attention state: viewed and pinned markers.
/// </summary>
public class PingUserState
{
    public int Id { get; set; }

    public int PingId { get; set; }
    public Ping Ping { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    public DateTime? ViewedAt { get; set; }
    public bool IsPinned { get; set; }
    public DateTime? PinnedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
