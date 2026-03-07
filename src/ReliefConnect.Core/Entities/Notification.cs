namespace ReliefConnect.Core.Entities;

/// <summary>
/// User notification for real-time alerts.
/// </summary>
public class Notification
{
    public int Id { get; set; }

    public string MessageText { get; set; } = string.Empty;

    public bool IsRead { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Foreign keys
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;
}
